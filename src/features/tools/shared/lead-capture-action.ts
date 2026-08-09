"use server";

import { z } from "zod";
import { subscribeNewsletterContact } from "@/features/newsletter/service";
import { attachEmailToLead, type AttachedLeadContext } from "./store";
import { TOOL_REGISTRY } from "./registry";

const schema = z.object({
    leadId: z.string().uuid(),
    email: z.string().email().max(200),
    consent: z.boolean(),
    firstName: z.string().max(80).optional(),
    /** Templates that own this site (used to find the workspace for the subscription). */
    templateId: z.string().max(80).optional(),
    /** Public page context captured client-side for source-aware follow-up. */
    pagePath: z.string().max(240).optional(),
    pageUrl: z.string().max(500).optional(),
    ctaRef: z.string().max(120).optional(),
});

export interface AttachEmailResult {
    ok: boolean;
    error?: string;
}

function buildSubscribeMetadata(ctx: AttachedLeadContext, input: z.infer<typeof schema>) {
    const toolPath = `/tools/${ctx.tool}`;
    const bookingPath = "/booking";

    return {
        event: "contact_subscribed",
        source: `public_tool:${ctx.tool}`,
        sourceSurface: "public_tools",
        leadMagnet: "tool_result_report",
        submitted_at: new Date().toISOString(),
        tool_slug: ctx.tool,
        tool_label: TOOL_REGISTRY[ctx.tool]?.title.en ?? ctx.tool,
        cta_ref: input.ctaRef ?? `tools-${ctx.tool}-email-report`,
        conversion_path: {
            page_path: input.pagePath ?? toolPath,
            page_url: input.pageUrl ?? null,
            tool_path: toolPath,
            booking_path: bookingPath,
            referrer: ctx.referrer,
            utm: ctx.utm,
            share_token_present: Boolean(ctx.shareToken),
        },
        contact: { email: ctx.email, first_name: input.firstName ?? null },
        tool_result: {
            inputs: ctx.payload,
            outputs: ctx.result,
        },
    } satisfies Record<string, unknown>;
}

export async function attachEmailToToolLead(input: unknown): Promise<AttachEmailResult> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }
    if (!parsed.data.consent) {
        return { ok: false, error: "Please confirm you agree to receive the report." };
    }

    const res = await attachEmailToLead(parsed.data.leadId, parsed.data.email);
    if (!res.ok || !res.context) {
        return { ok: false, error: res.error ?? "Could not save email." };
    }

    // Subscribe through the same pipeline as /audit so any "contact_subscribed"
    // automation (welcome email, sales notification, dispatch jobs) fires for
    // tools too. Failure here is non-fatal — the lead is already saved.
    try {
        await subscribeNewsletterContact({
            email: res.context.email,
            templateId: parsed.data.templateId ?? null,
            source: `public_tool:${res.context.tool}`,
            locale: res.context.locale ?? null,
            firstName: parsed.data.firstName ?? null,
            lastName: null,
            metadata: buildSubscribeMetadata(res.context, parsed.data),
        });
    } catch (err) {
        console.error("[tools.lead-capture] subscribeNewsletterContact failed:", (err as Error).message);
    }

    return { ok: true };
}
