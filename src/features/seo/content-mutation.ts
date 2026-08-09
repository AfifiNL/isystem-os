import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import BulletList from "@tiptap/extension-bullet-list";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";
import Color from "@tiptap/extension-color";
import Document from "@tiptap/extension-document";
import FontFamily from "@tiptap/extension-font-family";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import Highlight from "@tiptap/extension-highlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import Text from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { generateHTML, generateJSON } from "@tiptap/html";
import type { Json } from "@/shared/lib/supabase/database.types";
import type {
    SeoAutomationTier,
    SeoBuilderMutationTarget,
    SeoMutationCandidateDiagnostic,
    SeoMutationStep,
    SeoMutationStrategy,
    SeoRiskCheckResult,
} from "@/features/seo/types";
import { extractMarkdownLinks } from "@/features/seo/lib/analysis";
import {
    collectMarkdownProtectedRanges,
    hasMarkdownTemplatePlaceholder,
    rangeOverlapsProtectedRange,
} from "@/features/seo/lib/markdown-offsets";
import {
    createSeoSemanticTargetContext,
    isStrategyPreferredForTarget,
    resolveSemanticAnchorForSentence,
    type SeoSemanticTargetContext,
} from "@/features/seo/lib/semantic-anchors";
import { normalizeAiProviderError } from "@/shared/lib/ai/errors";
import { buildInternalContentHref } from "@/features/seo/lib/internal-link-href";
import {
    getModelMetadata,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";

const REWRITE_MODEL_ALIAS: AiModelAlias = "text.structured.bulk";
const REWRITE_MODEL_METADATA = getModelMetadata(REWRITE_MODEL_ALIAS);

type RichNode = {
    type?: string;
    text?: string;
    attrs?: Record<string, unknown>;
    marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
    content?: RichNode[];
};

type BuilderBlock = {
    type?: string;
    props?: Record<string, unknown>;
};

type SentenceAnchorSelection = {
    sentence: string;
    anchorText: string;
    semanticReason: string;
    semanticFit: SeoMutationCandidateDiagnostic["semanticFit"];
};

type StrategyAttemptResult = {
    ok: boolean;
    beforeSnippet: string;
    afterSnippet: string;
    updatedValue: string | null;
    locationRationale: string;
    rendererCompatibility: string;
    strategyReason: string;
    manualReviewReason: string | null;
    riskChecks: SeoRiskCheckResult[];
    mutationStrategy: SeoMutationStrategy;
    mutationStep: SeoMutationStep;
    skippedFallbacks: string[];
};

type SeoMutationPageContext = {
    sourceTitle: string;
    sourceSlug: string | null;
    pageIntent: string | null;
    conversionGoal: string | null;
    platformCopyContext?: string;
    /**
     * Workspace default locale used when building the final public href.
     * Defaults to "en" inside buildHref if absent. Historically the href
     * was constructed without a locale prefix and pointed at a 404 on any
     * i18n-aware route (e.g. `/beyond-2026-...` instead of
     * `/en/blog/beyond-2026-...`).
     */
    locale?: string | null;
};

/**
 * Per-recommendation AI call budget. Worst-case mutation iterates targets ×
 * strategies × anchor variants, each triggering one LLM call. Without a budget
 * a single recommendation could spend 30+ calls. We cap at MAX_AI_CALLS_DEFAULT.
 */
const MAX_AI_CALLS_DEFAULT = 8;
class AiCallBudget {
    private remaining: number;
    constructor(limit: number) {
        this.remaining = Math.max(0, limit);
    }
    tryConsume(): boolean {
        if (this.remaining <= 0) return false;
        this.remaining -= 1;
        return true;
    }
    get exhausted(): boolean {
        return this.remaining <= 0;
    }
}

/**
 * Failure specificity ranking used to pick the most actionable failure when no
 * target succeeds. Higher = more specific / more actionable for the user.
 */
function failureSpecificity(reason: string | null): number {
    if (!reason) return 0;
    const r = reason.toLowerCase();
    if (r.includes("manual blog builder") || r.includes("does not contain a supported builder")) return 100;
    if (r.includes("already contains a link")) return 90;
    if (r.includes("missing a valid target href") || r.includes("anchor text")) return 80;
    if (r.includes("policy-protected")) return 70;
    if (r.includes("ai rewrite gate rejected")) return 60;
    if (r.includes("rewrite confidence")) return 55;
    if (r.includes("no eligible") || r.includes("no safe")) return 30;
    if (r.includes("budget exhausted")) return 20;
    return 10;
}

type SeoRewriteSuggestion = {
    approved: boolean;
    sentence: string;
    anchorText: string;
    rationale: string;
    confidence: number;
};

export interface SeoMutationResult {
    ok: boolean;
    supported: boolean;
    automationTier: SeoAutomationTier;
    blockId: string | null;
    blockType: string | null;
    fieldPath: string | null;
    locale: string | null;
    mutationStrategy: SeoMutationStrategy;
    mutationStep: SeoMutationStep;
    strategyReason: string;
    beforeSnippet: string;
    afterSnippet: string;
    originalValue: string;
    updatedValue: string | null;
    updatedContent: string | null;
    locationRationale: string;
    rendererCompatibility: string;
    manualReviewReason: string | null;
    skippedFallbacks: string[];
    candidateDiagnostics: SeoMutationCandidateDiagnostic[];
    riskChecks: SeoRiskCheckResult[];
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function getStringAtPath(value: unknown, path: string[]) {
    let current: unknown = value;
    for (const segment of path) {
        if (!current || typeof current !== "object" || Array.isArray(current)) {
            return null;
        }
        current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === "string" ? current : null;
}

function setStringAtPath(value: unknown, path: string[], nextValue: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    let current = value as Record<string, unknown>;
    for (let index = 0; index < path.length - 1; index += 1) {
        const next = current[path[index]];
        if (!next || typeof next !== "object" || Array.isArray(next)) {
            return false;
        }
        current = next as Record<string, unknown>;
    }

    current[path[path.length - 1]] = nextValue;
    return true;
}

function escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHref(targetSlug: string | null, locale?: string | null) {
    if (targetSlug === null) return null;
    const clean = targetSlug.replace(/^\/+|\/+$/g, "");

    let type = "page";
    let slug = clean;
    if (clean.startsWith("blog/")) {
        type = "blog";
        slug = clean.slice("blog/".length);
    }

    return buildInternalContentHref({ slug, type, locale });
}

function pushRisk(
    riskChecks: SeoRiskCheckResult[],
    risk: Omit<SeoRiskCheckResult, "severity"> & { severity?: SeoRiskCheckResult["severity"] },
) {
    riskChecks.push({ severity: risk.severity ?? (risk.passed ? "info" : "error"), ...risk });
}

function getSnippet(value: string, pivot: number, radius = 120) {
    const start = Math.max(0, pivot - radius);
    const end = Math.min(value.length, pivot + radius);
    return value.slice(start, end).trim();
}

function splitSentences(value: string) {
    return value.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
}

function allowsSoftenedRephrase(target: SeoBuilderMutationTarget) {
    return target.automationTier === "fallback_field"
        || (target.contentFormat === "builder_rich_text_html" && /description|subtitle|body|missionText|visionText|richDescription|richBody/i.test(target.fieldPath));
}

function sentenceSupportsInsertion(sentence: string) {
    const trimmed = sentence.trim();
    if (trimmed.length < 18 || trimmed.length > 360) return false;
    if (hasMarkdownTemplatePlaceholder(trimmed)) return false;
    if (/\[[^\]]+\]\([^)]+\)/.test(trimmed) || /<a\b/i.test(trimmed)) return false;
    if (/^(read more|learn more|contact us|get started|book now|request a quote)/i.test(trimmed)) return false;
    return /\s/.test(trimmed);
}

function sentenceSupportsExactReplacement(sentence: string) {
    const trimmed = sentence.trim();
    if (trimmed.length < 8 || trimmed.length > 420) return false;
    if (/\[[^\]]+\]\([^)]+\)/.test(trimmed) || /<a\b/i.test(trimmed)) return false;
    return /\w/.test(trimmed);
}

function sentenceSupportsRephrase(sentence: string) {
    const trimmed = sentence.trim();
    if (trimmed.length < 18 || trimmed.length > 420) return false;
    if (hasMarkdownTemplatePlaceholder(trimmed)) return false;
    if (/\[[^\]]+\]\([^)]+\)/.test(trimmed) || /<a\b/i.test(trimmed)) return false;
    if (/(^|\s)(email|phone|address|hours|faq|form)(\s|$)/i.test(trimmed)) return false;
    return true;
}

function toMarkdownLink(sentence: string, anchor: string, href: string) {
    const pattern = new RegExp(`(^|[^\\w])(${escapeRegex(anchor)})(?=$|[^\\w])`, "i");
    return sentence.replace(pattern, (_, prefix: string, match: string) => `${prefix}[${match}](${href})`);
}

function findSafeRegexMatch(value: string, pattern: RegExp): { match: RegExpExecArray; anchorStart: number; anchorEnd: number; anchorText: string } | null {
    const protectedRanges = collectMarkdownProtectedRanges(value);
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(value)) !== null) {
        const prefix = match[1] ?? "";
        const anchorText = match[2] ?? match[0];
        const anchorStart = match.index + prefix.length;
        const anchorEnd = anchorStart + anchorText.length;
        if (!rangeOverlapsProtectedRange(anchorStart, anchorEnd, protectedRanges)) {
            return { match, anchorStart, anchorEnd, anchorText };
        }
        if (match[0].length === 0) re.lastIndex += 1;
    }
    return null;
}

function replaceSentence(source: string, currentSentence: string, nextSentence: string) {
    return source.replace(currentSentence, nextSentence);
}

function extractSentenceNeighborhood(paragraph: string, sentence: string) {
    const sentences = splitSentences(paragraph);
    const index = sentences.findIndex((candidate) => candidate === sentence);
    return {
        previous: index > 0 ? sentences[index - 1] ?? null : null,
        next: index >= 0 && index < sentences.length - 1 ? sentences[index + 1] ?? null : null,
    };
}


const NAVIGATION_PATTERNS = [/\bclick here\b/i, /\bread more\b/i, /\blearn more\b/i, /\bsee more\b/i, /\bfind out more\b/i, /\bexplore now\b/i, /\bget started\b/i, /^\s*(home|services?|about|contact|blog|portfolio)\s*$/i];

function isNavigationSentence(sentence: string) {
    const trimmed = sentence.trim();
    return NAVIGATION_PATTERNS.some((re) => re.test(trimmed)) || trimmed.length < 20;
}


function validateRewriteSuggestion(input: {
    suggestion: SeoRewriteSuggestion;
    sourceSentence: string;
    requestedAnchor: string;
    allowedAnchors?: string[];
}) {
    const allowedAnchors = [input.requestedAnchor, ...(input.allowedAnchors ?? [])]
        .map((value) => value.trim())
        .filter(Boolean);
    const resolvedAnchor = allowedAnchors.find((candidate) => containsRequestedAnchor(input.suggestion.sentence, candidate))
        ?? (input.suggestion.anchorText.trim().length > 0 && containsRequestedAnchor(input.suggestion.sentence, input.suggestion.anchorText)
            ? input.suggestion.anchorText.trim()
            : null);

    // Approved=false from the AI is a soft signal, not a hard gate. If the rewrite
    // still scored decent confidence (≥55) AND passes structural/anchor checks below,
    // accept it. The AI tends to over-flag "unnatural" for short banner copy where
    // perfect editorial fit is rare but a topical link is still useful.
    if (!input.suggestion.approved && input.suggestion.confidence < 55) {
        return { ok: false, reason: `The AI rewrite gate flagged this sentence as unnatural and confidence (${input.suggestion.confidence}) was below the soft-accept threshold.` };
    }

    if (input.suggestion.confidence < 40) {
        return { ok: false, reason: `The AI rewrite confidence (${input.suggestion.confidence}) was below the minimum threshold for automatic apply.` };
    }

    if (!resolvedAnchor) {
        return { ok: false, reason: "The rewritten sentence did not preserve a usable approved anchor phrase." };
    }

    if (!sentenceSupportsRephrase(input.suggestion.sentence) || input.suggestion.sentence.length > 360) {
        return { ok: false, reason: "The rewritten sentence was too weak, too long, or structurally unsuitable for safe in-flow mutation." };
    }

    if (isNavigationSentence(input.suggestion.sentence) && !isNavigationSentence(input.sourceSentence)) {
        return { ok: false, reason: "The rewritten sentence drifted into navigation-style copy instead of staying editorial." };
    }

    return { ok: true, reason: input.suggestion.rationale, anchorText: resolvedAnchor };
}

async function maybeGenerateRewriteSuggestion(input: {
    sentence: string;
    paragraph: string;
    blockType: string;
    fieldPath: string;
    sourceTitle: string;
    sourceSlug: string | null;
    pageIntent: string | null;
    conversionGoal: string | null;
    targetTitle: string | null;
    targetSlug: string | null;
    platformCopyContext?: string;
    requestedAnchor: string;
    semanticContext: SeoSemanticTargetContext;
    aiBudget?: AiCallBudget;
}): Promise<SeoRewriteSuggestion | null> {
    if (input.aiBudget && !input.aiBudget.tryConsume()) {
        return null;
    }

    const { generateObjectWithFallback } = await import("@/shared/lib/ai/runtime-fallback");
    const { z } = await import("zod");

    const neighbors = extractSentenceNeighborhood(input.paragraph, input.sentence);
    const prompt = `You are rewriting one sentence inside an existing website paragraph so an approved internal link can be inserted naturally.

You must return a JSON object.
Example output format:
{
  "approved": true,
  "rewrittenSentence": "This is a rewritten sentence containing the exact anchor text.",
  "anchorText": "exact anchor text",
  "reason": "This link contextually connects the source and target topics.",
  "confidence": 85
}

Rules:
- preserve the original meaning and narrative role of the sentence
- keep it to one sentence only
- include the exact anchor text: "${input.requestedAnchor}"
- do not create a new section
- do not sound like menu, navigation, or generic SEO filler
- do not add CTA chrome unless the original sentence is already CTA-like
- you may lightly enrich weak/basic copy if it improves flow, but stay inside the same topic and tone
- if the sentence cannot carry the link naturally, set approved to false

Confidence scoring guide (0-100):
- 80-100: The rewrite is editorial, preserves narrative intent fully, and the anchor fits naturally
- 65-79: Good fit; the anchor works and the sentence reads well with minor adjustments
- 50-64: Acceptable; the anchor is technically present but slightly forced
- Below 50: Poor fit — set approved to false instead of returning a weak rewrite

If you are returning approved: true with a quality rewrite, set confidence to at least 65. Reserve scores below 50 exclusively for approved: false cases where the anchor cannot be placed without distorting the sentence.

Platform/source context:
${JSON.stringify({
        sourceTitle: input.sourceTitle,
        sourceSlug: input.sourceSlug,
        pageIntent: input.pageIntent,
        conversionGoal: input.conversionGoal,
        blockType: input.blockType,
        fieldPath: input.fieldPath,
        targetTitle: input.targetTitle,
        targetSlug: input.targetSlug,
        sentence: input.sentence,
        paragraph: input.paragraph,
        previousSentence: neighbors.previous,
        nextSentence: neighbors.next,
        pageType: input.semanticContext.pageType,
        targetLabel: input.semanticContext.targetLabel,
        topicPhrase: input.semanticContext.topicPhrase,
        preferredAnchors: input.semanticContext.preferredAnchors,
    }, null, 2)}

Relevant workspace copy context:
${input.platformCopyContext?.trim() || "No additional platform context supplied."}`;

    try {
        const { object } = await generateObjectWithFallback(REWRITE_MODEL_ALIAS, {
            schema: z.object({
                approved: z.boolean(),
                rewrittenSentence: z.string().nullable(),
                anchorText: z.string().nullable(),
                reason: z.string(),
                confidence: z.number().min(0).max(100),
            }),
            prompt,
        });
        return {
            approved: object.approved,
            sentence: (object.rewrittenSentence || "").trim(),
            anchorText: (object.anchorText || "").trim(),
            rationale: object.reason.trim() || "AI-assisted rewrite proposal generated.",
            confidence: Math.max(0, Math.min(100, object.confidence)),
        };
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: REWRITE_MODEL_METADATA.provider,
            modelAlias: REWRITE_MODEL_ALIAS,
            modelId: REWRITE_MODEL_METADATA.modelId,
        });
        console.error("[seo:rewrite] maybeGenerateRewriteSuggestion failed", providerError.toJSON());
        if (error && typeof error === "object" && "text" in error && error.text) {
            console.error("[seo:rewrite] Raw response text:", error.text);
        }
        return null;
    }
}

function containsRequestedAnchor(sentence: string, anchor: string) {
    return new RegExp(`(^|[^\\w])${escapeRegex(anchor)}(?=$|[^\\w])`, "i").test(sentence);
}

function uniqueAnchorVariants(primary: string, preferred: readonly string[] | undefined): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (candidate: string | null | undefined) => {
        const trimmed = candidate?.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(trimmed);
    };
    add(primary);
    for (const value of preferred ?? []) add(value);
    return out;
}

function selectSentenceAnchor(input: {
    content: string;
    strategy: SeoMutationStrategy;
    requestedAnchor: string;
    semanticContext: SeoSemanticTargetContext;
    exactOnly?: boolean;
    allowSoftenedRephrase?: boolean;
}) {
    const sentences = splitSentences(input.content);
    let lastRejectedReason: string | null = null;

    for (const sentence of sentences) {
        const structurallyEligible = input.exactOnly
            ? sentenceSupportsExactReplacement(sentence)
            : input.strategy.endsWith("rephrase_link")
            ? sentenceSupportsRephrase(sentence)
            : sentenceSupportsInsertion(sentence);
        if (!structurallyEligible) continue;
        if (input.exactOnly && !containsRequestedAnchor(sentence, input.requestedAnchor)) continue;

        const resolution = resolveSemanticAnchorForSentence({
            sentence,
            requestedAnchor: input.requestedAnchor,
            strategy: input.strategy,
            context: input.semanticContext,
            requireVerbatimAnchor: input.exactOnly,
            allowSoftenedRephrase: input.allowSoftenedRephrase,
        });

        if (resolution.ok && resolution.anchorText) {
            return {
                ok: true,
                selection: {
                    sentence,
                    anchorText: resolution.anchorText,
                    semanticReason: resolution.reason,
                    semanticFit: resolution.semanticFit,
                } satisfies SentenceAnchorSelection,
                rejectedReason: null,
            };
        }

        lastRejectedReason = resolution.reason;
    }

    return {
        ok: false,
        selection: null,
        rejectedReason: lastRejectedReason ?? "No sentence passed semantic anchor suitability checks for this strategy.",
    };
}

function createFailure(input: {
    originalValue: string;
    manualReviewReason: string;
    rendererCompatibility: string;
    riskChecks: SeoRiskCheckResult[];
    updatedValue?: string | null;
    beforeSnippet?: string;
    afterSnippet?: string;
    locationRationale?: string;
    strategyReason?: string;
    mutationStrategy?: SeoMutationStrategy;
    mutationStep?: SeoMutationStep;
    skippedFallbacks?: string[];
}): StrategyAttemptResult {
    return {
        ok: false,
        beforeSnippet: input.beforeSnippet ?? "",
        afterSnippet: input.afterSnippet ?? "",
        updatedValue: input.updatedValue ?? null,
        locationRationale: input.locationRationale ?? "",
        rendererCompatibility: input.rendererCompatibility,
        strategyReason: input.strategyReason ?? "Automatic mutation could not be guaranteed safely.",
        manualReviewReason: input.manualReviewReason,
        riskChecks: input.riskChecks,
        mutationStrategy: input.mutationStrategy ?? "manual_review",
        mutationStep: input.mutationStep ?? "manual_review",
        skippedFallbacks: input.skippedFallbacks ?? [],
    };
}

function isEligibleMarkdownParagraph(block: string) {
    const trimmed = block.trim();
    if (!trimmed) return false;
    if (/^(#{1,6}|>|[-*+]\s|\d+\.\s|```|~~~|\|)/.test(trimmed)) return false;
    if (/\[[^\]]+\]\([^)]+\)/.test(trimmed) || /<a\b/i.test(trimmed)) return false;
    return trimmed.length >= 70;
}

export async function mutateMarkdownByStrategy(input: {
    content: string;
    anchorText: string;
    targetSlug: string | null;
    targetTitle: string | null;
    strategy: SeoMutationStrategy;
    blockType: string;
    fieldPath: string;
    pageContext: SeoMutationPageContext;
    semanticContext: SeoSemanticTargetContext;
    inheritedRiskChecks?: SeoRiskCheckResult[];
    allowSoftenedRephrase?: boolean;
    aiBudget?: AiCallBudget;
}): Promise<StrategyAttemptResult> {
    const riskChecks = [...(input.inheritedRiskChecks ?? [])];
    const href = buildHref(input.targetSlug, input.pageContext.locale);
    const anchor = input.anchorText.trim();
    const skippedFallbacks: string[] = [];

    pushRisk(riskChecks, {
        key: "target_href",
        label: "Target href resolved",
        passed: Boolean(href),
        message: href ? `Internal href resolved to ${href}.` : "Target slug is missing, so a stable internal href could not be built.",
    });

    if (!href || anchor.length < 3) {
        return createFailure({
            originalValue: input.content,
            manualReviewReason: "The recommendation is missing a valid target href or a sufficiently descriptive anchor text.",
            rendererCompatibility: "Markdown mutation was blocked before parsing.",
            riskChecks,
            skippedFallbacks,
            mutationStrategy: input.strategy,
        });
    }

    const duplicateExists = extractMarkdownLinks(input.content).includes(input.targetSlug?.replace(/^\/+|\/+$/g, "") ?? "");
    pushRisk(riskChecks, {
        key: "duplicate_target",
        label: "No duplicate link to target already exists",
        passed: !duplicateExists,
        message: !duplicateExists
            ? "The source content does not already link to the same target slug."
            : "A link to this target already exists in the source content, so another automated link would be redundant.",
    });
    if (duplicateExists) {
        return createFailure({
            originalValue: input.content,
            manualReviewReason: "The source content already contains a link to the target page.",
            rendererCompatibility: "Markdown rendering was left unchanged.",
            riskChecks,
            skippedFallbacks,
            mutationStrategy: input.strategy,
        });
    }

    const blocks = input.content.split(/\n\s*\n/);
    let consumed = 0;
    for (const block of blocks) {
        const startIndex = input.content.indexOf(block, consumed);
        consumed = startIndex + block.length;
        if (!isEligibleMarkdownParagraph(block)) continue;

        if (input.strategy === "builder_structured_markdown_link") {
            const pattern = new RegExp(`(^|[^\\w])(${escapeRegex(anchor)})(?=$|[^\\w])`, "i");
            const safeMatch = findSafeRegexMatch(block, pattern);
            if (safeMatch) {
                const semanticSelection = selectSentenceAnchor({
                    content: block,
                    strategy: input.strategy,
                    requestedAnchor: anchor,
                    semanticContext: input.semanticContext,
                    exactOnly: true,
                });
                if (!semanticSelection.ok) {
                    skippedFallbacks.push(`Exact markdown replacement was skipped because ${semanticSelection.rejectedReason}`);
                    continue;
                }

                const exactSelection = semanticSelection.selection;
                if (!exactSelection) {
                    skippedFallbacks.push("Exact markdown replacement was skipped because semantic anchor resolution returned no usable selection.");
                    continue;
                }

                pushRisk(riskChecks, {
                    key: "semantic_anchor_fit",
                    label: "Semantic anchor suitability passed",
                    passed: true,
                    severity: exactSelection.semanticFit === "degraded" ? "warning" : "info",
                    message: exactSelection.semanticReason,
                });

                const prefix = safeMatch.match[1] ?? "";
                const replacement = `${prefix}[${safeMatch.anchorText}](${href})`;
                const nextBlock = `${block.slice(0, safeMatch.match.index)}${replacement}${block.slice(safeMatch.anchorEnd)}`;
                const updatedContent = `${input.content.slice(0, startIndex)}${nextBlock}${input.content.slice(startIndex + block.length)}`;
                const pivot = startIndex + safeMatch.anchorStart;
                return {
                    ok: true,
                    beforeSnippet: getSnippet(input.content, pivot),
                    afterSnippet: getSnippet(updatedContent, pivot + replacement.length),
                    updatedValue: updatedContent,
                    locationRationale: "Exact anchor replacement was applied to the first eligible markdown paragraph.",
                    rendererCompatibility: "The field is treated as markdown-rendered content, so markdown link syntax remains safe.",
                    strategyReason: "Exact anchor replacement preserved the existing sentence with the smallest possible editorial change.",
                    manualReviewReason: null,
                    riskChecks,
                    mutationStrategy: input.strategy,
                    mutationStep: "exact_anchor_replacement",
                    skippedFallbacks,
                };
            }
        }

        const selected = selectSentenceAnchor({
            content: block,
            strategy: input.strategy,
            requestedAnchor: anchor,
            semanticContext: input.semanticContext,
            allowSoftenedRephrase: input.allowSoftenedRephrase,
        });

        if (!selected.ok || !selected.selection) {
            skippedFallbacks.push(`${input.strategy.replace(/^builder_structured_/, "").replace(/_/g, " ")} was skipped because ${selected.rejectedReason}`);
            continue;
        }

        const selectedSentence = selected.selection;

        pushRisk(riskChecks, {
            key: "semantic_anchor_fit",
            label: "Semantic anchor suitability passed",
            passed: true,
            severity: selectedSentence.semanticFit === "degraded" ? "warning" : "info",
            message: selectedSentence.semanticReason,
        });

        if (input.strategy === "builder_structured_markdown_rephrase_link") {
            const suggestion = await maybeGenerateRewriteSuggestion({
                sentence: selectedSentence.sentence,
                paragraph: block,
                blockType: input.blockType,
                fieldPath: input.fieldPath,
                sourceTitle: input.pageContext.sourceTitle,
                sourceSlug: input.pageContext.sourceSlug,
                pageIntent: input.pageContext.pageIntent,
                conversionGoal: input.pageContext.conversionGoal,
                targetTitle: input.targetTitle,
                targetSlug: input.targetSlug,
                platformCopyContext: input.pageContext.platformCopyContext,
                requestedAnchor: anchor,
                semanticContext: input.semanticContext,
                aiBudget: input.aiBudget,
            });

            if (!suggestion) {
                skippedFallbacks.push("AI-guided markdown rewrite was unavailable for this paragraph.");
                continue;
            }

            const validation = validateRewriteSuggestion({
                suggestion,
                sourceSentence: selectedSentence.sentence,
                requestedAnchor: anchor,
                allowedAnchors: input.semanticContext.preferredAnchors,
            });

            if (!validation.ok) {
                skippedFallbacks.push(`AI-guided markdown rewrite was rejected because ${validation.reason}`);
                continue;
            }

            pushRisk(riskChecks, {
                key: "rewrite_confidence",
                label: "Narrative rewrite confidence passed",
                passed: true,
                severity: suggestion.confidence >= 75 ? "info" : "warning",
                message: `${validation.reason} Confidence ${suggestion.confidence}.`,
            });

            const resolvedAnchor = validation.anchorText ?? anchor;
            const replacement = toMarkdownLink(suggestion.sentence, resolvedAnchor, href);
            const nextBlock = replaceSentence(block, selectedSentence.sentence, replacement);
            const updatedContent = `${input.content.slice(0, startIndex)}${nextBlock}${input.content.slice(startIndex + block.length)}`;
            const pivot = startIndex + block.indexOf(selectedSentence.sentence);
            return {
                ok: true,
                beforeSnippet: getSnippet(input.content, pivot),
                afterSnippet: getSnippet(updatedContent, pivot + replacement.length),
                updatedValue: updatedContent,
                locationRationale: "One existing markdown sentence was contextually rewritten in-place so the internal link fits the surrounding narrative.",
                rendererCompatibility: "Markdown output remains paragraph-safe because the rephrase stays inside a single narrative sentence.",
                strategyReason: "AI-assisted contextual rephrase was used because exact anchor replacement was unavailable but the existing paragraph could support a natural in-flow link.",
                manualReviewReason: null,
                riskChecks,
                mutationStrategy: input.strategy,
                mutationStep: "controlled_semantic_rephrase",
                skippedFallbacks,
            };
        }
    }

    return createFailure({
        originalValue: input.content,
        manualReviewReason: "No safe markdown paragraph supported the requested mutation strategy.",
        rendererCompatibility: "Markdown rendering was left unchanged.",
        riskChecks,
        skippedFallbacks: [`${input.strategy.replace(/^builder_structured_/, "").replace(/_/g, " ")} skipped because no eligible markdown paragraph could be mutated naturally.`],
        mutationStrategy: input.strategy,
        mutationStep: input.strategy === "builder_structured_markdown_link"
            ? "exact_anchor_replacement"
            : "controlled_semantic_rephrase",
    });
}

const richTextExtensions = [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    Strike,
    Underline,
    Blockquote,
    Code,
    CodeBlock,
    HardBreak,
    Heading.configure({ levels: [1, 2, 3] }),
    HorizontalRule,
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
            target: null,
            rel: null,
        },
    }),
    Image.configure({ inline: true, allowBase64: true }),
    BulletList,
    OrderedList,
    ListItem,
    Typography,
];

function collectExistingRichLinks(node: RichNode, links = new Set<string>()) {
    for (const mark of node.marks ?? []) {
        if (mark.type === "link") {
            const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : null;
            if (href) links.add(href);
        }
    }
    for (const child of node.content ?? []) collectExistingRichLinks(child, links);
    return links;
}

function paragraphPlainText(node: RichNode): string {
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map((child) => paragraphPlainText(child)).join("");
}

const REWRITE_SAFE_MARKS = new Set(["bold", "italic", "underline", "strike", "highlight", "textStyle", "color", "fontFamily", "fontSize", "textAlign"]);

function paragraphSupportsPlainRewrite(node: RichNode) {
    return (node.content ?? []).every((child) => {
        if (child.type === "hardBreak") return true;
        if (child.type !== "text" || typeof child.text !== "string") return false;
        return (child.marks ?? []).every((mark) => REWRITE_SAFE_MARKS.has(mark.type ?? ""));
    });
}

function withLinkMark(child: RichNode, href: string, text: string): RichNode {
    return {
        ...child,
        text,
        marks: [...(child.marks ?? []), { type: "link", attrs: { href, target: null, rel: null } }],
    };
}

function mutateParagraphExact(node: RichNode, anchorText: string, href: string) {
    const pattern = new RegExp(`(^|[^\\w])(${escapeRegex(anchorText)})(?=$|[^\\w])`, "i");
    const nextContent: RichNode[] = [];
    let changed = false;

    for (const child of node.content ?? []) {
        if (changed) {
            nextContent.push(child);
            continue;
        }
        if (child.type !== "text" || typeof child.text !== "string") {
            nextContent.push(child);
            continue;
        }
        if ((child.marks ?? []).some((mark) => mark.type === "link")) {
            nextContent.push(child);
            continue;
        }
        const safeMatch = findSafeRegexMatch(child.text, pattern);
        if (!safeMatch) {
            nextContent.push(child);
            continue;
        }

        const anchor = safeMatch.anchorText ?? anchorText;
        const anchorIndex = safeMatch.anchorStart;
        const before = child.text.slice(0, anchorIndex);
        const after = child.text.slice(anchorIndex + anchor.length);
        if (before) nextContent.push({ ...child, text: before });
        nextContent.push(withLinkMark(child, href, anchor));
        if (after) nextContent.push({ ...child, text: after });
        changed = true;
    }

    return { changed, content: nextContent };
}

type RewriteParagraphCandidate = {
    paragraph: string;
    sentence: string;
    sourceSentenceOffset: number;
    semanticReason: string;
    semanticFit: SeoMutationCandidateDiagnostic["semanticFit"];
};


/**
 * Collect all eligible rewrite paragraph candidates in document order. Used to retry
 * the AI rewrite on a different paragraph when the AI gate rejects every anchor variant
 * for the first candidate. Bounded by maxCandidates to keep cost predictable.
 */
function findAllRewriteParagraphCandidates(
    node: RichNode,
    strategy: SeoMutationStrategy,
    anchorText: string,
    semanticContext: SeoSemanticTargetContext,
    allowSoftenedRephrase: boolean,
    maxCandidates: number,
    inUnsafeContainer = false,
    out: RewriteParagraphCandidate[] = [],
): RewriteParagraphCandidate[] {
    if (out.length >= maxCandidates) return out;
    const unsafeHere = inUnsafeContainer || ["heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock"].includes(node.type ?? "");

    if ((node.type ?? "") === "paragraph" && !unsafeHere) {
        const isMixed = !paragraphSupportsPlainRewrite(node);
        if (isMixed) {
            for (const segment of getLinkFreeSegments(node)) {
                if (out.length >= maxCandidates) break;
                if (hasMarkdownTemplatePlaceholder(segment.text)) continue;
                const selected = selectSentenceAnchor({
                    content: segment.text,
                    strategy,
                    requestedAnchor: anchorText,
                    semanticContext,
                    allowSoftenedRephrase,
                });
                if (selected.ok && selected.selection) {
                    out.push({
                        paragraph: segment.text,
                        sentence: selected.selection.sentence,
                        sourceSentenceOffset: segment.startOffset + segment.text.indexOf(selected.selection.sentence),
                        semanticReason: selected.selection.semanticReason,
                        semanticFit: selected.selection.semanticFit,
                    });
                }
            }
            return out;
        }
        const paragraph = paragraphPlainText(node);
        if (hasMarkdownTemplatePlaceholder(paragraph)) return out;
        const selected = selectSentenceAnchor({
            content: paragraph,
            strategy,
            requestedAnchor: anchorText,
            semanticContext,
            allowSoftenedRephrase,
        });
        if (selected.ok && selected.selection) {
            out.push({
                paragraph,
                sentence: selected.selection.sentence,
                sourceSentenceOffset: paragraph.indexOf(selected.selection.sentence),
                semanticReason: selected.selection.semanticReason,
                semanticFit: selected.selection.semanticFit,
            });
        }
        return out;
    }

    for (const child of node.content ?? []) {
        if (out.length >= maxCandidates) break;
        findAllRewriteParagraphCandidates(child, strategy, anchorText, semanticContext, allowSoftenedRephrase, maxCandidates, unsafeHere, out);
    }
    return out;
}

function getLinkFreeSegments(node: RichNode): { text: string; startOffset: number }[] {
    const segments: { text: string; startOffset: number }[] = [];
    let offset = 0;
    let current = "";
    let currentStart = 0;

    for (const child of node.content ?? []) {
        const text = child.type === "text" ? (child.text ?? "") : "";
        const hasLink = (child.marks ?? []).some((m) => m.type === "link");

        if (child.type === "text" && !hasLink) {
            if (!current) currentStart = offset;
            current += text;
        } else {
            if (current) {
                segments.push({ text: current, startOffset: currentStart });
                current = "";
            }
        }

        offset += text.length;
    }

    if (current) segments.push({ text: current, startOffset: currentStart });
    return segments;
}

function mutateParagraphWithRewritePreservingLinks(
    node: RichNode,
    sourceSentence: string,
    rewrittenSentence: string,
    anchorText: string,
    href: string,
    sentenceStartHint = 0,
): { changed: boolean; content: RichNode[] } {
    const children = node.content ?? [];
    const plain = paragraphPlainText(node);
    const sentenceStart = plain.indexOf(sourceSentence, sentenceStartHint);
    if (sentenceStart < 0) return { changed: false, content: children };

    const sentenceEnd = sentenceStart + sourceSentence.length;
    const anchorIndex = rewrittenSentence.indexOf(anchorText);
    if (anchorIndex < 0) return { changed: false, content: children };

    const result: RichNode[] = [];
    let offset = 0;
    let sentenceInserted = false;

    for (const child of children) {
        const text = child.type === "text" ? (child.text ?? "") : "";
        const childStart = offset;
        const childEnd = offset + text.length;
        offset = childEnd;

        if (childEnd <= sentenceStart || childStart >= sentenceEnd) {
            result.push(child);
            continue;
        }

        if (child.type === "text" && childStart < sentenceStart) {
            const prefix = text.slice(0, sentenceStart - childStart);
            if (prefix) result.push({ ...child, text: prefix });
        }

        if (!sentenceInserted) {
            const beforeAnchor = rewrittenSentence.slice(0, anchorIndex);
            const afterAnchor = rewrittenSentence.slice(anchorIndex + anchorText.length);
            if (beforeAnchor) result.push({ type: "text", text: beforeAnchor });
            result.push({ type: "text", text: anchorText, marks: [{ type: "link", attrs: { href, target: null, rel: null } }] });
            if (afterAnchor) result.push({ type: "text", text: afterAnchor });
            sentenceInserted = true;
        }

        if (child.type === "text" && childEnd > sentenceEnd) {
            const suffix = text.slice(sentenceEnd - childStart);
            if (suffix) result.push({ ...child, text: suffix });
        }
    }

    return { changed: sentenceInserted, content: result };
}

function applyRewrittenSentenceToParagraph(
    node: RichNode,
    sourceSentence: string,
    rewrittenSentence: string,
    anchorText: string,
    href: string,
    inUnsafeContainer = false,
    sourceSentenceOffset?: number,
): { changed: boolean; node: RichNode; before: string; after: string } {
    const unsafeHere = inUnsafeContainer || ["heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock"].includes(node.type ?? "");

    if ((node.type ?? "") === "paragraph" && !unsafeHere) {
        const before = paragraphPlainText(node);
        const attempt = mutateParagraphWithRewritePreservingLinks(
            node,
            sourceSentence,
            rewrittenSentence,
            anchorText,
            href,
            sourceSentenceOffset ?? 0,
        );
        if (attempt.changed) {
            const nextNode = { ...node, content: attempt.content };
            return {
                changed: true,
                node: nextNode,
                before,
                after: paragraphPlainText(nextNode),
            };
        }
    }

    let changed = false;
    let beforeSnippet = "";
    let afterSnippet = "";
    const nextContent = (node.content ?? []).map((child) => {
        if (changed) return child;
        const result = applyRewrittenSentenceToParagraph(child, sourceSentence, rewrittenSentence, anchorText, href, unsafeHere);
        if (result.changed) {
            changed = true;
            beforeSnippet = result.before;
            afterSnippet = result.after;
        }
        return result.node;
    });

    return {
        changed,
        node: changed ? { ...node, content: nextContent } : node,
        before: beforeSnippet,
        after: afterSnippet,
    };
}

function mutateStandaloneParagraphs(
    node: RichNode,
    strategy: SeoMutationStrategy,
    anchorText: string,
    href: string,
    semanticContext: SeoSemanticTargetContext,
    inUnsafeContainer = false,
    allowSoftenedRephrase = false,
): { changed: boolean; node: RichNode; before: string; after: string; semanticReason?: string; semanticFit?: SeoMutationCandidateDiagnostic["semanticFit"]; rejectionReason?: string } {
    const unsafeHere = inUnsafeContainer || ["heading", "blockquote", "bulletList", "orderedList", "listItem", "codeBlock"].includes(node.type ?? "");

    if ((node.type ?? "") === "paragraph" && !unsafeHere) {
        const before = paragraphPlainText(node);
        if (hasMarkdownTemplatePlaceholder(before)) {
            return { changed: false, node, before: "", after: "", rejectionReason: "Paragraph contains a protected visual/template placeholder." };
        }
        const selected = selectSentenceAnchor({
            content: before,
            strategy,
            requestedAnchor: anchorText,
            semanticContext,
            exactOnly: strategy === "builder_structured_html_text_node",
            allowSoftenedRephrase,
        });

        if (!selected.ok || !selected.selection) {
            return { changed: false, node, before: "", after: "", rejectionReason: selected.rejectedReason ?? "Semantic suitability checks rejected this paragraph." };
        }

        const attempt = strategy === "builder_structured_html_text_node"
            ? mutateParagraphExact(node, selected.selection.anchorText, href)
            : { changed: false, content: node.content ?? [] };

        if (attempt.changed) {
            const nextNode = { ...node, content: attempt.content };
            return {
                changed: true,
                node: nextNode,
                before,
                after: paragraphPlainText(nextNode),
                semanticReason: selected.selection.semanticReason,
                semanticFit: selected.selection.semanticFit,
            };
        }
    }

    let changed = false;
    let beforeSnippet = "";
    let afterSnippet = "";
    let rejectionReason: string | undefined;
    const nextContent = (node.content ?? []).map((child) => {
        if (changed) return child;
        const result = mutateStandaloneParagraphs(child, strategy, anchorText, href, semanticContext, unsafeHere, allowSoftenedRephrase);
        if (result.changed) {
            changed = true;
            beforeSnippet = result.before;
            afterSnippet = result.after;
        } else if (result.rejectionReason && !rejectionReason) {
            rejectionReason = result.rejectionReason;
        }
        return result.node;
    });

    return {
        changed,
        node: changed ? { ...node, content: nextContent } : node,
        before: beforeSnippet,
        after: afterSnippet,
        semanticReason: undefined,
        semanticFit: undefined,
        rejectionReason,
    };
}

function enforceRichHtmlContainsLink(updatedContent: string, href: string) {
    return updatedContent.includes(`href="${href}"`);
}

async function mutateRichTextByStrategy(input: {
    content: string;
    anchorText: string;
    targetSlug: string | null;
    targetTitle: string | null;
    strategy: SeoMutationStrategy;
    blockType: string;
    fieldPath: string;
    pageContext: SeoMutationPageContext;
    semanticContext: SeoSemanticTargetContext;
    inheritedRiskChecks?: SeoRiskCheckResult[];
    allowSoftenedRephrase?: boolean;
    aiBudget?: AiCallBudget;
}): Promise<StrategyAttemptResult> {
    const riskChecks = [...(input.inheritedRiskChecks ?? [])];
    const href = buildHref(input.targetSlug, input.pageContext.locale);
    // Pre-resolve anchor variants so the length gate can promote a longer variant
    // when the recommendation's primary anchor is too short. Without this, e.g.
    // a single-word recommendation anchor would never reach the retry loop.
    const primaryAnchor = input.anchorText.trim();
    const allAnchorCandidates = uniqueAnchorVariants(primaryAnchor, input.semanticContext.preferredAnchors);
    const usableAnchorCandidates = allAnchorCandidates.filter((candidate) => candidate.length >= 3);
    const anchor = usableAnchorCandidates[0] ?? primaryAnchor;
    const skippedFallbacks: string[] = [];

    pushRisk(riskChecks, {
        key: "target_href",
        label: "Target href resolved",
        passed: Boolean(href),
        message: href ? `Internal href resolved to ${href}.` : "Target slug is missing, so a stable internal href could not be built.",
    });

    if (!href || usableAnchorCandidates.length === 0) {
        return createFailure({
            originalValue: input.content,
            manualReviewReason: "The recommendation is missing a valid target href or sufficiently descriptive anchor text.",
            rendererCompatibility: "Rich-text rendering was left unchanged.",
            riskChecks,
            skippedFallbacks,
            mutationStrategy: input.strategy,
        });
    }

    try {
        const htmlContent = input.content.trimStart().startsWith("<") ? input.content : `<p>${input.content}</p>`;
        const doc = generateJSON(htmlContent, richTextExtensions) as RichNode;
        const duplicateExists = collectExistingRichLinks(doc).has(href);
        pushRisk(riskChecks, {
            key: "duplicate_target",
            label: "No duplicate link to target already exists",
            passed: !duplicateExists,
            message: !duplicateExists
                ? "The rich-text document does not already contain a link to this target."
                : "A link to this target already exists in the rich-text document, so another automated link would be redundant.",
        });
        if (duplicateExists) {
            return createFailure({
                originalValue: input.content,
                manualReviewReason: "The source content already contains a link to the target page.",
                rendererCompatibility: "Rich-text rendering was left unchanged.",
                riskChecks,
                skippedFallbacks,
                mutationStrategy: input.strategy,
            });
        }

        // Anchor-retry for exact replacement: iterate the variant list and stop at the
        // first one whose literal text appears in a safe paragraph. This unblocks cases
        // where the recommendation's primary anchor is absent but a topic/CTA variant fits.
        let mutation: { changed: boolean; node: RichNode; before: string; after: string; semanticReason?: string; semanticFit?: SeoMutationCandidateDiagnostic["semanticFit"]; rejectionReason?: string };
        if (input.strategy === "builder_structured_html_rephrase_link") {
            mutation = { changed: false, node: doc, before: "", after: "", rejectionReason: "No AI-assisted rewrite candidate was accepted yet." };
        } else {
            mutation = { changed: false, node: doc, before: "", after: "", rejectionReason: "No anchor variant produced an exact match in a safe paragraph." };
            for (const candidateAnchor of usableAnchorCandidates) {
                const attempt = mutateStandaloneParagraphs(doc, input.strategy, candidateAnchor, href, input.semanticContext, false, input.allowSoftenedRephrase ?? false);
                if (attempt.changed) {
                    mutation = attempt;
                    break;
                }
                if (attempt.rejectionReason) {
                    skippedFallbacks.push(`Exact anchor "${candidateAnchor}" rejected: ${attempt.rejectionReason}`);
                }
            }
        }

        if (input.strategy === "builder_structured_html_rephrase_link") {
            // Collect up to 4 paragraph candidates and try them in order. For each paragraph,
            // try each anchor variant. This unblocks "AI rewrite gate rejected" failures where
            // ONE sentence couldn't carry ANY anchor — the engine can now move to the next
            // sentence in the same field instead of giving up immediately.
            const anchorCandidates = uniqueAnchorVariants(anchor, input.semanticContext.preferredAnchors);
            const paragraphCandidates = findAllRewriteParagraphCandidates(
                doc,
                input.strategy,
                anchor,
                input.semanticContext,
                input.allowSoftenedRephrase ?? false,
                4,
            );

            let lastRejectionReason: string | null = null;
            let acceptedSuggestion: SeoRewriteSuggestion | null = null;
            let acceptedValidation: { reason: string; anchorText?: string } | null = null;
            let acceptedCandidate: RewriteParagraphCandidate | null = null;

            if (paragraphCandidates.length === 0) {
                lastRejectionReason = "No safe rich-text paragraph could support a natural linked rewrite.";
            }

            outer: for (const paragraphCandidate of paragraphCandidates) {
                for (const candidateAnchor of anchorCandidates) {
                    if (input.aiBudget?.exhausted) {
                        lastRejectionReason = "AI rewrite budget exhausted before all candidate paragraphs were evaluated.";
                        break outer;
                    }
                    const suggestion = await maybeGenerateRewriteSuggestion({
                        sentence: paragraphCandidate.sentence,
                        paragraph: paragraphCandidate.paragraph,
                        blockType: input.blockType,
                        fieldPath: input.fieldPath,
                        sourceTitle: input.pageContext.sourceTitle,
                        sourceSlug: input.pageContext.sourceSlug,
                        pageIntent: input.pageContext.pageIntent,
                        conversionGoal: input.pageContext.conversionGoal,
                        targetTitle: input.targetTitle,
                        targetSlug: input.targetSlug,
                        platformCopyContext: input.pageContext.platformCopyContext,
                        requestedAnchor: candidateAnchor,
                        semanticContext: input.semanticContext,
                        aiBudget: input.aiBudget,
                    });

                    if (!suggestion) {
                        lastRejectionReason = input.aiBudget?.exhausted
                            ? "AI rewrite budget exhausted; remaining variants were skipped."
                            : "The AI rewrite service did not return a usable narrative-safe sentence.";
                        continue;
                    }

                    const validation = validateRewriteSuggestion({
                        suggestion,
                        sourceSentence: paragraphCandidate.sentence,
                        requestedAnchor: candidateAnchor,
                        allowedAnchors: input.semanticContext.preferredAnchors,
                    });

                    if (validation.ok) {
                        acceptedSuggestion = suggestion;
                        acceptedValidation = { reason: validation.reason, anchorText: validation.anchorText };
                        acceptedCandidate = paragraphCandidate;
                        break outer;
                    }

                    lastRejectionReason = validation.reason;
                    skippedFallbacks.push(
                        `Anchor "${candidateAnchor}" rejected on sentence "${paragraphCandidate.sentence.slice(0, 60)}...": ${validation.reason}`,
                    );
                }
            }

            if (acceptedSuggestion && acceptedValidation && acceptedCandidate) {
                pushRisk(riskChecks, {
                    key: "rewrite_confidence",
                    label: "Narrative rewrite confidence passed",
                    passed: true,
                    severity: acceptedSuggestion.confidence >= 65 ? "info" : "warning",
                    message: `${acceptedValidation.reason} Confidence ${acceptedSuggestion.confidence}.`,
                });

                mutation = applyRewrittenSentenceToParagraph(
                    doc,
                    acceptedCandidate.sentence,
                    acceptedSuggestion.sentence,
                    acceptedValidation.anchorText ?? anchor,
                    href,
                    false,
                    acceptedCandidate.sourceSentenceOffset,
                );
            } else {
                mutation = {
                    changed: false,
                    node: doc,
                    before: "",
                    after: "",
                    rejectionReason: lastRejectionReason
                        ?? "The AI rewrite service did not return a usable narrative-safe sentence after evaluating all candidate paragraphs.",
                };
            }
        }

        if (!mutation.changed) {
            return createFailure({
                originalValue: input.content,
                manualReviewReason: mutation.rejectionReason ?? "No safe rich-text paragraph supported the requested mutation strategy.",
                rendererCompatibility: "Rich-text rendering was left unchanged.",
                riskChecks,
                skippedFallbacks: [`${input.strategy.replace(/^builder_structured_/, "").replace(/_/g, " ")} skipped because ${mutation.rejectionReason ?? "no safe paragraph could support a natural linked rewrite"}.`],
                mutationStrategy: input.strategy,
                mutationStep: input.strategy === "builder_structured_html_text_node"
                    ? "exact_anchor_replacement"
                    : "controlled_semantic_rephrase",
                strategyReason: "The active renderer-aware HTML mutation could not preserve editorial naturalness safely.",
            });
        }

        if (mutation.semanticReason) {
            pushRisk(riskChecks, {
                key: "semantic_anchor_fit",
                label: "Semantic anchor suitability passed",
                passed: true,
                severity: mutation.semanticFit === "degraded" ? "warning" : "info",
                message: mutation.semanticReason,
            });
        }

        // Strip the XHTML namespace TipTap's generateHTML adds on the root element.
        // The browser parses HTML, not XHTML, so the xmlns attribute is meaningless here
        // and causes React #418 hydration mismatches when the same content is later
        // injected via dangerouslySetInnerHTML during page render.
        const updatedContent = generateHTML(mutation.node as never, richTextExtensions)
            .replace(/\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/gi, "");
        if (!enforceRichHtmlContainsLink(updatedContent, href)) {
            return createFailure({
                originalValue: input.content,
                manualReviewReason: "The rich-text AST validation did not produce the expected anchor output.",
                rendererCompatibility: "Rich-text rendering validation failed.",
                riskChecks,
                skippedFallbacks,
                mutationStrategy: input.strategy,
                mutationStep: input.strategy === "builder_structured_html_text_node"
                    ? "exact_anchor_replacement"
                    : "controlled_semantic_rephrase",
                beforeSnippet: mutation.before,
                afterSnippet: mutation.after,
            });
        }

        return {
            ok: true,
            beforeSnippet: mutation.before,
            afterSnippet: mutation.after,
            updatedValue: updatedContent,
            locationRationale: input.strategy === "builder_structured_html_text_node"
                ? "Exact anchor replacement was applied inside the first safe paragraph text node in the rich-text AST."
                : "A single rich-text sentence was contextually rewritten in-place so the internal link reads like part of the original narrative.",
            rendererCompatibility: "The field is rendered through the rich-text renderer and was mutated through a validated AST round-trip, so anchor markup will render correctly instead of leaking as literal text.",
            strategyReason: input.strategy === "builder_structured_html_text_node"
                ? "Exact anchor replacement was chosen because it makes the smallest possible editorial change."
                : "AI-assisted contextual rephrase was chosen because exact anchor replacement was unavailable but the existing paragraph could support a natural in-flow link.",
            manualReviewReason: null,
            riskChecks,
            mutationStrategy: input.strategy,
            mutationStep: input.strategy === "builder_structured_html_text_node"
                ? "exact_anchor_replacement"
                : "controlled_semantic_rephrase",
            skippedFallbacks,
        };
    } catch {
        return createFailure({
            originalValue: input.content,
            manualReviewReason: "The rich-text payload could not be parsed safely into an editable AST.",
            rendererCompatibility: "Rich-text rendering was left unchanged.",
            riskChecks,
            skippedFallbacks,
            mutationStrategy: input.strategy,
        });
    }
}

async function attemptTargetStrategy(input: {
    target: SeoBuilderMutationTarget;
    anchorText: string;
    targetSlug: string | null;
    targetTitle: string | null;
    pageContext: SeoMutationPageContext;
    inheritedRiskChecks?: SeoRiskCheckResult[];
    aiBudget?: AiCallBudget;
}): Promise<StrategyAttemptResult> {
    if (input.target.compatibilityStatus !== "safe_automatic_linking") {
        const protectedSurface = input.target.renderer !== "builder_plain_text_literal";
        return createFailure({
            originalValue: input.target.currentValue,
            manualReviewReason: protectedSurface
                ? "This candidate field is renderer-safe but policy-protected, so it remains manual-review only."
                : "This candidate field is renderer-incompatible with automatic linking and therefore remains manual-review only.",
            rendererCompatibility: input.target.compatibilityNote,
            riskChecks: [...(input.inheritedRiskChecks ?? [])],
            skippedFallbacks: [protectedSurface
                ? `${input.target.fieldPath} was rejected because this surface is policy-protected for manual review instead of unattended SEO mutation.`
                : `${input.target.fieldPath} was rejected because its renderer outputs literal text and cannot safely render automated links.`],
            mutationStrategy: "manual_review",
            mutationStep: "manual_review",
        });
    }

    const skippedFallbacks: string[] = [];
    let bestFailure: StrategyAttemptResult | null = null;
    const semanticContext = createSeoSemanticTargetContext({
        targetSlug: input.targetSlug,
        targetTitle: input.targetTitle,
        anchorText: input.anchorText,
    });

    const isStrategyCompatibleWithContentFormat = (strategy: SeoBuilderMutationTarget["preferredStrategies"][number]) => {
        if (strategy === "manual_review") {
            return true;
        }

        if (input.target.contentFormat === "builder_rich_text_html") {
            return strategy.startsWith("builder_structured_html_");
        }

        if (input.target.contentFormat === "builder_markdown") {
            return strategy.startsWith("builder_structured_markdown_");
        }

        return false;
    };

    for (const strategy of input.target.preferredStrategies) {
        if (strategy === "manual_review") continue;
        const semanticStrategyCheck = isStrategyPreferredForTarget(strategy, semanticContext);
        const relaxedSemanticStrategyCheck = !semanticStrategyCheck.passed && strategy.endsWith("rephrase_link") && allowsSoftenedRephrase(input.target)
            ? isStrategyPreferredForTarget(strategy, semanticContext, { allowSoftenedRephrase: true })
            : semanticStrategyCheck;
        if (!relaxedSemanticStrategyCheck.passed) {
            skippedFallbacks.push(`${strategy.replace(/^builder_structured_/, "").replace(/_/g, " ")} was skipped because ${relaxedSemanticStrategyCheck.reason}`);
            const candidate = createFailure({
                originalValue: input.target.currentValue,
                manualReviewReason: relaxedSemanticStrategyCheck.reason,
                rendererCompatibility: input.target.compatibilityNote,
                riskChecks: [...(input.inheritedRiskChecks ?? [])],
                skippedFallbacks: [...skippedFallbacks],
                mutationStrategy: strategy,
            });
            if (!bestFailure || failureSpecificity(candidate.manualReviewReason) > failureSpecificity(bestFailure.manualReviewReason)) {
                bestFailure = candidate;
            }
            continue;
        }
        if (!isStrategyCompatibleWithContentFormat(strategy)) {
            skippedFallbacks.push(`${strategy.replace(/^builder_structured_/, "").replace(/_/g, " ")} was skipped because ${input.target.fieldPath} requires ${input.target.contentFormat} output and the strategy format was incompatible.`);
            continue;
        }
        const strategyResult = input.target.contentFormat === "builder_markdown"
            ? await mutateMarkdownByStrategy({
                content: input.target.currentValue,
                anchorText: input.anchorText,
                targetSlug: input.targetSlug,
                targetTitle: input.targetTitle,
                strategy,
                blockType: input.target.blockType,
                fieldPath: input.target.fieldPath,
                pageContext: input.pageContext,
                semanticContext,
                inheritedRiskChecks: input.inheritedRiskChecks,
                allowSoftenedRephrase: allowsSoftenedRephrase(input.target),
                aiBudget: input.aiBudget,
            })
            : await mutateRichTextByStrategy({
                content: input.target.currentValue,
                anchorText: input.anchorText,
                targetSlug: input.targetSlug,
                targetTitle: input.targetTitle,
                strategy,
                blockType: input.target.blockType,
                fieldPath: input.target.fieldPath,
                pageContext: input.pageContext,
                semanticContext,
                inheritedRiskChecks: input.inheritedRiskChecks,
                allowSoftenedRephrase: allowsSoftenedRephrase(input.target),
                aiBudget: input.aiBudget,
            });

        if (strategyResult.ok) {
            return { ...strategyResult, skippedFallbacks: [...skippedFallbacks, ...strategyResult.skippedFallbacks] };
        }

        skippedFallbacks.push(...strategyResult.skippedFallbacks, `${strategy.replace(/^builder_structured_/, "").replace(/_/g, " ")} was attempted on ${input.target.fieldPath} but failed safe editorial or renderer validation.`);
        bestFailure = { ...strategyResult, skippedFallbacks: [...skippedFallbacks] };
    }

    return bestFailure ?? createFailure({
        originalValue: input.target.currentValue,
        manualReviewReason: "No target strategy was available for this field.",
        rendererCompatibility: input.target.compatibilityNote,
        riskChecks: [...(input.inheritedRiskChecks ?? [])],
        skippedFallbacks,
    });
}

function buildCandidateDiagnostic(
    target: SeoBuilderMutationTarget,
    status: SeoMutationCandidateDiagnostic["status"],
    summary: string,
    decisionReason: string,
    semanticFit: SeoMutationCandidateDiagnostic["semanticFit"],
): SeoMutationCandidateDiagnostic {
    return {
        blockId: target.blockId,
        blockType: target.blockType,
        fieldPath: target.fieldPath,
        locale: target.locale,
        contentFormat: target.contentFormat,
        renderer: target.renderer,
        compatibilityStatus: target.compatibilityStatus,
        status,
        rankingScore: target.rankingScore,
        summary,
        rendererCompatibility: target.compatibilityNote,
        decisionReason,
        semanticFit,
    };
}

export async function mutateBuilderInternalLink(input: {
    visualLayout: Json | null;
    anchorText: string;
    targetSlug: string | null;
    targetTitle: string | null;
    pageContext: SeoMutationPageContext;
    targets: SeoBuilderMutationTarget[];
    inheritedRiskChecks?: SeoRiskCheckResult[];
    /** Per-recommendation AI rewrite budget. Defaults to MAX_AI_CALLS_DEFAULT. */
    maxAiCalls?: number;
}): Promise<SeoMutationResult> {
    const riskChecks = [...(input.inheritedRiskChecks ?? [])];
    const candidateDiagnostics: SeoMutationCandidateDiagnostic[] = [];
    const aiBudget = new AiCallBudget(input.maxAiCalls ?? MAX_AI_CALLS_DEFAULT);

    if (!input.visualLayout || typeof input.visualLayout !== "object" || Array.isArray(input.visualLayout)) {
        return {
            ok: false,
            supported: false,
            automationTier: "manual_review",
            blockId: null,
            blockType: null,
            fieldPath: null,
            locale: null,
            mutationStrategy: "manual_review",
            mutationStep: "manual_review",
            strategyReason: "Builder mutation requires a structured visual layout object.",
            beforeSnippet: "",
            afterSnippet: "",
            originalValue: "",
            updatedValue: null,
            updatedContent: null,
            locationRationale: "",
            rendererCompatibility: "Builder mutation requires a structured visual layout object.",
            manualReviewReason: "No builder visual layout was available for structured mutation.",
            skippedFallbacks: [],
            candidateDiagnostics,
            riskChecks,
        };
    }

    const originalLayoutSnapshot = JSON.stringify(input.visualLayout);
    let bestFailure: SeoMutationResult | null = null;

    for (const target of input.targets) {
        if (target.compatibilityStatus !== "safe_automatic_linking") {
            candidateDiagnostics.push(buildCandidateDiagnostic(
                target,
                "rejected",
                target.renderer === "builder_plain_text_literal"
                    ? "Rejected before mutation because the renderer outputs literal plain text and cannot safely render automated links."
                    : "Rejected before mutation because this surface is policy-protected and remains manual-review only.",
                target.renderer === "builder_plain_text_literal"
                    ? "Renderer compatibility blocked automation before semantic evaluation."
                    : "Narrative/conversion protection blocked automation before semantic evaluation.",
                "rejected",
            ));
            continue;
        }

        pushRisk(riskChecks, {
            key: `target_${target.blockId}_${target.fieldPath}`,
            label: `Safe target ${target.blockType}.${target.fieldPath}`,
            passed: true,
            severity: "info",
            message: `Evaluating ${target.adapter.displayName} block ${target.blockId} at ${target.fieldPath}${target.locale ? ` for locale ${target.locale}` : ""}. Ranking ${target.rankingScore}. ${target.rankingBreakdown.join(" · ")}`,
        });

        const fieldMutation = await attemptTargetStrategy({
            target,
            anchorText: input.anchorText,
            targetSlug: input.targetSlug,
            targetTitle: input.targetTitle,
            pageContext: input.pageContext,
            inheritedRiskChecks: riskChecks,
            aiBudget,
        });

        const nextLayout = cloneJson(input.visualLayout) as { content?: BuilderBlock[] };
        const content = Array.isArray(nextLayout.content) ? nextLayout.content : [];
        const blockIndex = content.findIndex((block) => {
            const props = block && typeof block === "object" && !Array.isArray(block) ? (block.props as Record<string, unknown> | undefined) : undefined;
            return block?.type === target.blockType && props?.id === target.blockId;
        });

        if (blockIndex === -1) {
            candidateDiagnostics.push(buildCandidateDiagnostic(target, "fallback_skipped", "Skipped because the current visual layout no longer contains the expected target block instance.", "The stored preview snapshot drifted before mutation could be materialized.", "rejected"));
            continue;
        }

        const path = target.fieldPath.split(".");
        const currentValue = getStringAtPath(content[blockIndex], path);
        if (currentValue !== null && currentValue !== target.currentValue) {
            candidateDiagnostics.push(buildCandidateDiagnostic(target, "fallback_skipped", "Skipped because the candidate field changed after target discovery, so the preview snapshot is no longer safe to apply automatically.", "Field drift invalidated the semantic preview snapshot.", "rejected"));
            continue;
        }

        if (fieldMutation.updatedValue) {
            const updated = setStringAtPath(content[blockIndex], path, fieldMutation.updatedValue);
            if (!updated) {
                candidateDiagnostics.push(buildCandidateDiagnostic(target, "fallback_skipped", "Skipped because the structured field path could not be updated safely in the visual layout snapshot.", "Structured builder mutation could not be materialized safely.", "rejected"));
                continue;
            }
        }

        const materializedResult: SeoMutationResult = {
            ok: fieldMutation.ok,
            supported: fieldMutation.ok,
            automationTier: fieldMutation.ok ? target.automationTier : "manual_review",
            blockId: target.blockId,
            blockType: target.blockType,
            fieldPath: target.fieldPath,
            locale: target.locale,
            mutationStrategy: fieldMutation.mutationStrategy,
            mutationStep: fieldMutation.mutationStep,
            strategyReason: fieldMutation.strategyReason,
            beforeSnippet: fieldMutation.beforeSnippet,
            afterSnippet: fieldMutation.afterSnippet,
            originalValue: target.currentValue,
            updatedValue: fieldMutation.updatedValue,
            updatedContent: fieldMutation.updatedValue ? JSON.stringify(nextLayout) : null,
            locationRationale: `Selected ${target.adapter.displayName} ${target.blockId} at ${target.fieldPath}. ${fieldMutation.locationRationale}`,
            rendererCompatibility: `${target.compatibilityNote} ${fieldMutation.rendererCompatibility}`,
            manualReviewReason: fieldMutation.manualReviewReason,
            skippedFallbacks: fieldMutation.skippedFallbacks,
            candidateDiagnostics: [
                ...candidateDiagnostics,
                buildCandidateDiagnostic(target, fieldMutation.ok ? "selected" : "fallback_skipped", fieldMutation.ok
                    ? `Accepted with ${fieldMutation.mutationStep.replace(/_/g, " ")} after passing renderer and editorial validation.`
                    : fieldMutation.manualReviewReason ?? "Candidate failed safe editorial validation and remained a fallback skip.", fieldMutation.ok
                        ? fieldMutation.strategyReason
                        : fieldMutation.manualReviewReason ?? "Semantic or renderer guardrails rejected this candidate.", fieldMutation.ok ? "safe" : "rejected"),
            ],
            riskChecks: fieldMutation.riskChecks,
        };

        if (fieldMutation.ok) {
            pushRisk(riskChecks, {
                key: "single_section_limit",
                label: "Only one eligible section is mutated",
                passed: true,
                severity: "info",
                message: `Applied one contextual link in block ${target.blockId} only; no mass auto-linking was performed.`,
            });
            return materializedResult;
        }

        candidateDiagnostics.push(buildCandidateDiagnostic(target, "fallback_skipped", fieldMutation.manualReviewReason ?? "Candidate failed and the engine moved to the next ranked compatible target.", fieldMutation.manualReviewReason ?? "The engine downgraded this candidate after semantic or renderer validation failed.", "rejected"));
        // Pick the most-actionable failure for the user instead of the first one.
        if (
            !bestFailure
            || failureSpecificity(materializedResult.manualReviewReason) > failureSpecificity(bestFailure.manualReviewReason)
        ) {
            bestFailure = materializedResult;
        }
    }

    return bestFailure ?? {
        ok: false,
        supported: false,
        automationTier: "manual_review",
        blockId: null,
        blockType: null,
        fieldPath: null,
        locale: null,
        mutationStrategy: "manual_review",
        mutationStep: "manual_review",
        strategyReason: "No eligible builder field supported a safe automated mutation.",
        beforeSnippet: "",
        afterSnippet: "",
        originalValue: originalLayoutSnapshot,
        updatedValue: null,
        updatedContent: null,
        locationRationale: "",
        rendererCompatibility: "Builder visual layout was left unchanged.",
        manualReviewReason: "No safe builder field contained an eligible natural anchor occurrence or rephrase opportunity. Manual editorial review is required.",
        skippedFallbacks: [],
        candidateDiagnostics,
        riskChecks,
    };
}

export async function verifySeoMutationPipeline(input: {
    visualLayout: Json | null;
    anchorText: string;
    targetSlug: string | null;
    targetTitle: string | null;
    pageContext: SeoMutationPageContext;
    targets: SeoBuilderMutationTarget[];
    inheritedRiskChecks?: SeoRiskCheckResult[];
}) {
    const result = await mutateBuilderInternalLink(input);

    return {
        ok: result.ok,
        automationTier: result.automationTier,
        hasUpdatedSnapshot: typeof result.updatedContent === "string" && result.updatedContent.length > 0,
        selectedField: result.fieldPath,
        selectedBlock: result.blockType,
        manualReviewReason: result.manualReviewReason,
        skippedFallbacks: result.skippedFallbacks,
        candidateDiagnostics: result.candidateDiagnostics,
        riskChecks: result.riskChecks,
    };
}
