export type BlogVisualBlockType = "chart" | "diagram";

export type BlogChartType = "bar" | "line" | "donut" | "kpi" | "comparison_table";

export type BlogDiagramType = "relational" | "flowchart" | "timeline" | "funnel" | "framework" | "comparison_matrix";

export type BlogDiagramNodeType = "factor" | "stock" | "flow" | "actor" | "boundary" | "outcome";

export type BlogDiagramPolarity = "positive" | "negative" | "neutral";

export type BlogDiagramFeedbackType = "reinforcing" | "balancing" | "mixed" | "none";

export type BlogSystemArchetype =
    | "causal_loop"
    | "reinforcing_loop"
    | "balancing_loop"
    | "limits_to_growth"
    | "fixes_that_fail"
    | "shifting_the_burden"
    | "success_to_the_successful"
    | "tragedy_of_the_commons"
    | "escalation"
    | "growth_and_underinvestment"
    | "system_map";

export const BLOG_DIAGRAM_TYPES: readonly BlogDiagramType[] = [
    "relational",
    "flowchart",
    "timeline",
    "funnel",
    "framework",
    "comparison_matrix",
];

export const BLOG_DIAGRAM_NODE_TYPES: readonly BlogDiagramNodeType[] = [
    "factor",
    "stock",
    "flow",
    "actor",
    "boundary",
    "outcome",
];

export const BLOG_DIAGRAM_POLARITIES: readonly BlogDiagramPolarity[] = [
    "positive",
    "negative",
    "neutral",
];

export const BLOG_DIAGRAM_FEEDBACK_TYPES: readonly BlogDiagramFeedbackType[] = [
    "reinforcing",
    "balancing",
    "mixed",
    "none",
];

export const BLOG_SYSTEM_ARCHETYPES: readonly BlogSystemArchetype[] = [
    "causal_loop",
    "reinforcing_loop",
    "balancing_loop",
    "limits_to_growth",
    "fixes_that_fail",
    "shifting_the_burden",
    "success_to_the_successful",
    "tragedy_of_the_commons",
    "escalation",
    "growth_and_underinvestment",
    "system_map",
];

export type BlogEvidenceType =
    | "verified_statistic"
    | "time_sensitive_benchmark"
    | "forecast"
    | "author_framework"
    | "author_synthesis"
    | "internal_estimate"
    | "unsupported";

export type BlogSourceQuality = "primary" | "near_primary" | "secondary" | "vendor" | "internal" | "unknown";

export type BlogEvidenceConfidence = "high" | "medium" | "low";

export const BLOG_EVIDENCE_TYPES: readonly BlogEvidenceType[] = [
    "verified_statistic",
    "time_sensitive_benchmark",
    "forecast",
    "author_framework",
    "author_synthesis",
    "internal_estimate",
    "unsupported",
];

export const BLOG_SOURCE_QUALITIES: readonly BlogSourceQuality[] = [
    "primary",
    "near_primary",
    "secondary",
    "vendor",
    "internal",
    "unknown",
];

export const BLOG_EVIDENCE_CONFIDENCES: readonly BlogEvidenceConfidence[] = ["high", "medium", "low"];

export interface BlogEvidenceRecord {
    claim_id: string;
    article_slug?: string;
    visual_id: string;
    claim_text: string;
    claim_type: BlogEvidenceType;
    evidence_type: BlogEvidenceType;
    source_url?: string;
    source_label?: string;
    source_quality: BlogSourceQuality;
    publication_date?: string;
    accessed_date?: string;
    metric_definition?: string;
    geography_and_sample?: string;
    confidence: BlogEvidenceConfidence;
    review_date?: string;
    safe_fallback_wording?: string;
    source_note: string;
    badge_label: string;
}

export interface BlogChartDatum {
    label: string;
    value: number;
    secondaryValue?: number;
    group?: string;
    note?: string;
}

export interface BlogVisualBlockBase {
    id: string;
    type: BlogVisualBlockType;
    title: string;
    description: string;
    caption: string;
    source_label: string;
    source_url?: string;
    evidence?: BlogEvidenceRecord;
    seo_alt: string;
    placement_hint?: string;
}

export interface BlogChartBlock extends BlogVisualBlockBase {
    type: "chart";
    chart_type: BlogChartType;
    unit?: string;
    data: BlogChartDatum[];
}

export interface BlogDiagramNode {
    id: string;
    label: string;
    description?: string;
    node_type?: BlogDiagramNodeType;
}

export interface BlogDiagramEdge {
    from: string;
    to: string;
    label?: string;
    polarity?: BlogDiagramPolarity;
    delay?: boolean;
}

export interface BlogDiagramBlock extends BlogVisualBlockBase {
    type: "diagram";
    diagram_type: BlogDiagramType;
    system_archetype?: BlogSystemArchetype;
    feedback_type?: BlogDiagramFeedbackType;
    mermaid?: string;
    nodes?: BlogDiagramNode[];
    edges?: BlogDiagramEdge[];
}

export type BlogVisualBlock = BlogChartBlock | BlogDiagramBlock;

export interface BlogVisualEnrichment {
    schema_version: 1 | 2;
    generated_at?: string;
    visual_blocks: BlogVisualBlock[];
    evidence?: BlogEvidenceRecord[];
    seo_schema?: {
        faq?: Array<{ question: string; answer: string }>;
        datasets?: Array<{ name: string; description: string; block_id: string }>;
        article_sections?: string[];
    };
}

function normalizeDiagramId(value: string, fallback: string): string {
    const normalized = value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64);

    return normalized || fallback;
}

/**
 * Canonicalizes a model-produced graph before persistence. Edge endpoints are
 * resolved through the same ID normalization as nodes, then dangling and
 * duplicate relationships are removed. This keeps every renderer on a safe,
 * deterministic graph contract without another model or layout call.
 */
export function normalizeBlogDiagramGraph(
    inputNodes: readonly BlogDiagramNode[],
    inputEdges: readonly BlogDiagramEdge[],
): { nodes: BlogDiagramNode[]; edges: BlogDiagramEdge[] } {
    const usedNodeIds = new Set<string>();
    const nodeIdLookup = new Map<string, string>();
    const nodes = inputNodes.map((node, index) => {
        const lookupId = normalizeDiagramId(node.id, `node-${index + 1}`);
        let id = lookupId;
        let suffix = 2;
        while (usedNodeIds.has(id)) {
            id = `${lookupId}-${suffix}`;
            suffix += 1;
        }
        usedNodeIds.add(id);
        if (!nodeIdLookup.has(lookupId)) nodeIdLookup.set(lookupId, id);

        return {
            ...node,
            id,
            node_type: node.node_type && BLOG_DIAGRAM_NODE_TYPES.includes(node.node_type)
                ? node.node_type
                : undefined,
        };
    });

    const seenRelationships = new Set<string>();
    const edges = inputEdges.flatMap((edge) => {
        const from = nodeIdLookup.get(normalizeDiagramId(edge.from, ""));
        const to = nodeIdLookup.get(normalizeDiagramId(edge.to, ""));
        if (!from || !to || from === to) return [];

        const relationshipKey = `${from}->${to}`;
        if (seenRelationships.has(relationshipKey)) return [];
        seenRelationships.add(relationshipKey);

        return [{
            from,
            to,
            label: edge.label?.trim() || undefined,
            polarity: edge.polarity && BLOG_DIAGRAM_POLARITIES.includes(edge.polarity)
                ? edge.polarity
                : undefined,
            delay: edge.delay === true ? true : undefined,
        }];
    });

    return { nodes, edges };
}

export const VISUAL_SHORTCODE_PATTERN = /\{\{visual:([a-zA-Z0-9_-]+)\}\}/g;

const PLACEHOLDER_SOURCE_LABEL_PATTERNS: readonly RegExp[] = [
    /^ai[\s_-]*(research[\s_-]*)?synthesis$/i,
    /^research[\s_-]*synthesis$/i,
    /^synthesis$/i,
    /^ai[\s_-]*generated$/i,
    /^generated[\s_-]*by[\s_-]*ai$/i,
    /^ai[\s_-]*(research|summary|source|citation)$/i,
];

const REGULATOR_OR_INSTITUTION_HOST_PATTERNS: readonly RegExp[] = [
    /(^|\.)europa\.eu$/,
    /(^|\.)ec\.europa\.eu$/,
    /(^|\.)sba\.gov$/,
    /(^|\.)(gov|government)\.[a-z.]+$/,
    /\.gov$/,
    /\.gov\.[a-z.]+$/,
];

const NEAR_PRIMARY_RESEARCH_HOST_PATTERNS: readonly RegExp[] = [
    /(^|\.)hbs\.edu$/,
    /(^|\.)bcg\.com$/,
    /(^|\.)mckinsey\.com$/,
    /(^|\.)shrm\.org$/,
    /(^|\.)nfib\.com$/,
    /(^|\.)pmi\.org$/,
    /(^|\.)gartner\.com$/,
    /(^|\.)slack\.com$/,
    /(^|\.)cyberhaven\.com$/,
];

const NAMED_DATASET_HOST_PATTERNS: readonly RegExp[] = [
    /(^|\.)statista\.com$/,
    /(^|\.)bettercloud\.com$/,
    /(^|\.)okta\.com$/,
    /(^|\.)zylo\.com$/,
    /(^|\.)productiv\.com$/,
];

const VENDOR_HOST_PATTERNS: readonly RegExp[] = [
    /(^|\.)hubspot\.com$/,
    /(^|\.)salesforce\.com$/,
    /(^|\.)servicenow\.com$/,
    /(^|\.)atlassian\.com$/,
    /(^|\.)zapier\.com$/,
    /(^|\.)asana\.com$/,
    /(^|\.)monday\.com$/,
    /(^|\.)clickup\.com$/,
    /(^|\.)notion\.so$/,
];

const SOCIAL_OR_WEAK_SOURCE_HOST_PATTERNS: readonly RegExp[] = [
    /(^|\.)linkedin\.com$/,
    /(^|\.)medium\.com$/,
    /(^|\.)instagram\.com$/,
    /(^|\.)x\.com$/,
    /(^|\.)twitter\.com$/,
    /(^|\.)reddit\.com$/,
    /(^|\.)quora\.com$/,
    /(^|\.)youtube\.com$/,
    /(^|\.)tiktok\.com$/,
];

const WEAK_BLOG_SOURCE_HOST_PATTERNS: readonly RegExp[] = [
    /(^|\.)blog\.hubspot\.com$/,
    /(^|\.)securitybrief\.[a-z.]+$/,
];

const EVIDENCE_DISPLAY: Record<BlogEvidenceType, { badge: string; note: string }> = {
    verified_statistic: {
        badge: "Verified statistic",
        note: "Source-backed statistic. Check the linked source for methodology and context.",
    },
    time_sensitive_benchmark: {
        badge: "Time-sensitive benchmark",
        note: "Benchmark evidence that can change over time. Review before reuse.",
    },
    forecast: {
        badge: "Forecast",
        note: "Forward-looking estimate from the cited source, not a guaranteed outcome.",
    },
    author_framework: {
        badge: "Author framework",
        note: "Original framework or model from the author, not an external statistic.",
    },
    author_synthesis: {
        badge: "Author synthesis",
        note: "Author synthesis based on the surrounding argument and cited research context.",
    },
    internal_estimate: {
        badge: "Internal estimate",
        note: "Internal or heuristic estimate. Treat as directional unless independently verified.",
    },
    unsupported: {
        badge: "Needs evidence",
        note: "No acceptable source is attached. Use safe fallback wording or remove the claim.",
    },
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeHttpUrl(value: unknown): string | undefined {
    const raw = readString(value);
    if (!raw) return undefined;
    try {
        const url = new URL(raw);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

export function isPlaceholderSourceLabel(label: string | null | undefined): boolean {
    const normalized = label?.trim();
    if (!normalized) return true;
    return PLACEHOLDER_SOURCE_LABEL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function sanitizeEvidenceSourceLabel(label: string | null | undefined): string | undefined {
    const normalized = label?.trim();
    if (!normalized || isPlaceholderSourceLabel(normalized)) return undefined;
    return normalized;
}

export function isWeakSourceHost(url: string | null | undefined): boolean {
    const host = url ? hostFromUrl(url) : undefined;
    if (!host) return false;
    return SOCIAL_OR_WEAK_SOURCE_HOST_PATTERNS.some((pattern) => pattern.test(host))
        || WEAK_BLOG_SOURCE_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export function isSocialSourceHost(url: string | null | undefined): boolean {
    const host = url ? hostFromUrl(url) : undefined;
    if (!host) return false;
    return SOCIAL_OR_WEAK_SOURCE_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export function publisherLabelFromUrl(url: string): string | undefined {
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        if (!host) return undefined;
        const parts = host.split(".");
        const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        if (root.length <= 4) return root.toUpperCase();
        return root.charAt(0).toUpperCase() + root.slice(1);
    } catch {
        return undefined;
    }
}

export function badgeLabelForEvidenceType(evidenceType: BlogEvidenceType): string {
    return EVIDENCE_DISPLAY[evidenceType].badge;
}

export function sourceNoteForEvidenceType(evidenceType: BlogEvidenceType): string {
    return EVIDENCE_DISPLAY[evidenceType].note;
}

function isEvidenceType(value: unknown): value is BlogEvidenceType {
    return typeof value === "string" && BLOG_EVIDENCE_TYPES.includes(value as BlogEvidenceType);
}

function isSourceQuality(value: unknown): value is BlogSourceQuality {
    return typeof value === "string" && BLOG_SOURCE_QUALITIES.includes(value as BlogSourceQuality);
}

function isEvidenceConfidence(value: unknown): value is BlogEvidenceConfidence {
    return typeof value === "string" && BLOG_EVIDENCE_CONFIDENCES.includes(value as BlogEvidenceConfidence);
}

function inferEvidenceType(block: BlogVisualBlock, sourceUrl?: string): BlogEvidenceType {
    if (sourceUrl && block.type === "chart") return "verified_statistic";
    if (block.type === "diagram") return "author_framework";
    if (sourceUrl) return "author_synthesis";
    return "unsupported";
}

function inferSourceQuality(sourceUrl?: string, evidenceType?: BlogEvidenceType): BlogSourceQuality {
    if (evidenceType === "author_framework" || evidenceType === "author_synthesis" || evidenceType === "internal_estimate") return "internal";
    const host = sourceUrl ? hostFromUrl(sourceUrl) : undefined;
    if (!host) return "unknown";
    if (REGULATOR_OR_INSTITUTION_HOST_PATTERNS.some((pattern) => pattern.test(host))) return "primary";
    if (NEAR_PRIMARY_RESEARCH_HOST_PATTERNS.some((pattern) => pattern.test(host))) return "near_primary";
    if (NAMED_DATASET_HOST_PATTERNS.some((pattern) => pattern.test(host))) return "secondary";
    if (VENDOR_HOST_PATTERNS.some((pattern) => pattern.test(host))) return "vendor";
    if (WEAK_BLOG_SOURCE_HOST_PATTERNS.some((pattern) => pattern.test(host))) return "vendor";
    return "unknown";
}

function hostFromUrl(url: string): string | undefined {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return undefined;
    }
}

function inferConfidence(evidenceType: BlogEvidenceType, sourceUrl?: string): BlogEvidenceConfidence {
    if (evidenceType === "unsupported") return "low";
    if (sourceUrl && evidenceType === "verified_statistic") return "medium";
    if (evidenceType === "author_framework" || evidenceType === "author_synthesis") return "medium";
    return sourceUrl ? "medium" : "low";
}

function claimTextForBlock(block: BlogVisualBlock): string {
    return block.caption || block.description || block.title;
}

export function normalizeEvidenceRecord(input: unknown, block?: BlogVisualBlock, articleSlug?: string): BlogEvidenceRecord | null {
    const raw = asRecord(input);
    const visualId = readString(raw.visual_id) ?? block?.id;
    if (!visualId) return null;

    const sourceUrl = normalizeHttpUrl(raw.source_url) ?? normalizeHttpUrl(block?.source_url);
    const sourceLabel = sanitizeEvidenceSourceLabel(readString(raw.source_label) ?? block?.source_label)
        ?? (sourceUrl ? publisherLabelFromUrl(sourceUrl) : undefined);
    const evidenceType = isEvidenceType(raw.evidence_type)
        ? raw.evidence_type
        : isEvidenceType(raw.claim_type)
            ? raw.claim_type
            : block
                ? inferEvidenceType(block, sourceUrl)
                : sourceUrl
                    ? "author_synthesis"
                    : "unsupported";
    const claimText = readString(raw.claim_text) ?? (block ? claimTextForBlock(block) : undefined) ?? "Unspecified visual claim";

    return {
        claim_id: readString(raw.claim_id) ?? `${visualId}-evidence`,
        article_slug: readString(raw.article_slug) ?? articleSlug,
        visual_id: visualId,
        claim_text: claimText,
        claim_type: evidenceType,
        evidence_type: evidenceType,
        source_url: sourceUrl,
        source_label: sourceLabel,
        source_quality: isSourceQuality(raw.source_quality) ? raw.source_quality : inferSourceQuality(sourceUrl, evidenceType),
        publication_date: readString(raw.publication_date),
        accessed_date: readString(raw.accessed_date),
        metric_definition: readString(raw.metric_definition),
        geography_and_sample: readString(raw.geography_and_sample),
        confidence: isEvidenceConfidence(raw.confidence) ? raw.confidence : inferConfidence(evidenceType, sourceUrl),
        review_date: readString(raw.review_date),
        safe_fallback_wording: readString(raw.safe_fallback_wording),
        source_note: readString(raw.source_note) ?? sourceNoteForEvidenceType(evidenceType),
        badge_label: readString(raw.badge_label) ?? badgeLabelForEvidenceType(evidenceType),
    };
}

export function normalizeEvidenceForVisualBlock(block: BlogVisualBlock, input?: unknown, articleSlug?: string): BlogEvidenceRecord {
    return normalizeEvidenceRecord(input, block, articleSlug) ?? {
        claim_id: `${block.id}-evidence`,
        article_slug: articleSlug,
        visual_id: block.id,
        claim_text: claimTextForBlock(block),
        claim_type: "unsupported",
        evidence_type: "unsupported",
        source_quality: "unknown",
        confidence: "low",
        source_note: sourceNoteForEvidenceType("unsupported"),
        badge_label: badgeLabelForEvidenceType("unsupported"),
    };
}

export function getVisualEnrichment(metadata: unknown): BlogVisualEnrichment {
    const record = asRecord(metadata);
    const enrichment = record.enrichment && typeof record.enrichment === "object"
        ? record.enrichment as Partial<BlogVisualEnrichment>
        : {};
    const articleSlug = readString(record.slug) ?? readString(record.article_slug);
    const visualBlocks = Array.isArray(enrichment.visual_blocks)
        ? enrichment.visual_blocks.filter(isBlogVisualBlock)
            .map((block) => {
                const sourceUrl = normalizeHttpUrl(block.source_url);
                const sourceLabel = sanitizeEvidenceSourceLabel(block.source_label)
                    ?? (sourceUrl ? publisherLabelFromUrl(sourceUrl) : undefined)
                    ?? "";
                return { ...block, source_url: sourceUrl, source_label: sourceLabel } as BlogVisualBlock;
            })
        : [];
    const rawEvidence = Array.isArray(enrichment.evidence) ? enrichment.evidence : [];
    const rawEvidenceByVisualId = new Map(
        rawEvidence
            .map((item) => asRecord(item))
            .map((item) => [readString(item.visual_id), item] as const)
            .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])),
    );
    const evidence = visualBlocks.map((block) => normalizeEvidenceForVisualBlock(block, rawEvidenceByVisualId.get(block.id) ?? block.evidence, articleSlug));
    const evidenceByVisualId = new Map(evidence.map((item) => [item.visual_id, item]));
    const blocksWithEvidence = visualBlocks.map((block) => ({ ...block, evidence: evidenceByVisualId.get(block.id) } as BlogVisualBlock));

    return {
        schema_version: 2,
        generated_at: typeof enrichment.generated_at === "string" ? enrichment.generated_at : undefined,
        visual_blocks: blocksWithEvidence,
        evidence,
        seo_schema: enrichment.seo_schema,
    };
}

export function isBlogVisualBlock(value: unknown): value is BlogVisualBlock {
    if (!value || typeof value !== "object") return false;
    const block = value as Partial<BlogVisualBlock>;
    if (!block.id || !block.type || !block.title) return false;
    if (block.type === "chart") {
        return Array.isArray((block as Partial<BlogChartBlock>).data);
    }
    if (block.type === "diagram") {
        const diagram = block as Partial<BlogDiagramBlock>;
        return typeof diagram.mermaid === "string" || Array.isArray(diagram.nodes);
    }
    return false;
}

export function splitMarkdownByVisualShortcodes(markdown: string) {
    const chunks: Array<{ type: "markdown"; content: string } | { type: "visual"; id: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const pattern = new RegExp(VISUAL_SHORTCODE_PATTERN);

    while ((match = pattern.exec(markdown)) !== null) {
        if (match.index > lastIndex) {
            chunks.push({ type: "markdown", content: markdown.slice(lastIndex, match.index) });
        }
        chunks.push({ type: "visual", id: match[1] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < markdown.length) {
        chunks.push({ type: "markdown", content: markdown.slice(lastIndex) });
    }

    return chunks.filter((chunk) => chunk.type === "visual" || chunk.content.trim().length > 0);
}

export function createVisualShortcode(id: string) {
    return `{{visual:${id}}}`;
}
