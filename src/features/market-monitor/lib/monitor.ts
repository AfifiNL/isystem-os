import { createClient as createServiceClient } from "@supabase/supabase-js";
import { tavilyCountryForLocale, tavilySearch } from "@/shared/lib/ai/tavily";
import { createClient } from "@/shared/lib/supabase/server";
import type { MarketMonitorConfig, MonitorChangeType, MonitorScanSummary } from "../types";

const CHANGE_TYPE_RULES: Array<{
    keywords: string[];
    changeType: MonitorChangeType;
}> = [
    { keywords: ["price", "pricing", "cost", "plan", "tier", "subscription"], changeType: "pricing_signal" },
    { keywords: ["regulation", "compliance", "law", "policy", "gdpr", "legal"], changeType: "regulation_update" },
    { keywords: ["launch", "release", "announce", "new feature", "update"], changeType: "competitor_update" },
    { keywords: ["news", "report", "study", "research", "trend"], changeType: "industry_news" },
];

function classifyChangeType(title: string, snippet: string): MonitorChangeType {
    const text = `${title} ${snippet}`.toLowerCase();
    for (const rule of CHANGE_TYPE_RULES) {
        if (rule.keywords.some((kw) => text.includes(kw))) return rule.changeType;
    }
    return "new_page";
}

const TRACKING_PARAMS = new Set([
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "mc_cid", "mc_eid", "ref", "ref_src", "ref_url",
]);

// Canonicalize URLs so the upsert's `workspace_id,url` constraint actually
// catches the same page when source crawlers vary on trailing slashes, query
// param ordering, fragment anchors, or tracking params.
export function canonicalizeUrl(raw: string): string {
    try {
        const u = new URL(raw);
        u.hash = "";
        u.hostname = u.hostname.toLowerCase();
        for (const key of Array.from(u.searchParams.keys())) {
            if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
        }
        u.searchParams.sort();
        if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
            u.pathname = u.pathname.slice(0, -1);
        }
        return u.toString();
    } catch {
        return raw.trim();
    }
}

function sourceTrustTier(url: string): number {
    const TIER5 = ["docs.", "developer.", "platform."];
    const TIER4 = [".gov", ".edu", "blog."];
    const TIER3 = ["techcrunch.com", "theverge.com", "reuters.com", "bloomberg.com", "wired.com"];
    if (TIER5.some((p) => url.includes(p))) return 5;
    if (TIER4.some((p) => url.includes(p))) return 4;
    if (TIER3.some((p) => url.includes(p))) return 3;
    return 2;
}

type GenericSupabaseClient = ReturnType<typeof createServiceClient>;

interface SupabaseErrorLike {
    message: string;
}

interface MarketMonitorConfigTableClient {
    select: (columns: string) => {
        eq: (column: string, value: unknown) => {
            eq: (column: string, value: unknown) => {
                single: () => Promise<{ data: MarketMonitorConfig | null; error: SupabaseErrorLike | null }>;
            };
        };
    };
    update: (values: { last_run_at: string }) => {
        eq: (column: string, value: string) => Promise<unknown>;
    };
}

interface MarketMonitorResultsTableClient {
    upsert: (
        values: Array<Record<string, unknown>>,
        options: { onConflict: string; ignoreDuplicates: boolean },
    ) => {
        select: (columns: string) => Promise<{ data: Array<{ id: string }> | null; error: SupabaseErrorLike | null }>;
    };
}

function marketMonitorConfigTable(supabase: GenericSupabaseClient): MarketMonitorConfigTableClient {
    return supabase.from("workspace_market_monitor_config") as unknown as MarketMonitorConfigTableClient;
}

function marketMonitorResultsTable(supabase: GenericSupabaseClient): MarketMonitorResultsTableClient {
    return supabase.from("workspace_market_monitor_results") as unknown as MarketMonitorResultsTableClient;
}

async function getMarketMonitorSupabaseClient(): Promise<GenericSupabaseClient> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (url && serviceRoleKey) {
        return createServiceClient(url, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    return await createClient() as unknown as GenericSupabaseClient;
}

async function scanKeyword(
    keyword: string,
    competitorDomains: string[],
    authorityDomains: string[],
    country: string | undefined,
): Promise<Array<{ url: string; title: string; snippet: string; published_date?: string; changeType: MonitorChangeType; trustTier: number }>> {
    const includeDomains = [...competitorDomains, ...authorityDomains].slice(0, 10);

    const result = await tavilySearch({
        query: keyword,
        search_depth: "basic",
        topic: "news",
        time_range: "week",
        max_results: 5,
        ...(includeDomains.length > 0 ? { include_domains: includeDomains } : {}),
        country,
    });

    return result.results.map((r) => ({
        url: canonicalizeUrl(r.url),
        title: r.title,
        snippet: r.content.substring(0, 300),
        published_date: r.published_date,
        changeType: classifyChangeType(r.title, r.content),
        trustTier: sourceTrustTier(r.url),
    }));
}

export async function runMarketMonitorScan(workspaceId: string): Promise<MonitorScanSummary> {
    const supabase = await getMarketMonitorSupabaseClient();
    const scannedAt = new Date().toISOString();
    const errors: string[] = [];

    const { data: config, error: configError } = await marketMonitorConfigTable(supabase)
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("enabled", true)
        .single();

    if (configError || !config) {
        return { workspace_id: workspaceId, scanned_at: scannedAt, new_results: 0, errors: ["Monitor not configured or disabled"] };
    }

    const monitorConfig = config as MarketMonitorConfig;
    const keywords = monitorConfig.industry_keywords.slice(0, 5); // cap at 5 queries

    // Resolve the workspace's content locale so Tavily news searches favour
    // in-region sources for non-EN workspaces. Looked up once per scan, not
    // per-keyword, since locale is a workspace property.
    const { data: workspaceRow } = await (supabase as unknown as {
        from: (t: string) => {
            select: (c: string) => {
                eq: (c: string, v: string) => {
                    maybeSingle: () => Promise<{ data: { default_locale: string | null } | null }>;
                };
            };
        };
    })
        .from("workspaces")
        .select("default_locale")
        .eq("id", workspaceId)
        .maybeSingle();
    const monitorCountry = tavilyCountryForLocale(workspaceRow?.default_locale ?? null);

    const allFindings: Array<{
        url: string;
        title: string;
        snippet: string;
        published_date?: string;
        changeType: MonitorChangeType;
        trustTier: number;
    }> = [];

    for (const keyword of keywords) {
        try {
            const findings = await scanKeyword(
                keyword,
                monitorConfig.competitor_domains,
                monitorConfig.authority_domains,
                monitorCountry,
            );
            allFindings.push(...findings);
        } catch (err) {
            errors.push(`Keyword "${keyword}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    // Deduplicate by URL
    const deduped = Array.from(new Map(allFindings.map((f) => [f.url, f])).values());

    if (deduped.length === 0) {
        await marketMonitorConfigTable(supabase)
            .update({ last_run_at: scannedAt })
            .eq("id", monitorConfig.id);

        return { workspace_id: workspaceId, scanned_at: scannedAt, new_results: 0, errors };
    }

    const rows = deduped.map((f) => ({
        workspace_id: workspaceId,
        config_id: monitorConfig.id,
        url: f.url,
        title: f.title,
        snippet: f.snippet,
        change_type: f.changeType,
        trust_tier: f.trustTier,
        published_date: f.published_date ?? null,
        detected_at: scannedAt,
        read: false,
    }));

    const { data: inserted, error: insertError } = await marketMonitorResultsTable(supabase)
        .upsert(rows, { onConflict: "workspace_id,url", ignoreDuplicates: true })
        .select("id");

    if (insertError) errors.push(`Insert: ${insertError.message}`);

    await marketMonitorConfigTable(supabase)
        .update({ last_run_at: scannedAt })
        .eq("id", monitorConfig.id);

    return {
        workspace_id: workspaceId,
        scanned_at: scannedAt,
        new_results: inserted?.length ?? 0,
        errors,
    };
}
