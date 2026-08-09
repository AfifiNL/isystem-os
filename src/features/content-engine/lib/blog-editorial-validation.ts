import {
    BLOG_EVIDENCE_TYPES,
    BLOG_SOURCE_QUALITIES,
    isPlaceholderSourceLabel,
    isSocialSourceHost,
    isWeakSourceHost,
    type BlogChartDatum,
    type BlogEvidenceConfidence,
    type BlogEvidenceRecord,
    type BlogEvidenceType,
    type BlogSourceQuality,
} from "../visual-enrichment";
import { containsAsciiDiagramLeak } from "./diagram-intents";
import {
    findUnsafeGeneratedOutput,
    type GeneratedOutputSafetyCode,
} from "@/shared/lib/ai/output-safety";

export type BlogDraftLengthTier = "short" | "medium" | "long" | "deep-dive";

export type BlogEditorialIntent =
    | "generic"
    | "guide"
    | "how-to"
    | "comparison"
    | "case-study"
    | "opinion"
    | "news";

export interface BlogLengthTierRule {
    minH2: number;
    targetH2Range: readonly [number, number];
    targetH2Label: string;
    minH3: number;
    longH2SectionWordThreshold: number;
    minSectionWords: number;
    minSubstantiveParagraphWords: number;
    minInternalLinkSuggestions: number;
    minResearchCitations: number;
}

export const BLOG_LENGTH_TIER_RULES: Record<BlogDraftLengthTier, BlogLengthTierRule> = {
    short: {
        minH2: 3,
        targetH2Range: [3, 5],
        targetH2Label: "3-5",
        minH3: 0,
        longH2SectionWordThreshold: 600,
        minSectionWords: 60,
        minSubstantiveParagraphWords: 35,
        minInternalLinkSuggestions: 0,
        minResearchCitations: 1,
    },
    medium: {
        minH2: 4,
        targetH2Range: [4, 6],
        targetH2Label: "4-6",
        minH3: 1,
        longH2SectionWordThreshold: 600,
        minSectionWords: 90,
        minSubstantiveParagraphWords: 40,
        minInternalLinkSuggestions: 2,
        minResearchCitations: 2,
    },
    long: {
        minH2: 5,
        targetH2Range: [5, 8],
        targetH2Label: "5-8",
        minH3: 2,
        longH2SectionWordThreshold: 600,
        minSectionWords: 120,
        minSubstantiveParagraphWords: 45,
        minInternalLinkSuggestions: 3,
        minResearchCitations: 3,
    },
    "deep-dive": {
        minH2: 7,
        targetH2Range: [7, 12],
        targetH2Label: "7-12",
        minH3: 4,
        longH2SectionWordThreshold: 600,
        minSectionWords: 150,
        minSubstantiveParagraphWords: 50,
        minInternalLinkSuggestions: 4,
        minResearchCitations: 4,
    },
};

export interface ExtractedEditorialHeading {
    level: number;
    text: string;
    normalizedText: string;
    parentH2: string | null;
    index: number;
}

export interface EditorialLinkSuggestion {
    url: string;
    anchor?: string;
    reason?: string;
}

export interface EditorialCitation {
    url: string;
    title?: string;
    publisher?: string;
}

export interface EditorialFaqItem {
    question: string;
    answer: string;
}

export interface EditorialVisualBlockLike {
    id: string;
    type?: string;
    chart_type?: string;
    title?: string;
    placement_hint?: string;
    source_label?: string;
    source_url?: string;
    data?: readonly BlogChartDatum[];
    evidence?: Partial<BlogEvidenceRecord> | null;
}

export interface BlogEditorialValidationInput {
    markdown: string;
    length: BlogDraftLengthTier;
    seoTitle?: string;
    seoDescription?: string;
    primaryKeyword?: string;
    keywords?: readonly string[];
    intent?: BlogEditorialIntent;
    internalLinkSuggestions?: readonly (EditorialLinkSuggestion | string)[];
    externalCitations?: readonly (EditorialCitation | string)[];
    faqItems?: readonly EditorialFaqItem[];
    visualBlocks?: readonly EditorialVisualBlockLike[];
    siteHost?: string;
    allowedInternalLinks?: readonly string[];
    title?: string;
    forbiddenPublicTerms?: readonly string[];
}

export type EditorialIssueSeverity = "error" | "warning" | "info";

export type EditorialScoreDimension =
    | "structure"
    | "editorialDepth"
    | "seo"
    | "linkingEvidence"
    | "faqReadiness"
    | "visualIntegration"
    | "localizationSafety";

export interface EditorialValidationIssue {
    code: string;
    severity: EditorialIssueSeverity;
    dimension: EditorialScoreDimension;
    message: string;
    repairInstruction: string;
    heading?: string;
    details?: Record<string, string | number | boolean | null>;
}

export interface EditorialScoreDimensionResult {
    score: number;
    maxScore: number;
    issueCount: number;
}

export interface EditorialScorecard {
    overall: number;
    passed: boolean;
    dimensions: Record<EditorialScoreDimension, EditorialScoreDimensionResult>;
}

export interface EditorialValidationStats {
    wordCount: number;
    h2Count: number;
    h3Count: number;
    h4PlusCount: number;
    visualShortcodeCount: number;
    internalMarkdownLinkCount: number;
    externalMarkdownLinkCount: number;
}

export interface BlogEditorialValidationResult {
    valid: boolean;
    issues: EditorialValidationIssue[];
    scorecard: EditorialScorecard;
    headings: ExtractedEditorialHeading[];
    stats: EditorialValidationStats;
}

interface AtxHeadingWithLine {
    level: number;
    text: string;
    normalizedText: string;
    line: number;
}

interface H2Section {
    heading: string;
    normalizedHeading: string;
    body: string;
    wordCount: number;
    substantiveParagraphCount: number;
    h3Count: number;
    visualShortcodeCount: number;
}

interface MarkdownLink {
    href: string;
    isInternal: boolean;
    isExternal: boolean;
}

interface VisualShortcodeMatch {
    raw: string;
    id: string | null;
    index: number;
    valid: boolean;
}

const FENCE_RE = /^\s*(```|~~~)/;
const ATX_HEADING_RE = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const STRICT_VISUAL_SHORTCODE_RE = /^\{\{visual:([A-Za-z0-9_-]+)\}\}$/;
const VISUALISH_SHORTCODE_RE = /\{\{\s*visual\s*:[^}]*\}\}/g;

const BANNED_GENERIC_HEADING_TEXTS = [
    "conclusion",
    "final thoughts",
    "key takeaways",
    "summary",
    "wrapping up",
    "introduction",
    "overview",
    "next steps",
    "what this means",
    "in conclusion",
    "conclusie",
    "samenvatting",
    "belangrijkste punten",
    "volgende stappen",
    "introductie",
    "overzicht",
    "الخلاصة",
    "خاتمة",
    "ملخص",
    "مقدمة",
    "نظرة عامة",
].map((heading) => normalizeHeadingForEditorialMatch(heading));

const FAQ_HEADING_TEXTS = [
    "faq",
    "faqs",
    "frequently asked questions",
    "veelgestelde vragen",
    "الأسئلة الشائعة",
].map((heading) => normalizeHeadingForEditorialMatch(heading));

const EDITORIAL_DIMENSIONS: EditorialScoreDimension[] = [
    "structure",
    "editorialDepth",
    "seo",
    "linkingEvidence",
    "faqReadiness",
    "visualIntegration",
    "localizationSafety",
];

export function normalizeHeadingForEditorialMatch(text: string): string {
    return text
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/[`*_~[\](){}<>]/g, " ")
        .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function extractMarkdownHeadings(markdown: string): ExtractedEditorialHeading[] {
    const headings = extractAtxHeadings(markdown).filter((heading) => heading.level >= 2);
    const out: ExtractedEditorialHeading[] = [];
    let parentH2: string | null = null;

    headings.forEach((heading) => {
        if (heading.level === 2) {
            parentH2 = heading.text;
        }
        out.push({
            level: heading.level,
            text: heading.text,
            normalizedText: heading.normalizedText,
            parentH2: heading.level === 2 ? null : parentH2,
            index: out.length,
        });
    });

    return out;
}

export function validateGeneratedBlogDraft(input: BlogEditorialValidationInput): BlogEditorialValidationResult {
    const markdown = input.markdown ?? "";
    const rules = BLOG_LENGTH_TIER_RULES[input.length];
    const issues: EditorialValidationIssue[] = [];
    const allHeadings = extractAtxHeadings(markdown);
    const headings = extractMarkdownHeadings(markdown);
    const sections = extractH2Sections(markdown);
    const links = extractMarkdownLinks(markdown, input.siteHost);
    const visualShortcodes = extractVisualShortcodes(markdown);
    const stats = buildStats(markdown, headings, links, visualShortcodes);

    validateHeadingStructure({ allHeadings, headings, sections, rules, issues });
    validateEditorialDepth({ sections, rules, issues });
    validateSeoBasics({ input, markdown, headings, issues });
    validateLinkingAndEvidence({ input, links, issues });
    validateFaqReadiness({ input, headings, issues });
    validateEditorialPolish({ input, markdown, issues });
    validateVisualEvidence(input, issues);
    validateVisualShortcodes({ input, markdown, sections, visualShortcodes, issues });
    validateDiagramLeaks(markdown, issues);

    const scorecard = buildEditorialScorecard(issues);
    return {
        valid: !issues.some((issue) => issue.severity === "error"),
        issues,
        scorecard,
        headings,
        stats,
    };
}

const PLURAL_SUBJECT_IS_CANDIDATE_RE = /\b(threats|risks|documents|systems|workflows|wrappers|controls|sources)\s+is\b/gi;
// "one of the risks is", "the number of systems is", and "the platform that
// hosts your documents is" are grammatically correct: the true subject is the
// singular head before "of" or before the relative clause, not the plural noun.
const PLURAL_SUBJECT_IS_SAFE_CONTEXT_RE = /(?:\bof\s+(?:[\p{L}\p{N}'’-]+\s+){0,3}|\b(?:that|which|who)\s+(?:[\p{L}\p{N}'’-]+\s+){1,3})$/iu;
const PLURAL_SUBJECT_IS_CONTEXT_WINDOW = 60;

function pluralSubjectIsMatches(text: string): Array<{ index: number; match: string; noun: string; safe: boolean }> {
    return Array.from(text.matchAll(PLURAL_SUBJECT_IS_CANDIDATE_RE)).map((match) => {
        const index = match.index ?? 0;
        const before = text.slice(Math.max(0, index - PLURAL_SUBJECT_IS_CONTEXT_WINDOW), index);
        return {
            index,
            match: match[0],
            noun: match[1],
            safe: PLURAL_SUBJECT_IS_SAFE_CONTEXT_RE.test(before),
        };
    });
}

export function hasLikelyPluralSubjectVerbDisagreement(text: string): boolean {
    return pluralSubjectIsMatches(text).some((candidate) => !candidate.safe);
}

export function repairLikelyPluralSubjectVerbDisagreements(text: string): string {
    let out = "";
    let cursor = 0;
    pluralSubjectIsMatches(text).forEach((candidate) => {
        out += text.slice(cursor, candidate.index);
        out += candidate.safe ? candidate.match : `${candidate.noun} are`;
        cursor = candidate.index + candidate.match.length;
    });
    return out + text.slice(cursor);
}

// SEO titles must stay within the 35-65 character production band, so a
// headline-style "keyword" (a full title with a subtitle) can never appear in
// one verbatim. Reduce it to its core phrase so keyword validation and repair
// stay satisfiable without degrading the article itself.
const MAX_EFFECTIVE_SEO_KEYWORD_LENGTH = 50;
const HEADLINE_SUBTITLE_SPLIT_RE = /\s*(?:[:：|–—]|\s-\s)\s*/;

export function resolveEffectivePrimaryKeyword(keyword: string): string {
    const trimmed = keyword.trim();
    if (!trimmed) return trimmed;
    const core = trimmed.split(HEADLINE_SUBTITLE_SPLIT_RE)[0]?.trim() || trimmed;
    if (core.length <= MAX_EFFECTIVE_SEO_KEYWORD_LENGTH) return core;
    let shortened = "";
    for (const word of core.split(/\s+/)) {
        const next = shortened ? `${shortened} ${word}` : word;
        if (shortened && next.length > MAX_EFFECTIVE_SEO_KEYWORD_LENGTH) break;
        shortened = next;
    }
    return shortened || core;
}

const GRAMMAR_POLISH_PATTERNS: ReadonlyArray<{ code: string; matches: (text: string) => boolean; message: string; repairInstruction: string }> = [
    {
        code: "article_indefinite_article_agreement",
        matches: (text) => /\bA\s+(?:approach|article|answer|AI|audit|automation|analysis|example|implementation|integration|operator|operating|orchestrator|architecture)\b/i.test(text),
        message: "Draft contains an obvious indefinite-article grammar error.",
        repairInstruction: "Replace the phrase with the correct article, usually 'an', and reread the surrounding sentence for fluency.",
    },
    {
        code: "subject_verb_agreement_these_is",
        matches: (text) => /\bThese\s+is\b/i.test(text),
        message: "Draft contains a subject-verb agreement error: 'These is'.",
        repairInstruction: "Rewrite the sentence with correct plural agreement, e.g. 'These are'.",
    },
    {
        code: "subject_verb_agreement_plural_is",
        matches: hasLikelyPluralSubjectVerbDisagreement,
        message: "Draft contains likely plural subject-verb disagreement.",
        repairInstruction: "Rewrite the sentence so plural nouns use plural verbs.",
    },
    {
        code: "singular_one_plural_noun",
        matches: (text) => /\bone\s+(?:documents|systems|workflows|articles|sources|claims|checks|risks|threats)\b/i.test(text),
        message: "Draft contains likely singular/plural mismatch after 'one'.",
        repairInstruction: "Use a singular noun after 'one' or rewrite the phrase for clarity.",
    },
    {
        code: "missing_object_after_past",
        matches: (text) => /\bmoving past brittle and building\b/i.test(text),
        message: "Draft contains an incomplete phrase after 'moving past'.",
        repairInstruction: "Name the brittle object being replaced, then rewrite the full sentence for fluency.",
    },
    {
        code: "incorrect_do_guidelines_collocation",
        matches: (text) => /\b(?:agents?|systems?|workflows?)\s+do(?:es)?\s+(?:your(?:\s+company)?|the|company)\s+guidelines\b/i.test(text),
        message: "Draft uses the incorrect phrase 'do guidelines'.",
        repairInstruction: "Use a precise verb such as follow, apply, or enforce, and verify that the claim is accurate.",
    },
    {
        code: "broken_requires_running_phrase",
        matches: (text) => /\brequires running\b[^.\n]{0,140},\s+on\b/i.test(text),
        message: "Draft contains a broken 'requires running …, on' construction.",
        repairInstruction: "Rewrite the sentence without the stray comma and avoid presenting one hosting pattern as an absolute requirement.",
    },
];

const DUPLICATE_LABEL_PATTERN = /\b([A-Z][A-Za-z]{3,})\s+\1\b/g;
const PUBLICATION_LEAK_DETAILS: Partial<Record<
    GeneratedOutputSafetyCode,
    { code: string; message: string; repairInstruction: string }
>> = {
    machine_evidence_reason: {
        code: "internal_evidence_reason_exposed",
        message: "Draft exposes an internal evidence-gate reason code.",
        repairInstruction: "Remove the machine reason code and write a concise reader-facing caveat if one is needed.",
    },
    native_review_marker: {
        code: "native_review_marker_exposed",
        message: "Draft exposes an internal localization review marker.",
        repairInstruction: "Keep the content unpublished until review is complete, then remove the workflow marker before publication.",
    },
    serialized_object: {
        code: "serialized_object_exposed",
        message: "Draft exposes a serialized application object.",
        repairInstruction: "Replace the broken interpolation with reviewed reader-facing copy.",
    },
    model_preamble: {
        code: "model_preamble_exposed",
        message: "Draft contains a model-response preamble.",
        repairInstruction: "Remove the assistant preamble and begin with the article itself.",
    },
    internal_content_field: {
        code: "internal_content_field_exposed",
        message: "Draft exposes an internal content-system field.",
        repairInstruction: "Remove internal field names and describe only what is useful to the reader.",
    },
    internal_billing_unit: {
        code: "internal_billing_unit_exposed",
        message: "Draft exposes an internal billing unit.",
        repairInstruction: "Describe the reader-facing usage record or cost control without naming the storage unit.",
    },
};

function publicationLeakDetails(code: GeneratedOutputSafetyCode) {
    return PUBLICATION_LEAK_DETAILS[code] ?? {
        code: "internal_authoring_text_exposed",
        message: "Draft exposes internal authoring or operating text.",
        repairInstruction: "Remove internal instructions and implementation mechanics; replace them with reader-facing outcomes.",
    };
}
const ABSOLUTE_PROMISE_PATTERN = /\b(?:ensur(?:e|es|ed|ing)|guarantee(?:s|d|ing)?)\s+(?:complete|full|absolute)\s+(?:compliance|control|security|privacy)|\babsolute data security\b/i;
const OUTDATED_EU_AI_ACT_PATTERN = /\b(?:impending|upcoming|forthcoming|proposed|coming)\s+(?:EU\s+)?AI\s+Act\b|\bEU\s+AI\s+Act\b[^.\n]{0,120}\b(?:impending|upcoming|forthcoming|proposed|coming)\b/i;
const NAMED_SOURCE_CLAIM_PATTERN = /\b(Cisco|Gartner|McKinsey|IBM|Forrester|Deloitte|PwC|KPMG|OECD|European Commission|EU Commission|Eurostat|NIST)\b[^.\n]{0,180}\b(?:reports?|reported|says?|said|states?|stated|finds?|found|shows?|showed|confirms?|confirmed|announced|published|estimates?|forecast|survey|study|research|data|claim|claims)\b/i;
const QUANTIFIED_PROSE_CLAIM_PATTERN = /(?:[€$]\s?\d+(?:[,.]\d+)?|\b\d+(?:\.\d+)?\s?(?:%|percent|percentage points|x|times|hours?|days?|weeks?|months?)(?=\W|$))/i;
const QUANTIFIED_PROSE_CAVEAT_PATTERN = /\b(?:scenario|directional|estimate|estimated|illustrative|model|hypothesis|not (?:a )?(?:guarantee|benchmark)|not guaranteed|not published benchmark|example)\b/i;
const BEFORE_AFTER_WORKFLOW_PATTERN = /\b(?:before|after|from\s+[^.\n]{3,80}\s+to\s+|as-is|to-be|current workflow|target workflow|existing workflow|new workflow)\b/i;
const IMPLEMENTATION_DETAIL_PATTERN = /\b(?:step|workflow|handoff|owner|approval|review|rollback|intake|queue|dashboard|SOP|checklist|stack|tool|CRM|CMS|database|API|pilot|sequence|process map|automation)\b/i;
const VAGUE_BIG_CLAIM_PATTERNS: readonly RegExp[] = [
    /\b(?:revolutioni[sz]e|transform(?:s|ed|ing)? your business|unlock (?:the )?(?:power|potential)|game[-\s]?changing|cutting[-\s]?edge|world[-\s]?class|unparalleled)\b/i,
    /\b(?:seamless|robust|comprehensive|end[-\s]?to[-\s]?end|powerful|innovative|scalable)\s+(?:solution|platform|system|approach|framework)\b/i,
    /\b(?:drive growth|boost productivity|increase efficiency|optimi[sz]e operations)\b/i,
];

function validateEditorialPolish(args: {
    input: BlogEditorialValidationInput;
    markdown: string;
    issues: EditorialValidationIssue[];
}) {
    const { input, markdown, issues } = args;
    const text = stripMarkdownNoise(markdown);

    GRAMMAR_POLISH_PATTERNS.forEach((check) => {
        if (!check.matches(text)) return;
        issues.push({
            code: check.code,
            severity: "error",
            dimension: "editorialDepth",
            message: check.message,
            repairInstruction: check.repairInstruction,
        });
    });

    const publicationFields = {
        markdown,
        title: input.title,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        faqItems: input.faqItems,
    };
    const seenPublicationLeakCodes = new Set<string>();
    findUnsafeGeneratedOutput(publicationFields).forEach((finding) => {
        const check = publicationLeakDetails(finding.code);
        if (seenPublicationLeakCodes.has(check.code)) return;
        seenPublicationLeakCodes.add(check.code);
        issues.push({
            code: check.code,
            severity: "error",
            dimension: "localizationSafety",
            message: check.message,
            repairInstruction: check.repairInstruction,
        });
    });

    (input.forbiddenPublicTerms ?? []).forEach((term) => {
        const normalized = term.trim();
        if (!normalized) return;
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`\\b${escaped}\\b`, "i").test(text)) return;
        issues.push({
            code: "forbidden_public_term",
            severity: "error",
            dimension: "localizationSafety",
            message: `Draft contains a forbidden public term: "${normalized}".`,
            repairInstruction: "Remove the cross-client or internal reference and rewrite the example in neutral, reader-facing language.",
            details: { term: normalized },
        });
    });

    if (ABSOLUTE_PROMISE_PATTERN.test(text)) {
        issues.push({
            code: "absolute_compliance_or_security_promise",
            severity: "error",
            dimension: "linkingEvidence",
            message: "Draft makes an absolute compliance, control, privacy, or security promise.",
            repairInstruction: "State the concrete control and its boundary. Do not guarantee complete compliance or absolute security.",
        });
    }

    const duplicateLabels = new Set<string>();
    let duplicateMatch: RegExpExecArray | null;
    DUPLICATE_LABEL_PATTERN.lastIndex = 0;
    while ((duplicateMatch = DUPLICATE_LABEL_PATTERN.exec(text)) !== null) {
        const repeated = duplicateMatch[0];
        if (/\b(?:had|that|with|from|have|were|will|this)\b/i.test(duplicateMatch[1])) continue;
        duplicateLabels.add(repeated);
    }
    duplicateLabels.forEach((label) => {
        issues.push({
            code: "duplicate_editorial_label",
            severity: "error",
            dimension: "editorialDepth",
            message: `Draft contains repeated label text: "${label}".`,
            repairInstruction: "Remove the duplicated label and rewrite the surrounding heading, caption, or list item so it reads as human-edited prose.",
        });
    });

    if (OUTDATED_EU_AI_ACT_PATTERN.test(text)) {
        issues.push({
            code: "outdated_eu_ai_act_wording",
            severity: "error",
            dimension: "linkingEvidence",
            message: "EU AI Act wording appears outdated; it is no longer 'impending' or merely 'upcoming'.",
            repairInstruction: "State that the EU AI Act entered into force on 1 August 2024, with obligations phasing in through 2025-2028 as applicable, and cite an official EU source.",
        });
    }

    const paragraphs = markdown.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    paragraphs.forEach((paragraph) => {
        const plain = stripMarkdownNoise(paragraph);
        if (!NAMED_SOURCE_CLAIM_PATTERN.test(plain)) return;
        const links = extractMarkdownLinks(paragraph, input.siteHost).filter((link) => link.isExternal);
        if (links.length > 0) return;
        issues.push({
            code: "named_source_claim_without_link",
            severity: "warning",
            dimension: "linkingEvidence",
            message: "A paragraph names a research/source publisher but does not link to the exact source.",
            repairInstruction: "Link the publisher mention to the primary source URL, or remove/soften the claim if the exact source cannot be verified.",
        });
    });

    validateUnsupportedProseStatistics({ input, paragraphs, issues });
    validateTrustAndPracticalitySignals({ input, markdown, text, issues });
    validateRepetitiveSeoPhrasing({ input, text, issues });
}

function validateUnsupportedProseStatistics(args: {
    input: BlogEditorialValidationInput;
    paragraphs: readonly string[];
    issues: EditorialValidationIssue[];
}) {
    const { input, paragraphs, issues } = args;
    paragraphs.forEach((paragraph) => {
        const plain = stripMarkdownNoise(paragraph);
        if (!QUANTIFIED_PROSE_CLAIM_PATTERN.test(plain)) return;
        if (QUANTIFIED_PROSE_CAVEAT_PATTERN.test(plain)) return;
        const externalLinks = extractMarkdownLinks(paragraph, input.siteHost).filter((link) => link.isExternal);
        if (externalLinks.length > 0) return;
        issues.push({
            code: "quantified_claim_without_source_or_caveat",
            severity: "warning",
            dimension: "linkingEvidence",
            message: "A paragraph contains a quantified claim without an adjacent external source link or scenario/estimate caveat.",
            repairInstruction: "Attach the exact source URL, or rewrite the number as a clearly labelled scenario model / directional estimate. Do not publish unsupported metrics.",
        });
    });
}

function validateTrustAndPracticalitySignals(args: {
    input: BlogEditorialValidationInput;
    markdown: string;
    text: string;
    issues: EditorialValidationIssue[];
}) {
    const { input, markdown, text, issues } = args;
    const wordCount = countWords(text);
    const practicalIntent = input.intent === "guide" || input.intent === "how-to" || input.intent === "comparison" || input.intent === "case-study";

    if (practicalIntent && wordCount >= 700 && !BEFORE_AFTER_WORKFLOW_PATTERN.test(text)) {
        issues.push({
            code: "missing_before_after_workflow_example",
            severity: "warning",
            dimension: "editorialDepth",
            message: "Practical article lacks a before/after, as-is/to-be, or workflow transition example.",
            repairInstruction: "Add a grounded before/after workflow example only if supported by the brief, author framework, source context, or labelled scenario model. Do not invent client results.",
        });
    }

    if (practicalIntent && wordCount >= 700 && !IMPLEMENTATION_DETAIL_PATTERN.test(text)) {
        issues.push({
            code: "missing_implementation_concreteness",
            severity: "warning",
            dimension: "editorialDepth",
            message: "Practical article lacks implementation-level language such as workflow ownership, review steps, tools, approvals, or operating sequence.",
            repairInstruction: "Add concrete process detail supported by the source material: steps, owner, review gate, tool category, stack/process mention, or rollout sequence.",
        });
    }

    const vagueHitCount = VAGUE_BIG_CLAIM_PATTERNS.reduce((count, pattern) => count + (text.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))?.length ?? 0), 0);
    if (vagueHitCount >= 3) {
        issues.push({
            code: "vague_big_claim_density",
            severity: "warning",
            dimension: "editorialDepth",
            message: `Draft contains ${vagueHitCount} vague transformation or corporate-marketing claims.`,
            repairInstruction: "Replace broad claims with named examples, workflow specifics, evidence labels, or narrower founder-led observations. If support is missing, soften the claim.",
            details: { found: vagueHitCount },
        });
    }

    const visualShortcodeCount = extractVisualShortcodes(markdown).filter((shortcode) => shortcode.valid).length;
    if ((input.visualBlocks?.length ?? 0) === 0 && visualShortcodeCount === 0 && input.length !== "short" && practicalIntent) {
        issues.push({
            code: "missing_visual_or_diagram_support",
            severity: "info",
            dimension: "visualIntegration",
            message: "Longer practical article has no diagram, chart, screenshot, or visual evidence block metadata.",
            repairInstruction: "If available, add a workflow diagram, architecture sketch, or visual evidence block with explicit evidence taxonomy. Do not fabricate screenshots or charts.",
        });
    }
}

function validateRepetitiveSeoPhrasing(args: {
    input: BlogEditorialValidationInput;
    text: string;
    issues: EditorialValidationIssue[];
}) {
    const { input, text, issues } = args;
    const rawKeyword = firstNonEmpty([input.primaryKeyword, ...(input.keywords ?? [])]);
    const keyword = rawKeyword ? resolveEffectivePrimaryKeyword(rawKeyword) : undefined;
    if (!keyword || keyword.length < 8) return;
    const normalizedText = normalizeHeadingForEditorialMatch(text);
    const normalizedKeyword = normalizeHeadingForEditorialMatch(keyword);
    if (!normalizedText || !normalizedKeyword) return;
    const count = countPhraseOccurrences(normalizedText, normalizedKeyword);
    const wordCount = countWords(text);
    const allowed = Math.max(4, Math.ceil(wordCount / 240));
    if (count > allowed) {
        issues.push({
            code: "repetitive_exact_keyword_phrasing",
            severity: "warning",
            dimension: "seo",
            message: `Exact primary keyword phrase appears ${count} times; this risks SEO-assisted repetition.`,
            repairInstruction: "Keep the keyword in SEO-critical places, but vary body phrasing with natural synonyms and reader-specific language.",
            details: { found: count, allowed },
        });
    }
}

function countPhraseOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let index = 0;
    while ((index = haystack.indexOf(needle, index)) !== -1) {
        count += 1;
        index += needle.length;
    }
    return count;
}

function validateDiagramLeaks(markdown: string, issues: EditorialValidationIssue[]) {
    const DIAGRAM_FAMILY_BLOCK_START_RE = /^(?:```|~~~)?\s*(?:mermaid|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|mindmap|timeline|quadrantChart|gitGraph|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic)\b/im;

    if (DIAGRAM_FAMILY_BLOCK_START_RE.test(markdown)) {
        issues.push({
            code: "leaked_diagram_dsl",
            severity: "error",
            dimension: "visualIntegration",
            message: "Draft contains raw Mermaid or diagram DSL syntax.",
            repairInstruction: "Remove all Mermaid, flowchart, and diagram DSL code blocks from the body. You must only use {{visual:ID}} shortcodes for diagrams.",
        });
    }

    if (containsAsciiDiagramLeak(markdown)) {
        issues.push({
            code: "leaked_ascii_art_diagram",
            severity: "error",
            dimension: "visualIntegration",
            message: "Draft contains an ASCII/text diagram instead of a structured visual block.",
            repairInstruction: "Convert the diagram intent to structured visual metadata and keep only its {{visual:ID}} shortcode in the article body.",
        });
    }
}

export function buildEditorialScorecard(issues: readonly EditorialValidationIssue[]): EditorialScorecard {
    const dimensions = Object.fromEntries(
        EDITORIAL_DIMENSIONS.map((dimension) => [
            dimension,
            { score: 100, maxScore: 100, issueCount: 0 } satisfies EditorialScoreDimensionResult,
        ]),
    ) as Record<EditorialScoreDimension, EditorialScoreDimensionResult>;

    issues.forEach((issue) => {
        const bucket = dimensions[issue.dimension];
        bucket.issueCount += 1;
        bucket.score = Math.max(0, bucket.score - issuePenalty(issue.severity));
    });

    const overall = Math.round(
        EDITORIAL_DIMENSIONS.reduce((sum, dimension) => sum + dimensions[dimension].score, 0) /
        EDITORIAL_DIMENSIONS.length,
    );

    return {
        overall,
        passed: !issues.some((issue) => issue.severity === "error"),
        dimensions,
    };
}

export function formatValidationIssuesForPrompt(
    issues: readonly EditorialValidationIssue[],
    options: { maxIssues?: number; includeInfo?: boolean } = {},
): string {
    const maxIssues = options.maxIssues ?? 12;
    const filtered = issues
        .filter((issue) => options.includeInfo || issue.severity !== "info")
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
        .slice(0, maxIssues);

    if (filtered.length === 0) {
        return "No editorial validation issues were found. Preserve the article structure and do not rewrite unnecessarily.";
    }

    return filtered
        .map((issue, index) => {
            const heading = issue.heading ? ` [heading: ${issue.heading}]` : "";
            return `${index + 1}. ${issue.severity.toUpperCase()} ${issue.code}${heading}: ${issue.message} Repair: ${issue.repairInstruction}`;
        })
        .join("\n");
}

function validateHeadingStructure(args: {
    allHeadings: readonly AtxHeadingWithLine[];
    headings: readonly ExtractedEditorialHeading[];
    sections: readonly H2Section[];
    rules: BlogLengthTierRule;
    issues: EditorialValidationIssue[];
}) {
    const { allHeadings, headings, sections, rules, issues } = args;
    const h1s = allHeadings.filter((heading) => heading.level === 1);
    const h2s = headings.filter((heading) => heading.level === 2);
    const h3s = headings.filter((heading) => heading.level === 3);

    h1s.forEach((heading) => {
        issues.push({
            code: "body_h1_present",
            severity: "error",
            dimension: "structure",
            message: `Body contains an H1 heading: "${heading.text}".`,
            repairInstruction: "Remove the in-body H1. The saved post title is the article H1; body markdown must start with intro prose or H2 sections.",
            heading: heading.text,
            details: { line: heading.line },
        });
    });

    if (h2s.length < rules.minH2) {
        issues.push({
            code: "h2_count_below_tier_minimum",
            severity: "error",
            dimension: "structure",
            message: `Draft has ${h2s.length} H2 sections; ${rules.minH2}+ are required for this length tier.`,
            repairInstruction: `Restructure the body into ${rules.targetH2Label} substantive ## sections without adding a body H1 or generic closing heading.`,
            details: { found: h2s.length, required: rules.minH2 },
        });
    }

    if (h2s.length > rules.targetH2Range[1]) {
        issues.push({
            code: "h2_count_above_tier_target",
            severity: "warning",
            dimension: "structure",
            message: `Draft has ${h2s.length} H2 sections; target range is ${rules.targetH2Label}.`,
            repairInstruction: "Merge thin or overlapping H2 sections so each remaining section carries a distinct argument.",
            details: { found: h2s.length, targetMax: rules.targetH2Range[1] },
        });
    }

    if (h3s.length < rules.minH3) {
        issues.push({
            code: "h3_count_below_tier_expectation",
            severity: "warning",
            dimension: "structure",
            message: `Draft has ${h3s.length} H3 subheadings; this length tier expects at least ${rules.minH3}.`,
            repairInstruction: "Add specific ### subheadings inside the longest H2 sections where they help readers scan the argument.",
            details: { found: h3s.length, expected: rules.minH3 },
        });
    }

    allHeadings.forEach((heading, index) => {
        const previous = allHeadings[index - 1];
        if (!previous) {
            if (heading.level > 2) {
                issues.push({
                    code: "heading_starts_below_h2",
                    severity: "error",
                    dimension: "structure",
                    message: `First heading is H${heading.level}, which skips the opening H2 level.`,
                    repairInstruction: "Start the body structure with ## sections, then nest ### and deeper headings only inside those sections.",
                    heading: heading.text,
                    details: { line: heading.line, level: heading.level },
                });
            }
            return;
        }

        if (heading.level > previous.level + 1) {
            issues.push({
                code: "skipped_heading_level",
                severity: "error",
                dimension: "structure",
                message: `Heading "${heading.text}" jumps from H${previous.level} to H${heading.level}.`,
                repairInstruction: "Insert the missing intermediate heading level or promote this heading so the outline does not skip levels.",
                heading: heading.text,
                details: { previousLevel: previous.level, currentLevel: heading.level, line: heading.line },
            });
        }
    });

    headings.forEach((heading) => {
        if (BANNED_GENERIC_HEADING_TEXTS.includes(heading.normalizedText)) {
            issues.push({
                code: "banned_generic_heading",
                severity: heading.level === 2 ? "error" : "warning",
                dimension: "editorialDepth",
                message: `Generic heading "${heading.text}" is not editorially specific.`,
                repairInstruction: "Replace it with a concrete, topic-specific promise or remove the closing-summary section entirely.",
                heading: heading.text,
            });
        }
    });

    validateAdjacentH2Patterns(sections, issues);
}

function validateAdjacentH2Patterns(sections: readonly H2Section[], issues: EditorialValidationIssue[]) {
    for (let index = 1; index < sections.length; index += 1) {
        const previous = sections[index - 1];
        const current = sections[index];
        const previousPattern = classifyHeadingPattern(previous.heading);
        const currentPattern = classifyHeadingPattern(current.heading);

        if (previousPattern && previousPattern === currentPattern) {
            issues.push({
                code: "adjacent_h2_pattern_repetition",
                severity: "warning",
                dimension: "editorialDepth",
                message: `Adjacent H2 headings repeat the same pattern (${previousPattern}): "${previous.heading}" → "${current.heading}".`,
                repairInstruction: "Vary the section architecture so adjacent H2s do not read like a generated template. Use distinct claims, tensions, or reader jobs.",
                heading: current.heading,
                details: { sectionIndex: index },
            });
        }
    }
}

function validateEditorialDepth(args: {
    sections: readonly H2Section[];
    rules: BlogLengthTierRule;
    issues: EditorialValidationIssue[];
}) {
    const { sections, rules, issues } = args;
    sections.forEach((section) => {
        if (section.substantiveParagraphCount === 0) {
            issues.push({
                code: "h2_missing_substantive_paragraph",
                severity: "error",
                dimension: "editorialDepth",
                message: `H2 section "${section.heading}" has no paragraph of at least ${rules.minSubstantiveParagraphWords} words.`,
                repairInstruction: "Add a real explanatory paragraph under this H2 before bullets, visuals, or the next heading.",
                heading: section.heading,
                details: { wordCount: section.wordCount },
            });
        }

        if (section.wordCount > 0 && section.wordCount < rules.minSectionWords) {
            issues.push({
                code: "h2_section_too_thin",
                severity: "warning",
                dimension: "editorialDepth",
                message: `H2 section "${section.heading}" has ${section.wordCount} words; expected at least ${rules.minSectionWords}.`,
                repairInstruction: "Develop this section with concrete explanation, examples, evidence, or merge it into a stronger neighbouring section.",
                heading: section.heading,
                details: { wordCount: section.wordCount, expected: rules.minSectionWords },
            });
        }

        if (section.wordCount > rules.longH2SectionWordThreshold && section.h3Count === 0) {
            issues.push({
                code: "long_h2_section_requires_h3",
                severity: "warning",
                dimension: "structure",
                message: `H2 section "${section.heading}" has ${section.wordCount} words without an H3 subheading.`,
                repairInstruction: "Split this long section with one or more specific ### subheadings, or shorten it below the long-section threshold.",
                heading: section.heading,
                details: { wordCount: section.wordCount, threshold: rules.longH2SectionWordThreshold },
            });
        }
    });
}

function validateSeoBasics(args: {
    input: BlogEditorialValidationInput;
    markdown: string;
    headings: readonly ExtractedEditorialHeading[];
    issues: EditorialValidationIssue[];
}) {
    const { input, markdown, headings, issues } = args;
    const titleLength = (input.seoTitle ?? "").trim().length;
    const descriptionLength = (input.seoDescription ?? "").trim().length;

    if (titleLength < 35 || titleLength > 65) {
        issues.push({
            code: "seo_title_outside_safe_band",
            severity: "error",
            dimension: "seo",
            message: `SEO title is ${titleLength} characters; safe production band is 35-65 characters.`,
            repairInstruction: "Rewrite the SEO title to be specific, click-worthy, and roughly 45-60 characters.",
            details: { titleLength },
        });
    } else if (titleLength < 45 || titleLength > 60) {
        issues.push({
            code: "seo_title_outside_optimal_band",
            severity: "warning",
            dimension: "seo",
            message: `SEO title is ${titleLength} characters; optimal band is 45-60 characters.`,
            repairInstruction: "Tighten or expand the SEO title toward 45-60 characters while preserving the primary keyword.",
            details: { titleLength },
        });
    }

    if (descriptionLength < 90 || descriptionLength > 170) {
        issues.push({
            code: "seo_description_outside_safe_band",
            severity: "error",
            dimension: "seo",
            message: `SEO description is ${descriptionLength} characters; safe production band is 90-170 characters.`,
            repairInstruction: "Rewrite the meta description to summarize the reader value in roughly 120-160 characters.",
            details: { descriptionLength },
        });
    } else if (descriptionLength < 120 || descriptionLength > 160) {
        issues.push({
            code: "seo_description_outside_optimal_band",
            severity: "warning",
            dimension: "seo",
            message: `SEO description is ${descriptionLength} characters; optimal band is 120-160 characters.`,
            repairInstruction: "Tune the meta description toward 120-160 characters without stuffing keywords.",
            details: { descriptionLength },
        });
    }

    const rawKeyword = firstNonEmpty([input.primaryKeyword, ...(input.keywords ?? [])]);
    if (!rawKeyword) return;

    const keyword = resolveEffectivePrimaryKeyword(rawKeyword);
    const normalizedKeyword = normalizeHeadingForEditorialMatch(keyword);
    const localizedKeywordMismatch = isLikelyLocalizedKeywordMismatch(keyword, input.seoTitle ?? input.title ?? "");
    const intro = firstWords(stripMarkdownNoise(markdown), 120);
    const h2Texts = headings.filter((heading) => heading.level === 2).map((heading) => heading.normalizedText).join(" ");

    if (!containsNormalized(input.seoTitle ?? "", normalizedKeyword)) {
        issues.push({
            code: "primary_keyword_missing_from_seo_title",
            severity: localizedKeywordMismatch ? "warning" : "error",
            dimension: "seo",
            message: `Primary keyword "${keyword}" is missing from the SEO title.`,
            repairInstruction: localizedKeywordMismatch
                ? "Use locale-native keyword research for this translation; do not force the English canonical keyword into a Dutch or Arabic title."
                : "Include the primary keyword naturally in the SEO title without making the title read like a keyword list.",
        });
    }

    if (!containsNormalized(input.seoDescription ?? "", normalizedKeyword)) {
        issues.push({
            code: "primary_keyword_missing_from_seo_description",
            severity: "warning",
            dimension: "seo",
            message: `Primary keyword "${keyword}" is missing from the SEO description.`,
            repairInstruction: "Work the primary keyword or a very close variant into the meta description naturally.",
        });
    }

    if (!containsNormalized(intro, normalizedKeyword)) {
        issues.push({
            code: "primary_keyword_missing_from_intro",
            severity: "warning",
            dimension: "seo",
            message: `Primary keyword "${keyword}" does not appear in the opening 120 words.`,
            repairInstruction: "Mention the primary keyword once in the intro where it clarifies the reader problem, not as a forced exact-match phrase.",
        });
    }

    if (!containsNormalized(h2Texts, normalizedKeyword)) {
        issues.push({
            code: "primary_keyword_missing_from_h2s",
            severity: "info",
            dimension: "seo",
            message: `Primary keyword "${keyword}" does not appear in any H2 heading.`,
            repairInstruction: "If it fits the article architecture, include the primary keyword or a close variant in one H2.",
        });
    }
}

function validateLinkingAndEvidence(args: {
    input: BlogEditorialValidationInput;
    links: readonly MarkdownLink[];
    issues: EditorialValidationIssue[];
}) {
    const { input, links, issues } = args;
    const rules = BLOG_LENGTH_TIER_RULES[input.length];
    const internalSuggestions = (input.internalLinkSuggestions ?? []).filter((suggestion) => {
        const url = typeof suggestion === "string" ? suggestion : suggestion.url;
        return typeof url === "string" && url.trim().length > 0;
    });
    const internalMarkdownLinks = links.filter((link) => link.isInternal);

    if (rules.minInternalLinkSuggestions > 0 && internalSuggestions.length < rules.minInternalLinkSuggestions && internalMarkdownLinks.length < rules.minInternalLinkSuggestions) {
        issues.push({
            code: "insufficient_internal_link_suggestions",
            severity: "warning",
            dimension: "linkingEvidence",
            message: `${input.length} drafts need ${rules.minInternalLinkSuggestions}+ internal-link suggestions or already-inserted internal links; found ${Math.max(internalSuggestions.length, internalMarkdownLinks.length)}.`,
            repairInstruction: "Pass relevant content-graph suggestions into the repair prompt or add natural internal links to related workspace articles/pages.",
            details: {
                required: rules.minInternalLinkSuggestions,
                suggestions: internalSuggestions.length,
                markdownLinks: internalMarkdownLinks.length,
            },
        });
    }

    const citationCount = countResearchCitations(input.externalCitations, links);
    if (citationCount < rules.minResearchCitations) {
        issues.push({
            code: "insufficient_research_citations",
            severity: rules.minResearchCitations > 1 ? "warning" : "error",
            dimension: "linkingEvidence",
            message: `Draft has ${citationCount} research-led external citations; ${rules.minResearchCitations}+ expected for this length tier.`,
            repairInstruction: "Ground claims in verified external sources and pass those source URLs through as citations or markdown links.",
            details: { found: citationCount, required: rules.minResearchCitations },
        });
    }

    if (input.allowedInternalLinks) {
        const allowedPaths = new Set([
            ...IMPLICITLY_ALLOWED_PATHS,
            ...input.allowedInternalLinks.map(normalizePath),
        ]);

        internalMarkdownLinks.forEach((link) => {
            const path = normalizePath(link.href);
            if (!allowedPaths.has(path)) {
                issues.push({
                    code: "invalid_internal_link",
                    severity: "warning",
                    dimension: "linkingEvidence",
                    message: `Internal link "${link.href}" is invalid or does not exist (404 risk).`,
                    repairInstruction: "Replace the link URL with a valid published page path or slug from the workspace inventory.",
                    details: { href: link.href, path },
                });
            }
        });
    }
}

function validateFaqReadiness(args: {
    input: BlogEditorialValidationInput;
    headings: readonly ExtractedEditorialHeading[];
    issues: EditorialValidationIssue[];
}) {
    const { input, headings, issues } = args;
    if (!isFaqReadyIntent(input.intent)) return;

    const hasFaqHeading = headings.some((heading) => FAQ_HEADING_TEXTS.includes(heading.normalizedText));
    const faqItemCount = (input.faqItems ?? []).filter((item) => item.question.trim() && item.answer.trim()).length;

    if (!hasFaqHeading && faqItemCount < 2) {
        issues.push({
            code: "faq_readiness_missing",
            severity: "warning",
            dimension: "faqReadiness",
            message: `${input.intent} content should be FAQ-ready, but no FAQ section or 2+ FAQ schema items were provided.`,
            repairInstruction: "Add a compact FAQ section or provide at least two schema-ready FAQ question/answer pairs tied to search intent.",
            details: { faqItemCount },
        });
    }
}

const NUMERIC_CHART_EVIDENCE_TYPES = new Set<BlogEvidenceType>([
    "verified_statistic",
    "time_sensitive_benchmark",
    "forecast",
    "internal_estimate",
]);

const INTERNAL_EVIDENCE_TYPES = new Set<BlogEvidenceType>([
    "author_framework",
    "author_synthesis",
    "internal_estimate",
]);

const EXACT_NUMBER_RE = /(?:\b\d+(?:\.\d+)?\s?%\b|\b\d{2,}(?:\.\d+)?\b)/;
const SOURCE_YEAR_RE = /\b(?:19|20)\d{2}\b/;
const EXTERNAL_PROOF_TYPES = new Set<BlogEvidenceType>([
    "verified_statistic",
    "time_sensitive_benchmark",
    "forecast",
]);

const STRONG_QUANT_SOURCE_QUALITIES = new Set<BlogSourceQuality>(["primary", "near_primary"]);
const ROI_OR_PRODUCTIVITY_CLAIM_RE = /\b(?:roi|return on investment|productivity|savings?|save[sd]?|time[-\s]?savings?|hours? recovered|cost reduction|efficiency gain|margin expansion|payback|revenue uplift|profit)\b/i;
const DIRECT_OBSERVATION_CAVEAT_RE = /\b(?:observed|survey|telemetry|official|field experiment|dataset|benchmark|measured|reported)\b/i;
const INTERNAL_OR_SECONDARY_CAVEAT_RE = /\b(?:scenario|directional|not (?:a )?(?:guarantee|benchmark)|not guaranteed|estimate|forecast|context|restatement|synthesis|model|hypothesis)\b/i;

function validateVisualEvidence(input: BlogEditorialValidationInput, issues: EditorialValidationIssue[]) {
    const visualBlocks = input.visualBlocks ?? [];

    visualBlocks.forEach((block) => {
        const evidence = normalizeEditorialVisualEvidence(block);
        const evidenceType = evidence.evidence_type;
        const sourceLabel = firstNonEmpty([evidence.source_label, block.source_label]);
        const sourceUrl = firstNonEmpty([evidence.source_url, block.source_url]);
        const sourceQuality = evidence.source_quality;
        const evidenceText = [block.title, block.source_label, evidence.claim_text, evidence.source_label, evidence.metric_definition, evidence.geography_and_sample, evidence.source_note, evidence.safe_fallback_wording]
            .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
            .join("\n");
        const hasInternalMethodology = Boolean(firstNonEmpty([evidence.metric_definition, evidence.source_note, evidence.safe_fallback_wording]));

        if (sourceLabel && isPlaceholderSourceLabel(sourceLabel)) {
            issues.push({
                code: "visual_evidence_banned_source_label",
                severity: "error",
                dimension: "visualIntegration",
                message: `Visual "${block.id}" uses banned source label "${sourceLabel}".`,
                repairInstruction: "Remove AI/synthesis placeholder labels. Use a named publisher with source_url, mark the visual as author_framework/author_synthesis/internal_estimate, or remove the visual.",
                details: { id: block.id, sourceLabel },
            });
        }

        if (!BLOG_EVIDENCE_TYPES.includes(evidenceType)) {
            issues.push({
                code: "visual_evidence_invalid_type",
                severity: "error",
                dimension: "visualIntegration",
                message: `Visual "${block.id}" has invalid evidence_type "${String(evidenceType)}".`,
                repairInstruction: "Set evidence.evidence_type to verified_statistic, time_sensitive_benchmark, forecast, author_framework, author_synthesis, internal_estimate, or unsupported.",
                details: { id: block.id, evidenceType: String(evidenceType) },
            });
        }

        if (block.type === "chart" && hasNumericChartData(block)) {
            if (!NUMERIC_CHART_EVIDENCE_TYPES.has(evidenceType)) {
                issues.push({
                    code: "visual_numeric_chart_invalid_evidence_type",
                    severity: "error",
                    dimension: "visualIntegration",
                    message: `Numeric chart "${block.id}" uses evidence_type "${evidenceType}" instead of a statistic, benchmark, forecast, or internal estimate type.`,
                    repairInstruction: "Use verified_statistic, time_sensitive_benchmark, forecast, or internal_estimate for numeric charts, or remove numeric values from author-framework visuals.",
                    details: { id: block.id, evidenceType },
                });
            }

            if (evidenceType === "internal_estimate") {
                if (!hasInternalMethodology) {
                    issues.push({
                        code: "visual_internal_estimate_missing_methodology",
                        severity: "error",
                        dimension: "visualIntegration",
                        message: `Internal-estimate chart "${block.id}" is missing a methodology note or metric definition.`,
                        repairInstruction: "Add evidence.metric_definition or evidence.source_note explaining the internal methodology, sample, or scenario assumptions.",
                        details: { id: block.id },
                    });
                }
            } else if (!sourceUrl) {
                issues.push({
                    code: "visual_numeric_chart_missing_source_url",
                    severity: "error",
                    dimension: "visualIntegration",
                    message: `Numeric chart "${block.id}" is missing source_url for external evidence.`,
                    repairInstruction: "Attach the exact source page URL for the statistic, benchmark, or forecast; if it is an internal estimate, change evidence_type and add methodology.",
                    details: { id: block.id, evidenceType },
                });
            }

            if (evidenceType !== "internal_estimate" && hasExactNumericClaim(block) && !evidence.publication_date && !sourceLabelHasYear(sourceLabel)) {
                issues.push({
                    code: "visual_exact_number_missing_source_date",
                    severity: "warning",
                    dimension: "visualIntegration",
                    message: `Exact-number chart "${block.id}" is missing source publication date or dataset year.`,
                    repairInstruction: "Add evidence.publication_date, or include an exact dataset/report year in source_label for named datasets.",
                    details: { id: block.id },
                });
            }

            if (hasExactNumericClaim(block) && !evidence.metric_definition) {
                issues.push({
                    code: "visual_exact_number_missing_metric_definition",
                    severity: "warning",
                    dimension: "visualIntegration",
                    message: `Exact-number chart "${block.id}" is missing a metric definition.`,
                    repairInstruction: "Add evidence.metric_definition explaining what the value measures and the denominator/sample where feasible.",
                    details: { id: block.id },
                });
            }

            if (hasExactNumericClaim(block) && !evidence.geography_and_sample && evidenceType !== "internal_estimate") {
                issues.push({
                    code: "visual_exact_number_missing_scope",
                    severity: "warning",
                    dimension: "visualIntegration",
                    message: `Exact-number chart "${block.id}" is missing geography/sample/scope metadata.`,
                    repairInstruction: "Add evidence.geography_and_sample explaining geography, sample/base, and whether the metric is observed, forecast, telemetry, vendor-reported, or author synthesis.",
                    details: { id: block.id },
                });
            }

            const vendorTelemetryCaveated = sourceQuality === "vendor" && evidenceType === "time_sensitive_benchmark" && /vendor|telemetry|product data|not (?:a )?universal|customer\/product/i.test(evidenceText);
            if (EXTERNAL_PROOF_TYPES.has(evidenceType) && hasExactNumericClaim(block) && !vendorTelemetryCaveated && (!STRONG_QUANT_SOURCE_QUALITIES.has(sourceQuality) || (sourceUrl && isWeakSourceHost(sourceUrl)))) {
                issues.push({
                    code: "visual_quantitative_weak_source_hierarchy",
                    severity: "error",
                    dimension: "visualIntegration",
                    message: `Quantitative visual "${block.id}" needs primary or near-primary source hierarchy.`,
                    repairInstruction: "Use a primary/near-primary source for exact quantitative visuals. If only a vendor, blog, social, or secondary restatement is available, downgrade to internal_estimate/author_synthesis and add a clear caveat.",
                    details: { id: block.id, sourceQuality, sourceUrl: sourceUrl ?? null },
                });
            }

            if (sourceUrl && isSocialSourceHost(sourceUrl) && EXTERNAL_PROOF_TYPES.has(evidenceType)) {
                issues.push({
                    code: "visual_quantitative_social_source",
                    severity: "error",
                    dimension: "visualIntegration",
                    message: `Quantitative visual "${block.id}" uses a social URL as evidence.`,
                    repairInstruction: "Replace LinkedIn/X/social links with the original report, study, regulator page, or vendor research page; social links may only be social/context, not statistic support.",
                    details: { id: block.id, sourceUrl },
                });
            }

            if (ROI_OR_PRODUCTIVITY_CLAIM_RE.test(evidenceText)) {
                const needsCaveat = evidenceType === "forecast" || evidenceType === "internal_estimate" || evidenceType === "author_synthesis" || sourceQuality === "secondary" || sourceQuality === "vendor";
                if (needsCaveat && !INTERNAL_OR_SECONDARY_CAVEAT_RE.test(evidenceText)) {
                    issues.push({
                        code: "visual_hard_roi_claim_needs_caveat",
                        severity: "error",
                        dimension: "visualIntegration",
                        message: `Visual "${block.id}" makes a hard ROI/productivity claim without a caveat compatible with its evidence quality.`,
                        repairInstruction: "For forecasts, internal estimates, author syntheses, secondary sources, or vendor sources, label ROI/productivity claims as directional, scenario, forecast, context, or not guaranteed.",
                        details: { id: block.id, evidenceType, sourceQuality },
                    });
                }
            }
        }

        if (INTERNAL_EVIDENCE_TYPES.has(evidenceType) && (DIRECT_OBSERVATION_CAVEAT_RE.test(evidenceText) || /\bbenchmark\b/i.test(evidenceText)) && !/not (?:a )?(?:external )?benchmark|not external proof|not a measured/i.test(evidenceText)) {
            issues.push({
                code: "visual_framework_displayed_as_benchmark",
                severity: "warning",
                dimension: "visualIntegration",
                message: `Framework/synthesis visual "${block.id}" may read like external evidence.`,
                repairInstruction: "Keep author framework/synthesis visuals separate from statistical visuals and label them clearly: “Author framework — not a benchmark.”",
                details: { id: block.id, evidenceType },
            });
        }

        if (EXTERNAL_PROOF_TYPES.has(evidenceType) && sourceLabel && !sourceUrl && evidenceType !== "internal_estimate") {
            issues.push({
                code: "visual_external_evidence_missing_source_url",
                severity: "error",
                dimension: "visualIntegration",
                message: `Visual "${block.id}" names external source "${sourceLabel}" without source_url.`,
                repairInstruction: "Add the exact source URL or downgrade the visual to author_synthesis/internal_estimate with a clear note.",
                details: { id: block.id, sourceLabel, evidenceType },
            });
        }

        if (evidenceType === "forecast" && (!evidence.publication_date || !/forecast|not (?:a )?performance guarantee|not guaranteed|forward-looking/i.test(evidence.source_note ?? ""))) {
            issues.push({
                code: "visual_forecast_missing_date_or_caveat",
                severity: "warning",
                dimension: "visualIntegration",
                message: `Forecast visual "${block.id}" needs a source date and caveat.`,
                repairInstruction: "Add evidence.publication_date and a source_note saying forecasts are forward-looking estimates, not performance guarantees.",
                details: { id: block.id, hasPublicationDate: Boolean(evidence.publication_date) },
            });
        }

        if (INTERNAL_EVIDENCE_TYPES.has(evidenceType) && sourceUrl) {
            issues.push({
                code: "visual_author_synthesis_displayed_as_external_proof",
                severity: "warning",
                dimension: "visualIntegration",
                message: `Visual "${block.id}" is ${evidenceType} but also carries source_url, which can display it as external proof.`,
                repairInstruction: "For author frameworks/syntheses, clear source_url or change evidence_type to the external evidence category only if the visual directly represents that source.",
                details: { id: block.id, evidenceType },
            });
        }
    });
}

function normalizeEditorialVisualEvidence(block: EditorialVisualBlockLike): Partial<BlogEvidenceRecord> & { evidence_type: BlogEvidenceType; source_quality: BlogSourceQuality; confidence: BlogEvidenceConfidence } {
    const evidence = block.evidence ?? {};
    const evidenceType = typeof evidence.evidence_type === "string" && BLOG_EVIDENCE_TYPES.includes(evidence.evidence_type as BlogEvidenceType)
        ? evidence.evidence_type as BlogEvidenceType
        : block.type === "chart" && block.source_url
            ? "verified_statistic"
            : block.type === "diagram"
                ? "author_framework"
                : "unsupported";
    const sourceQuality = typeof evidence.source_quality === "string" && BLOG_SOURCE_QUALITIES.includes(evidence.source_quality as BlogSourceQuality)
        ? evidence.source_quality as BlogSourceQuality
        : "unknown";
    const confidence = evidence.confidence === "high" || evidence.confidence === "medium" || evidence.confidence === "low"
        ? evidence.confidence
        : "low";
    return {
        ...evidence,
        evidence_type: evidenceType,
        source_quality: sourceQuality,
        confidence,
    };
}

function hasNumericChartData(block: EditorialVisualBlockLike): boolean {
    return Array.isArray(block.data) && block.data.some((datum) => typeof datum.value === "number" && Number.isFinite(datum.value));
}

function hasExactNumericClaim(block: EditorialVisualBlockLike): boolean {
    const textParts = [block.title, block.source_label, block.evidence?.claim_text, block.evidence?.source_label, block.evidence?.metric_definition];
    const textHasNumber = textParts.some((part) => typeof part === "string" && EXACT_NUMBER_RE.test(part));
    const numericData = Array.isArray(block.data) && block.data.some((datum) => Number.isFinite(datum.value));
    return textHasNumber || numericData;
}

function sourceLabelHasYear(label: string | undefined): boolean {
    return Boolean(label && SOURCE_YEAR_RE.test(label));
}

function validateVisualShortcodes(args: {
    input: BlogEditorialValidationInput;
    markdown: string;
    sections: readonly H2Section[];
    visualShortcodes: readonly VisualShortcodeMatch[];
    issues: EditorialValidationIssue[];
}) {
    const { input, markdown, sections, visualShortcodes, issues } = args;
    const validShortcodes = visualShortcodes.filter((shortcode) => shortcode.valid && shortcode.id);
    const visualBlocks = input.visualBlocks ?? [];
    const visualBlockIds = visualBlocks.map((block) => block.id).filter(Boolean);
    const blockIdSet = new Set(visualBlockIds);
    const shortcodeIds = validShortcodes.map((shortcode) => shortcode.id).filter((id): id is string => Boolean(id));

    visualShortcodes
        .filter((shortcode) => !shortcode.valid)
        .forEach((shortcode) => {
            issues.push({
                code: "invalid_visual_shortcode",
                severity: "error",
                dimension: "visualIntegration",
                message: `Invalid visual shortcode syntax: ${shortcode.raw}.`,
                repairInstruction: "Use exact shortcode syntax {{visual:ID}} with only letters, numbers, underscores, or hyphens in the ID.",
            });
        });

    findDuplicates(visualBlockIds).forEach((id) => {
        issues.push({
            code: "duplicate_visual_block_id",
            severity: "error",
            dimension: "visualIntegration",
            message: `Visual block ID "${id}" is duplicated.`,
            repairInstruction: "Deduplicate visual block IDs before injecting shortcodes so each visual maps to exactly one block.",
            details: { id },
        });
    });

    findDuplicates(shortcodeIds).forEach((id) => {
        issues.push({
            code: "duplicate_visual_shortcode_id",
            severity: "error",
            dimension: "visualIntegration",
            message: `Visual shortcode ID "${id}" appears more than once in the markdown.`,
            repairInstruction: "Remove duplicate shortcode placements or generate separate visual IDs for distinct visuals.",
            details: { id },
        });
    });

    if (visualBlocks.length > 0) {
        shortcodeIds
            .filter((id) => !blockIdSet.has(id))
            .forEach((id) => {
                issues.push({
                    code: "visual_shortcode_missing_block",
                    severity: "error",
                    dimension: "visualIntegration",
                    message: `Shortcode {{visual:${id}}} has no matching visual block.`,
                    repairInstruction: "Remove the orphan shortcode or ensure the visual_blocks metadata contains the same ID.",
                    details: { id },
                });
            });
    }

    if (visualBlocks.length > 0 && shortcodeIds.length > 0) {
        visualBlockIds
            .filter((id) => !shortcodeIds.includes(id))
            .forEach((id) => {
                issues.push({
                    code: "visual_block_not_placed",
                    severity: "warning",
                    dimension: "visualIntegration",
                    message: `Visual block "${id}" is not placed in the markdown.`,
                    repairInstruction: "Place each useful visual near the relevant H2 section or drop unused visual metadata.",
                    details: { id },
                });
            });
    }

    if (validShortcodes.length >= 3 && isAllTailVisualDump(markdown, validShortcodes, sections)) {
        issues.push({
            code: "all_tail_visual_dump",
            severity: "error",
            dimension: "visualIntegration",
            message: `${validShortcodes.length} visual shortcodes appear to be dumped at the article tail instead of distributed inline.`,
            repairInstruction: "Redistribute visual shortcodes inside the H2 sections they support, ideally after relevant paragraphs rather than as a final stack.",
            details: { visualShortcodeCount: validShortcodes.length },
        });
    }
}

function extractAtxHeadings(markdown: string): AtxHeadingWithLine[] {
    const lines = markdown.split(/\r?\n/);
    const headings: AtxHeadingWithLine[] = [];
    let inFence = false;

    lines.forEach((line, index) => {
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            return;
        }
        if (inFence) return;

        const match = line.match(ATX_HEADING_RE);
        if (!match) return;

        const text = match[2]
            .replace(/[ \t]+#+[ \t]*$/g, "")
            .trim();
        if (!text) return;

        headings.push({
            level: match[1].length,
            text,
            normalizedText: normalizeHeadingForEditorialMatch(text),
            line: index + 1,
        });
    });

    return headings;
}

function extractH2Sections(markdown: string): H2Section[] {
    const lines = markdown.split(/\r?\n/);
    const sections: Array<{ heading: string; normalizedHeading: string; lines: string[] }> = [];
    let current: { heading: string; normalizedHeading: string; lines: string[] } | null = null;
    let inFence = false;

    lines.forEach((line) => {
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
        }

        const match = !inFence ? line.match(ATX_HEADING_RE) : null;
        if (match && match[1].length === 2) {
            current = {
                heading: match[2].replace(/[ \t]+#+[ \t]*$/g, "").trim(),
                normalizedHeading: normalizeHeadingForEditorialMatch(match[2]),
                lines: [],
            };
            sections.push(current);
            return;
        }

        if (current) {
            current.lines.push(line);
        }
    });

    return sections.map((section) => {
        const body = section.lines.join("\n").trim();
        const h3Count = extractAtxHeadings(body).filter((heading) => heading.level === 3).length;
        const cleanBody = stripMarkdownNoise(body);
        const paragraphs = cleanBody
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);

        return {
            heading: section.heading,
            normalizedHeading: section.normalizedHeading,
            body,
            wordCount: countWords(cleanBody),
            substantiveParagraphCount: paragraphs.filter((paragraph) => countWords(paragraph) >= 35).length,
            h3Count,
            visualShortcodeCount: extractVisualShortcodes(body).filter((shortcode) => shortcode.valid).length,
        };
    });
}

function extractMarkdownLinks(markdown: string, siteHost?: string): MarkdownLink[] {
    const links: MarkdownLink[] = [];
    const linkRe = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(markdown)) !== null) {
        const href = match[1].trim();
        links.push({
            href,
            isInternal: isInternalUrl(href, siteHost),
            isExternal: isExternalUrl(href, siteHost),
        });
    }
    return links;
}

function extractVisualShortcodes(markdown: string): VisualShortcodeMatch[] {
    const matches: VisualShortcodeMatch[] = [];
    let match: RegExpExecArray | null;
    while ((match = VISUALISH_SHORTCODE_RE.exec(markdown)) !== null) {
        const strict = match[0].match(STRICT_VISUAL_SHORTCODE_RE);
        matches.push({
            raw: match[0],
            id: strict?.[1] ?? null,
            index: match.index,
            valid: Boolean(strict),
        });
    }
    return matches;
}

function buildStats(
    markdown: string,
    headings: readonly ExtractedEditorialHeading[],
    links: readonly MarkdownLink[],
    visualShortcodes: readonly VisualShortcodeMatch[],
): EditorialValidationStats {
    return {
        wordCount: countWords(stripMarkdownNoise(markdown)),
        h2Count: headings.filter((heading) => heading.level === 2).length,
        h3Count: headings.filter((heading) => heading.level === 3).length,
        h4PlusCount: headings.filter((heading) => heading.level >= 4).length,
        visualShortcodeCount: visualShortcodes.filter((shortcode) => shortcode.valid).length,
        internalMarkdownLinkCount: links.filter((link) => link.isInternal).length,
        externalMarkdownLinkCount: links.filter((link) => link.isExternal).length,
    };
}

function stripMarkdownNoise(markdown: string): string {
    return markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/~~~[\s\S]*?~~~/g, " ")
        .replace(/^#{1,6}\s+.+$/gm, " ")
        .replace(/\{\{\s*visual\s*:[^}]*\}\}/g, " ")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[`*_~>\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function countWords(text: string): number {
    return text.match(WORD_RE)?.length ?? 0;
}

function firstWords(text: string, limit: number): string {
    const words = text.match(WORD_RE) ?? [];
    return words.slice(0, limit).join(" ");
}

function containsNormalized(haystack: string, normalizedNeedle: string): boolean {
    if (!normalizedNeedle) return false;
    return normalizeHeadingForEditorialMatch(haystack).includes(normalizedNeedle);
}

function isMostlyAscii(text: string): boolean {
    const letters = text.match(/[\p{L}\p{N}]/gu) ?? [];
    if (letters.length === 0) return true;
    const ascii = letters.filter((char) => /^[A-Za-z0-9]$/.test(char)).length;
    return ascii / letters.length >= 0.9;
}

function containsArabicScript(text: string): boolean {
    return /\p{Script=Arabic}/u.test(text);
}

function isLikelyLocalizedKeywordMismatch(keyword: string, title: string): boolean {
    if (!keyword || !title) return false;
    // Translation rows often retain English canonical keyword metadata while
    // the rendered title is Dutch/Arabic. That should remain an SEO warning,
    // not a publication blocker.
    if (!isMostlyAscii(keyword)) return false;
    return containsArabicScript(title) || !isMostlyAscii(title);
}

function firstNonEmpty(values: readonly (string | undefined)[]): string | undefined {
    return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

function classifyHeadingPattern(heading: string): string | null {
    const normalized = normalizeHeadingForEditorialMatch(heading);
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

function isInternalUrl(href: string, siteHost?: string): boolean {
    if (href.startsWith("/") && !href.startsWith("//")) return true;
    if (!siteHost) return false;
    try {
        const host = normalizeHost(siteHost);
        const url = new URL(href);
        return normalizeHost(url.hostname) === host;
    } catch {
        return false;
    }
}

function isExternalUrl(href: string, siteHost?: string): boolean {
    try {
        const url = new URL(href);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        if (!siteHost) return true;
        return normalizeHost(url.hostname) !== normalizeHost(siteHost);
    } catch {
        return false;
    }
}

function normalizeHost(value: string): string {
    try {
        return new URL(value).hostname.replace(/^www\./, "").toLocaleLowerCase();
    } catch {
        return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLocaleLowerCase();
    }
}

function countResearchCitations(
    citations: BlogEditorialValidationInput["externalCitations"],
    links: readonly MarkdownLink[],
): number {
    const citationUrls = new Set<string>();
    (citations ?? []).forEach((citation) => {
        const url = typeof citation === "string" ? citation : citation.url;
        if (isExternalUrl(url)) citationUrls.add(url);
    });
    links.filter((link) => link.isExternal).forEach((link) => citationUrls.add(link.href));
    return citationUrls.size;
}

function isFaqReadyIntent(intent: BlogEditorialValidationInput["intent"]): boolean {
    return intent === "guide" || intent === "how-to" || intent === "comparison";
}

function findDuplicates(values: readonly string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    values.forEach((value) => {
        if (seen.has(value)) {
            duplicates.add(value);
        } else {
            seen.add(value);
        }
    });
    return [...duplicates];
}

function isAllTailVisualDump(markdown: string, shortcodes: readonly VisualShortcodeMatch[], sections: readonly H2Section[]): boolean {
    const tailStart = Math.floor(markdown.length * 0.72);
    const allInTail = shortcodes.every((shortcode) => shortcode.index >= tailStart);
    if (allInTail) return true;

    const nonEmptyLines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const trailingVisualLines = [...nonEmptyLines].reverse().findIndex((line) => !STRICT_VISUAL_SHORTCODE_RE.test(line));
    if (trailingVisualLines >= 3) return true;

    if (sections.length > 0) {
        const sectionsWithVisuals = sections.filter((section) => section.visualShortcodeCount > 0).length;
        if (sectionsWithVisuals === 1 && sections[sections.length - 1].visualShortcodeCount === shortcodes.length) {
            return true;
        }
    }

    return false;
}

function issuePenalty(severity: EditorialIssueSeverity): number {
    if (severity === "error") return 18;
    if (severity === "warning") return 8;
    return 3;
}

function severityRank(severity: EditorialIssueSeverity): number {
    if (severity === "error") return 0;
    if (severity === "warning") return 1;
    return 2;
}

const IMPLICITLY_ALLOWED_PATHS = new Set([
    "/",
    "/en",
    "/nl",
    "/ar",
    "/services",
    "/en/services",
    "/nl/services",
    "/ar/services",
    "/blog",
    "/en/blog",
    "/nl/blog",
    "/ar/blog",
    "/contact",
    "/en/contact",
    "/nl/contact",
    "/ar/contact",
    "/about",
    "/en/about",
    "/nl/about",
    "/ar/about",
    "/pricing",
    "/en/pricing",
    "/nl/pricing",
    "/ar/pricing",
]);

function normalizePath(href: string): string {
    try {
        const path = href.split("?")[0].split("#")[0].trim();
        // Remove trailing slash if length > 1
        return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
    } catch {
        return href;
    }
}
