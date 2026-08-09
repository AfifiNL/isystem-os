import type { Json } from "@/shared/lib/supabase/database.types";
import type { SeoContentAnalytics, SeoPublishedContentItem } from "@/features/seo/types";
import type { Locale } from "@/features/templates/types";

const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with", "your", "you", "our", "we", "their", "into", "about",
]);

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

export function extractTextFromJson(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(extractTextFromJson).join(" ");
    if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(extractTextFromJson).join(" ");
    return "";
}

export function normalizeToken(token: string) {
    return token.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

export function tokenize(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function uniqueTokens(value: string): string[] {
    return Array.from(new Set(tokenize(value)));
}

export function slugFromHref(href: string): string | null {
    if (!href) return null;
    const withoutHash = href.split("#")[0] ?? "";
    const withoutQuery = withoutHash.split("?")[0] ?? "";
    const trimmed = withoutQuery.trim();

    if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) {
        return null;
    }

    return trimmed.replace(/^\//, "").replace(/\/$/, "") || null;
}

export function normalizeContentSlug(slug: string): string {
    const clean = slug.replace(/^\/+|\/+$/g, "").trim();
    // Normalize root locale links ("en", "nl", "ar"), empty strings, and the "home" slug to "home"
    if (clean === "" || clean === "home" || clean === "en" || clean === "nl" || clean === "ar") {
        return "home";
    }
    // Strip leading locale segment (e.g., "en/services" -> "services")
    return clean.replace(/^(en|nl|ar)\//, "");
}

export function extractMarkdownLinks(markdown: string): string[] {
    const links = new Set<string>();
    const matches = markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
    for (const match of matches) {
        const slug = slugFromHref(match[1] ?? "");
        if (slug) {
            const normalized = normalizeContentSlug(slug);
            if (normalized) links.add(normalized);
        }
    }
    return Array.from(links);
}

export function getMetadataText(metadata: Json | null): string {
    return extractTextFromJson(metadata);
}

const NARRATIVE_BUILDER_FIELDS = new Set([
    "description",
    "body",
    "richBody",
    "richBodyEn",
    "richBodyNl",
    "richDescription",
    "richDescriptionEn",
    "richDescriptionNl",
    "subtitle",
    "missionText",
    "visionText",
    "supportLine",
    "title",
    "headline",
    "tagline",
]);

const LOCALE_KEYS = new Set(["en", "nl", "ar"]);

function isLocaleMap(value: unknown): value is Partial<Record<Locale, unknown>> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.keys(value as Record<string, unknown>).some((key) => LOCALE_KEYS.has(key));
}

function fieldMatchesLocale(key: string, locale?: Locale): boolean {
    if (!locale) return true;
    if (/En$/.test(key)) return locale === "en";
    if (/Nl$/.test(key)) return locale === "nl";
    if (/Ar$/.test(key)) return locale === "ar";
    return true;
}

function extractNarrativeFromBlock(value: unknown, intoTextChunks: string[], locale?: Locale): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
        for (const item of value) extractNarrativeFromBlock(item, intoTextChunks, locale);
        return;
    }
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(record)) {
        if (typeof child === "string") {
            if (NARRATIVE_BUILDER_FIELDS.has(key) && fieldMatchesLocale(key, locale) && child.trim().length > 0) {
                intoTextChunks.push(child.replace(/<[^>]+>/g, " "));
            }
            continue;
        }
        if (NARRATIVE_BUILDER_FIELDS.has(key) && locale && isLocaleMap(child)) {
            const localized = child[locale];
            if (typeof localized === "string" && localized.trim().length > 0) {
                intoTextChunks.push(localized.replace(/<[^>]+>/g, " "));
            } else {
                extractNarrativeFromBlock(localized, intoTextChunks, locale);
            }
            continue;
        }
        extractNarrativeFromBlock(child, intoTextChunks, locale);
    }
}

/**
 * Extract narrative text from a Puck visual_layout payload. Walks all blocks and
 * pulls strings whose key matches a known narrative field (description, body,
 * mission/vision, etc). Strips HTML so token analysis stays clean.
 */
export function extractVisualLayoutText(visualLayout: Json | null, locale?: Locale): string {
    if (!visualLayout || typeof visualLayout !== "object") return "";
    const chunks: string[] = [];
    const root = visualLayout as Record<string, unknown>;
    const blocks = Array.isArray(root.content) ? root.content : [];
    for (const block of blocks) {
        const props = (block as Record<string, unknown> | null)?.props;
        extractNarrativeFromBlock(props, chunks, locale);
    }
    return chunks.join("\n");
}

/**
 * Extract internal-link hrefs embedded inside a visual_layout payload. Returns
 * locale-stripped slugs (e.g. "/en/services" → "services"; "/en/blog/x" → "blog/x")
 * so they can be compared against the audit's slug-based duplicate filter.
 */
export function extractVisualLayoutLinks(visualLayout: Json | null, locale?: Locale): string[] {
    if (!visualLayout || typeof visualLayout !== "object") return [];
    const out = new Set<string>();
    const visit = (value: unknown): void => {
        if (!value) return;
        if (typeof value === "string") {
            // Only consider strings that look like an href: leading "/", or "http(s)://"
            // (slugFromHref will reject external hosts). Anything else is title/copy text.
            if (!value.startsWith("/")) return;
            const slug = slugFromHref(value);
            if (slug) {
                const normalized = normalizeContentSlug(slug);
                if (normalized) out.add(normalized);
            }
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }
        if (typeof value === "object") {
            const record = value as Record<string, unknown>;
            if (locale && isLocaleMap(record)) {
                visit(record[locale]);
                return;
            }
            for (const child of Object.values(record)) visit(child);
        }
    };
    visit(visualLayout);
    return Array.from(out);
}

export function getContentFingerprint(item: {
    title: string;
    excerpt?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    contentMarkdown?: string | null;
    visualLayoutText?: string | null;
    metadata?: Json | null;
}) {
    return [
        item.title,
        item.excerpt ?? "",
        item.seoTitle ?? "",
        item.seoDescription ?? "",
        item.contentMarkdown ?? "",
        item.visualLayoutText ?? "",
        getMetadataText(item.metadata ?? null),
    ].join("\n");
}

export function extractKeywords(metadata: Json | null): string[] {
    const meta = asRecord(metadata);
    const seo = asRecord(meta.seo);
    const keywords = Array.isArray(seo.keywords) ? seo.keywords.filter((entry): entry is string => typeof entry === "string") : [];
    return keywords.map((keyword) => keyword.trim()).filter(Boolean);
}

export function resolveBuilderSignals(metadata: Json | null) {
    const meta = asRecord(metadata);
    const manualBuilder = asRecord(meta.manual_builder);
    const structured = asRecord(meta.structured_content);
    const rootProps = asRecord(asRecord(structured.root).props);
    const builderMetadata = asRecord(rootProps.metadata);

    const pageIntent = typeof rootProps.pageIntent === "string"
        ? rootProps.pageIntent
        : typeof meta.page_intent === "string"
            ? meta.page_intent
            : typeof builderMetadata.pageIntent === "string"
                ? builderMetadata.pageIntent
                : null;

    const audienceType = typeof builderMetadata.audienceType === "string"
        ? builderMetadata.audienceType
        : typeof manualBuilder.audienceType === "string"
            ? manualBuilder.audienceType
            : null;

    const conversionGoal = typeof builderMetadata.conversionGoal === "string"
        ? builderMetadata.conversionGoal
        : typeof manualBuilder.conversionGoal === "string"
            ? manualBuilder.conversionGoal
            : null;

    const seoTitle = typeof builderMetadata.seoTitle === "string"
        ? builderMetadata.seoTitle
        : null;

    const seoDescription = typeof builderMetadata.seoDescription === "string"
        ? builderMetadata.seoDescription
        : null;

    return { pageIntent, audienceType, conversionGoal, seoTitle, seoDescription };
}

export function similarityScore(source: string, target: string) {
    const sourceTokens = new Set(uniqueTokens(source));
    const targetTokens = new Set(uniqueTokens(target));
    if (sourceTokens.size === 0 || targetTokens.size === 0) return 0;

    let overlap = 0;
    for (const token of sourceTokens) {
        if (targetTokens.has(token)) overlap += 1;
    }

    const denominator = new Set([...sourceTokens, ...targetTokens]).size || 1;
    return Number(((overlap / denominator) * 100).toFixed(2));
}

export function buildAnchorText(source: SeoPublishedContentItem, target: SeoPublishedContentItem) {
    const sourceTokens = new Set(uniqueTokens(getContentFingerprint(source)));
    const targetTokens = uniqueTokens(`${target.title} ${target.excerpt} ${target.seoTitle ?? ""} ${target.seoDescription ?? ""} ${target.visualLayoutText}`);
    const overlap = targetTokens.filter((token) => sourceTokens.has(token));

    if (overlap.length >= 2) {
        return overlap.slice(0, 4).join(" ");
    }

    // Prefer multi-word keyword over single-word title to avoid brittle anchors that
    // get rejected downstream as "single-word destination label".
    const multiWordKeyword = target.keywords.find((kw) => kw.trim().split(/\s+/).length >= 2);
    if (multiWordKeyword) return multiWordKeyword;

    const titleTokens = target.title.trim().split(/\s+/);
    if (titleTokens.length >= 2) {
        // Take 2-3 content words from the title, skipping leading stop words.
        const meaningful = titleTokens.filter((t) => !STOP_WORDS.has(t.toLowerCase()));
        if (meaningful.length >= 2) return meaningful.slice(0, 3).join(" ");
    }

    if (target.keywords.length > 0) {
        return target.keywords[0] ?? target.title;
    }

    return target.title;
}

/**
 * Build the duplicate-detection slug used by the audit. Mirrors the runtime href that
 * the mutation engine writes (`/{locale}/[blog/]{slug}`) so the audit's "skip if already
 * linked" filter agrees with the AST-level `collectExistingRichLinks` check at apply time.
 */
export function targetDuplicateKeys(target: { slug: string; type: string }): string[] {
    const clean = target.slug.replace(/^\/+|\/+$/g, "").trim();
    if (clean === "" || clean === "home" || clean === "en" || clean === "nl" || clean === "ar") {
        return ["home", "en/home", "nl/home", "ar/home", "", "en", "nl", "ar"];
    }
    const routed = target.type === "blog" ? `blog/${clean}` : clean;
    const localeVariants = ["en", "nl", "ar"].flatMap((locale) => [
        `${locale}/${clean}`,
        `${locale}/${routed}`,
    ]);
    // Include bare slugs, routed slugs, and locale-prefixed hrefs. Markdown links
    // can preserve `/en/blog/x` while builder extraction strips locale; either
    // shape means the source already links to the same target.
    return Array.from(new Set([clean, routed, ...localeVariants]));
}

export function normalizeAnalyticsMap(rows: SeoContentAnalytics[]) {
    return new Map(rows.map((row) => [row.slug, row]));
}

export function computePriorityScore(input: {
    semanticFit: number;
    analyticsScore: number;
    strategicImportance: number;
    /** Total outbound internal links the source already has. Over-linked pages get penalized. */
    sourceOutboundCount?: number;
    /** Approximate narrative length of the source (chars). Thin pages can't host new links naturally. */
    sourceNarrativeLength?: number;
}) {
    const base = input.semanticFit * 0.45 + input.analyticsScore * 0.3 + input.strategicImportance * 0.25;
    // Over-linked penalty: each existing outbound link beyond 5 subtracts 2 points, capped at -20.
    const overLinkedPenalty = Math.min(20, Math.max(0, (input.sourceOutboundCount ?? 0) - 5) * 2);
    // Thin-page penalty: pages with <300 chars of narrative get up to -15.
    const thinPenalty = Math.max(0, Math.min(15, Math.round((300 - (input.sourceNarrativeLength ?? 300)) / 20)));
    return Number(Math.max(0, base - overLinkedPenalty - thinPenalty).toFixed(2));
}

export function computeAnalyticsScore(source: SeoContentAnalytics | undefined, target: SeoContentAnalytics | undefined) {
    const sourceTraffic = Math.min(source?.pageViews ?? 0, 500) / 5;
    const targetConv = Math.min(target?.conversions ?? 0, 50) * 2;
    const ctaGapBonus = Math.max(0, (source?.pageViews ?? 0) - (source?.ctaClicks ?? 0) * 3) / 10;
    return Number(Math.min(100, sourceTraffic + targetConv + ctaGapBonus).toFixed(2));
}

export function computeStrategicImportance(item: SeoPublishedContentItem, incomingLinks: number, targetAnalytics?: SeoContentAnalytics) {
    let score = 20;
    if (item.conversionGoal) score += 30;
    if (item.pageIntent === "quote-capture" || item.pageIntent === "campaign-landing") score += 20;
    if (item.type === "page") score += 10;
    if (incomingLinks === 0) score += 15;
    if ((targetAnalytics?.conversions ?? 0) > 0) score += 10;
    return Number(Math.min(100, score).toFixed(2));
}

export function inferFunnelStage(value: string | null | undefined): "top" | "middle" | "bottom" {
    const normalized = (value ?? "").toLowerCase();
    if (/(quote|book|contact|demo|consult|pricing|audit)/.test(normalized)) return "bottom";
    if (/(compare|case|service|solution|workflow|process)/.test(normalized)) return "middle";
    return "top";
}

export function inferOpportunityType(value: SeoPublishedContentItem): "orphan_support" | "conversion_support" | "cluster_gap" {
    if (value.conversionGoal) return "conversion_support";
    if (value.type === "page") return "cluster_gap";
    return "orphan_support";
}

export function safeAverage(values: number[]) {
    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}
