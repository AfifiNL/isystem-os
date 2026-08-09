import { assessToolRequest, type ToolAntiAbuseInput } from "./anti-abuse";
import { checkToolRateLimit, formatRateLimitError } from "./rate-limit";
import { getToolRequestContext } from "./request-context";
import { toolGuardrailsSchema, type ToolGuardrails } from "./guardrails";
import { tryConsumeUnlockForTool } from "./unlock-grant";
import type { ToolActionResult, ToolRequestContext, ToolSlug } from "./types";

export { toolGuardrailsSchema, type ToolGuardrails };

interface RunWithGuardrailsParams {
    tool: ToolSlug;
    /** Guardrail fields extracted from the parsed payload. */
    guardrails: ToolGuardrails;
    /** Optional summary string used by spam-keyword filtering. */
    contentSummary?: string | null;
    /** Source path stamped onto the abuse event. */
    sourcePath: string;
    /**
     * Optional fast path for URL-fetching tools. Runs after anti-abuse but
     * before rate-limit consumption so a cache hit can return without burning
     * the visitor's daily quota. It may still create attribution rows (lead +
     * share token) using the supplied request context.
     */
    resolveCached?: (context: ToolRequestContext) => Promise<ToolActionResult<unknown> | null>;
    /** The actual work — runs only after all guardrails pass. */
    compute: (context: ToolRequestContext) => Promise<ToolActionResult<unknown>>;
}

/**
 * Run a public tool action under the strict anti-abuse + rate-limit pipeline.
 *
 * Order of checks:
 *   1. Anti-abuse pre-flight (honeypot, dwell, UA, shared anti-abuse rules).
 *   2. Optional cache resolver (URL scanners only, no quota consumption).
 *   3. Per-IP+tool rate limit (daily=1, burst=1 — see DEFAULT_LIMITS).
 *   4. Compute callback — the tool's actual work.
 *
 * Any failed gate short-circuits with a user-safe error message; the compute
 * callback never runs and never consumes AI/DB resources.
 */
export async function runWithToolGuardrails(
    params: RunWithGuardrailsParams,
): Promise<ToolActionResult<unknown>> {
    const context = await getToolRequestContext();

    const antiAbuseInput: ToolAntiAbuseInput = {
        tool: params.tool,
        website: params.guardrails.website ?? null,
        formStartedAt: params.guardrails.formStartedAt ?? null,
        contentSummary: params.contentSummary ?? null,
        sourcePath: params.sourcePath,
    };

    const abuse = await assessToolRequest(antiAbuseInput);
    if (!abuse.ok) {
        return { ok: false, error: abuse.userMessage };
    }

    if (params.resolveCached) {
        const cached = await params.resolveCached(context);
        if (cached) return cached;
    }

    const rate = await checkToolRateLimit({ ipHash: context.ipHash, tool: params.tool });
    let unlockUsesRemaining: number | undefined;
    if (!rate.allow) {
        // The 1-per-IP-per-day cap was hit. Before returning an error,
        // check whether this browser has an active newsletter-unlock grant
        // with remaining uses for this tool. If yes, consume one and
        // proceed — the user already paid the email cost.
        const unlock = await tryConsumeUnlockForTool(params.tool);
        if (unlock.allowed) {
            unlockUsesRemaining = unlock.usesRemaining;
        } else {
            // No grant, exhausted, expired, or revoked. Tell the client to
            // open the subscribe-to-unlock modal. The cap-reached and
            // expired reasons are distinct enough that we could surface
            // copy variants in the future; today they share one CTA.
            return {
                ok: false,
                error: formatRateLimitError(rate, params.tool),
                requiresSubscription: true,
            };
        }
    }

    const result = await params.compute(context);
    if (result.ok && unlockUsesRemaining !== undefined) {
        return { ...result, unlockUsesRemaining };
    }
    return result;
}
