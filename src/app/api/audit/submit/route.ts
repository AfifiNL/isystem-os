import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { auditSubmitSchema } from "@/features/audit/schema";
import { calculateAuditOutputs, sanitizeAuditInputs } from "@/features/audit/lib/calculations";
import { subscribeNewsletterContact } from "@/features/newsletter/service";
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
import { lookupActivePublicWorkspaceByDomain, resolvePublicWorkspace } from "@/shared/lib/public-workspace";

const AUDIT_SOURCE = "stealth_cto_audit";

// Split the user-supplied "Full Name" into first/last names by the first
// whitespace. Anything beyond the first token becomes the last name. Keeps
// "Mary van der Berg" intact instead of dropping suffixes.
function splitName(fullName: string): { firstName: string; lastName: string | null } {
    const trimmed = fullName.trim();
    const idx = trimmed.indexOf(" ");
    if (idx === -1) return { firstName: trimmed, lastName: null };
    return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1).trim() || null };
}

export async function POST(req: NextRequest) {
    try {
        const body = await readBoundedJson(req, 32 * 1024);
        if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
        const parsed = auditSubmitSchema.safeParse(body.value);

        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid submission." },
                { status: 400 },
            );
        }

        const { email, name, website, formStartedAt, templateId, locale, inputs } = parsed.data;

        const serviceClient = createServiceClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        );
        let workspace;
        try {
            workspace = await resolvePublicWorkspace({
                requestHost: req.headers.get("host") ?? req.headers.get("x-forwarded-host") ?? req.nextUrl.host,
                expectedTemplateId: templateId,
                lookupByDomain: (domain) => lookupActivePublicWorkspaceByDomain(serviceClient, domain),
            });
        } catch {
            return NextResponse.json({ error: "Audit form does not match this site." }, { status: 409 });
        }

        // Anti-abuse first. Identical configuration to the newsletter route so
        // we share rate-limit windows across both surfaces — bots can't get
        // around the newsletter limit by hammering the audit endpoint.
        const antiAbuseInput = {
            surface: "newsletter_subscribe" as const,
            sourcePath: "/api/audit/submit",
            workspaceId: workspace.id,
            email,
            honeypotValue: website,
            formStartedAt: formStartedAt ?? null,
            contentSummary: email,
            metadata: { source: AUDIT_SOURCE },
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
            // Generic success on hard-block so the bot can't probe whether it
            // tripped the filter. Calculator stays gated on the client because
            // we don't return an `unlocked` flag in this branch.
            return NextResponse.json(
                { message: buildAntiAbuseGenericSuccessMessage("newsletter_subscribe") },
                { status: 200 },
            );
        }

        if (antiAbuse.decision === "throttle") {
            return NextResponse.json(
                { error: "Too many requests. Please wait a moment and try again." },
                { status: 429 },
            );
        }

        const cleanInputs = sanitizeAuditInputs(inputs);
        const outputs = calculateAuditOutputs(cleanInputs);
        const { firstName, lastName } = splitName(name);

        let subscription: Awaited<ReturnType<typeof subscribeNewsletterContact>>;
        try {
            subscription = await subscribeNewsletterContact({
                email,
                workspaceId: workspace.id,
                source: AUDIT_SOURCE,
                locale: locale ?? null,
                firstName,
                lastName,
                metadata: {
                    event: "contact_subscribed",
                    source: AUDIT_SOURCE,
                    submitted_at: new Date().toISOString(),
                    contact: { name, email },
                    calculator_data: {
                        inputs: cleanInputs,
                        outputs,
                    },
                },
            });
        } catch (subscribeError) {
            console.error("[audit] subscribe failed:", subscribeError);
            return NextResponse.json(
                { error: "Could not save your results. Please try again." },
                { status: 500 },
            );
        }

        // Best-effort analytics. The lead is already saved at this point, so
        // any failure below must not surface as a 500 — the user has done
        // their part and the operator already has the metadata. Use a real
        // try/catch (not `.catch()` on the postgrest builder, which isn't a
        // true Promise and can throw synchronously when chained).
        try {
            await serviceClient.from("analytics_events").insert({
                event_type: "audit_submit",
                event_name: "stealth_cto_audit_submit",
                path: "/audit",
                page_slug: "audit",
                workspace_id: subscription.workspaceId,
                metadata: {
                    emailHash: hashEmailForAnalytics(email),
                    contactId: subscription.contact.id,
                    subscriberId: subscription.contact.id,
                    source: AUDIT_SOURCE,
                    locale: locale ?? null,
                    consentState: subscription.requiresConfirmation ? "pending_double_opt_in" : "subscribed",
                    requiresConfirmation: subscription.requiresConfirmation,
                    ...buildAntiAbuseAnalyticsSummary(antiAbuse),
                    combined_annual_savings: outputs.combined_annual_savings,
                },
            });
        } catch (analyticsError) {
            console.error("[audit] analytics insert failed:", analyticsError);
        }

        return NextResponse.json({ ok: true, outputs }, { status: 200 });
    } catch (err) {
        console.error("[audit] unexpected error:", err);
        return NextResponse.json(
            { error: "An unexpected error occurred." },
            { status: 500 },
        );
    }
}
