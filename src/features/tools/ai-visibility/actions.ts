"use server";

import { aiVisibilityInputSchema, evaluateAiVisibility, normalizeAiVisibilityResult, type AiVisibilityResult } from "./compute";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead, getScanCache, setScanCache } from "../shared/store";
import { safeFetchHtml } from "../shared/safe-fetch";
import { parseHtmlSignals } from "../shared/html-parser";
import type { ToolActionResult } from "../shared/types";
import { callPublicAi } from "../shared/ai";

const CACHE_TTL_MINUTES = 60 * 6;

const FRIENDLY_FETCH_ERRORS: Record<string, string> = {
    invalid_url: "That doesn't look like a valid URL.",
    scheme_not_allowed: "Only http:// and https:// URLs are supported.",
    private_address: "We can't scan local or internal addresses.",
    dns_failure: "Could not resolve that domain.",
    timeout: "The site took too long to respond.",
    too_large: "Page is too large to scan (over 2 MB).",
    bad_content_type: "URL didn't return an HTML page.",
    redirect_loop: "Too many redirects.",
    http_error: "The site returned an error status.",
    network_error: "Network error while reaching the site.",
};

export interface AiVisibilityActionResponse {
    result: AiVisibilityResult;
    leadId: string | null;
    shareToken: string | null;
    fromCache: boolean;
}

function canonicalAiVisibilityCacheKey(data: { url: string; brandName: string }) {
    const canonical = new URL(data.url).toString();
    return { canonical, cacheKey: `${canonical}|${data.brandName.toLowerCase()}` };
}

async function enrichWithAiProse(result: AiVisibilityResult, data: { brandName: string; industry: string; location?: string }) {
    const ai = await callPublicAi({
        purpose: "Summarize whether a public web page is citation-ready for AI search tools.",
        userContent: JSON.stringify({
            brandName: data.brandName,
            industry: data.industry,
            location: data.location ?? null,
            score: result.overallScore,
            readiness: result.citationReadiness,
            checks: result.checks.map((check) => ({
                id: check.id,
                label: check.label,
                status: check.status,
                detail: check.detail,
                impact: check.impact,
            })),
            deterministicFixes: result.topFixes,
        }),
        instructions: [
            "Write a concise, honest 2-paragraph assessment for a business owner.",
            "Then provide 3-5 top fixes as a JSON array.",
            "Return strict JSON only with this shape: {\"prose\": string, \"topFixes\": string[]}.",
            "Do not invent facts beyond the supplied checks.",
        ].join("\n"),
        maxOutputTokens: 420,
    });

    if (!ai.ok || !ai.text) return result;

    try {
        const cleaned = ai.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
        const parsed = JSON.parse(cleaned) as { prose?: unknown; topFixes?: unknown };
        return {
            ...result,
            prose: typeof parsed.prose === "string" && parsed.prose.trim().length > 0 ? parsed.prose.trim() : result.prose,
            topFixes: Array.isArray(parsed.topFixes)
                ? parsed.topFixes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5)
                : result.topFixes,
        } satisfies AiVisibilityResult;
    } catch {
        return {
            ...result,
            prose: ai.text.trim(),
        } satisfies AiVisibilityResult;
    }
}

export async function runAiVisibilityChecker(input: unknown): Promise<ToolActionResult<AiVisibilityActionResponse>> {
    const parsed = aiVisibilityInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const data = parsed.data;

    const guarded = await runWithToolGuardrails({
        tool: "ai-visibility-checker",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        contentSummary: `${data.brandName} ${data.url}`,
        sourcePath: "/tools/ai-visibility-checker",
        resolveCached: async (context) => {
            let canonical: string;
            let cacheKey: string;
            try {
                ({ canonical, cacheKey } = canonicalAiVisibilityCacheKey(data));
            } catch {
                return { ok: false, error: "Invalid URL." };
            }
            const cached = await getScanCache<AiVisibilityResult>("ai-visibility-checker", cacheKey);
            if (!cached) return null;
            const result = normalizeAiVisibilityResult(cached.result);
            const saved = await saveToolLead({
                tool: "ai-visibility-checker",
                payload: { ...data, url: canonical },
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return {
                ok: true,
                data: { result, leadId: saved?.id ?? null, shareToken: saved?.shareToken ?? null, fromCache: true },
            };
        },
        compute: async (context) => {
            let cacheKey: string;
            try {
                ({ cacheKey } = canonicalAiVisibilityCacheKey(data));
            } catch {
                return { ok: false, error: "Invalid URL." };
            }

            const fetched = await safeFetchHtml(data.url);
            if (!fetched.ok) {
                return { ok: false, error: FRIENDLY_FETCH_ERRORS[fetched.error ?? "network_error"] ?? "Could not fetch URL." };
            }

            const signals = parseHtmlSignals(fetched.body ?? "");
            const deterministic = evaluateAiVisibility({ input: data, signals, finalUrl: fetched.finalUrl ?? data.url });
            const result = await enrichWithAiProse(deterministic, data);
            await setScanCache({ tool: "ai-visibility-checker", cacheKey, result, ttlMinutes: CACHE_TTL_MINUTES });
            const saved = await saveToolLead({
                tool: "ai-visibility-checker",
                payload: data,
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return {
                ok: true,
                data: {
                    result,
                    leadId: saved?.id ?? null,
                    shareToken: saved?.shareToken ?? null,
                    fromCache: false,
                },
            };
        },
    });

    return guarded as ToolActionResult<AiVisibilityActionResponse>;
}
