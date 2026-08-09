import { getBlogWordCount } from "@/features/blog/reading-time";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";
import type { Json } from "@/shared/lib/supabase/database.types";
import { getSiteHost } from "@/shared/lib/site-url";
import {
    repairLikelyPluralSubjectVerbDisagreements,
    type BlogDraftLengthTier,
    type BlogEditorialIntent,
    type BlogEditorialValidationInput,
    type BlogEditorialValidationResult,
    type EditorialCitation,
    type EditorialLinkSuggestion,
    type EditorialValidationIssue,
} from "./blog-editorial-validation";

export interface RepairSeoData {
    title?: string;
    description?: string;
    keywords?: string[];
}

export interface RewriteFailureReason {
    code: "length_drift" | "headings_changed" | "shortcodes_changed";
    message: string;
}

interface MarkdownLinkRepair {
    href: string;
    replacementHref?: string;
}

interface RewriteValidationOptions {
    allowHeadingTextChanges?: boolean;
    allowHeadingStructureChanges?: boolean;
}

interface MarkdownHeading {
    level: number;
    text: string;
    line: string;
}

type LinkLike = string | EditorialLinkSuggestion | EditorialCitation;

const VALID_LENGTH_TIERS = new Set<BlogDraftLengthTier>(["short", "medium", "long", "deep-dive"]);
const VALID_INTENTS = new Set<BlogEditorialIntent>(["generic", "guide", "how-to", "comparison", "case-study", "opinion", "news"]);
const VISUAL_SHORTCODE_RE = /\{\{\s*visual\s*:\s*([A-Za-z0-9_-]+)\s*\}\}/g;
const IMPLICIT_INTERNAL_LINK_FALLBACKS = ["/", "/blog", "/contact"];

export function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
        : [];
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asLengthTier(value: unknown): BlogDraftLengthTier | null {
    return typeof value === "string" && VALID_LENGTH_TIERS.has(value as BlogDraftLengthTier) ? value as BlogDraftLengthTier : null;
}

function asIntent(value: unknown): BlogEditorialIntent | null {
    if (typeof value !== "string") return null;
    const normalized = value.toLowerCase();
    if (VALID_INTENTS.has(normalized as BlogEditorialIntent)) return normalized as BlogEditorialIntent;
    if (/how\s*to|tutorial|playbook|step|workflow|procedure|process|implement/.test(normalized)) return "how-to";
    if (/compar|versus|vs\.?|alternative/.test(normalized)) return "comparison";
    if (/case|customer|example|use case/.test(normalized)) return "case-study";
    if (/opinion|perspective|pov|thought leadership/.test(normalized)) return "opinion";
    if (/news|announce|launch|release|trend/.test(normalized)) return "news";
    if (/guide|pillar|framework|blueprint|checklist/.test(normalized)) return "guide";
    return null;
}

function normalizeHeadingText(text: string): string {
    return text
        .replace(/\s+/g, " ")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .trim();
}

function extractHeadings(markdown: string, maxLevel = 6): MarkdownHeading[] {
    const headings: MarkdownHeading[] = [];
    const headingRegex = /^(#{1,6})\s+(.+?)\s*$/gm;
    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(markdown)) !== null) {
        const level = match[1].length;
        if (level > maxLevel) continue;
        const text = normalizeHeadingText(match[2]);
        headings.push({
            level,
            text,
            line: `${"#".repeat(level)} ${text}`,
        });
    }
    return headings;
}

function normalizeInternalPath(value: string): string {
    try {
        if (value.startsWith("http://") || value.startsWith("https://")) {
            const url = new URL(value);
            return `${url.pathname}${url.search}${url.hash}` || "/";
        }
    } catch {}
    return value.startsWith("/") ? value : `/${value}`;
}

function normalizeExternalUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return url.href.replace(/#.*$/, "").replace(/\/$/, "");
    } catch {
        return null;
    }
}

function linkUrl(value: LinkLike): string {
    return typeof value === "string" ? value : value.url;
}

function dedupeLinks<T extends LinkLike>(values: T[], normalizer: (url: string) => string | null): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    values.forEach((value) => {
        const normalized = normalizer(linkUrl(value));
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        out.push(value);
    });
    return out;
}

function sourceListToCitations(value: unknown): EditorialCitation[] {
    return asArray(value)
        .map((item): EditorialCitation | null => {
            if (typeof item === "string" && normalizeExternalUrl(item)) return { url: item };
            const record = asRecord(item);
            const url = asNonEmptyString(record?.url)
                ?? asNonEmptyString(record?.href)
                ?? asNonEmptyString(record?.canonical_url)
                ?? asNonEmptyString(record?.citationUrl)
                ?? asNonEmptyString(record?.citation_url)
                ?? asNonEmptyString(record?.source_url);
            if (!url || !normalizeExternalUrl(url)) return null;
            return {
                url,
                ...(asNonEmptyString(record?.title) ?? asNonEmptyString(record?.source_title) ? { title: asNonEmptyString(record?.title) ?? asNonEmptyString(record?.source_title) ?? undefined } : {}),
                ...(asNonEmptyString(record?.publisher) ?? asNonEmptyString(record?.source_label) ? { publisher: asNonEmptyString(record?.publisher) ?? asNonEmptyString(record?.source_label) ?? undefined } : {}),
            };
        })
        .filter((item): item is EditorialCitation => item !== null);
}

function evidencePackToCitations(pack: unknown): EditorialCitation[] {
    const record = asRecord(pack);
    if (!record) return [];
    return [
        ...sourceListToCitations(record.documents),
        ...asArray(record.claims).flatMap((item) => {
            const claim = asRecord(item);
            if (!claim) return [];
            const nestedSource = asRecord(claim.source);
            const url = asNonEmptyString(claim.source_url) ?? asNonEmptyString(nestedSource?.canonical_url);
            if (!url) return [];
            return sourceListToCitations([{
                url,
                title: claim.source_title ?? nestedSource?.title,
                publisher: claim.publisher ?? nestedSource?.publisher,
            }]);
        }),
    ];
}

function repairRepeatedHeadingText(heading: string): string {
    const marker = heading.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!marker) return heading;
    const prefix = marker[1];
    const originalText = marker[2].trim();
    let text = marker[2].trim();

    text = text.replace(/^\d+[).:-]\s*/, "");
    text = text.replace(/^((?:step|phase|pillar|principle|stap|fase|pijler|خطوة|مرحلة|ركيزة)\s+\d*[).:-]?\s*)/i, "");
    text = text.replace(/^((?:how|why|what|when|waarom|hoe|wat|كيف|لماذا|ما)\s+)/i, "");
    text = text.replace(/\s*[:：]\s*/g, " - ");
    text = text.replace(/\s+/g, " ").trim();

    if (text.length < 12) {
        text = `${text || "Operational"} reader decision`;
    }
    const repairedText = `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}`;
    const repaired = `${prefix} ${classifyRepairHeadingPattern(repairedText) ? `Reader decision - ${repairedText}` : repairedText}`;
    return repaired === heading ? `${prefix} Reader decision - ${originalText}` : repaired;
}

function normalizeHeadingForRepairPattern(heading: string): string {
    return heading
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function classifyRepairHeadingPattern(heading: string): string | null {
    const normalized = normalizeHeadingForRepairPattern(heading);
    if (!normalized) return null;
    if (/[:：]/.test(heading)) return "colon-tagline";
    if (/^\d+[).:-]/.test(heading.trim())) return "numbered";

    const firstWord = normalized.split(" ")[0];
    if (["how", "why", "what", "when", "waarom", "hoe", "wat", "كيف", "لماذا", "ما"].includes(firstWord)) {
        return `question-${firstWord}`;
    }
    if (["step", "phase", "pillar", "principle", "stap", "fase", "pijler", "خطوة", "مرحلة", "ركيزة"].includes(firstWord)) {
        return `template-${firstWord}`;
    }
    return null;
}

export function repairAdjacentHeadingDiagnostics(markdown: string, issues: readonly EditorialValidationIssue[]): string {
    const hasAdjacentHeadingIssue = issues.some((issue) => issue.code === "adjacent_h2_pattern_repetition");
    if (!hasAdjacentHeadingIssue) return markdown;

    const targetHeadings = new Set(
        issues
            .filter((issue) => issue.code === "adjacent_h2_pattern_repetition" && typeof issue.heading === "string")
            .map((issue) => issue.heading),
    );
    let previousPattern: string | null = null;

    return markdown
        .split("\n")
        .map((line) => {
            const match = line.match(/^(##)\s+(.+?)\s*$/);
            if (!match) return line;

            const headingText = match[2].trim();
            const currentPattern = classifyRepairHeadingPattern(headingText);
            const shouldRepair = targetHeadings.has(headingText) || Boolean(currentPattern && currentPattern === previousPattern);
            const repairedLine = shouldRepair ? repairRepeatedHeadingText(line) : line;
            previousPattern = classifyRepairHeadingPattern(repairedLine.replace(/^##\s+/, ""));
            return repairedLine;
        })
        .join("\n");
}

export function repairDeterministicGrammarDiagnostics(
    markdown: string,
    issues: readonly EditorialValidationIssue[],
): string {
    const codes = new Set(issues.map((issue) => issue.code));
    let repaired = markdown;

    if (codes.has("subject_verb_agreement_these_is")) {
        repaired = repaired.replace(/\b(These)\s+is\b/gi, "$1 are");
    }
    if (codes.has("subject_verb_agreement_plural_is")) {
        repaired = repairLikelyPluralSubjectVerbDisagreements(repaired);
    }

    return repaired;
}

function markdownLinkPatternForHref(href: string): RegExp {
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\[([^\\]]+)\\]\\(${escaped}\\)`, "g");
}

export function repairInvalidInternalLinks(markdown: string, issues: readonly EditorialValidationIssue[], allowedInternalLinks: readonly string[] = []): string {
    const invalidHrefs = issues
        .filter((issue) => issue.code === "invalid_internal_link")
        .map((issue) => asRecord(issue.details)?.href)
        .filter((href): href is string => typeof href === "string" && href.trim().length > 0);
    if (invalidHrefs.length === 0) return markdown;

    const replacements = [...allowedInternalLinks, ...IMPLICIT_INTERNAL_LINK_FALLBACKS]
        .map(normalizeInternalPath)
        .filter((href, index, all) => href && all.indexOf(href) === index);

    const repairs: MarkdownLinkRepair[] = invalidHrefs.map((href, index) => ({
        href,
        replacementHref: replacements[index % replacements.length],
    }));

    return repairs.reduce((current, repair) => {
        const pattern = markdownLinkPatternForHref(repair.href);
        return current.replace(pattern, (_match, label: string) => (
            repair.replacementHref ? `[${label}](${repair.replacementHref})` : label
        ));
    }, markdown);
}

function stripVisualShortcodes(markdown: string): string {
    return markdown
        .replace(/^\s*\{\{\s*visual\s*:\s*[A-Za-z0-9_-]+\s*\}\}\s*$/gim, "")
        .replace(/\{\{\s*visual\s*:\s*[A-Za-z0-9_-]+\s*\}\}/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function insertShortcodeIntoSection(section: string, shortcode: string): string {
    const trimmed = section.trimEnd();
    if (!trimmed) return shortcode;
    return `${trimmed}\n\n${shortcode}`;
}

export function repairVisualShortcodeDiagnostics(
    markdown: string,
    issues: readonly EditorialValidationIssue[],
    visualBlocks: readonly { id?: string | null }[] = [],
): string {
    const canRepair = issues.some((issue) => [
        "duplicate_visual_shortcode_id",
        "visual_block_not_placed",
        "visual_shortcode_missing_block",
        "all_tail_visual_dump",
        "invalid_visual_shortcode",
    ].includes(issue.code));
    const visualIds = visualBlocks
        .map((block) => asNonEmptyString(block.id))
        .filter((id): id is string => Boolean(id));
    if (!canRepair || visualIds.length === 0) return markdown;

    const cleaned = stripVisualShortcodes(markdown);
    const firstH2 = cleaned.search(/^##\s+/m);
    if (firstH2 === -1) {
        return `${cleaned}\n\n${visualIds.map((id) => `{{visual:${id}}}`).join("\n\n")}`.trim();
    }

    const intro = cleaned.slice(0, firstH2).trimEnd();
    const body = cleaned.slice(firstH2);
    const sections = body.split(/(?=^##\s+)/m).filter((section) => section.trim().length > 0);
    const repairedSections = sections.map((section, index) => {
        const idsForSection = visualIds.filter((_id, visualIndex) => visualIndex % sections.length === index);
        if (idsForSection.length === 0) return section.trimEnd();
        return insertShortcodeIntoSection(section, idsForSection.map((id) => `{{visual:${id}}}`).join("\n\n"));
    });

    return [intro, ...repairedSections].filter((part) => part.trim().length > 0).join("\n\n").trim();
}

function appendCaveat(value: unknown, caveat: string): string {
    const current = asNonEmptyString(value);
    if (!current) return caveat;
    if (current.toLowerCase().includes(caveat.toLowerCase())) return current;
    return `${current} ${caveat}`;
}

function repairFrameworkBenchmarkEvidence(evidence: unknown, visualId: string): Record<string, unknown> {
    const record = asRecord(evidence) ?? {};
    const caveat = "Author framework - not a benchmark.";
    return {
        ...record,
        visual_id: asNonEmptyString(record.visual_id) ?? visualId,
        evidence_type: asNonEmptyString(record.evidence_type) ?? "author_framework",
        source_quality: asNonEmptyString(record.source_quality) ?? "internal",
        confidence: asNonEmptyString(record.confidence) ?? "low",
        source_note: appendCaveat(record.source_note, caveat),
        safe_fallback_wording: appendCaveat(record.safe_fallback_wording, caveat),
        badge_label: "Author framework",
    };
}

function hasNumericChartData(block: Record<string, unknown>): boolean {
    return Array.isArray(block.data) && block.data.some((datum) => {
        const record = asRecord(datum);
        return typeof record?.value === "number" && Number.isFinite(record.value);
    });
}

function hasHardEvidenceIssue(issue: EditorialValidationIssue): boolean {
    return [
        "visual_evidence_banned_source_label",
        "visual_evidence_invalid_type",
        "visual_numeric_chart_invalid_evidence_type",
        "visual_internal_estimate_missing_methodology",
        "visual_numeric_chart_missing_source_url",
        "visual_quantitative_weak_source_hierarchy",
        "visual_quantitative_social_source",
        "visual_hard_roi_claim_needs_caveat",
        "visual_external_evidence_missing_source_url",
        "visual_author_synthesis_displayed_as_external_proof",
        "visual_exact_number_missing_source_date",
        "visual_exact_number_missing_metric_definition",
        "visual_exact_number_missing_scope",
        "visual_forecast_missing_date_or_caveat",
    ].includes(issue.code);
}

function repairVisualEvidenceRecord(evidence: unknown, block: Record<string, unknown>, visualId: string): Record<string, unknown> {
    const record = asRecord(evidence) ?? {};
    const numericChart = block.type === "chart" && hasNumericChartData(block);
    const evidenceType = numericChart ? "internal_estimate" : block.type === "diagram" ? "author_framework" : "author_synthesis";
    const note = numericChart
        ? "Internal scenario estimate; not an external benchmark or guaranteed outcome."
        : "Author framework - not external proof or a benchmark.";

    return {
        ...record,
        visual_id: asNonEmptyString(record.visual_id) ?? visualId,
        evidence_type: evidenceType,
        claim_type: evidenceType,
        source_url: undefined,
        source_quality: numericChart ? "internal" : "internal",
        confidence: "low",
        source_note: appendCaveat(record.source_note, note),
        safe_fallback_wording: appendCaveat(record.safe_fallback_wording, note),
        metric_definition: numericChart
            ? asNonEmptyString(record.metric_definition) ?? "Directional internal scenario model for editorial illustration; denominator and sample are not external observed benchmarks."
            : record.metric_definition,
        geography_and_sample: numericChart
            ? asNonEmptyString(record.geography_and_sample) ?? "Illustrative internal scenario; not a public dataset."
            : record.geography_and_sample,
        badge_label: numericChart ? "Internal estimate" : "Author framework",
    };
}

export function repairVisualEvidenceDiagnostics(metadata: unknown, issues: readonly EditorialValidationIssue[]): { metadata: Record<string, unknown>; repaired: boolean } {
    const benchmarkTargetIds = new Set(
        issues
            .filter((issue) => issue.code === "visual_framework_displayed_as_benchmark")
            .map((issue) => asRecord(issue.details)?.id)
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    );
    const hardTargetIds = new Set(
        issues
            .filter(hasHardEvidenceIssue)
            .map((issue) => asRecord(issue.details)?.id)
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    );
    const record = asRecord(metadata) ?? {};
    if (benchmarkTargetIds.size === 0 && hardTargetIds.size === 0) return { metadata: record, repaired: false };

    const enrichment = asRecord(record.enrichment) ?? {};
    const visualBlocks = Array.isArray(enrichment.visual_blocks)
        ? enrichment.visual_blocks.map((block) => {
            const blockRecord = asRecord(block);
            const id = asNonEmptyString(blockRecord?.id);
            if (!blockRecord || !id || (!benchmarkTargetIds.has(id) && !hardTargetIds.has(id))) return block;
            if (hardTargetIds.has(id)) {
                const repairedEvidence = repairVisualEvidenceRecord(blockRecord.evidence, blockRecord, id);
                return {
                    ...blockRecord,
                    source_url: undefined,
                    source_label: repairedEvidence.badge_label,
                    evidence: repairedEvidence,
                };
            }
            return {
                ...blockRecord,
                evidence: repairFrameworkBenchmarkEvidence(blockRecord.evidence, id),
            };
        })
        : enrichment.visual_blocks;

    const existingEvidence = Array.isArray(enrichment.evidence) ? enrichment.evidence : [];
    const seenEvidenceIds = new Set<string>();
    const evidence = existingEvidence.map((item) => {
        const itemRecord = asRecord(item);
        const visualId = asNonEmptyString(itemRecord?.visual_id);
        if (!itemRecord || !visualId || (!benchmarkTargetIds.has(visualId) && !hardTargetIds.has(visualId))) return item;
        seenEvidenceIds.add(visualId);
        if (hardTargetIds.has(visualId)) {
            const blockRecord = Array.isArray(enrichment.visual_blocks)
                ? asRecord(enrichment.visual_blocks.find((block) => asNonEmptyString(asRecord(block)?.id) === visualId))
                : null;
            return repairVisualEvidenceRecord(itemRecord, blockRecord ?? { type: itemRecord.evidence_type === "internal_estimate" ? "chart" : "diagram" }, visualId);
        }
        return repairFrameworkBenchmarkEvidence(itemRecord, visualId);
    });

    new Set([...benchmarkTargetIds, ...hardTargetIds]).forEach((visualId) => {
        if (!seenEvidenceIds.has(visualId)) {
            if (hardTargetIds.has(visualId)) {
                const blockRecord = Array.isArray(enrichment.visual_blocks)
                    ? asRecord(enrichment.visual_blocks.find((block) => asNonEmptyString(asRecord(block)?.id) === visualId))
                    : null;
                evidence.push(repairVisualEvidenceRecord(null, blockRecord ?? {}, visualId));
            } else {
                evidence.push(repairFrameworkBenchmarkEvidence(null, visualId));
            }
        }
    });

    return {
        metadata: {
            ...record,
            enrichment: {
                ...enrichment,
                visual_blocks: visualBlocks,
                evidence,
            },
        },
        repaired: true,
    };
}

export function extractVisualShortcodes(markdown: string): string[] {
    const matches = Array.from(markdown.matchAll(VISUAL_SHORTCODE_RE));
    return matches.map((match) => `{{visual:${match[1]}}}`);
}

export function validateRepairRewrite(original: string, revised: string, options: RewriteValidationOptions = {}): RewriteFailureReason | null {
    const ratio = revised.length / Math.max(original.length, 1);
    if (ratio < 0.8 || ratio > 1.3) {
        return {
            code: "length_drift",
            message: `Revised draft is ${Math.round(ratio * 100)}% of the original size; outside the 80-130% safety window.`,
        };
    }
    const originalHeadings = extractHeadings(original);
    const revisedHeadings = extractHeadings(revised);
    const headingShapeChanged = options.allowHeadingStructureChanges
        ? false
        : options.allowHeadingTextChanges
        ? originalHeadings.map((heading) => heading.level).join(",") !== revisedHeadings.map((heading) => heading.level).join(",")
        : originalHeadings.map((heading) => heading.line).join("\n") !== revisedHeadings.map((heading) => heading.line).join("\n");
    if (headingShapeChanged) {
        return {
            code: "headings_changed",
            message: options.allowHeadingTextChanges
                ? "Revised draft changed the heading count, order, or nesting levels."
                : "Revised draft modified or reordered the article headings.",
        };
    }
    const originalShortcodes = extractVisualShortcodes(original).sort().join("|");
    const revisedShortcodes = extractVisualShortcodes(revised).sort().join("|");
    if (originalShortcodes !== revisedShortcodes) {
        return {
            code: "shortcodes_changed",
            message: "Revised draft modified or removed embedded visual shortcodes.",
        };
    }
    return null;
}

export function inferRepairLengthTier(metadata: unknown, markdown: string): BlogDraftLengthTier {
    const record = asRecord(metadata) ?? {};
    const generationInputs = asRecord(record.generation_inputs) ?? {};
    const brief = asRecord(record.brief) ?? {};
    const configured = asLengthTier(generationInputs.length) ?? asLengthTier(brief.length) ?? asLengthTier(record.length);
    if (configured) return configured;

    const wordCount = getBlogWordCount({ content_markdown: markdown, metadata });
    if (wordCount >= 2800) return "deep-dive";
    if (wordCount >= 1800) return "long";
    if (wordCount >= 900) return "medium";
    return "short";
}

function inferRepairIntent(metadata: Record<string, unknown>): BlogEditorialIntent {
    const generationInputs = asRecord(metadata.generation_inputs) ?? {};
    const seoSchema = asRecord(asRecord(metadata.enrichment)?.seo_schema) ?? {};
    return asIntent(metadata.article_type)
        ?? asIntent(metadata.search_intent)
        ?? asIntent(generationInputs.article_type)
        ?? asIntent(generationInputs.search_intent)
        ?? asIntent(generationInputs.narrative_style)
        ?? asIntent(seoSchema.article_type)
        ?? "guide";
}

function extractFaqItems(metadata: Record<string, unknown>) {
    const directFaqs = Array.isArray(metadata.faqs) ? metadata.faqs : [];
    const seoSchemaFaqs = getVisualEnrichment(metadata).seo_schema?.faq ?? [];
    return [...directFaqs, ...seoSchemaFaqs]
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
            question: asNonEmptyString(item.question) ?? "",
            answer: asNonEmptyString(item.answer) ?? "",
        }))
        .filter((item) => item.question && item.answer);
}

function extractLinkList(value: unknown): Array<string | EditorialLinkSuggestion> {
    if (!Array.isArray(value)) return [];
    return value
        .map((item): string | EditorialLinkSuggestion | null => {
            if (typeof item === "string" && item.trim()) return item.trim();
            const record = asRecord(item);
            const url = asNonEmptyString(record?.url) ?? asNonEmptyString(record?.href);
            if (!url) return null;
            return {
                url,
                ...(asNonEmptyString(record?.anchor) ? { anchor: asNonEmptyString(record?.anchor) ?? undefined } : {}),
                ...(asNonEmptyString(record?.reason) ? { reason: asNonEmptyString(record?.reason) ?? undefined } : {}),
            };
        })
        .filter((item): item is string | EditorialLinkSuggestion => item !== null);
}

function extractSavedInternalLinkSuggestions(metadata: Record<string, unknown>, enrichment: Record<string, unknown>): EditorialLinkSuggestion[] {
    const generationInputs = asRecord(metadata.generation_inputs) ?? {};
    const articleBlueprint = asRecord(generationInputs.article_blueprint) ?? {};
    const seoSchema = asRecord(enrichment.seo_schema) ?? {};
    return dedupeLinks([
        ...extractLinkList(metadata.internal_link_suggestions),
        ...extractLinkList(metadata.internalLinkSuggestions),
        ...extractLinkList(enrichment.internal_link_suggestions),
        ...extractLinkList(seoSchema.internal_link_suggestions),
        ...extractLinkList(seoSchema.internalLinkSuggestions),
        ...extractLinkList(articleBlueprint.internalLinkTargets),
    ].map((item): EditorialLinkSuggestion => (
        typeof item === "string" ? { url: item } : { url: item.url, anchor: item.anchor, reason: item.reason }
    )), (url) => normalizeInternalPath(url));
}

function extractSavedExternalCitations(metadata: Record<string, unknown>, enrichment: Record<string, unknown>): EditorialCitation[] {
    const generationInputs = asRecord(metadata.generation_inputs) ?? {};
    const articleBlueprint = asRecord(generationInputs.article_blueprint) ?? {};
    const seoSchema = asRecord(enrichment.seo_schema) ?? {};
    const provenance = asRecord(metadata.provenance) ?? {};
    const fallbackFactSheet = asRecord(provenance.fallback_fact_sheet ?? provenance.fact_sheet) ?? {};
    const provenanceEvergreen = asRecord(provenance.fallback_evergreen_source_pass ?? provenance.evergreen_source_pass) ?? {};
    const enrichmentEvergreen = asRecord(enrichment.evergreen_source_pass) ?? {};

    const visualCitations = [
        ...sourceListToCitations(enrichment.evidence),
        ...sourceListToCitations(enrichment.visual_blocks),
    ];

    return dedupeLinks([
        ...sourceListToCitations(metadata.external_citations),
        ...sourceListToCitations(metadata.externalCitations),
        ...sourceListToCitations(enrichment.external_citations),
        ...sourceListToCitations(seoSchema.citations),
        ...sourceListToCitations(articleBlueprint.externalCitationTargets),
        ...evidencePackToCitations(provenance.source_intelligence_evidence_pack),
        ...evidencePackToCitations(enrichment.source_intelligence_evidence_pack),
        ...sourceListToCitations(fallbackFactSheet.sources ?? provenance.sources),
        ...sourceListToCitations(provenanceEvergreen.sources),
        ...sourceListToCitations(enrichmentEvergreen.sources),
        ...visualCitations,
    ], normalizeExternalUrl);
}

function extractAllowedInternalLinks(metadata: Record<string, unknown>, enrichment: Record<string, unknown>, suggestions: readonly EditorialLinkSuggestion[]): string[] {
    const seoSchema = asRecord(enrichment.seo_schema) ?? {};
    return Array.from(new Set([
        ...asStringArray(metadata.allowed_internal_links),
        ...asStringArray(metadata.allowedInternalLinks),
        ...asStringArray(enrichment.allowed_internal_links),
        ...asStringArray(seoSchema.allowed_internal_links),
        ...suggestions.map((link) => link.url),
    ].map(normalizeInternalPath)));
}

export function extractRepairSeoData(metadata: unknown, title: string): RepairSeoData {
    const record = asRecord(metadata) ?? {};
    const seo = asRecord(record.seo) ?? {};
    const generationInputs = asRecord(record.generation_inputs) ?? {};
    const keywords = asStringArray(seo.keywords).length > 0 ? asStringArray(seo.keywords) : asStringArray(generationInputs.keywords);
    return {
        title: asNonEmptyString(seo.title) ?? title,
        description: asNonEmptyString(seo.description) ?? asNonEmptyString(record.excerpt) ?? "",
        keywords,
    };
}

export function buildEditorialRepairValidationInput(input: {
    markdown: string;
    title: string;
    metadata: unknown;
    seoData?: RepairSeoData;
    siteHost?: string;
    forbiddenPublicTerms?: readonly string[];
}): BlogEditorialValidationInput {
    const metadata = asRecord(input.metadata) ?? {};
    const generationInputs = asRecord(metadata.generation_inputs) ?? {};
    const seoData = input.seoData ?? extractRepairSeoData(metadata, input.title);
    const keywords = [
        ...(seoData.keywords ?? []),
        ...asStringArray(generationInputs.keywords),
    ].filter((keyword, index, all) => keyword && all.indexOf(keyword) === index);
    const enrichment = asRecord(metadata.enrichment) ?? {};
    const internalLinkSuggestions = extractSavedInternalLinkSuggestions(metadata, enrichment);
    const externalCitations = extractSavedExternalCitations(metadata, enrichment);

    return {
        markdown: input.markdown,
        length: inferRepairLengthTier(metadata, input.markdown),
        title: input.title,
        seoTitle: seoData.title ?? input.title,
        seoDescription: seoData.description ?? "",
        primaryKeyword: keywords[0],
        keywords,
        intent: inferRepairIntent(metadata),
        internalLinkSuggestions,
        externalCitations,
        faqItems: extractFaqItems(metadata),
        visualBlocks: getVisualEnrichment(metadata).visual_blocks,
        siteHost: input.siteHost ?? getSiteHost(),
        allowedInternalLinks: extractAllowedInternalLinks(metadata, enrichment, internalLinkSuggestions),
        forbiddenPublicTerms: input.forbiddenPublicTerms,
    };
}

function serializeIssues(issues: EditorialValidationIssue[]) {
    return issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        dimension: issue.dimension,
        message: issue.message,
        repair_instruction: issue.repairInstruction,
        heading: issue.heading ?? null,
        details: issue.details ?? null,
    }));
}

export function buildRepairedBlogMetadata(input: {
    metadata: unknown;
    seoData: RepairSeoData;
    validation: BlogEditorialValidationResult;
    repairAttempts: number;
    repaired: boolean;
    fallbackReason?: string | null;
}): Json {
    const metadata = asRecord(input.metadata) ?? {};
    const seo = asRecord(metadata.seo) ?? {};
    const enrichment = asRecord(metadata.enrichment) ?? {};
    const existingValidation = asRecord(enrichment.editorial_validation) ?? {};
    const nextSeo = {
        ...seo,
        ...(input.seoData.title ? { title: input.seoData.title } : {}),
        ...(input.seoData.description ? { description: input.seoData.description } : {}),
        ...(input.seoData.keywords ? { keywords: input.seoData.keywords } : {}),
    };

    return {
        ...metadata,
        seo: nextSeo,
        enrichment: {
            ...enrichment,
            editorial_validation: {
                ...existingValidation,
                valid: input.validation.valid,
                repair_attempts: input.repairAttempts,
                repaired: input.repaired,
                fallback_reason: input.fallbackReason ?? null,
                stats: input.validation.stats,
                issues: serializeIssues(input.validation.issues),
                issue_count: input.validation.issues.length,
                error_count: input.validation.issues.filter((issue) => issue.severity === "error").length,
                warning_count: input.validation.issues.filter((issue) => issue.severity === "warning").length,
                info_count: input.validation.issues.filter((issue) => issue.severity === "info").length,
            },
            editorial_scorecard: input.validation.scorecard,
        },
    } as unknown as Json;
}
