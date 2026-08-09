import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { newsletterSubscribeSchema } from "@/features/newsletter/schema";
import { buildNewsletterWelcomeEmail } from "@/features/newsletter/service";
import { sendEmail } from "@/shared/lib/resend/send-email";
import { getSiteUrl } from "@/shared/lib/auth/redirect-url";
import {
    applyAutomaticCooldownRule,
    assessAntiAbuseSubmission,
    buildAntiAbuseGenericSuccessMessage,
    extractAntiAbuseRequestContext,
    persistAntiAbuseEvent,
} from "@/shared/lib/anti-abuse/server";
import { subscribeNewsletterContact } from "@/features/newsletter/service";
import { getUnlockRemainingForTool, mintUnlockGrant } from "@/features/tools/shared/unlock-grant";
import {
    buildAntiAbuseAnalyticsSummary,
    hashEmailForAnalytics,
} from "@/features/analytics/privacy";
import { recordNewsletterBusinessEvent } from "@/features/business-spine/recorders";
import type { Database } from "@/shared/lib/supabase/database.types";
import { inspectBoundedMetadata, readBoundedJson } from "@/shared/lib/public-request";
import { lookupActivePublicWorkspaceByDomain, resolvePublicWorkspace } from "@/shared/lib/public-workspace";

function getServiceClientConfig() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("[newsletter] Missing required Supabase service environment variables.");
        return null;
    }

    return { supabaseUrl, serviceRoleKey };
}

export async function POST(req: NextRequest) {
    try {
        const body = await readBoundedJson(req, 32 * 1024);
        if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
        const parsed = newsletterSubscribeSchema.safeParse(body.value);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "A valid email address is required." },
                { status: 400 }
            );
        }

        const { email, website, formStartedAt, templateId, source: sourceOverride, firstName, grantUnlock, metadata } = parsed.data;
        if (!inspectBoundedMetadata(metadata, { maxDepth: 4, maxEntries: 80, maxBytes: 8 * 1024 }).ok) {
            return NextResponse.json({ error: "Newsletter metadata is too complex." }, { status: 413 });
        }

        const serviceClientConfig = getServiceClientConfig();
        if (!serviceClientConfig) {
            return NextResponse.json(
                { error: "Newsletter subscriptions are temporarily unavailable." },
                { status: 503 },
            );
        }

        const serviceClient = createServiceClient<Database>(
            serviceClientConfig.supabaseUrl,
            serviceClientConfig.serviceRoleKey,
            { auth: { persistSession: false, autoRefreshToken: false } }
        );
        let workspace;
        try {
            workspace = await resolvePublicWorkspace({
                requestHost: req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? req.nextUrl.host,
                expectedTemplateId: templateId,
                lookupByDomain: (domain) => lookupActivePublicWorkspaceByDomain(serviceClient, domain),
            });
        } catch {
            return NextResponse.json({ error: "Newsletter form does not match this site." }, { status: 409 });
        }
        const antiAbuseInput = {
            surface: "newsletter_subscribe" as const,
            sourcePath: "/api/newsletter/subscribe",
            workspaceId: workspace.id,
            email,
            honeypotValue: website,
            formStartedAt: formStartedAt ?? null,
            contentSummary: email,
            metadata: {},
            context: extractAntiAbuseRequestContext(req.headers),
        };
        const antiAbuse = await assessAntiAbuseSubmission({
            supabaseAdmin: serviceClient,
            input: antiAbuseInput,
        });

        await persistAntiAbuseEvent({
            supabaseAdmin: serviceClient,
            assessment: antiAbuse,
            input: antiAbuseInput,
        });

        if (antiAbuse.triggerCooldown) {
            await applyAutomaticCooldownRule({
                supabaseAdmin: serviceClient,
                assessment: antiAbuse,
                input: antiAbuseInput,
            });
        }

        if (antiAbuse.decision === "block") {
            return NextResponse.json(
                { message: buildAntiAbuseGenericSuccessMessage("newsletter_subscribe") },
                { status: 200 },
            );
        }

        if (antiAbuse.decision === "throttle") {
            return NextResponse.json(
                { error: "Too many requests. Please wait a bit before subscribing again." },
                { status: 429 }
            );
        }

        let subscription;
        try {
            subscription = await subscribeNewsletterContact({
                email,
                workspaceId: workspace.id,
                // Allow the public client to override the attribution string
                // (e.g. the popup host sends "popup_<id>"). Falls back to the
                // generic public_form label so legacy callers stay unchanged.
                source: sourceOverride || "public_form",
                locale: null,
                firstName: firstName ?? null,
                metadata: metadata ?? null,
            });
        } catch (subscriptionError) {
            console.error("[newsletter] Subscribe error:", subscriptionError);
            return NextResponse.json(
                { error: "Could not subscribe. Please try again later." },
                { status: 500 }
            );
        }

        const analyticsClient = serviceClient as unknown as { from: (table: string) => { insert: (payload: unknown) => Promise<unknown> } };

        // Attribute the subscription to wherever it was triggered from
        // (popup on /, inline blog form, footer, /newsletter page itself).
        // The Referer header is the cheapest reliable signal; fall back to
        // /newsletter so the row is never null in legacy clients.
        const refererHeader = req.headers.get("referer");
        let analyticsPath = "/newsletter";
        if (refererHeader) {
            try {
                analyticsPath = new URL(refererHeader).pathname || "/newsletter";
            } catch {
                // Malformed Referer — fall back silently.
            }
        }

        await analyticsClient.from("analytics_events").insert({
            event_type: "newsletter_subscribe",
            event_name: "newsletter_subscribe",
            path: analyticsPath,
            page_slug: "newsletter",
            workspace_id: subscription.workspaceId,
            metadata: {
                emailHash: hashEmailForAnalytics(email),
                subscriberId: subscription.contact.id,
                contactId: subscription.contact.id,
                audienceId: subscription.audience.id,
                source: sourceOverride || "public_form",
                locale: null,
                consentState: subscription.requiresConfirmation ? "pending_double_opt_in" : "subscribed",
                requiresConfirmation: subscription.requiresConfirmation,
                ...buildAntiAbuseAnalyticsSummary(antiAbuse),
                grantUnlockTool: grantUnlock?.tool ?? null,
            },
        });

        await recordNewsletterBusinessEvent({
            supabase: serviceClient,
            workspaceId: subscription.workspaceId,
            eventType: subscription.requiresConfirmation ? "subscribed" : "confirmed",
            contact: { email },
            contactId: subscription.contact.id,
            payload: {
                audienceId: subscription.audience.id,
                source: sourceOverride || "public_form",
                requiresConfirmation: subscription.requiresConfirmation,
            },
        });

        // Mint or reuse the tool-unlock grant + HttpOnly cookie when the
        // caller asked for one (typically the tool subscribe-to-unlock
        // modal). Best-effort: failing to mint the grant should NOT fail
        // the subscription itself.
        //
        // Reuse semantics: if this email already has an active (non-expired,
        // non-revoked) grant for this workspace, we reuse it instead of
        // minting a fresh one. Without that check, a visitor could
        // subscribe, exhaust their 3 unlocks, subscribe again with the same
        // email, and get 3 more — repeating indefinitely. Reusing means
        // the remaining count carries over, so re-subscribing is a no-op
        // for quota purposes.
        let unlockResult:
            | { granted: boolean; usesRemaining: number; reused?: boolean }
            | undefined;
        if (grantUnlock) {
            const minted = await mintUnlockGrant({
                email,
                workspaceId: subscription.workspaceId ?? null,
                source: `tool_modal:${grantUnlock.tool}`,
            });
            if (minted) {
                // Always query actual remaining — reused grants may be at 0
                // already, fresh grants are at the per-tool cap. Surfacing
                // the real number lets the client modal show "you have 0
                // runs left for this tool today" instead of falsely claiming
                // a brand-new 3.
                const usesRemaining = await getUnlockRemainingForTool(
                    minted.token,
                    grantUnlock.tool,
                );
                unlockResult = { granted: true, usesRemaining, reused: minted.reused };
            } else {
                unlockResult = { granted: false, usesRemaining: 0 };
            }
        }

        // Only send welcome email if confirmation is not required (double opt-in)
        if (!subscription.requiresConfirmation) {
            const fromEmail = process.env.NEWSLETTER_FROM_EMAIL?.trim() || "Newsletter <noreply@example.invalid>";
            try {
                await sendEmail({
                    from: fromEmail,
                    to: email,
                    subject: subscription.settings.welcomeSubject,
                    html: buildNewsletterWelcomeEmail({ siteUrl: getSiteUrl(), settings: subscription.settings }),
                    replyTo: subscription.settings.replyToEmail || undefined,
                });
            } catch (emailError) {
                console.error("[newsletter] Welcome email failed:", emailError);
            }
        }

        const message = subscription.requiresConfirmation
            ? "Please check your inbox to confirm your subscription."
            : "You're in! Welcome to the Systems Brief.";

        return NextResponse.json(
            {
                message,
                pending: subscription.requiresConfirmation,
                requiresConfirmation: subscription.requiresConfirmation,
                ...(unlockResult ? { unlock: unlockResult } : {}),
            },
            { status: 200 }
        );
    } catch (err) {
        console.error("[newsletter] Unexpected error:", err);
        return NextResponse.json(
            { error: "An unexpected error occurred." },
            { status: 500 }
        );
    }
}
