import type { Json } from "@/shared/lib/supabase/database.types";
import { createClient } from "@/shared/lib/supabase/server";
import {
    extractKeywords,
    extractMarkdownLinks,
    extractVisualLayoutLinks,
    extractVisualLayoutText,
    resolveBuilderSignals,
} from "@/features/seo/lib/analysis";
import type { SeoContentAnalytics, SeoPublishedContentItem } from "@/features/seo/types";
import { isTrueConversionEvent } from "@/features/analytics/taxonomy";
import { asObjectRecord } from "@/features/seo/lib/workspace-access";
import type { Locale } from "@/features/templates/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import {
    aggregateSearchConsoleQuerySignals,
    type SeoQuerySignal,
    type SeoRawSearchConsoleRow,
} from "@/features/seo/lib/strategist-context";

type ContentInventoryRow = {
    id: string;
    title: string;
    slug: string;
    type: string;
    status: string;
    locale: string | null;
    content_markdown: string | null;
    visual_layout: unknown;
    metadata: unknown;
    created_at: string;
    updated_at: string;
};

type AnalyticsEventRow = {
    page_slug: string | null;
    event_type: string;
    event_name: string;
    created_at: string;
};

export async function fetchPublishedInventory(workspaceId: string, locale: Locale): Promise<SeoPublishedContentItem[]> {
    const supabase = await createClient();
    // Locale scoping rule:
    //   * type='blog' rows are single-language — filter by content_items.locale.
    //   * type='page' rows hold every locale inside visual_layout JSONB
    //     (LocaleField pattern); their `locale` column stays at the 'en'
    //     default and does not reflect the languages they actually serve.
    //     We pull every page row regardless and let the strategist treat
    //     them as locale-spanning landing pages.
    // Implemented as two queries instead of an `.or()` on locale to keep
    // the intent obvious for future readers.
    const [blogResult, pageResult] = await Promise.all([
        supabase
            .from("content_items")
            .select("id,title,slug,type,status,locale,content_markdown,visual_layout,metadata,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "published")
            .eq("type", "blog")
            .eq("locale", locale)
            .order("updated_at", { ascending: false }),
        supabase
            .from("content_items")
            .select("id,title,slug,type,status,locale,content_markdown,visual_layout,metadata,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "published")
            .eq("type", "page")
            .order("updated_at", { ascending: false }),
    ]);

    const error = blogResult.error ?? pageResult.error;
    const data = [...(blogResult.data ?? []), ...(pageResult.data ?? [])];

    if (error) {
        throw new Error(error.message ?? "Failed to fetch content inventory.");
    }

    return ((data ?? []) as ContentInventoryRow[]).map((row) => {
        const metadata = (row.metadata ?? null) as Json;
        const meta = asObjectRecord(metadata);
        const seo = asObjectRecord(meta.seo);
        const builderSignals = resolveBuilderSignals(metadata);
        const excerpt = typeof meta.excerpt === "string" ? meta.excerpt : "";
        const seoTitle = typeof seo.title === "string" ? seo.title : builderSignals.seoTitle;
        const seoDescription = typeof seo.description === "string" ? seo.description : builderSignals.seoDescription;
        const contentMarkdown = typeof row.content_markdown === "string" ? row.content_markdown : "";
        const visualLayout = (row.visual_layout ?? null) as Json;
        const visualLayoutText = extractVisualLayoutText(visualLayout, locale);
        // Unified outbound-link inventory: markdown-extracted slugs + builder anchor hrefs
        // (locale-stripped). The audit dedupe filter and the AST-level apply-time check now
        // operate on the same key space.
        const links = Array.from(new Set([
            ...extractMarkdownLinks(contentMarkdown),
            ...extractVisualLayoutLinks(visualLayout, locale),
        ]));

        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            type: row.type,
            status: row.status,
            locale: row.locale,
            contentMarkdown,
            visualLayoutText,
            excerpt,
            keywords: extractKeywords(metadata),
            links,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata,
            pageIntent: builderSignals.pageIntent,
            audienceType: builderSignals.audienceType,
            conversionGoal: builderSignals.conversionGoal,
            seoTitle,
            seoDescription,
        } satisfies SeoPublishedContentItem;
    });
}

export async function fetchAnalyticsSignals(workspaceId: string, days = 90): Promise<SeoContentAnalytics[]> {
    const supabase = await createClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from("analytics_events")
        .select("page_slug,event_type,event_name,created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);

    if (error) {
        throw new Error(error.message ?? "Failed to fetch analytics signals.");
    }

    const map = new Map<string, SeoContentAnalytics>();
    for (const row of (data ?? []) as AnalyticsEventRow[]) {
        const slug = typeof row.page_slug === "string" ? row.page_slug : null;
        if (!slug) continue;
        const current = map.get(slug) ?? { slug, pageViews: 0, conversions: 0, ctaClicks: 0, lastSeenAt: null };
        if (row.event_type === "page_view") current.pageViews += 1;
        if (row.event_type === "cta_click") current.ctaClicks += 1;
        if (isTrueConversionEvent(row.event_type, row.event_name)) current.conversions += 1;
        current.lastSeenAt = current.lastSeenAt && current.lastSeenAt > row.created_at ? current.lastSeenAt : row.created_at;
        map.set(slug, current);
    }

    return Array.from(map.values()).sort((a, b) => b.pageViews - a.pageViews);
}

export interface GscPageSummary {
    page: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
}

export async function fetchSearchConsoleSignals(workspaceId: string, days = 30): Promise<GscPageSummary[]> {
    const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    if (!siteUrl) {
        console.warn("GOOGLE_SEARCH_CONSOLE_SITE_URL is not set. GSC signals will be disabled/empty.");
        return [];
    }

    try {
        const supabase = await createClient();
        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from("gsc_page_daily_summary")
            .select("page_slug, total_impressions, total_clicks, avg_position, date")
            .eq("workspace_id", workspaceId)
            .eq("site_url", siteUrl)
            .gte("date", sinceDate)
            .limit(10000);

        if (error) {
            console.warn("GSC query failed or missing:", error.message);
            return [];
        }

        interface GscMappedPage {
            page: string;
            impressions: number;
            clicks: number;
            _sumPos: number;
        }
        const map = new Map<string, GscMappedPage>();
        for (const row of (data ?? [])) {
            const current = map.get(row.page_slug) ?? { page: row.page_slug, impressions: 0, clicks: 0, _sumPos: 0 };
            current.impressions += row.total_impressions;
            current.clicks += row.total_clicks;
            current._sumPos += (row.avg_position * row.total_impressions);
            map.set(row.page_slug, current);
        }

        return Array.from(map.values()).map(s => {
            const finalCtr = s.impressions > 0 ? s.clicks / s.impressions : 0;
            const finalPos = s.impressions > 0 ? s._sumPos / s.impressions : 0;
            return {
                page: s.page,
                impressions: s.impressions,
                clicks: s.clicks,
                ctr: finalCtr,
                position: finalPos
            } satisfies GscPageSummary;
        }).sort((a, b) => b.impressions - a.impressions);
    } catch (err) {
        console.error("fetchSearchConsoleSignals encountered an error:", err);
        return [];
    }
}

/**
 * Loads query-level GSC evidence from the raw daily table for the requested
 * window and locale. The rolled-up query table intentionally spans 90 days and
 * drops the original page URL, so it cannot truthfully power a locale-aware
 * "last 30 days" strategist or specialist run.
 */
export async function fetchFreshSearchConsoleQuerySignals(
    workspaceId: string,
    locale: Locale,
    days = 30,
    client?: SupabaseClient<Database>,
): Promise<SeoQuerySignal[]> {
    const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;
    if (!siteUrl) {
        return [];
    }

    const supabase = client ?? await createClient();
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows: SeoRawSearchConsoleRow[] = [];
    const pageSize = 1_000;
    const maxRows = 100_000;

    for (let from = 0; from < maxRows; from += pageSize) {
        const { data, error } = await supabase
            .from("gsc_search_analytics_rows")
            .select("page_url,page_slug,query,date,clicks,impressions,position")
            .eq("workspace_id", workspaceId)
            .eq("site_url", siteUrl)
            .gte("date", sinceDate)
            .order("date", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) {
            throw new Error(`Failed to load fresh Search Console evidence: ${error.message}`);
        }

        const chunk = (data ?? []) as SeoRawSearchConsoleRow[];
        rows.push(...chunk);
        if (chunk.length < pageSize) break;
    }

    return aggregateSearchConsoleQuerySignals(rows, { locale, siteUrl });
}

export function createIncomingLinkMap(inventory: SeoPublishedContentItem[]) {
    const bySlug = new Map(inventory.map((item) => [item.slug, item]));
    const incoming = new Map<string, number>();
    for (const item of inventory) incoming.set(item.id, 0);

    for (const source of inventory) {
        for (const linkedSlug of source.links) {
            const target = bySlug.get(linkedSlug);
            if (!target || target.id === source.id) continue;
            incoming.set(target.id, (incoming.get(target.id) ?? 0) + 1);
        }
    }

    return incoming;
}
