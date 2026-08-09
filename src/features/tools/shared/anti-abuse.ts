"use server";

import { headers } from "next/headers";
import {
    applyAutomaticCooldownRule,
    assessAntiAbuseSubmission,
    extractAntiAbuseRequestContext,
    persistAntiAbuseEvent,
} from "@/shared/lib/anti-abuse/server";
import type { ToolSlug } from "./types";
import { getToolsServiceClient } from "./service-client";

/**
 * Strict anti-abuse pre-flight for every public tool action.
 *
 * Layers:
 *   1. Honeypot — `website` form field is rendered offscreen and invisible.
 *      Real users never touch it; bots that fill every input fail here.
 *   2. Dwell time — submissions faster than 2.5s after form mount are bots.
 *      Mounted timestamps come from the client as `formStartedAt` (ISO).
 *   3. User-agent — empty or obvious bot UAs are rejected outright.
 *   4. Shared anti-abuse pipeline — reuses `assessAntiAbuseSubmission` with
 *      the `newsletter_subscribe` surface so the IP-fingerprint rate-limit
 *      window is shared with the audit + newsletter forms. Bots can't sidestep
 *      the rate limit by switching from newsletter to a tool.
 *
 * Decisions:
 *   - `allow` → the action proceeds.
 *   - `block` / `throttle` → return a generic 429-style error to the user.
 *   - Honeypot trips behave like newsletter: we silently 200 with a generic
 *     message so bots can't probe.
 */

const MIN_DWELL_MS = 2500;

// Substring-match list of known scraper / automation UAs. Kept conservative —
// blocking too aggressively hurts honest power-users. Update as we observe
// abuse patterns in `anti_abuse_events`.
const BOT_UA_PATTERNS: RegExp[] = [
    /bot\b/i,
    /crawl/i,
    /spider/i,
    /scrape/i,
    /headlesschrome/i,
    /phantomjs/i,
    /puppeteer/i,
    /python-requests/i,
    /\bcurl\//i,
    /\bwget\//i,
    /go-http-client/i,
    /libwww/i,
    /httpclient/i,
    /okhttp/i,
];

export interface ToolAntiAbuseInput {
    tool: ToolSlug;
    /** Honeypot field value. Should be empty for real users. */
    website?: string | null;
    /** ISO timestamp from when the form mounted client-side. */
    formStartedAt?: string | null;
    /** Optional email if the action carries one (most tools don't). */
    email?: string | null;
    /** Short textual summary used by the shared anti-abuse spam-keyword filter. */
    contentSummary?: string | null;
    /** Slug of the active workspace template (for analytics + scoping). */
    templateId?: string | null;
    sourcePath: string;
}

export type ToolAntiAbuseDecision =
    | { ok: true }
    | { ok: false; reason: "honeypot" | "rate_limited" | "blocked" | "ua_bot"; userMessage: string; retryAfterSeconds?: number };

function looksLikeBotUserAgent(ua: string | null): boolean {
    if (!ua) return true; // missing UA is suspicious enough
    const trimmed = ua.trim();
    if (trimmed.length < 8) return true;
    return BOT_UA_PATTERNS.some((re) => re.test(trimmed));
}

export async function assessToolRequest(input: ToolAntiAbuseInput): Promise<ToolAntiAbuseDecision> {
    const headerStore = await headers();
    const context = extractAntiAbuseRequestContext(headerStore);
    const ua = context.userAgent;

    // 1. User-agent gate. Cheapest check; runs before any DB I/O.
    if (looksLikeBotUserAgent(ua)) {
        return {
            ok: false,
            reason: "ua_bot",
            userMessage: "Automated access isn't allowed on this surface. If you're a real user, please try again from a regular browser.",
        };
    }

    // 2. Dwell time. Reject if the form submitted faster than a human reads
    //    the first sentence.
    if (input.formStartedAt) {
        const startedAt = Date.parse(input.formStartedAt);
        if (!Number.isNaN(startedAt) && Date.now() - startedAt < MIN_DWELL_MS) {
            return {
                ok: false,
                reason: "blocked",
                userMessage: "Please take a moment to fill in the form before submitting.",
            };
        }
    }

    // 3. Hand off to the shared anti-abuse pipeline. Using
    //    `newsletter_subscribe` surface so the rate-limit + cooldown buckets
    //    are shared with the audit and newsletter forms — same pattern as
    //    src/app/api/audit/submit/route.ts. Tool slug is captured in metadata.
    const supabaseAdmin = getToolsServiceClient();
    if (!supabaseAdmin) {
        if (process.env.NODE_ENV === "production") {
            return {
                ok: false,
                reason: "blocked",
                userMessage: "Public tools are temporarily unavailable. Please try again later.",
            };
        }
        // If the service-role client isn't configured we fail open in development rather than
        // brick public tools, but we log loudly so monitoring picks it up.
        console.error("[tools.anti-abuse] service-role client missing — failing open in development. Configure SUPABASE_SERVICE_ROLE_KEY.");
        return { ok: true };
    }

    const antiAbuseInput = {
        surface: "newsletter_subscribe" as const,
        sourcePath: input.sourcePath,
        workspaceId: null,
        email: input.email ?? null,
        honeypotValue: input.website ?? null,
        formStartedAt: input.formStartedAt ?? null,
        contentSummary: input.contentSummary ?? null,
        metadata: {
            tool_slug: input.tool,
            template_id: input.templateId ?? null,
            origin: "public_tool",
        },
        context,
    };

    const assessment = await assessAntiAbuseSubmission({ supabaseAdmin, input: antiAbuseInput });

    // Persist every assessment so the admin abuse log surfaces tools traffic
    // next to newsletter / audit traffic. Non-fatal on failure.
    persistAntiAbuseEvent({ supabaseAdmin, assessment, input: antiAbuseInput }).catch((err) => {
        console.error("[tools.anti-abuse] persist failed", (err as Error).message);
    });

    if (assessment.triggerCooldown) {
        // Schedule automatic cooldown on the fingerprint / IP / email so a
        // bursty bot gets banned for the configured cooldown window across
        // all surfaces that share this anti-abuse pipeline.
        applyAutomaticCooldownRule({ supabaseAdmin, assessment, input: antiAbuseInput }).catch((err) => {
            console.error("[tools.anti-abuse] cooldown rule failed", (err as Error).message);
        });
    }

    if (assessment.reasons.includes("honeypot_triggered")) {
        // Mirror the newsletter pattern: generic success-style refusal so the
        // bot can't tell it tripped. The action callers should turn this into
        // a benign user-facing response.
        return {
            ok: false,
            reason: "honeypot",
            userMessage: "Submission received.",
        };
    }

    if (assessment.decision === "block") {
        return {
            ok: false,
            reason: "blocked",
            userMessage: "We've temporarily restricted this surface for your network. If this is unexpected, email hossam@isystem.ai.",
        };
    }

    if (assessment.decision === "throttle") {
        return {
            ok: false,
            reason: "rate_limited",
            userMessage: "Too many requests from your network. Please try again later.",
            retryAfterSeconds: 60 * 30,
        };
    }

    return { ok: true };
}
