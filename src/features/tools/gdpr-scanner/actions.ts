"use server";

import { evaluateGdpr, gdprInputSchema, normalizeGdprResult, type GdprResult } from "./compute";
import { runWithToolGuardrails } from "../shared/action-wrapper";
import { saveToolLead, getScanCache, setScanCache } from "../shared/store";
import { safeFetchHtml } from "../shared/safe-fetch";
import { parseHtmlSignals } from "../shared/html-parser";
import type { ToolActionResult } from "../shared/types";

const CACHE_TTL_MINUTES = 60 * 4;

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

export interface GdprActionResponse {
    result: GdprResult;
    leadId: string | null;
    shareToken: string | null;
    fromCache: boolean;
}

export async function runGdprScanner(input: unknown): Promise<ToolActionResult<GdprActionResponse>> {
    const parsed = gdprInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid URL." };
    const data = parsed.data;

    const guarded = await runWithToolGuardrails({
        tool: "gdpr-cookie-scanner",
        guardrails: { website: data.website, formStartedAt: data.formStartedAt },
        contentSummary: data.url,
        sourcePath: "/tools/gdpr-cookie-scanner",
        resolveCached: async (context) => {
            let canonical: string;
            try { canonical = new URL(data.url).toString(); } catch { return { ok: false, error: "Invalid URL." }; }
            const cached = await getScanCache<GdprResult>("gdpr-cookie-scanner", canonical);
            if (!cached) return null;
            const result = normalizeGdprResult(cached.result);
            const saved = await saveToolLead({
                tool: "gdpr-cookie-scanner",
                payload: { ...data, url: canonical },
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return { ok: true, data: { result, leadId: saved?.id ?? null, shareToken: saved?.shareToken ?? null, fromCache: true } };
        },
        compute: async (context) => {
            let canonical: string;
            try { canonical = new URL(data.url).toString(); } catch { return { ok: false, error: "Invalid URL." }; }

            const fetched = await safeFetchHtml(data.url);
            if (!fetched.ok) return { ok: false, error: FRIENDLY_FETCH_ERRORS[fetched.error ?? "network_error"] ?? "Could not fetch URL." };

            const signals = parseHtmlSignals(fetched.body ?? "");
            const result = evaluateGdpr({ rawHtml: fetched.body ?? "", signals, finalUrl: fetched.finalUrl ?? data.url });
            await setScanCache({ tool: "gdpr-cookie-scanner", cacheKey: canonical, result, ttlMinutes: CACHE_TTL_MINUTES });

            const saved = await saveToolLead({
                tool: "gdpr-cookie-scanner",
                payload: data,
                result: result as unknown as Record<string, unknown>,
                context,
                shareable: true,
            });
            return { ok: true, data: { result, leadId: saved?.id ?? null, shareToken: saved?.shareToken ?? null, fromCache: false } };
        },
    });

    return guarded as ToolActionResult<GdprActionResponse>;
}
