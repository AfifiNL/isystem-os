import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { getInquiryEmailPlan } from "@/features/communications/email-lifecycle";
import { dispatchTransactionalEmailJobsByIdempotencyKeys } from "@/features/communications/transactional-email";
import { buildInquiryAcknowledgement, buildManagerInquiryEmail } from "@/features/contact/emails";
import { contactSubmitSchema } from "@/features/contact/schema";
import {
    buildAtomicContactSubmission,
    getContactDeliveryDisposition,
    isContactSubmissionReplayConflict,
} from "@/features/contact/public-submission";
import { subscribeNewsletterContact } from "@/features/newsletter/service";
import { loadManagerRecipients } from "@/features/booking/lib/booking-emails";
import { recordContactBusinessEvent } from "@/features/business-spine/recorders";
import {
    applyAutomaticCooldownRule,
    assessAntiAbuseSubmission,
    buildAntiAbuseGenericSuccessMessage,
    extractAntiAbuseRequestContext,
    persistAntiAbuseEvent,
} from "@/shared/lib/anti-abuse/server";
import {
    buildAntiAbuseAnalyticsSummary,
    hashEmailForAnalytics,
} from "@/features/analytics/privacy";
import type { Database } from "@/shared/lib/supabase/database.types";
import { readBoundedJson } from "@/shared/lib/public-request";
import {
    lookupActivePublicWorkspaceByDomain,
    PublicWorkspaceResolutionError,
    resolvePublicWorkspace,
} from "@/shared/lib/public-workspace";

const CONTACT_SOURCE = "contact_form";

function getServiceClientConfig() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    return supabaseUrl && serviceRoleKey ? { supabaseUrl, serviceRoleKey } : null;
}

function normalizeConfiguredEmail(value: string | undefined): string | null {
    const configured = value?.trim();
    if (!configured) return null;
    const address = configured.match(/<([^<>]+)>/)?.[1] ?? configured;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim()) ? configured : null;
}

function getOperationalEmailConfig() {
    const fromEmail = normalizeConfiguredEmail(process.env.NEWSLETTER_FROM_EMAIL);
    const configuredReplyTo = process.env.NEWSLETTER_REPLY_TO_EMAIL?.trim();
    const replyToEmail = configuredReplyTo
        ? normalizeConfiguredEmail(configuredReplyTo)
        : null;
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (!fromEmail || (configuredReplyTo && !replyToEmail) || !configuredSiteUrl) {
        return null;
    }

    try {
        const siteUrl = new URL(configuredSiteUrl);
        if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
            return null;
        }
        return {
            fromEmail,
            replyToEmail: replyToEmail ?? undefined,
            siteUrl: siteUrl.toString().replace(/\/$/, ""),
        };
    } catch {
        return null;
    }
}

function splitName(fullName: string) {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    return { firstName, lastName: rest.join(" ") || null };
}

function successMessage(locale?: string | null, newsletterSubscriptionFailed = false) {
    if (locale === "nl") {
        return newsletterSubscriptionFailed
            ? "Uw bericht is ontvangen. De optionele nieuwsbriefinschrijving is niet gelukt; probeer die later apart opnieuw."
            : "Bedankt! Uw bericht is ontvangen. We nemen snel persoonlijk contact met u op.";
    }
    if (locale === "ar") {
        return newsletterSubscriptionFailed
            ? "تم استلام رسالتك. تعذر إكمال الاشتراك الاختياري في النشرة؛ يمكنك المحاولة لاحقًا بشكل منفصل."
            : "شكرًا لك! لقد استلمنا رسالتك وسنتواصل معك شخصيًا قريبًا.";
    }
    return newsletterSubscriptionFailed
        ? "Your inquiry was received. The optional newsletter signup did not complete; please retry it separately later."
        : "Thank you! Your message has been received. We will be in touch personally.";
}

export async function POST(req: NextRequest) {
    try {
        const body = await readBoundedJson(req, 32 * 1024);
        if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
        const parsed = contactSubmitSchema.safeParse(body.value);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid submission." },
                { status: 400 },
            );
        }

        const input = parsed.data;
        const config = getServiceClientConfig();
        if (!config) {
            return NextResponse.json({ error: "Contact submissions are temporarily unavailable." }, { status: 503 });
        }

        const emailConfig = getOperationalEmailConfig();
        if (!emailConfig) {
            return NextResponse.json({ error: "Contact submissions are temporarily unavailable." }, { status: 503 });
        }

        const serviceClient = createServiceClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        let workspace;
        try {
            workspace = await resolvePublicWorkspace({
                requestHost: req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? req.nextUrl.host,
                expectedTemplateId: input.templateId,
                lookupByDomain: (domain) => lookupActivePublicWorkspaceByDomain(serviceClient, domain),
            });
        } catch (error) {
            if (error instanceof PublicWorkspaceResolutionError) {
                const status = error.code === "template_mismatch" ? 409 : 404;
                return NextResponse.json({ error: "Contact form does not match this site." }, { status });
            }
            throw error;
        }

        const antiAbuseInput = {
            surface: "contact_inquiry" as const,
            sourcePath: "/api/contact/submit",
            workspaceId: workspace.id,
            email: input.email,
            honeypotValue: input.website,
            formStartedAt: input.formStartedAt ?? null,
            contentSummary: [input.name, input.company, input.challenge].filter(Boolean).join(" "),
            metadata: { source: CONTACT_SOURCE, requestType: input.requestType },
            context: extractAntiAbuseRequestContext(req.headers),
        };
        const antiAbuse = await assessAntiAbuseSubmission({ supabaseAdmin: serviceClient, input: antiAbuseInput });
        await persistAntiAbuseEvent({ supabaseAdmin: serviceClient, assessment: antiAbuse, input: antiAbuseInput });
        if (antiAbuse.triggerCooldown) {
            await applyAutomaticCooldownRule({ supabaseAdmin: serviceClient, assessment: antiAbuse, input: antiAbuseInput });
        }
        if (antiAbuse.decision === "block") {
            return NextResponse.json({ message: buildAntiAbuseGenericSuccessMessage("contact_inquiry") });
        }
        if (antiAbuse.decision === "throttle") {
            return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429 });
        }

        const plan = getInquiryEmailPlan({
            marketingConsent: input.marketingConsent,
            locale: input.locale,
        });
        const acknowledgement = buildInquiryAcknowledgement({
            locale: plan.customer.locale,
            workspaceName: workspace.name,
            customerName: input.name,
        });
        const managers = await loadManagerRecipients(serviceClient, workspace.id);
        const dashboardUrl = `${emailConfig.siteUrl}/dashboard/inbox`;
        const managerEmail = buildManagerInquiryEmail({
            workspaceName: workspace.name,
            name: input.name,
            email: input.email,
            company: input.company,
            phone: input.phone,
            requestType: input.requestType,
            timeline: input.timeline,
            challenge: input.challenge,
            dashboardUrl,
        });
        const atomicSubmission = buildAtomicContactSubmission({
            workspaceId: workspace.id,
            submissionId: input.submissionId,
            name: input.name,
            email: input.email,
            company: input.company,
            phone: input.phone,
            requestType: input.requestType,
            timeline: input.timeline,
            challenge: input.challenge,
            locale: plan.customer.locale,
            marketingConsent: input.marketingConsent,
            metadata: {
                source: CONTACT_SOURCE,
                antiAbuse: buildAntiAbuseAnalyticsSummary(antiAbuse),
            },
            fromEmail: emailConfig.fromEmail,
            customer: {
                eventType: plan.customer.event,
                locale: plan.customer.locale,
                replyToEmail: emailConfig.replyToEmail,
                subject: acknowledgement.subject,
                html: acknowledgement.html,
            },
            managers: managers.map((manager) => ({
                email: manager,
                eventType: plan.manager.event,
                locale: plan.manager.locale,
                replyToEmail: input.email,
                subject: managerEmail.subject,
                html: managerEmail.html,
            })),
        });
        const { data: submissionRows, error: submissionError } = await serviceClient.rpc(
            "submit_contact_inquiry_with_email_jobs",
            {
                p_workspace_id: workspace.id,
                p_submission_id: input.submissionId,
                p_submission_fingerprint: atomicSubmission.fingerprint,
                p_inquiry: atomicSubmission.inquiry,
                p_email_jobs: atomicSubmission.emailJobs,
            },
        );
        if (submissionError) {
            if (isContactSubmissionReplayConflict(submissionError)) {
                return NextResponse.json({ error: "Contact submission id was already used." }, { status: 409 });
            }
            throw new Error(submissionError.message);
        }
        const submission = submissionRows?.[0];
        if (!submission?.inquiry_id) {
            throw new Error("Contact submission RPC did not return the durable inquiry.");
        }
        const inquiry = { id: submission.inquiry_id };

        let delivery: { requested: number; delivered: number } | null = null;
        try {
            delivery = await dispatchTransactionalEmailJobsByIdempotencyKeys(
                workspace.id,
                atomicSubmission.emailJobKeys,
            );
        } catch (error) {
            console.error("[contact] Durable email dispatch deferred:", error);
        }
        const { deliveryDegraded, status: deliveryStatus } = getContactDeliveryDisposition(delivery);

        let newsletterContactId: string | null = null;
        let requiresConfirmation = false;
        let newsletterSubscriptionFailed = false;
        if (plan.subscribeToNewsletter) {
            try {
                const { firstName, lastName } = splitName(input.name);
                const subscription = await subscribeNewsletterContact({
                    email: input.email,
                    workspaceId: workspace.id,
                    source: CONTACT_SOURCE,
                    locale: input.locale,
                    firstName,
                    lastName,
                    metadata: { inquiry_id: inquiry.id, explicit_marketing_consent: true },
                });
                newsletterContactId = subscription.contact.id;
                requiresConfirmation = subscription.requiresConfirmation;
            } catch (error) {
                newsletterSubscriptionFailed = true;
                console.error("[contact] Optional newsletter subscription failed:", error);
            }
        }

        await recordContactBusinessEvent({
            supabase: serviceClient,
            workspaceId: workspace.id,
            inquiryId: inquiry.id,
            contact: { name: input.name, email: input.email, phone: input.phone },
            requestType: input.requestType,
            company: input.company,
            challenge: input.challenge,
            requiresConfirmation,
        });

        await serviceClient.from("analytics_events").insert({
            event_type: "contact_submit",
            event_name: "contact_submit",
            path: "/contact",
            page_slug: "contact",
            workspace_id: workspace.id,
            metadata: {
                emailHash: hashEmailForAnalytics(input.email),
                inquiryId: inquiry.id,
                subscriberId: newsletterContactId,
                marketingConsent: input.marketingConsent,
                requiresConfirmation,
                newsletterSubscriptionFailed,
                requestType: input.requestType,
                ...buildAntiAbuseAnalyticsSummary(antiAbuse),
            },
        });

        return NextResponse.json(
            {
                ok: true,
                accepted: true,
                deliveryDegraded,
                newsletterConfirmationPending: requiresConfirmation,
                newsletterSubscriptionFailed,
                message: successMessage(input.locale, newsletterSubscriptionFailed),
            },
            { status: deliveryStatus },
        );
    } catch (error) {
        console.error("[contact] unexpected error:", error);
        return NextResponse.json({ error: "Could not submit your message. Please try again." }, { status: 500 });
    }
}
