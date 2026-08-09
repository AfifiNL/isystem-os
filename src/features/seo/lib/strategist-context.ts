import type { Locale } from "@/features/templates/types";
import type { SeoContentAnalytics, SeoPublishedContentItem } from "@/features/seo/types";
import { DEFAULT_LOCALE, getLocaleFromPathname } from "@/shared/lib/i18n/routing";

export interface SeoQuerySignal {
    page_slug: string;
    query: string;
    total_impressions: number;
    total_clicks: number;
    avg_ctr: number;
    avg_position: number;
    min_date: string;
    max_date: string;
}

export interface SeoRawSearchConsoleRow {
    page_url: string;
    page_slug: string;
    query: string;
    date: string;
    clicks: number;
    impressions: number;
    position: number;
}

function cleanNarrative(value: string): string {
    return value
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_`~|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizedSiteUrl(siteUrl: string): URL | null {
    try {
        return new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
    } catch {
        return null;
    }
}

export function inferSearchConsoleLocale(pageUrl: string, siteUrl: string): Locale | null {
    const propertyUrl = normalizedSiteUrl(siteUrl);
    if (!propertyUrl) return null;

    try {
        const page = new URL(pageUrl, propertyUrl);
        if (page.origin !== propertyUrl.origin) return null;
        const locale = getLocaleFromPathname(page.pathname);
        // English blog canonicals intentionally omit /en. Other localized public
        // surfaces are prefixed, so an unprefixed GSC URL belongs to the default locale.
        return locale ?? DEFAULT_LOCALE;
    } catch {
        return null;
    }
}

export function aggregateSearchConsoleQuerySignals(
    rows: readonly SeoRawSearchConsoleRow[],
    input: { locale: Locale; siteUrl: string },
): SeoQuerySignal[] {
    const grouped = new Map<string, {
        page_slug: string;
        query: string;
        total_impressions: number;
        total_clicks: number;
        weighted_position: number;
        min_date: string;
        max_date: string;
    }>();

    for (const row of rows) {
        if (inferSearchConsoleLocale(row.page_url, input.siteUrl) !== input.locale) continue;
        if (!row.page_slug || !row.query || row.impressions <= 0) continue;
        const key = `${row.page_slug}\u0000${row.query.trim().toLocaleLowerCase(input.locale)}`;
        const current = grouped.get(key) ?? {
            page_slug: row.page_slug,
            query: row.query.trim(),
            total_impressions: 0,
            total_clicks: 0,
            weighted_position: 0,
            min_date: row.date,
            max_date: row.date,
        };
        current.total_impressions += row.impressions;
        current.total_clicks += row.clicks;
        current.weighted_position += row.position * row.impressions;
        if (row.date < current.min_date) current.min_date = row.date;
        if (row.date > current.max_date) current.max_date = row.date;
        grouped.set(key, current);
    }

    return Array.from(grouped.values())
        .map((row) => ({
            page_slug: row.page_slug,
            query: row.query,
            total_impressions: row.total_impressions,
            total_clicks: row.total_clicks,
            avg_ctr: row.total_impressions > 0 ? row.total_clicks / row.total_impressions : 0,
            avg_position: row.total_impressions > 0 ? row.weighted_position / row.total_impressions : 0,
            min_date: row.min_date,
            max_date: row.max_date,
        }))
        .sort((a, b) => b.total_impressions - a.total_impressions || a.avg_position - b.avg_position);
}

export function selectSearchConsoleSignalsForPrompt(
    signals: readonly SeoQuerySignal[],
    input: { maxSignals?: number; maxPerPage?: number } = {},
): SeoQuerySignal[] {
    const maxSignals = input.maxSignals ?? 80;
    const maxPerPage = input.maxPerPage ?? 5;
    const pageCounts = new Map<string, number>();
    const selected: SeoQuerySignal[] = [];

    for (const signal of signals) {
        const pageCount = pageCounts.get(signal.page_slug) ?? 0;
        if (pageCount >= maxPerPage) continue;
        selected.push(signal);
        pageCounts.set(signal.page_slug, pageCount + 1);
        if (selected.length >= maxSignals) break;
    }

    return selected;
}

export function summarizeSearchConsolePages(signals: readonly SeoQuerySignal[]) {
    const pages = new Map<string, {
        page: string;
        impressions: number;
        clicks: number;
        weightedPosition: number;
    }>();
    for (const signal of signals) {
        const current = pages.get(signal.page_slug) ?? {
            page: signal.page_slug,
            impressions: 0,
            clicks: 0,
            weightedPosition: 0,
        };
        current.impressions += signal.total_impressions;
        current.clicks += signal.total_clicks;
        current.weightedPosition += signal.avg_position * signal.total_impressions;
        pages.set(signal.page_slug, current);
    }
    return Array.from(pages.values())
        .map((page) => ({
            page: page.page,
            impressions: page.impressions,
            clicks: page.clicks,
            ctr: page.impressions > 0 ? page.clicks / page.impressions : 0,
            position: page.impressions > 0 ? page.weightedPosition / page.impressions : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions);
}

export function normalizeSeoSearchTerm(value: string): string {
    return value
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
}

export function findMatchingSearchConsoleSignal(
    value: string,
    signals: readonly SeoQuerySignal[],
): SeoQuerySignal | null {
    const normalized = normalizeSeoSearchTerm(value);
    if (!normalized) return null;
    const exact = signals.find((signal) => normalizeSeoSearchTerm(signal.query) === normalized);
    if (exact) return exact;

    const tokens = new Set(normalized.split(" ").filter((token) => token.length >= 3));
    if (tokens.size < 2) return null;
    let best: { signal: SeoQuerySignal; overlap: number } | null = null;
    for (const signal of signals) {
        const queryTokens = normalizeSeoSearchTerm(signal.query).split(" ").filter((token) => token.length >= 3);
        if (queryTokens.length < 2) continue;
        const overlap = queryTokens.filter((token) => tokens.has(token)).length / Math.max(tokens.size, queryTokens.length);
        if (overlap >= 0.6 && (!best || overlap > best.overlap || (overlap === best.overlap && signal.total_impressions > best.signal.total_impressions))) {
            best = { signal, overlap };
        }
    }
    return best?.signal ?? null;
}

export function isStrategicContentDuplicate(
    input: { title?: string | null; topic?: string | null; slugSuggestion?: string | null; primaryKeyword?: string | null },
    inventory: readonly Pick<SeoPublishedContentItem, "title" | "slug">[],
    signals: readonly SeoQuerySignal[],
): boolean {
    const existingSlugs = new Set(inventory.map((item) => item.slug.replace(/^\/+|\/+$/g, "").toLowerCase()));
    const existingTitles = new Set(inventory.map((item) => normalizeSeoSearchTerm(item.title)).filter(Boolean));
    const rankedQueries = new Set(signals.map((signal) => normalizeSeoSearchTerm(signal.query)).filter(Boolean));

    const slug = input.slugSuggestion?.replace(/^\/+|\/+$/g, "").toLowerCase() ?? "";
    if (slug && existingSlugs.has(slug)) return true;

    const candidateTerms = [input.title, input.topic, input.primaryKeyword]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map(normalizeSeoSearchTerm)
        .filter(Boolean);
    return candidateTerms.some((term) => existingTitles.has(term) || rankedQueries.has(term));
}

export function buildStrategistInventoryContext(
    inventory: readonly SeoPublishedContentItem[],
    analytics: readonly SeoContentAnalytics[],
    detailedLimit = 40,
) {
    const analyticsBySlug = new Map(analytics.map((item) => [item.slug, item]));
    const ranked = [...inventory].sort((a, b) => {
        const typeDelta = Number(b.type === "page") - Number(a.type === "page");
        if (typeDelta !== 0) return typeDelta;
        const conversionDelta = Number(Boolean(b.conversionGoal)) - Number(Boolean(a.conversionGoal));
        if (conversionDelta !== 0) return conversionDelta;
        const trafficDelta = (analyticsBySlug.get(b.slug)?.pageViews ?? 0) - (analyticsBySlug.get(a.slug)?.pageViews ?? 0);
        if (trafficDelta !== 0) return trafficDelta;
        return b.updatedAt.localeCompare(a.updatedAt);
    });

    const catalog = inventory.map((item) => ({
        title: item.title,
        slug: item.slug,
        type: item.type,
        updatedAt: item.updatedAt,
        pageIntent: item.pageIntent,
        conversionGoal: item.conversionGoal,
        keywords: item.keywords.slice(0, 5),
    }));

    const detailed = ranked.slice(0, Math.max(1, detailedLimit)).map((item) => {
        const narrative = cleanNarrative([
            item.excerpt,
            item.seoDescription ?? "",
            item.visualLayoutText,
            item.contentMarkdown,
        ].filter(Boolean).join(" "));
        const itemAnalytics = analyticsBySlug.get(item.slug);
        return {
            title: item.title,
            slug: item.slug,
            type: item.type,
            updatedAt: item.updatedAt,
            pageIntent: item.pageIntent,
            conversionGoal: item.conversionGoal,
            audienceType: item.audienceType,
            keywords: item.keywords.slice(0, 8),
            seoTitle: item.seoTitle,
            seoDescription: item.seoDescription,
            coverageExcerpt: truncate(narrative, 600),
            pageViews: itemAnalytics?.pageViews ?? 0,
            conversions: itemAnalytics?.conversions ?? 0,
            ctaClicks: itemAnalytics?.ctaClicks ?? 0,
        };
    });

    return {
        totalPublished: inventory.length,
        countsByType: inventory.reduce<Record<string, number>>((counts, item) => {
            counts[item.type] = (counts[item.type] ?? 0) + 1;
            return counts;
        }, {}),
        catalog,
        detailed,
        detailedCount: detailed.length,
    };
}
