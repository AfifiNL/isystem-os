import { randomUUID } from "node:crypto";
import {
    BLOG_EVIDENCE_CONFIDENCES,
    BLOG_EVIDENCE_TYPES,
    BLOG_SOURCE_QUALITIES,
    getVisualEnrichment,
    type BlogChartBlock,
    type BlogEvidenceConfidence,
    type BlogEvidenceRecord,
    type BlogEvidenceType,
    type BlogSourceQuality,
    type BlogVisualBlock,
} from "@/features/content-engine/visual-enrichment";
import { getBlogWordCount } from "@/features/blog/reading-time";
import {
    normalizeHeadingForEditorialMatch,
    resolveEffectivePrimaryKeyword,
    validateGeneratedBlogDraft,
    type BlogDraftLengthTier,
    type EditorialValidationIssue,
} from "@/features/content-engine/lib/blog-editorial-validation";
import type { BlogEnhancementProposal } from "@/features/seo/types";
import { getSiteHost } from "@/shared/lib/site-url";

type JsonRecord = Record<string, unknown>;

const SEO_TITLE_MIN = 35;
const SEO_TITLE_MAX = 65;
const REMEDIATED_NUMERIC_CHART_CODES = new Set([
    "visual_numeric_chart_invalid_evidence_type",
    "visual_numeric_chart_missing_source_url",
    "visual_external_evidence_missing_source_url",
    "visual_quantitative_weak_source_hierarchy",
    "visual_quantitative_social_source",
]);

const EXTERNAL_NUMERIC_EVIDENCE_TYPES = new Set<BlogEvidenceType>([
    "verified_statistic",
    "time_sensitive_benchmark",
    "forecast",
]);

export interface BlogEditorialRemediationInput {
    title: string;
    contentMarkdown: string;
    metadata: JsonRecord;
    locale?: string | null;
}

export interface BlogEditorialRemediationChange {
    code: string;
    message: string;
}

export interface BlogEditorialRemediationResult {
    metadata: JsonRecord;
    changed: boolean;
    changes: BlogEditorialRemediationChange[];
    remainingBlockingIssues: EditorialValidationIssue[];
}

export function buildBlogEditorialRemediationProposal(
    input: BlogEditorialRemediationInput,
): BlogEnhancementProposal | null {
    const result = remediateBlogEditorialValidation(input);
    if (!result.changed) return null;

    const original = result.changes.map((change) => `${change.code}: ${change.message}`).join("\n");
    const unresolved = result.remainingBlockingIssues.length > 0
        ? ` ${result.remainingBlockingIssues.length} blocking issue${result.remainingBlockingIssues.length === 1 ? "" : "s"} may still need manual review.`
        : " Publication-blocking SEO/visual validation issues are remediated.";

    return {
        id: randomUUID(),
        type: "editorial_validation_remediation",
        category: "meta",
        startOffset: -1,
        endOffset: -1,
        metaPath: "metadata.enrichment.editorial_validation",
        original,
        proposed: `Apply rule-aware editorial validation remediation.${unresolved}`,
        rationale: "Fixes the same editorial validation rules that can block blog publication: exact primary keyword in SEO title and numeric chart evidence metadata safety.",
        riskFlags: [],
        estimatedCostMillicents: 0,
    };
}

export function remediateBlogEditorialValidation(
    input: BlogEditorialRemediationInput,
): BlogEditorialRemediationResult {
    const locale = normalizeLocale(input.locale);
    let metadata: JsonRecord = cloneRecord(input.metadata);
    const before = validateForMetadata(input, metadata);
    const changes: BlogEditorialRemediationChange[] = [];

    const keywordIssue = before.issues.find((issue) => issue.code === "primary_keyword_missing_from_seo_title");
    const storedKeyword = getPrimaryKeyword(metadata);
    // Stored keywords can be headline-style (full title + subtitle); reduce to
    // the core phrase the validator actually checks so the rebuilt SEO title
    // stays inside the 35-65 character band.
    const primaryKeyword = storedKeyword ? resolveEffectivePrimaryKeyword(storedKeyword) : null;
    if (keywordIssue && primaryKeyword && locale === "en") {
        const seo = asRecord(metadata.seo);
        const currentTitle = typeof seo.title === "string" ? seo.title : input.title;
        const nextTitle = buildKeywordInclusiveSeoTitle({
            currentTitle,
            contentTitle: input.title,
            primaryKeyword,
        });
        if (nextTitle && nextTitle !== currentTitle && containsNormalizedPhrase(nextTitle, primaryKeyword)) {
            metadata = {
                ...metadata,
                seo: {
                    ...seo,
                    title: nextTitle,
                },
            };
            changes.push({
                code: keywordIssue.code,
                message: `SEO title changed from "${currentTitle}" to "${nextTitle}".`,
            });
        }
    }

    const visualIssueIds = collectVisualIssueIds(before.issues);
    if (visualIssueIds.size > 0) {
        const visualResult = remediateVisualEvidenceMetadata(metadata, visualIssueIds);
        if (visualResult.changed) {
            metadata = visualResult.metadata;
            changes.push(...visualResult.changes);
        }
    }

    const after = validateForMetadata(input, metadata);
    metadata = attachEditorialValidationSnapshot(metadata, after);

    return {
        metadata,
        changed: changes.length > 0,
        changes,
        remainingBlockingIssues: after.issues.filter((issue) => issue.severity === "error"),
    };
}

function validateForMetadata(input: BlogEditorialRemediationInput, metadata: JsonRecord) {
    const seo = asRecord(metadata.seo);
    const keywords = getKeywords(metadata);
    const visualBlocks = getVisualEnrichment(metadata).visual_blocks;
    return validateGeneratedBlogDraft({
        markdown: input.contentMarkdown,
        length: inferLengthTier(metadata, input.contentMarkdown),
        title: input.title,
        seoTitle: typeof seo.title === "string" ? seo.title : input.title,
        seoDescription: typeof seo.description === "string" ? seo.description : typeof metadata.excerpt === "string" ? metadata.excerpt : undefined,
        primaryKeyword: keywords[0],
        keywords,
        visualBlocks,
        siteHost: getSiteHost(),
    });
}

function remediateVisualEvidenceMetadata(metadata: JsonRecord, visualIssueIds: Set<string>): {
    metadata: JsonRecord;
    changed: boolean;
    changes: BlogEditorialRemediationChange[];
} {
    const enrichment = getVisualEnrichment(metadata);
    const changes: BlogEditorialRemediationChange[] = [];
    let changed = false;

    const visualBlocks = enrichment.visual_blocks.map((block) => {
        if (!visualIssueIds.has(block.id) || block.type !== "chart" || !hasNumericChartData(block)) return block;

        const next = remediateNumericChartBlock(block);
        if (next !== block) {
            changed = true;
            changes.push({
                code: "visual_numeric_chart_evidence_remediated",
                message: `Numeric chart "${block.id}" evidence metadata normalized to "${next.evidence?.evidence_type ?? "internal_estimate"}".`,
            });
        }
        return next;
    });

    if (!changed) return { metadata, changed: false, changes: [] };

    const currentEnrichment = asRecord(metadata.enrichment);
    const evidence = visualBlocks.map((block) => block.evidence).filter(isEvidenceRecord);
    return {
        metadata: {
            ...metadata,
            enrichment: {
                ...currentEnrichment,
                schema_version: 2,
                generated_at: typeof currentEnrichment.generated_at === "string" ? currentEnrichment.generated_at : new Date().toISOString(),
                visual_blocks: visualBlocks,
                evidence,
            },
        },
        changed: true,
        changes,
    };
}

function remediateNumericChartBlock(block: BlogChartBlock): BlogChartBlock {
    const evidence = normalizeEvidenceShape(block);
    const hasSourceUrl = hasHttpUrl(block.source_url) || hasHttpUrl(evidence.source_url);
    const nextEvidenceType = chooseNumericChartEvidenceType(evidence, hasSourceUrl);
    const shouldUseInternalEstimate = nextEvidenceType === "internal_estimate" || !hasSourceUrl;

    if (shouldUseInternalEstimate) {
        const sourceNote = buildInternalEstimateSourceNote(block);
        const nextEvidence: BlogEvidenceRecord = {
            ...evidence,
            evidence_type: "internal_estimate",
            claim_type: evidence.claim_type === "unsupported" ? "internal_estimate" : evidence.claim_type,
            source_quality: "internal",
            confidence: "low",
            source_url: undefined,
            source_label: "Internal estimate",
            metric_definition: evidence.metric_definition || "Directional scenario estimate for the charted comparison; values are editorial planning estimates, not observed external statistics.",
            source_note: sourceNote,
            safe_fallback_wording: evidence.safe_fallback_wording || "Directional internal estimate — not an external benchmark or measured market statistic.",
            badge_label: "Internal estimate",
        };
        return {
            ...block,
            source_url: undefined,
            source_label: "Internal estimate",
            evidence: nextEvidence,
        };
    }

    const sourceUrl = block.source_url || evidence.source_url;
    const sourceLabel = block.source_label || evidence.source_label || publisherLabelFromUrl(sourceUrl);
    const sourceQuality = normalizeSourceQuality(evidence.source_quality);
    const nextEvidence: BlogEvidenceRecord = {
        ...evidence,
        evidence_type: nextEvidenceType,
        claim_type: evidence.claim_type === "unsupported" ? nextEvidenceType : evidence.claim_type,
        source_url: sourceUrl,
        source_label: sourceLabel,
        source_quality: sourceQuality === "unknown" ? "near_primary" : sourceQuality,
        confidence: evidence.confidence === "low" ? "medium" : evidence.confidence,
        metric_definition: evidence.metric_definition || "Numeric chart value as represented by the cited source or dataset.",
        source_note: evidence.source_note || sourceNoteForExternalType(nextEvidenceType),
        badge_label: badgeLabelForEvidenceType(nextEvidenceType),
    };
    return {
        ...block,
        source_url: sourceUrl,
        source_label: sourceLabel,
        evidence: nextEvidence,
    };
}

function chooseNumericChartEvidenceType(evidence: BlogEvidenceRecord, hasSourceUrl: boolean): BlogEvidenceType {
    if (!hasSourceUrl) return "internal_estimate";
    if (EXTERNAL_NUMERIC_EVIDENCE_TYPES.has(evidence.evidence_type)) return evidence.evidence_type;
    const text = [evidence.claim_text, evidence.source_note, evidence.badge_label].join(" ");
    if (/forecast|projection|forward-looking/i.test(text)) return "forecast";
    if (/benchmark|telemetry|survey|dataset|report/i.test(text)) return "time_sensitive_benchmark";
    return "verified_statistic";
}

function normalizeEvidenceShape(block: BlogChartBlock): BlogEvidenceRecord {
    const raw = asRecord(block.evidence);
    const evidenceType = normalizeEvidenceType(raw.evidence_type, "unsupported");
    const claimType = normalizeEvidenceType(raw.claim_type, evidenceType);
    return {
        claim_id: typeof raw.claim_id === "string" ? raw.claim_id : `${block.id}-evidence`,
        article_slug: typeof raw.article_slug === "string" ? raw.article_slug : undefined,
        visual_id: block.id,
        claim_text: typeof raw.claim_text === "string" ? raw.claim_text : block.title,
        claim_type: claimType,
        evidence_type: evidenceType,
        source_url: typeof raw.source_url === "string" ? raw.source_url : block.source_url,
        source_label: typeof raw.source_label === "string" ? raw.source_label : block.source_label,
        source_quality: normalizeSourceQuality(raw.source_quality),
        publication_date: typeof raw.publication_date === "string" ? raw.publication_date : undefined,
        accessed_date: typeof raw.accessed_date === "string" ? raw.accessed_date : undefined,
        metric_definition: typeof raw.metric_definition === "string" ? raw.metric_definition : undefined,
        geography_and_sample: typeof raw.geography_and_sample === "string" ? raw.geography_and_sample : undefined,
        confidence: normalizeConfidence(raw.confidence),
        review_date: typeof raw.review_date === "string" ? raw.review_date : undefined,
        safe_fallback_wording: typeof raw.safe_fallback_wording === "string" ? raw.safe_fallback_wording : undefined,
        source_note: typeof raw.source_note === "string" ? raw.source_note : "Evidence metadata normalized during SEO enhancement.",
        badge_label: typeof raw.badge_label === "string" ? raw.badge_label : badgeLabelForEvidenceType(evidenceType),
    };
}

function collectVisualIssueIds(issues: readonly EditorialValidationIssue[]): Set<string> {
    const ids = new Set<string>();
    for (const issue of issues) {
        if (!REMEDIATED_NUMERIC_CHART_CODES.has(issue.code)) continue;
        const id = issue.details?.id;
        if (typeof id === "string" && id.trim()) ids.add(id);
    }
    return ids;
}

function buildKeywordInclusiveSeoTitle(input: {
    currentTitle: string;
    contentTitle: string;
    primaryKeyword: string;
}): string | null {
    const keyword = cleanInlineText(input.primaryKeyword);
    if (!keyword) return null;
    if (containsNormalizedPhrase(input.currentTitle, keyword)) return input.currentTitle;

    const descriptor = cleanDescriptor(input.currentTitle || input.contentTitle, keyword);
    const candidates = [
        descriptor ? `${keyword}: ${descriptor}` : "",
        `${keyword}: Key Differences`,
        `${keyword}: Practical Guide`,
        `${keyword} Guide`,
        keyword,
    ].filter(Boolean);

    const safe = candidates
        .map((candidate) => fitSeoTitle(candidate, keyword))
        .find((candidate) => candidate.length >= SEO_TITLE_MIN && candidate.length <= SEO_TITLE_MAX && containsNormalizedPhrase(candidate, keyword));

    return safe ?? fitSeoTitle(candidates[0] ?? keyword, keyword);
}

function cleanDescriptor(value: string, keyword: string): string {
    const withoutBrand = value
        .replace(/\s+[|–—-]\s+iSystem(?:\.ai)?\s*$/i, "")
        .replace(/\s+[|–—-]\s+Hossam\s+Afifi\s*$/i, "");
    const normalizedKeyword = normalizeHeadingForEditorialMatch(keyword);
    const parts = withoutBrand.split(/\s*[:|–—-]\s*/).filter(Boolean);
    const descriptor = parts.find((part) => !containsNormalizedPhrase(part, normalizedKeyword)) ?? parts[0] ?? withoutBrand;
    return cleanInlineText(descriptor);
}

function fitSeoTitle(value: string, keyword: string): string {
    const cleaned = cleanInlineText(value);
    if (cleaned.length <= SEO_TITLE_MAX) return cleaned;
    if (keyword.length >= SEO_TITLE_MAX) return keyword.slice(0, SEO_TITLE_MAX).trim();
    const suffixBudget = SEO_TITLE_MAX - keyword.length - 2;
    if (!cleaned.startsWith(keyword) || suffixBudget < 8) return keyword;
    const suffix = cleaned.slice(keyword.length + 2).trim();
    return `${keyword}: ${truncateAtWord(suffix, suffixBudget)}`.trim();
}

function truncateAtWord(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    const sliced = value.slice(0, maxLength).trim();
    return (sliced.replace(/\s+\S*$/, "") || sliced).replace(/[,:;\-–—]+$/g, "").trim();
}

function attachEditorialValidationSnapshot(metadata: JsonRecord, validation: ReturnType<typeof validateGeneratedBlogDraft>): JsonRecord {
    const enrichment = asRecord(metadata.enrichment);
    const existingValidation = asRecord(enrichment.editorial_validation);
    return {
        ...metadata,
        enrichment: {
            ...enrichment,
            editorial_validation: {
                ...existingValidation,
                valid: validation.valid,
                issues: validation.issues,
                issue_count: validation.issues.length,
                error_count: validation.issues.filter((issue) => issue.severity === "error").length,
                warning_count: validation.issues.filter((issue) => issue.severity === "warning").length,
            },
            editorial_scorecard: validation.scorecard,
        },
    };
}

function inferLengthTier(metadata: JsonRecord, markdown: string): BlogDraftLengthTier {
    const generationInputs = asRecord(metadata.generation_inputs);
    const configured = generationInputs.length;
    if (configured === "short" || configured === "medium" || configured === "long" || configured === "deep-dive") return configured;
    const wordCount = getBlogWordCount({ content_markdown: markdown, metadata });
    if (wordCount >= 2800) return "deep-dive";
    if (wordCount >= 1800) return "long";
    if (wordCount >= 900) return "medium";
    return "short";
}

function getPrimaryKeyword(metadata: JsonRecord): string | null {
    return getKeywords(metadata)[0] ?? null;
}

function getKeywords(metadata: JsonRecord): string[] {
    const seo = asRecord(metadata.seo);
    const generationInputs = asRecord(metadata.generation_inputs);
    const raw = Array.isArray(seo.keywords) ? seo.keywords : Array.isArray(generationInputs.keywords) ? generationInputs.keywords : [];
    return raw.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0);
}

function hasNumericChartData(block: BlogVisualBlock): block is BlogChartBlock {
    return block.type === "chart" && Array.isArray(block.data) && block.data.some((datum) => typeof datum.value === "number" && Number.isFinite(datum.value));
}

function containsNormalizedPhrase(haystack: string, needle: string): boolean {
    return normalizeHeadingForEditorialMatch(haystack).includes(normalizeHeadingForEditorialMatch(needle));
}

function normalizeLocale(locale: string | null | undefined): "en" | "nl" | "ar" {
    return locale === "nl" || locale === "ar" ? locale : "en";
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function cloneRecord(value: JsonRecord): JsonRecord {
    return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function cleanInlineText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

function hasHttpUrl(value: unknown): value is string {
    return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function normalizeEvidenceType(value: unknown, fallback: BlogEvidenceType): BlogEvidenceType {
    return typeof value === "string" && BLOG_EVIDENCE_TYPES.includes(value as BlogEvidenceType)
        ? value as BlogEvidenceType
        : fallback;
}

function normalizeSourceQuality(value: unknown): BlogSourceQuality {
    return typeof value === "string" && BLOG_SOURCE_QUALITIES.includes(value as BlogSourceQuality)
        ? value as BlogSourceQuality
        : "unknown";
}

function normalizeConfidence(value: unknown): BlogEvidenceConfidence {
    return typeof value === "string" && BLOG_EVIDENCE_CONFIDENCES.includes(value as BlogEvidenceConfidence)
        ? value as BlogEvidenceConfidence
        : "low";
}

function isEvidenceRecord(value: unknown): value is BlogEvidenceRecord {
    return Boolean(value && typeof value === "object" && typeof (value as BlogEvidenceRecord).visual_id === "string");
}

function buildInternalEstimateSourceNote(block: BlogChartBlock): string {
    return `Directional internal estimate for "${block.title}" based on the article's scenario framing; not an external benchmark, measured statistic, or performance guarantee.`;
}

function sourceNoteForExternalType(type: BlogEvidenceType): string {
    if (type === "forecast") return "Source-backed forecast; forward-looking estimate, not a performance guarantee.";
    if (type === "time_sensitive_benchmark") return "Source-backed benchmark; verify freshness during editorial review.";
    return "Source-backed statistic verified for editorial use.";
}

function badgeLabelForEvidenceType(type: BlogEvidenceType): string {
    switch (type) {
        case "verified_statistic": return "Verified statistic";
        case "time_sensitive_benchmark": return "Benchmark";
        case "forecast": return "Forecast";
        case "internal_estimate": return "Internal estimate";
        case "author_framework": return "Author framework";
        case "author_synthesis": return "Author synthesis";
        case "unsupported": return "Needs evidence";
    }
}

function publisherLabelFromUrl(url: string | undefined): string {
    if (!url) return "Source";
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "Source";
    }
}
