import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import {
    extractThemeAiContext,
    extractThemeAiSystemContext,
    getThemeManifestConfig,
} from "@/shared/lib/workspace/theme-manifest";
import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import { classifyTopicFreshnessRisk } from "@/shared/lib/ai/freshness";
import {
    buildFactSheet,
    formatFactSheetForPrompt,
    rankEvidenceHybrid,
    type CanonicalFactSheet,
    type RankedSource,
} from "@/shared/lib/ai/research-facts";
import {
    formatEvidencePackForPrompt,
    requireEvidenceForQuantitativeVisual,
    retrieveEvidencePack,
    type SourceEvidencePack,
} from "@/shared/lib/ai/source-intelligence";
import { HUMAN_VOICE_RULES, humanize, humanizeDeep } from "@/shared/lib/ai/human-voice";
import {
    GeneratedOutputSafetyError,
    assertSafeGeneratedOutput,
} from "@/shared/lib/ai/output-safety";
import { applyAntiTemplateTransforms } from "@/shared/lib/ai/anti-template";
import { buildLocaleSystemPrompt, resolveGenerationLocale } from "@/shared/lib/ai/locale";
import { normalizeMarkdownForRender } from "@/features/content-engine/lib/normalize-markdown";
import {
    buildAsciiDiagramFallback,
    extractAsciiDiagramIntents,
    formatAsciiDiagramIntentsForPrompt,
} from "@/features/content-engine/lib/diagram-intents";
import {
    pickCaseSnippetForBrief,
    recordCaseSnippetUsage,
} from "@/features/content-engine/case-snippets";
import { buildCaseSnippetPromptBlock } from "@/features/content-engine/case-snippets-prompt";
import type { CaseSnippet } from "@/features/content-engine/case-snippets-types";
import {
    BLOG_DIAGRAM_FEEDBACK_TYPES,
    BLOG_DIAGRAM_NODE_TYPES,
    BLOG_DIAGRAM_POLARITIES,
    BLOG_DIAGRAM_TYPES,
    BLOG_SYSTEM_ARCHETYPES,
    normalizeBlogDiagramGraph,
    normalizeEvidenceForVisualBlock,
    type BlogEvidenceRecord,
    type BlogSourceQuality,
    type BlogVisualBlock,
} from "@/features/content-engine/visual-enrichment";
import { tavilySearch, tavilyCountryForLocale } from "@/shared/lib/ai/tavily";
import { isBlockedExternalUrl } from "@/features/seo/lib/external-link-blocklist";
import { buildInternalContentHref } from "@/features/seo/lib/internal-link-href";
import { normalizeAiProviderError } from "@/shared/lib/ai/errors";
import {
    buildAiRequestMetadata,
    getAiModel,
    getModelMetadata,
    runWithWorkspaceAiConfig,
    type AiModelAlias,
} from "@/shared/lib/ai/provider";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    BLOG_LENGTH_TIER_RULES,
    buildEditorialScorecard,
    extractMarkdownHeadings,
    formatValidationIssuesForPrompt,
    normalizeHeadingForEditorialMatch,
    resolveEffectivePrimaryKeyword,
    validateGeneratedBlogDraft,
    type BlogEditorialIntent,
    type BlogEditorialValidationInput,
    type BlogEditorialValidationResult,
    type EditorialCitation,
    type ExtractedEditorialHeading,
    type EditorialScorecard,
} from "@/features/content-engine/lib/blog-editorial-validation";
import {
    assessBlogEditorialPublicationReadiness,
    getBlogEditorialPublicPolicy,
    getBlogEditorialRepairTargets,
} from "@/features/content-engine/lib/blog-editorial-policy";
import { repairDeterministicGrammarDiagnostics } from "@/features/content-engine/lib/editorial-repair";
import {
    parseDraftGenerationRequest,
    type DraftGenerationRequest,
} from "@/features/content-engine/generation/draft-request-contract";
import { normalizeGeneratedDraftFormats } from "@/features/content-engine/generation/derived-formats";
import { getSiteHost } from "@/shared/lib/site-url";
import {
    beginDraftGenerationPhase,
    completeDraftGenerationPhase,
    completeDraftGenerationRun,
    failDraftGenerationRun,
    runDraftGenerationPhase,
    startDraftGenerationRun,
    type DraftGenerationRunHandle,
} from "@/features/content-engine/generation/draft-run-state";

export const maxDuration = 300;

const ROUTE_NAME = "generate-draft";
// Workload aliases keep this route on Flash-class economics by default:
// research and draft writing use text.writer, while retryable side-output JSON
// uses text.structured.bulk. The deep-reasoning alias is reserved for explicit
// escalation paths once runtime fallback/evaluation gates are in place.
// TODO(search-grounding): the Deno edge function ran the research model
// with `{ useSearchGrounding: true }`. Grounding replacement is deferred;
// Tavily-backed fact sheets remain intact and model calls now route through
// the central provider adapter.
const RESEARCH_MODEL_ALIAS: AiModelAlias = "text.writer";
const DRAFT_MODEL_ALIAS: AiModelAlias = "text.writer";
const STRUCTURED_MODEL_ALIAS: AiModelAlias = "text.structured.bulk";
const BLOG_EDITORIAL_MAX_REPAIR_ATTEMPTS = 1;

function resolveTextModel(alias: AiModelAlias): LanguageModel {
    return getAiModel(alias) as LanguageModel;
}

interface DraftBrief extends Omit<
    DraftGenerationRequest,
    "locale" | "opportunity_id" | "plan_id"
> {
    author_id: string;
    aiContext: {
        industry: string;
        brandVoice: string;
        targetAudience: string;
        contentPillars: string[];
        visualStyle: string;
    };
    aiSystemContext: string;
    workspaceLocale: "en" | "nl" | "ar";
    generate_charts?: boolean;
    generate_diagrams?: boolean;
    visual_density?: "light" | "balanced" | "rich";
}

type SeoSourceKind = "plan" | "opportunity";

interface SeoPlanSourceContext {
    kind: Extract<SeoSourceKind, "plan">;
    id: string;
    title: string;
    slugSuggestion: string | null;
    primaryKeyword: string | null;
    secondaryKeywords: string[];
    intentStage: string | null;
    funnelStage: string | null;
    targetConversionGoal: string | null;
    briefMarkdown: string | null;
    outline: Json;
    metadata: Json;
    locale: string | null;
}

interface SeoOpportunitySourceContext {
    kind: Extract<SeoSourceKind, "opportunity">;
    id: string;
    title: string;
    topic: string;
    summary: string | null;
    rationale: string | null;
    targetIntent: string | null;
    funnelStage: string | null;
    targetConversionGoal: string | null;
    recommendedFormat: string | null;
    opportunityType: string;
    clusterId: string | null;
    clusterName: string | null;
    planId: string | null;
    priorityScore: number;
    strategicImportanceScore: number;
    blueOceanScore: number;
    analyticsScore: number;
    inventorySnapshot: Json;
    analyticsSnapshot: Json;
    metadata: Json;
    locale: string | null;
}

type SeoSourceContext = SeoPlanSourceContext | SeoOpportunitySourceContext;

interface ArticleLinkSuggestion {
    url: string;
    anchor: string;
    reason: string;
    targetSection?: string;
}

interface ArticleCitationSuggestion {
    title: string;
    url: string;
    publisher?: string;
    reason: string;
    targetSection?: string;
}

interface ArticleFaqSuggestion {
    question: string;
    intent: string;
    answerAngle?: string;
}

interface ArticleBlueprintSection {
    h2: string;
    role: string;
    targetWordCount?: number;
    h3s: Array<{
        heading: string;
        role: string;
        requiredEvidence?: string[];
    }>;
    keyPoints: string[];
    requiredEvidence: string[];
    internalLinkTargets: ArticleLinkSuggestion[];
    externalCitationTargets: ArticleCitationSuggestion[];
}

interface ArticleBlueprint {
    primaryKeyword: string;
    secondaryKeywords: string[];
    searchIntent: string;
    intentStage: string | null;
    funnelStage: string | null;
    targetReader: string;
    conversionGoal: string | null;
    articleType: string;
    thesis: string;
    differentiationAngle: string;
    requiredEvidence: string[];
    internalLinkTargets: ArticleLinkSuggestion[];
    externalCitationTargets: ArticleCitationSuggestion[];
    faqQuestions: ArticleFaqSuggestion[];
    sections: ArticleBlueprintSection[];
}

interface EvergreenResearchSourcePass {
    checked_at: string;
    target_count: number;
    sources: RankedSource[];
    query: string;
    retrieval_mode: "tavily_evergreen_lightweight" | "none";
    notes: string;
}

const LENGTH_GUIDE: Record<DraftBrief["length"], string> = {
    short: "500-800 words",
    medium: "1000-1500 words",
    long: "2000-3000 words",
    "deep-dive": "4000-6000 words with sub-sections and examples",
};

// Required H2 section count per length tier. Used both in the writer prompt
// (so the model knows the structural target) and in the post-extraction
// validator (so we retry when the model emits one continuous body).
const H2_SECTION_GUIDE: Record<DraftBrief["length"], { min: number; target: string }> = {
    short: { min: 3, target: "3-5" },
    medium: { min: 4, target: "4-6" },
    long: { min: 5, target: "5-8" },
    "deep-dive": { min: 7, target: "7-12" },
};

const VISUAL_DENSITY_GUIDE: Record<NonNullable<DraftBrief["visual_density"]>, string> = {
    light: "1-2 high-value visual blocks",
    balanced: "3-5 high-value visual blocks",
    rich: "5-8 high-value visual blocks with a mix of data charts and explanatory diagrams",
};

function extractJsonObject(text: string) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in response");
    return JSON.parse(match[0]) as Record<string, unknown>;
}

function extractTaggedText(tag: string, text: string) {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
}

function slugifyVisualId(input: string, fallback: string) {
    const slug = input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 64);
    return slug || fallback;
}

function normalizeHttpUrl(value: unknown) {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
        const url = new URL(trimmed);
        if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
        return url.toString();
    } catch {
        return undefined;
    }
}

function stripInlineMarkdown(value: unknown) {
    if (typeof value !== "string") return undefined;
    return value
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/_(.*?)_/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
        .replace(/^[-*]\s+/gm, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

const PUBLIC_COPY_IDENTIFIER_REWRITES: Array<[RegExp, string]> = [
    [/`workspace_signup`/g, "workspace sign-up"],
    [/\bworkspace_signup\b/g, "workspace sign-up"],
    [/`newsletter_subscribe`/g, "newsletter subscription"],
    [/\bnewsletter_subscribe\b/g, "newsletter subscription"],
    [/`form_submit`/g, "form submission"],
    [/\bform_submit\b/g, "form submission"],
    [/`cta_click`/g, "call-to-action click"],
    [/\bcta_click\b/g, "call-to-action click"],
    [/`page_view`/g, "page visit"],
    [/\bpage_view\b/g, "page visit"],
    [/`booking_reserved`/g, "booking request"],
    [/\bbooking_reserved\b/g, "booking request"],
    [/`booking_blocked_pro_gate`/g, "booking access restriction"],
    [/\bbooking_blocked_pro_gate\b/g, "booking access restriction"],
    [/`content_items`/g, "content library"],
    [/\bcontent_items\b/g, "content library"],
    [/`visual_blocks`/g, "visual content blocks"],
    [/\bvisual_blocks\b/g, "visual content blocks"],
];

function sanitizePublicCopy(text: string) {
    let out = text;
    for (const [pattern, replacement] of PUBLIC_COPY_IDENTIFIER_REWRITES) {
        out = out.replace(pattern, replacement);
    }

    // Inline code is acceptable in developer docs, but this generator creates
    // public marketing/SEO prose. Backticks around business terms make the copy
    // look like leaked implementation notes, so unwrap non-code phrases.
    out = out.replace(/`([a-z][a-z0-9_-]{2,})`/gi, (_match, raw: string) => {
        const human = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
        return human;
    });

    return out;
}

function getPromptResearchSources(factSheet: CanonicalFactSheet | null, evergreenSources: readonly RankedSource[], evidencePack: SourceEvidencePack | null = null): RankedSource[] {
    const byUrl = new Map<string, RankedSource>();
    const evidenceSources: RankedSource[] = (evidencePack?.documents ?? []).map((document) => ({
        url: document.canonical_url,
        title: document.title,
        snippet: `${document.publisher ?? "Source Intelligence"} ${document.quality} ${document.trust_tier}`,
        score: document.score,
        trust_tier: document.trust_tier === "regulatory" ? 5 : document.trust_tier === "industry" ? 4 : document.trust_tier === "vendor" ? 2 : 1,
        published_date: document.published_at ?? undefined,
    }));
    for (const source of [...(factSheet?.sources ?? []), ...evergreenSources, ...evidenceSources]) {
        if (!source.url || byUrl.has(source.url)) continue;
        byUrl.set(source.url, source);
    }
    return [...byUrl.values()];
}

function formatVisualSourceContextWithSources(sources: readonly RankedSource[]) {
    if (!sources.length) {
        return "No verified external source URLs were available at draft time. Generate the visual anyway — a post-generation pass will look up and attach a real source URL automatically. Do NOT use placeholder source labels; leave source_label and source_url empty if you cannot supply a real one.";
    }

    return `Verified external source URLs available for visual citations:
${sources.slice(0, 10).map((source, index) => `${index + 1}. ${source.title} — ${source.url}${source.published_date ? ` (${source.published_date})` : ""}`).join("\n")}

Citation rule: every chart and diagram MUST cite one of the URLs above. Set source_url to the exact URL and source_label to the publisher name (e.g. "McKinsey", "Statista", "Gartner"). Never use placeholder source labels when verified URLs are available — pick the most relevant one. If absolutely none of the URLs above relate to the visual, leave source_label and source_url empty; a post-generation pass will look up a real URL.`;
}

const VISUAL_EVIDENCE_PROMPT_CONTRACT = `STRUCTURED EVIDENCE CONTRACT (mandatory for every visual):
- Every chart or diagram object MUST include an "evidence" object. Do not rely only on source_label/source_url.
- evidence.evidence_type MUST be one of: verified_statistic, time_sensitive_benchmark, forecast, author_framework, author_synthesis, internal_estimate, unsupported.
- evidence.source_quality MUST be one of: primary, near_primary, secondary, vendor, internal, unknown.
- evidence.confidence MUST be one of: high, medium, low.
- evidence.claim_text: write the exact claim represented by the visual.
- evidence.source_label/source_url must mirror top-level source_label/source_url when external evidence is used.
- evidence.publication_date: exact report/date/year for external numbers, forecasts, benchmarks, or named datasets when available.
- evidence.metric_definition: define what exact numbers measure and denominator/sample/geography where feasible.
- evidence.geography_and_sample: include sample/geography when the source provides it.
- evidence.source_note: reviewer-facing caveat, methodology note, or "not external proof" note.

SOURCE HIERARCHY / TAXONOMY:
1. primary regulators/institutions (source_quality=primary): EU, European Commission, SBA, national/statistical/government bodies. Best for legal/status/regulatory and official program facts.
2. primary/near-primary research (source_quality=near_primary): HBS, BCG, McKinsey, SHRM, NFIB, PMI, Gartner press releases. Use for research-led statistics only with exact source URL and date.
3. named datasets (source_quality=secondary): Statista, BetterCloud, Okta, Zylo, Productiv. Source label MUST include exact year/dataset/report name when used for numbers.
4. analyst/market research: forecasts only; evidence_type=forecast, include source date and source_note caveat that forecasts are forward-looking estimates, not performance guarantees.
5. vendor blogs (source_quality=vendor): definitions/framing only. Do NOT use vendor blogs as hard quantitative proof.
6. author frameworks/syntheses: evidence_type=author_framework or author_synthesis, source_quality=internal, no external source_url unless the visual directly maps a named external framework.
7. AI-generated synthesis is NEVER an acceptable source_label. Never output source_label values like "AI research synthesis", "AI synthesis", "Generated by AI", or "research synthesis".`;

// ─── Visual source attachment (post-generation) ────────────────────────────
//
// The blog generator used to fall back to a vague placeholder source label with
// no URL whenever it couldn't pin a visual to a specific source. The published
// article then displayed that string under
// every visual, which both reads as machine-generated AND breaks the SEO
// expectation that every cited datapoint links to a verifiable origin.
//
// This helper runs AFTER the chart/diagram generators and:
//   1. Reuses verified factSheet sources by token-overlap match (free, no API).
//   2. Falls back to a one-shot Tavily search keyed off the visual's title +
//      description when no factSheet match exists.
//   3. Derives a clean publisher label from the URL hostname (e.g.
//      "www.mckinsey.com/insights/foo" → "McKinsey").
//
// Blocks that already arrive with a real source_url are left untouched. If
// every attempt fails (Tavily key missing, no usable result), the block is
// returned with source_label cleared so the renderer omits the "Source:" row
// instead of printing the placeholder string.

const PLACEHOLDER_SOURCE_LABELS: ReadonlySet<string> = new Set([
    `ai ${"research"} synthesis`,
    `ai ${"synthesis"}`,
    "research synthesis",
    "synthesis",
    "ai generated",
    "ai-generated",
]);

function isPlaceholderSourceLabel(label: string | null | undefined): boolean {
    if (!label) return true;
    return PLACEHOLDER_SOURCE_LABELS.has(label.trim().toLowerCase());
}

function publisherLabelFromUrl(url: string): string | null {
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        if (!host) return null;
        const parts = host.split(".");
        // Use the second-level domain when it carries the brand
        // (mckinsey.com → "McKinsey"); for brand.subdomain.com take the
        // leftmost label; for sites like "hbr.org" capitalize all-caps.
        const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        if (root.length <= 4) return root.toUpperCase();
        return root.charAt(0).toUpperCase() + root.slice(1);
    } catch {
        return null;
    }
}

function tokenizeSimple(text: string): Set<string> {
    const STOP = new Set(["the", "and", "for", "with", "from", "that", "this", "into", "your", "you", "are", "but", "how", "what", "why", "who"]);
    return new Set(
        (text.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []).filter((t) => !STOP.has(t)),
    );
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let hits = 0;
    const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
    for (const t of smaller) if (larger.has(t)) hits += 1;
    const union = a.size + b.size - hits;
    return union > 0 ? hits / union : 0;
}

function matchFactSheetSource(
    block: BlogVisualBlock,
    factSheet: CanonicalFactSheet | null,
    evergreenSources: readonly RankedSource[] = [],
    evidencePack: SourceEvidencePack | null = null,
): { url: string; label: string } | null {
    const sources = getPromptResearchSources(factSheet, evergreenSources, evidencePack);
    if (!sources.length) return null;
    const blockTokens = tokenizeSimple(`${block.title} ${block.description ?? ""} ${block.caption ?? ""}`);
    if (blockTokens.size === 0) return null;
    let best: { url: string; label: string; score: number } | null = null;
    for (const source of sources) {
        const sourceTokens = tokenizeSimple(`${source.title} ${source.snippet ?? ""}`);
        const score = jaccard(blockTokens, sourceTokens);
        if (score < 0.05) continue;
        if (!best || score > best.score) {
            best = {
                url: source.url,
                label: publisherLabelFromUrl(source.url) || source.title || "Source",
                score,
            };
        }
    }
    return best ? { url: best.url, label: best.label } : null;
}

function getSourceQualityForUrl(url: string | undefined): BlogSourceQuality {
    if (!url) return "unknown";
    try {
        const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        if (/(^|\.)europa\.eu$|(^|\.)ec\.europa\.eu$|(^|\.)sba\.gov$|\.gov$|\.gov\.[a-z.]+$/.test(host)) return "primary";
        if (/(^|\.)(hbs\.edu|bcg\.com|mckinsey\.com|shrm\.org|nfib\.com|pmi\.org|gartner\.com)$/.test(host)) return "near_primary";
        if (/(^|\.)(statista\.com|bettercloud\.com|okta\.com|zylo\.com|productiv\.com)$/.test(host)) return "secondary";
        if (/(^|\.)(hubspot\.com|salesforce\.com|servicenow\.com|atlassian\.com|zapier\.com|asana\.com|monday\.com|clickup\.com|notion\.so)$/.test(host)) return "vendor";
        return "unknown";
    } catch {
        return "unknown";
    }
}

function normalizeVisualEvidenceAfterSourceAttachment(block: BlogVisualBlock, input?: unknown): BlogEvidenceRecord {
    const evidence = normalizeEvidenceForVisualBlock(block, input);
    const sourceUrl = block.source_url ?? evidence.source_url;
    const sourceLabel = block.source_label || evidence.source_label;
    const sourceQuality = evidence.source_quality === "unknown" && sourceUrl
        ? getSourceQualityForUrl(sourceUrl)
        : evidence.source_quality;
    return {
        ...evidence,
        source_url: sourceUrl,
        source_label: sourceLabel || evidence.source_label,
        source_quality: sourceQuality,
    };
}

function downgradeUnsupportedQuantitativeChart(block: BlogVisualBlock, evidencePack: SourceEvidencePack | null): BlogVisualBlock {
    if (block.type !== "chart") return block;
    const hasExactNumericData = Array.isArray(block.data) && block.data.some((datum) => Number.isFinite(datum.value) && datum.value !== 0);
    if (!hasExactNumericData) return block;
    const gate = requireEvidenceForQuantitativeVisual(evidencePack, `${block.title} ${block.description ?? ""} ${block.caption ?? ""}`);
    if (gate.allowed) return block;
    const nextBlock = {
        ...block,
        type: "diagram" as const,
        diagram_type: "framework" as const,
        nodes: block.data.map((datum, index) => ({
            id: slugifyVisualId(datum.label, `signal-${index + 1}`),
            label: datum.label,
            description: datum.note ?? "Directional signal only; exact numeric chart suppressed because no primary or near-primary evidence was available.",
        })).slice(0, 6),
        edges: [],
        data: undefined,
        chart_type: undefined,
        unit: undefined,
        source_url: "",
        source_label: "",
    } as BlogVisualBlock;
    return {
        ...nextBlock,
        evidence: normalizeVisualEvidenceAfterSourceAttachment(nextBlock, {
            evidence_type: "author_synthesis",
            source_quality: "internal",
            confidence: "low",
            claim_text: block.evidence?.claim_text ?? block.title,
            source_note: "Exact numeric values were removed because no suitable primary or near-primary source was available.",
            safe_fallback_wording: "Directional framework, not a benchmark.",
        }),
    };
}

async function lookupSourceViaTavily(
    block: BlogVisualBlock,
    brief: DraftBrief,
): Promise<{ url: string; label: string } | null> {
    if (!process.env.TAVILY_API_KEY) return null;
    const query = `${block.title} ${block.description ?? ""}`.trim().slice(0, 380);
    if (!query) return null;
    try {
        const result = await tavilySearch({
            query: `${query} ${brief.aiContext.industry ?? ""}`.trim().slice(0, 400),
            search_depth: "advanced",
            topic: "general",
            max_results: 6,
            country: tavilyCountryForLocale(brief.workspaceLocale),
        });
        const candidate = (result.results ?? [])
            .filter((r) => !isBlockedExternalUrl(r.url))
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        if (!candidate) return null;
        const label = publisherLabelFromUrl(candidate.url) || candidate.title?.slice(0, 60) || "Source";
        return { url: candidate.url, label };
    } catch (err) {
        console.warn("[attachSourcesToVisualBlocks] tavily lookup failed", {
            blockId: block.id,
            error: String(err).slice(0, 200),
        });
        return null;
    }
}

async function attachSourcesToVisualBlocks(
    blocks: BlogVisualBlock[],
    brief: DraftBrief,
    factSheet: CanonicalFactSheet | null,
    evergreenSources: readonly RankedSource[] = [],
    evidencePack: SourceEvidencePack | null = null,
): Promise<BlogVisualBlock[]> {
    if (blocks.length === 0) return blocks;

    return Promise.all(
        blocks.map(async (rawBlock) => {
            const block = downgradeUnsupportedQuantitativeChart(rawBlock, evidencePack);
            // Already has a real http(s) source URL — keep it. Just ensure the
            // label is a real publisher name instead of a vague placeholder.
            if (block.source_url) {
                if (isPlaceholderSourceLabel(block.source_label)) {
                    const nextBlock = {
                        ...block,
                        source_label: publisherLabelFromUrl(block.source_url) || "Source",
                    };
                    return {
                        ...nextBlock,
                        evidence: normalizeVisualEvidenceAfterSourceAttachment(nextBlock, block.evidence),
                    };
                }
                return {
                    ...block,
                    evidence: normalizeVisualEvidenceAfterSourceAttachment(block, block.evidence),
                };
            }

            // Author-created system maps are explanatory models, not missing
            // citations. Keep them explicitly internal instead of spending a
            // Tavily call to attach an unrelated source and accidentally
            // presenting inferred causality as external proof.
            const normalizedEvidence = normalizeVisualEvidenceAfterSourceAttachment(block, block.evidence);
            if (
                block.type === "diagram"
                && ["author_framework", "author_synthesis"].includes(normalizedEvidence.evidence_type)
            ) {
                const nextBlock = {
                    ...block,
                    source_label: "",
                    source_url: undefined,
                };
                return {
                    ...nextBlock,
                    evidence: normalizeVisualEvidenceAfterSourceAttachment(nextBlock, normalizedEvidence),
                };
            }

            // No URL. Try the factSheet first (free), then Tavily.
            const fromFactSheet = matchFactSheetSource(block, factSheet, evergreenSources, evidencePack);
            const resolved = fromFactSheet ?? (await lookupSourceViaTavily(block, brief));

            if (resolved) {
                const nextBlock = {
                    ...block,
                    source_url: resolved.url,
                    source_label: resolved.label,
                };
                return {
                    ...nextBlock,
                    evidence: normalizeVisualEvidenceAfterSourceAttachment(nextBlock, block.evidence),
                };
            }

            // Last resort: clear the placeholder label so the UI omits the
            // "Source:" row instead of printing the AI tell.
            if (isPlaceholderSourceLabel(block.source_label)) {
                const nextBlock = { ...block, source_label: "" };
                return {
                    ...nextBlock,
                    evidence: normalizeVisualEvidenceAfterSourceAttachment(nextBlock, block.evidence),
                };
            }
            return {
                ...block,
                evidence: normalizeVisualEvidenceAfterSourceAttachment(block, block.evidence),
            };
        }),
    );
}

function sanitizeVisualBlocks(blocks: unknown, prefix: "chart" | "diagram"): BlogVisualBlock[] {
    if (!Array.isArray(blocks)) return [];

    const sanitized: BlogVisualBlock[] = [];
    // Track every id we've already produced for THIS sanitize call so two
    // visuals with identical titles don't collide on the same slug. The
    // prefix-namespacing on the base id already separates chart from diagram
    // across calls; this disambiguates within the same array.
    const usedIds = new Set<string>();
    const dedupedId = (raw: string, fallback: string) => {
        const base = slugifyVisualId(raw, fallback);
        if (!usedIds.has(base)) {
            usedIds.add(base);
            return base;
        }
        let suffix = 2;
        while (usedIds.has(`${base}-${suffix}`)) suffix += 1;
        const out = `${base}-${suffix}`;
        usedIds.add(out);
        return out;
    };

    blocks.forEach((raw, index) => {
            if (!raw || typeof raw !== "object") return null;
            const block = raw as Record<string, unknown>;
            const title = stripInlineMarkdown(block.title) || "";
            if (!title) return null;

            const base = {
                // Prefix every id with chart_/diagram_ so the two parallel
                // generators can never produce a colliding id even if they
                // both pick the same model-supplied id or title.
                id: `${prefix}_${dedupedId(typeof block.id === "string" ? block.id : title, `${prefix}-${index + 1}`)}`,
                title,
                description: stripInlineMarkdown(block.description) || "",
                caption: stripInlineMarkdown(block.caption) || "",
                // Default source_label to empty rather than the "AI research
                // synthesis" placeholder. The post-generation
                // attachSourcesToVisualBlocks pass either fills both fields
                // with a real URL+publisher or leaves the label empty so the
                // renderer omits the "Source:" row entirely. The placeholder
                // string used to leak into published articles as an AI tell.
                source_label: stripInlineMarkdown(block.source_label) || "",
                source_url: normalizeHttpUrl(block.source_url),
                seo_alt: stripInlineMarkdown(block.seo_alt) || title,
                placement_hint: stripInlineMarkdown(block.placement_hint),
            };
            const evidenceInput = block.evidence;

            if (prefix === "chart") {
                const data = Array.isArray(block.data)
                    ? block.data.map((datum) => {
                        if (!datum || typeof datum !== "object") return null;
                        const d = datum as Record<string, unknown>;
                        const label = typeof d.label === "string" ? d.label.trim() : "";
                        const value = typeof d.value === "number" ? d.value : Number(d.value);
                        if (!label || Number.isNaN(value)) return null;
                        return {
                            label,
                            value,
                            secondaryValue: typeof d.secondaryValue === "number" ? d.secondaryValue : undefined,
                            group: typeof d.group === "string" ? d.group : undefined,
                            note: stripInlineMarkdown(d.note),
                        };
                    }).filter((datum): datum is NonNullable<typeof datum> => Boolean(datum))
                    : [];

                if (!data.length) return null;
                const chartType = String(block.chart_type);
                const unitRaw = typeof block.unit === "string" ? block.unit : undefined;
                const isPercentageUnit = typeof unitRaw === "string" && /%|percent/i.test(unitRaw);

                // ── Hallucination guards ────────────────────────────────
                // A reviewer caught a published chart with values 37.5% / 37.5%
                // (identical, contradicting the surrounding narrative). The
                // model invents plausible-looking numbers in JSON when the
                // research doesn't give it real ones. Drop charts that fail
                // these structural checks rather than ship invalid data.

                // 1. All-identical values across a multi-segment chart are
                //    structurally meaningless. KPIs are a single value so this
                //    only applies when there are 2+ distinct labels.
                if (data.length >= 2) {
                    const first = data[0].value;
                    if (data.every((d) => d.value === first)) {
                        console.warn(`[sanitizeVisualBlocks] dropping chart "${title}" — all ${data.length} segments share the same value (${first}). Likely hallucination.`);
                        return null;
                    }
                }

                // 2. Percentage charts whose values don't sum to ~100 (donut/
                //    pie semantics) or whose any single value exceeds 100 are
                //    invalid. We allow ±5 slack for rounding.
                if (isPercentageUnit) {
                    const anyOver100 = data.some((d) => Math.abs(d.value) > 100);
                    if (anyOver100) {
                        console.warn(`[sanitizeVisualBlocks] dropping chart "${title}" — percentage value exceeds 100.`);
                        return null;
                    }
                    if ((chartType === "donut" || (chartType === "bar" && data.length <= 6)) && data.length >= 2) {
                        const sum = data.reduce((acc, d) => acc + d.value, 0);
                        if (sum < 90 || sum > 110) {
                            console.warn(`[sanitizeVisualBlocks] dropping chart "${title}" — percentage segments sum to ${sum.toFixed(1)} (expected ~100).`);
                            return null;
                        }
                    }
                }

                // 3. Charts with numeric values BUT no `source_url` reference
                //    are unverifiable and the model frequently invents them.
                //    KPIs are allowed without a URL because they often
                //    reference a fact already proved in the narrative.
                if (chartType !== "kpi" && !base.source_url) {
                    const hasNumericData = data.some((d) => typeof d.value === "number" && d.value !== 0);
                    if (hasNumericData) {
                        console.warn(`[sanitizeVisualBlocks] dropping chart "${title}" — numeric chart has no source_url; cannot verify values.`);
                        return null;
                    }
                }

                const chartBlock = {
                    ...base,
                    type: "chart" as const,
                    chart_type: ["bar", "line", "donut", "kpi", "comparison_table"].includes(chartType)
                        ? chartType as "bar" | "line" | "donut" | "kpi" | "comparison_table"
                        : "bar",
                    unit: unitRaw,
                    data,
                };
                sanitized.push({
                    ...chartBlock,
                    evidence: normalizeVisualEvidenceAfterSourceAttachment(chartBlock, evidenceInput),
                });
                return null;
            }

            const nodes = Array.isArray(block.nodes)
                ? block.nodes.map((node) => {
                    if (!node || typeof node !== "object") return null;
                    const n = node as Record<string, unknown>;
                    const label = stripInlineMarkdown(n.label) || "";
                    if (!label) return null;
                    return {
                        id: slugifyVisualId(typeof n.id === "string" ? n.id : label, `node-${index + 1}`),
                        label,
                        description: stripInlineMarkdown(n.description),
                        node_type: BLOG_DIAGRAM_NODE_TYPES.includes(String(n.node_type) as typeof BLOG_DIAGRAM_NODE_TYPES[number])
                            ? String(n.node_type) as typeof BLOG_DIAGRAM_NODE_TYPES[number]
                            : undefined,
                    };
                }).filter((node): node is NonNullable<typeof node> => Boolean(node))
                : [];
            const edges = Array.isArray(block.edges)
                ? block.edges.map((edge) => {
                    if (!edge || typeof edge !== "object") return null;
                    const e = edge as Record<string, unknown>;
                    if (typeof e.from !== "string" || typeof e.to !== "string") return null;
                    return {
                        from: e.from,
                        to: e.to,
                        label: stripInlineMarkdown(e.label),
                        polarity: BLOG_DIAGRAM_POLARITIES.includes(String(e.polarity) as typeof BLOG_DIAGRAM_POLARITIES[number])
                            ? String(e.polarity) as typeof BLOG_DIAGRAM_POLARITIES[number]
                            : undefined,
                        delay: e.delay === true,
                    };
                }).filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))
                : [];

            if (!nodes.length && typeof block.mermaid !== "string") return null;
            const diagramType = String(block.diagram_type);
            const graph = normalizeBlogDiagramGraph(nodes, edges);
            const diagramBlock = {
                ...base,
                type: "diagram" as const,
                diagram_type: BLOG_DIAGRAM_TYPES.includes(diagramType as typeof BLOG_DIAGRAM_TYPES[number])
                    ? diagramType as typeof BLOG_DIAGRAM_TYPES[number]
                    : "flowchart",
                system_archetype: BLOG_SYSTEM_ARCHETYPES.includes(String(block.system_archetype) as typeof BLOG_SYSTEM_ARCHETYPES[number])
                    ? String(block.system_archetype) as typeof BLOG_SYSTEM_ARCHETYPES[number]
                    : undefined,
                feedback_type: BLOG_DIAGRAM_FEEDBACK_TYPES.includes(String(block.feedback_type) as typeof BLOG_DIAGRAM_FEEDBACK_TYPES[number])
                    ? String(block.feedback_type) as typeof BLOG_DIAGRAM_FEEDBACK_TYPES[number]
                    : undefined,
                mermaid: typeof block.mermaid === "string" ? block.mermaid : undefined,
                nodes: graph.nodes,
                edges: graph.edges,
            };
            sanitized.push({
                ...diagramBlock,
                evidence: normalizeVisualEvidenceAfterSourceAttachment(diagramBlock, evidenceInput),
            });
            return null;
        });

    return sanitized;
}

function normalizeHeadingForMatch(text: string): string {
    return normalizeHeadingForEditorialMatch(text);
}

interface VisualPlacementHeading {
    level: 2 | 3;
    text: string;
    normalizedText: string;
    parentH2: string | null;
    index: number;
}

/**
 * Extract every H2/H3 placement target from a markdown document, in document
 * order. H2s are retained for backward compatibility with older visual logic,
 * while H3s let charts/diagrams anchor inside nested subsections instead of
 * only broad parent sections.
 */
function extractVisualPlacementHeadings(markdown: string): VisualPlacementHeading[] {
    return extractMarkdownHeadings(markdown)
        .filter((heading): heading is ExtractedEditorialHeading & { level: 2 | 3 } => heading.level === 2 || heading.level === 3)
        .map((heading) => ({
            level: heading.level,
            text: heading.text,
            normalizedText: heading.normalizedText,
            parentH2: heading.parentH2,
            index: heading.index,
        }));
}

function coerceVisualPlacementHeadings(headings: readonly VisualPlacementHeading[] | readonly string[]): VisualPlacementHeading[] {
    return headings.map((heading, index) => {
        if (typeof heading === "string") {
            return {
                level: 2,
                text: heading,
                normalizedText: normalizeHeadingForMatch(heading),
                parentH2: null,
                index,
            };
        }
        return heading;
    });
}

/**
 * Format the H2/H3 list into a numbered enum for the visual prompts. The model
 * is instructed to set placement_hint to one of these EXACT heading strings.
 * Listing every target explicitly guarantees the model can target subsections
 * that may live beyond the body-text truncation window.
 */
function formatHeadingEnum(headings: readonly VisualPlacementHeading[] | readonly string[]): string {
    const placementHeadings = coerceVisualPlacementHeadings(headings);
    if (placementHeadings.length === 0) {
        return "AVAILABLE VISUAL PLACEMENT TARGETS: (none — the article has no H2/H3 sections)";
    }
    const lines = placementHeadings.map((heading, i) => {
        const label = heading.level === 2
            ? `H2 target: ${heading.text}`
            : `H3 target: ${heading.text} (parent H2: ${heading.parentH2 ?? "unknown"})`;
        return `  ${i + 1}. ${label}`;
    }).join("\n");
    return `AVAILABLE VISUAL PLACEMENT TARGETS (placement_hint MUST be the exact text of one listed H2 or H3 target, copied verbatim without the H2/H3 label, markdown prefix, parenthetical context, quotes, or paraphrase):\n${lines}`;
}

function asNonEmptyString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(asNonEmptyString).filter((item): item is string => Boolean(item));
    }
    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function isSupportedDraftLocale(value: string | null | undefined): value is DraftBrief["workspaceLocale"] {
    return value === "en" || value === "nl" || value === "ar";
}

function safeJsonForPrompt(value: unknown, fallback = "null", maxLength = 6000): string {
    try {
        const serialized = JSON.stringify(value ?? null, null, 2);
        if (!serialized) return fallback;
        return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}\n…[truncated]` : serialized;
    } catch {
        return fallback;
    }
}

function cleanSlugBase(input: string, fallback = "article"): string {
    const slug = input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 80)
        .replace(/-$/g, "");
    return slug || fallback;
}

function compactSourceContextForMetadata(sourceContext: SeoSourceContext | null): Record<string, unknown> | null {
    if (!sourceContext) return null;
    return { ...sourceContext };
}

function inferBlogEditorialIntent(brief: DraftBrief, blueprint: ArticleBlueprint | null, sourceContext: SeoSourceContext | null): BlogEditorialIntent {
    const haystack = [
        blueprint?.articleType,
        blueprint?.searchIntent,
        sourceContext?.kind === "opportunity" ? sourceContext.recommendedFormat : null,
        sourceContext?.kind === "opportunity" ? sourceContext.targetIntent : null,
        brief.narrative_style,
        brief.title,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    if (/case|customer|example|use case/.test(haystack)) return "case-study";
    if (/compar|versus|vs\.?|alternative/.test(haystack)) return "comparison";
    if (/how\s*to|how-to|step|playbook|tutorial|implement/.test(haystack)) return "how-to";
    if (/guide|pillar|framework|blueprint|checklist/.test(haystack)) return "guide";
    if (/opinion|perspective|point of view|pov|thought leadership/.test(haystack)) return "opinion";
    if (/news|announce|launch|release|trend/.test(haystack)) return "news";
    return "generic";
}

function buildBlogEditorialValidationInput(args: {
    markdown: string;
    brief: DraftBrief;
    title: string;
    seoData: Record<string, unknown>;
    blueprint: ArticleBlueprint | null;
    sourceContext: SeoSourceContext | null;
    visualBlocks: BlogVisualBlock[];
    factSheet: CanonicalFactSheet | null;
    evergreenSourcePass: EvergreenResearchSourcePass | null;
    templateId: string;
    allowedInternalLinks?: string[];
    faqItems?: Array<{ question: string; answer: string }>;
}): BlogEditorialValidationInput {
    const { markdown, brief, title, seoData, blueprint, sourceContext, visualBlocks, factSheet, evergreenSourcePass, templateId, allowedInternalLinks, faqItems } = args;
    const sourcePrimaryKeyword = sourceContext?.kind === "plan" ? sourceContext.primaryKeyword : null;
    const opportunityKeyword = sourceContext?.kind === "opportunity" ? sourceContext.topic : null;
    const sourceSecondaryKeywords = sourceContext?.kind === "plan" ? sourceContext.secondaryKeywords : [];
    const seoKeywords = asStringArray(seoData.keywords);
    const factSheetLikeCitations: EditorialCitation[] = [
        ...(blueprint?.externalCitationTargets.map((citation) => ({
            url: citation.url,
            title: citation.title,
            publisher: citation.publisher,
        })) ?? []),
        ...getPromptResearchSources(factSheet, evergreenSourcePass?.sources ?? []).map((source) => ({
            url: source.url,
            title: source.title,
            publisher: publisherLabelFromUrl(source.url) ?? undefined,
        })),
    ];

    return {
        markdown,
        length: brief.length,
        seoTitle: asNonEmptyString(seoData.title) ?? title,
        seoDescription: asNonEmptyString(seoData.description) ?? "",
        primaryKeyword: blueprint?.primaryKeyword ?? sourcePrimaryKeyword ?? opportunityKeyword ?? brief.keywords[0],
        keywords: [
            ...(blueprint?.secondaryKeywords ?? []),
            ...sourceSecondaryKeywords,
            ...seoKeywords,
            ...brief.keywords,
        ],
        intent: inferBlogEditorialIntent(brief, blueprint, sourceContext),
        internalLinkSuggestions: blueprint?.internalLinkTargets ?? [],
        externalCitations: factSheetLikeCitations,
        faqItems: faqItems && faqItems.length > 0 ? faqItems : blueprint?.faqQuestions.map((faq) => ({
            question: faq.question,
            answer: faq.answerAngle ?? faq.intent,
        })) ?? [],
        visualBlocks,
        siteHost: getSiteHost(),
        allowedInternalLinks,
        forbiddenPublicTerms: getBlogEditorialPublicPolicy(templateId).forbiddenPublicTerms,
    };
}

function listVisualShortcodes(markdown: string): string[] {
    const matches = markdown.match(/\{\{\s*visual\s*:\s*[A-Za-z0-9_-]+\s*\}\}/gi) ?? [];
    return matches.map((m) => m.replace(/\s+/g, "").toLowerCase());
}

function hasExactVisualShortcodesOnce(markdown: string, visualBlocks: BlogVisualBlock[]): boolean {
    if (visualBlocks.length === 0) return listVisualShortcodes(markdown).length === 0;
    const actual = listVisualShortcodes(markdown);
    const actualCounts = new Map<string, number>();
    actual.forEach((shortcode) => actualCounts.set(shortcode, (actualCounts.get(shortcode) ?? 0) + 1));

    return visualBlocks.every((block) => actualCounts.get(`{{visual:${block.id.toLowerCase()}}}`) === 1)
        && actual.every((shortcode) => visualBlocks.some((block) => shortcode === `{{visual:${block.id.toLowerCase()}}}`));
}

function countMarkdownWords(markdown: string): number {
    return (markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/\{\{\s*visual\s*:[^}]+\}\}/gi, " ")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[#>*_`~|-]/g, " ")
        .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function summarizeDraftStructure(markdown: string, length: DraftBrief["length"]): {
    wordCount: number;
    charCount: number;
    h2Count: number;
    h3Count: number;
    sectionWordCounts: number[];
    valid: boolean;
    reason: string | null;
} {
    const tierRule = BLOG_LENGTH_TIER_RULES[length];
    const headings = extractMarkdownHeadings(markdown);
    const h2Count = headings.filter((heading) => heading.level === 2).length;
    const h3Count = headings.filter((heading) => heading.level === 3).length;
    const sectionWordCounts = splitMarkdownIntoVisualTargetSections(markdown).sections
        .filter((section) => section.level === 2)
        .map((section) => countMarkdownWords(section.body));
    const wordCount = countMarkdownWords(markdown);
    const charCount = markdown.trim().length;
    const tooThinSections = sectionWordCounts.filter((count) => count > 0 && count < tierRule.minSectionWords).length;
    const deepDiveTooShort = length === "deep-dive" && wordCount < 3200 && charCount < 18000;
    const valid = h2Count >= tierRule.minH2
        && h3Count >= tierRule.minH3
        && tooThinSections === 0
        && !deepDiveTooShort;
    const reason = h2Count < tierRule.minH2
        ? `h2_count_${h2Count}_below_${tierRule.minH2}`
        : h3Count < tierRule.minH3
            ? `h3_count_${h3Count}_below_${tierRule.minH3}`
            : tooThinSections > 0
                ? `thin_sections_${tooThinSections}`
                : deepDiveTooShort
                    ? `deep_dive_too_short_${wordCount}_words_${charCount}_chars`
                    : null;

    return { wordCount, charCount, h2Count, h3Count, sectionWordCounts, valid, reason };
}

function stripVisualShortcodes(markdown: string): string {
    return markdown
        .replace(/\{\{\s*visual\s*:\s*[A-Za-z0-9_-]+\s*\}\}/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function preserveOrReinjectVisualShortcodes(markdown: string, visualBlocks: BlogVisualBlock[]): string {
    if (visualBlocks.length === 0) return stripVisualShortcodes(markdown);
    const stripped = stripVisualShortcodes(markdown);
    return injectVisualShortcodes(stripped, visualBlocks);
}

function summarizeBlueprintForRepair(blueprint: ArticleBlueprint | null): string {
    if (!blueprint) return "No article blueprint was available. Repair against the validation issues and original brief only.";
    return `Primary keyword: ${blueprint.primaryKeyword}
Search intent: ${blueprint.searchIntent}
Target reader: ${blueprint.targetReader}
Thesis: ${blueprint.thesis}
Differentiation angle: ${blueprint.differentiationAngle}
Required H2 architecture:
${blueprint.sections.map((section, index) => `${index + 1}. ${section.h2} — ${section.role}; H3 suggestions: ${section.h3s.map((h3) => h3.heading).join(", ") || "none"}`).join("\n")}
Internal links: ${blueprint.internalLinkTargets.map((link) => `${link.anchor} → ${link.url}`).join("; ") || "none"}
External citations: ${blueprint.externalCitationTargets.map((citation) => `${citation.title} → ${citation.url}`).join("; ") || "none"}
FAQ questions: ${blueprint.faqQuestions.map((faq) => faq.question).join("; ") || "none"}`;
}

function formatEvergreenSourcesForPrompt(sourcePass: EvergreenResearchSourcePass | null): string {
    if (!sourcePass?.sources.length) {
        return "No evergreen source pass was run or no usable sources were found. Do not invent citations.";
    }

    return `Evergreen source pass (not a freshness/status fact sheet; checked ${sourcePass.checked_at})
Purpose: provide stable, citation-worthy background sources for evergreen editorial depth.
Retrieval mode: ${sourcePass.retrieval_mode}
Query: ${sourcePass.query}
Policy target: ${sourcePass.target_count} source(s)
Notes: ${sourcePass.notes}

Sources:
${sourcePass.sources.map((source, index) => `${index + 1}. ${source.title} — ${source.url}${source.published_date ? ` (${source.published_date})` : ""}\n   ${source.snippet.slice(0, 280)}`).join("\n")}`;
}

function serializeEvergreenSourcePassForMetadata(sourcePass: EvergreenResearchSourcePass | null) {
    if (!sourcePass) return null;
    return {
        checked_at: sourcePass.checked_at,
        target_count: sourcePass.target_count,
        retrieval_mode: sourcePass.retrieval_mode,
        query: sourcePass.query,
        notes: sourcePass.notes,
        sources: sourcePass.sources.slice(0, 10).map((source) => ({
            url: source.url,
            title: source.title,
            snippet: source.snippet.slice(0, 500),
            score: source.score,
            trust_tier: source.trust_tier,
            published_date: source.published_date,
        })),
    };
}

function serializeEvidencePackForMetadata(pack: SourceEvidencePack | null) {
    if (!pack) return null;
    return {
        topic: pack.topic,
        checked_at: pack.checked_at,
        retrieval_mode: pack.retrieval_mode,
        stale: pack.stale,
        claims: pack.claims.slice(0, 12).map((claim) => ({
            id: claim.id,
            claim_text: claim.claim_text,
            evidence_type: claim.evidence_type,
            confidence: claim.confidence,
            quality: claim.quality,
            score: claim.score,
            source_url: claim.source.canonical_url,
            source_title: claim.source.title,
            publisher: claim.source.publisher,
            trust_tier: claim.source.trust_tier,
        })),
        documents: pack.documents.slice(0, 8),
    };
}

function seoTitleContainsKeyword(seoTitle: unknown, keyword: string | null | undefined): boolean {
    if (typeof seoTitle !== "string" || !keyword) return true;
    return normalizeHeadingForEditorialMatch(seoTitle).includes(normalizeHeadingForEditorialMatch(keyword));
}

function repairSeoTitleWithLockedKeyword(seoData: Record<string, unknown>, sourceContext: SeoSourceContext | null, locale: string): Record<string, unknown> {
    const planKeyword = sourceContext?.kind === "plan" ? sourceContext.primaryKeyword : null;
    // Plans occasionally store a headline-style keyword; lock only its core
    // phrase so the rebuilt title can stay inside the 35-65 character band.
    const keyword = planKeyword ? resolveEffectivePrimaryKeyword(planKeyword) : null;
    if (!keyword || locale !== "en" || seoTitleContainsKeyword(seoData.title, keyword)) return seoData;
    const current = asNonEmptyString(seoData.title) ?? "Practical Guide";
    const suffix = current.replace(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").replace(/^\s*[:|–—-]\s*/, "").trim();
    let title = `${keyword}: ${suffix || "Practical Guide"}`.trim();
    if (title.length > 65) title = keyword.length <= 58 ? keyword : keyword.slice(0, 62).trim();
    return { ...seoData, title };
}

function summarizeVisualBlocksForRepair(visualBlocks: BlogVisualBlock[]): string {
    if (visualBlocks.length === 0) return "No visual shortcodes are required.";
    return visualBlocks
        .map((block) => `- {{visual:${block.id}}}: ${block.title}${block.placement_hint ? ` (placement hint: ${block.placement_hint})` : ""}`)
        .join("\n");
}

function serializeEditorialValidationForMetadata(result: BlogEditorialValidationResult, attempts: number, repaired: boolean, fallbackReason?: string | null) {
    return {
        valid: result.valid,
        repair_attempts: attempts,
        repaired,
        fallback_reason: fallbackReason ?? null,
        stats: result.stats,
        issue_count: result.issues.length,
        error_count: result.issues.filter((issue) => issue.severity === "error").length,
        warning_count: result.issues.filter((issue) => issue.severity === "warning").length,
        info_count: result.issues.filter((issue) => issue.severity === "info").length,
        issues: result.issues.map((issue) => ({
            code: issue.code,
            severity: issue.severity,
            dimension: issue.dimension,
            message: issue.message,
            repair_instruction: issue.repairInstruction,
            heading: issue.heading ?? null,
            details: issue.details ?? null,
        })),
    };
}

function firstNonEmptyString(...values: unknown[]): string | null {
    for (const value of values) {
        const stringValue = asNonEmptyString(value);
        if (stringValue) return stringValue;
    }
    return null;
}

function articleTypeSupportsHowToSchema(articleType: string | null | undefined, intent: BlogEditorialIntent): boolean {
    const haystack = [articleType, intent].filter(Boolean).join(" ").toLowerCase();
    return /how\s*to|how-to|tutorial|playbook|step|workflow|procedure|process|implement|implementation|guide/.test(haystack);
}

function buildSeoSchemaCandidateMetadata(args: {
    title: string;
    slug: string;
    markdown: string;
    seoData: Record<string, unknown>;
    excerpt: unknown;
    brief: DraftBrief;
    blueprint: ArticleBlueprint | null;
    sourceContext: SeoSourceContext | null;
    visualBlocks: BlogVisualBlock[];
    factSheet: CanonicalFactSheet | null;
    evergreenSourcePass: EvergreenResearchSourcePass | null;
    caseSnippet: CaseSnippet | null;
    validation: BlogEditorialValidationResult;
}) {
    const { title, slug, markdown, seoData, excerpt, brief, blueprint, sourceContext, visualBlocks, factSheet, evergreenSourcePass, caseSnippet, validation } = args;
    const articleSections = extractMarkdownHeadings(markdown)
        .filter((heading) => heading.level === 2 || heading.level === 3)
        .map((heading) => ({
            level: heading.level,
            heading: heading.text,
            parent_h2: heading.parentH2,
        }))
        .slice(0, 24);
    const articleType = blueprint?.articleType ?? inferBlogEditorialIntent(brief, blueprint, sourceContext);
    const editorialIntent = inferBlogEditorialIntent(brief, blueprint, sourceContext);
    const searchIntent = firstNonEmptyString(
        blueprint?.searchIntent,
        sourceContext?.kind === "opportunity" ? sourceContext.targetIntent : null,
        sourceContext?.kind === "plan" ? sourceContext.intentStage : null,
    );
    const conversionGoal = firstNonEmptyString(blueprint?.conversionGoal, sourceContext?.targetConversionGoal);
    const primaryKeyword = firstNonEmptyString(
        blueprint?.primaryKeyword,
        sourceContext?.kind === "plan" ? sourceContext.primaryKeyword : null,
        sourceContext?.kind === "opportunity" ? sourceContext.topic : null,
        brief.keywords[0],
    );
    const seoTitle = firstNonEmptyString(seoData.title, title);
    const seoDescription = firstNonEmptyString(seoData.description, excerpt);
    const faqCandidates = blueprint?.faqQuestions.map((faq) => ({
        question: faq.question,
        answer_candidate: faq.answerAngle ?? faq.intent,
        intent: faq.intent,
    })) ?? [];
    const citationTargets = [
        ...(blueprint?.externalCitationTargets ?? []).map((citation) => ({
            title: citation.title,
            url: citation.url,
            publisher: citation.publisher ?? null,
            reason: citation.reason,
            target_section: citation.targetSection ?? null,
            source: "article_blueprint",
        })),
        ...(factSheet?.sources ?? []).slice(0, 10).map((source) => ({
            title: source.title,
            url: source.url,
            publisher: publisherLabelFromUrl(source.url),
            reason: `Verified ${source.trust_tier} source from fact sheet`,
            target_section: null,
            source: "fact_sheet",
        })),
        ...(evergreenSourcePass?.sources ?? []).slice(0, 10).map((source) => ({
            title: source.title,
            url: source.url,
            publisher: publisherLabelFromUrl(source.url),
            reason: `Evergreen background source from lightweight source pass`,
            target_section: null,
            source: "evergreen_source_pass",
        })),
    ];
    const internalLinks = blueprint?.internalLinkTargets.map((link) => ({
        url: link.url,
        anchor: link.anchor,
        reason: link.reason,
        target_section: link.targetSection ?? null,
    })) ?? [];
    const howToSteps = articleTypeSupportsHowToSchema(blueprint?.articleType, editorialIntent)
        ? (blueprint?.sections ?? []).map((section, index) => ({
            position: index + 1,
            name: section.h2,
            text_candidate: section.keyPoints.join(" ") || section.role,
            nested_subsections: section.h3s.map((h3) => h3.heading),
        })).slice(0, 12)
        : [];

    return {
        status: "candidate_review_required",
        rendered_automatically: false,
        article_blueprint: blueprint,
        source_context: compactSourceContextForMetadata(sourceContext),
        article_json_ld_candidate: {
            "@type": "Article",
            headline: seoTitle,
            description: seoDescription,
            inLanguage: brief.workspaceLocale,
            keywords: Array.from(new Set([primaryKeyword, ...(blueprint?.secondaryKeywords ?? []), ...brief.keywords].filter(Boolean))).slice(0, 16),
            articleSection: articleSections.filter((section) => section.level === 2).map((section) => section.heading).slice(0, 12),
            about: primaryKeyword,
            url_path: `/blog/${slug}`,
        },
        faq_page_candidate: faqCandidates.length > 0 ? {
            "@type": "FAQPage",
            questions: faqCandidates,
        } : null,
        how_to_candidate: howToSteps.length > 0 ? {
            "@type": "HowTo",
            name: seoTitle,
            description: seoDescription,
            steps: howToSteps,
        } : null,
        citations: citationTargets,
        internal_link_suggestions: internalLinks,
        canonical_slug_suggestion: sourceContext?.kind === "plan" ? sourceContext.slugSuggestion ?? slug : slug,
        article_type: articleType,
        search_intent: searchIntent,
        conversion_goal: conversionGoal,
        author_proof_points_used: caseSnippet ? {
            snippet_id: caseSnippet.id,
            title: caseSnippet.title,
            tags: caseSnippet.tags,
            industry: caseSnippet.industry,
            outcome_summary: caseSnippet.outcome_summary,
        } : null,
        case_snippet_signal: caseSnippet ? "workspace_case_snippet_used" : "no_case_snippet_available",
        datasets: visualBlocks
            .filter((block) => block.type === "chart")
            .map((block) => ({
                name: block.title,
                description: block.description || block.caption,
                block_id: block.id,
                placement_hint: block.placement_hint ?? null,
                source_url: block.source_url ?? null,
            })),
        article_sections: articleSections,
        validation_diagnostics: {
            valid: validation.valid,
            scorecard: validation.scorecard,
            stats: validation.stats,
        },
    };
}

interface BlogEditorialRepairResult {
    markdown: string;
    seoData: Record<string, unknown>;
    validation: BlogEditorialValidationResult;
    attempts: number;
    repaired: boolean;
    fallbackReason: string | null;
}

async function repairBlogDraftAgainstEditorialIssues(args: {
    markdown: string;
    title: string;
    seoData: Record<string, unknown>;
    brief: DraftBrief;
    blueprint: ArticleBlueprint | null;
    sourceContext: SeoSourceContext | null;
    visualBlocks: BlogVisualBlock[];
    factSheet: CanonicalFactSheet | null;
    evergreenSourcePass: EvergreenResearchSourcePass | null;
    validation: BlogEditorialValidationResult;
    ctx: MeterCtx;
    templateId: string;
    allowedInternalLinks?: string[];
}): Promise<BlogEditorialRepairResult> {
    const { markdown, title, seoData, brief, blueprint, sourceContext, visualBlocks, factSheet, evergreenSourcePass, validation, ctx, templateId, allowedInternalLinks } = args;
    let currentValidation = validation;
    let currentMarkdown = markdown;
    let currentSeoData = repairSeoTitleWithLockedKeyword(seoData, sourceContext, brief.workspaceLocale);
    let fallbackReason: string | null = null;
    let repaired = false;
    const publicPolicy = getBlogEditorialPublicPolicy(templateId);
    const readinessOptions = {
        locale: brief.workspaceLocale,
        scoreFloor: publicPolicy.publicationScoreFloor,
    };

    const deterministicMarkdown = repairDeterministicGrammarDiagnostics(
        currentMarkdown,
        getBlogEditorialRepairTargets(currentValidation, readinessOptions),
    );
    if (deterministicMarkdown !== currentMarkdown) {
        currentMarkdown = deterministicMarkdown;
        currentValidation = validateGeneratedBlogDraft(buildBlogEditorialValidationInput({
            markdown: currentMarkdown,
            brief,
            title,
            seoData: currentSeoData,
            blueprint,
            sourceContext,
            visualBlocks,
            factSheet,
            evergreenSourcePass,
            templateId,
            allowedInternalLinks,
        }));
        repaired = true;
    }

    if (currentSeoData !== seoData) {
        const nextValidationInput = buildBlogEditorialValidationInput({
            markdown: currentMarkdown,
            brief,
            title,
            seoData: currentSeoData,
            blueprint,
            sourceContext,
            visualBlocks,
            factSheet,
            evergreenSourcePass,
            templateId,
            allowedInternalLinks,
        });
        currentValidation = validateGeneratedBlogDraft(nextValidationInput);
        repaired = true;
        if (assessBlogEditorialPublicationReadiness(currentValidation, readinessOptions).ready) {
            return { markdown: currentMarkdown, seoData: currentSeoData, validation: currentValidation, attempts: 0, repaired, fallbackReason };
        }
    }

    for (let attempt = 1; attempt <= BLOG_EDITORIAL_MAX_REPAIR_ATTEMPTS; attempt += 1) {
        const repairTargets = getBlogEditorialRepairTargets(
            currentValidation,
            readinessOptions,
        );
        if (repairTargets.length === 0) {
            return { markdown: currentMarkdown, seoData: currentSeoData, validation: currentValidation, attempts: attempt - 1, repaired, fallbackReason };
        }

        try {
            const { text, usage } = await generateText({
                model: resolveTextModel(DRAFT_MODEL_ALIAS),
                system: `You are a senior production editor repairing a generated blog draft after deterministic validation.

Repair ONLY the failing sections and metadata called out by the validation report. Do not regenerate the article from scratch. Preserve the article's thesis, source context, approximate length (±15%), language/locale, H2 architecture where it already works, source citations, internal links, and all concrete examples.

VISUAL SHORTCODE RULES:
- Preserve every required shortcode exactly once, with exact syntax {{visual:ID}}.
- Do not invent new visual IDs.
- If a shortcode is duplicated, malformed, orphaned, or dumped at the tail, move/fix it near the relevant H2 paragraph instead of deleting useful visuals.

DIAGRAM LEAK RULES:
- Never output raw Mermaid, diagram DSL, or ASCII art diagrams inside <CONTENT_MARKDOWN>: no flowchart/graph TD/LR, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, journey, pie, mindmap, timeline, quadrantChart, gitGraph, requirementDiagram, C4* source, or box-drawing characters (┌, ─, └, │, ├, ┬).
- Treat bracketed nodes joined by arrows, repeated equals/dashes, slashes/backslashes, carets, or v characters as ASCII diagrams too, including inside plain code fences.
- Diagrams are represented only by required {{visual:ID}} shortcodes and structured visual metadata outside the article body.

Output only the XML tags requested. No commentary, no markdown fences.`,
                prompt: `${localeInstruction(brief.workspaceLocale)}

VALIDATION ISSUES TO REPAIR:
${formatValidationIssuesForPrompt(repairTargets, { maxIssues: 14 })}

ARTICLE LENGTH TIER: ${brief.length} (${LENGTH_GUIDE[brief.length]})
TITLE: ${title}
CURRENT SEO TITLE: ${asNonEmptyString(currentSeoData.title) ?? ""}
CURRENT SEO DESCRIPTION: ${asNonEmptyString(currentSeoData.description) ?? ""}

SEO SOURCE CONTEXT:
${formatSeoSourceContextForPrompt(sourceContext)}

BLUEPRINT SUMMARY:
${summarizeBlueprintForRepair(blueprint)}

REQUIRED VISUAL SHORTCODES:
${summarizeVisualBlocksForRepair(visualBlocks)}

CURRENT FINAL MARKDOWN AFTER VISUAL INJECTION:
${currentMarkdown}

Return exactly:
<CONTENT_MARKDOWN>repaired markdown only</CONTENT_MARKDOWN>
<SEO_TITLE>repaired title if needed, otherwise current title</SEO_TITLE>
<SEO_DESCRIPTION>repaired description if needed, otherwise current description</SEO_DESCRIPTION>`,
            });
            await meterCall(ctx, DRAFT_MODEL_ALIAS, usage, { phase: "repair_blog_editorial_validation", attempt });

            const rawMarkdown = extractTaggedText("CONTENT_MARKDOWN", text) || String(text || "").trim();
            const repairedMarkdown = normalizeMarkdownForRender(sanitizePublicCopy(humanize(rawMarkdown)));
            const safelyShortcoded = preserveOrReinjectVisualShortcodes(repairedMarkdown, visualBlocks);
            const normalizedMarkdown = normalizeMarkdownForRender(safelyShortcoded);
            const repairedSeoTitle = humanize(extractTaggedText("SEO_TITLE", text), { preserveNewlines: false });
            const repairedSeoDescription = humanize(extractTaggedText("SEO_DESCRIPTION", text), { preserveNewlines: false });
            const nextSeoData = {
                ...currentSeoData,
                ...(repairedSeoTitle ? { title: repairedSeoTitle } : {}),
                ...(repairedSeoDescription ? { description: repairedSeoDescription } : {}),
            };

            if (!normalizedMarkdown || normalizedMarkdown.length < currentMarkdown.length * 0.7) {
                fallbackReason = "repair_too_short";
                break;
            }

            if (!hasExactVisualShortcodesOnce(normalizedMarkdown, visualBlocks)) {
                console.warn(`[repairGeneratedBlogDraftWithEditorialReport] attempt ${attempt} failed shortcode validation; retrying next attempt.`);
                fallbackReason = "repair_shortcode_mismatch";
                continue;
            }

            const nextValidationInput = buildBlogEditorialValidationInput({
                markdown: normalizedMarkdown,
                brief,
                title,
                seoData: nextSeoData,
                blueprint,
                sourceContext,
                visualBlocks,
                factSheet,
                evergreenSourcePass,
                templateId,
                allowedInternalLinks,
            });
            currentValidation = validateGeneratedBlogDraft(nextValidationInput);
            currentMarkdown = normalizedMarkdown;
            currentSeoData = nextSeoData;
            repaired = true;
        } catch (err) {
            const providerError = normalizeAiProviderError(err, {
                provider: getModelMetadata(DRAFT_MODEL_ALIAS).provider,
                modelAlias: DRAFT_MODEL_ALIAS,
                modelId: getModelMetadata(DRAFT_MODEL_ALIAS).modelId,
            });
            console.warn("[repairBlogDraftAgainstEditorialIssues] repair pass failed; keeping pre-repair content:", providerError.toJSON());
            fallbackReason = "repair_call_failed";
            break;
        }
    }

    if (fallbackReason && !repaired) {
        return { markdown, seoData, validation, attempts: BLOG_EDITORIAL_MAX_REPAIR_ATTEMPTS, repaired: false, fallbackReason };
    }

    return {
        markdown: currentMarkdown,
        seoData: currentSeoData,
        validation: currentValidation,
        attempts: BLOG_EDITORIAL_MAX_REPAIR_ATTEMPTS,
        repaired,
        fallbackReason,
    };
}

async function createUniqueContentSlug(
    supabase: SupabaseClient,
    input: {
        title: string;
        templateId: string;
        locale: DraftBrief["workspaceLocale"];
        sourceContext: SeoSourceContext | null;
        blueprint: ArticleBlueprint | null;
    },
): Promise<string> {
    const baseCandidates = [
        input.sourceContext?.kind === "plan" ? input.sourceContext.slugSuggestion : null,
        input.blueprint?.primaryKeyword,
        input.title,
    ].map(asNonEmptyString).filter((item): item is string => Boolean(item));

    const base = cleanSlugBase(baseCandidates[0] ?? input.title);
    const candidates = [base, ...Array.from({ length: 20 }, (_value, index) => `${base}-${index + 2}`)];

    const { data, error } = await supabase
        .from("content_items")
        .select("slug")
        .eq("template_id", input.templateId)
        .eq("locale", input.locale)
        .in("slug", candidates);

    if (error) {
        console.warn("[generate-draft] slug uniqueness probe failed; using timestamp fallback:", error);
        return `${base}-${Date.now()}`;
    }

    const used = new Set((data ?? []).map((row: { slug: string | null }) => row.slug).filter(Boolean));
    return candidates.find((candidate) => !used.has(candidate)) ?? `${base}-${Date.now()}`;
}

async function fetchSeoSourceContext(
    supabase: SupabaseClient,
    workspaceId: string,
    input: { planId: string | null; opportunityId: string | null },
): Promise<SeoSourceContext | null> {
    if (input.planId) {
        const { data, error } = await supabase
            .from("seo_content_plans")
            .select("id,title,slug_suggestion,primary_keyword,secondary_keywords,intent_stage,funnel_stage,target_conversion_goal,brief_markdown,outline,metadata,locale")
            .eq("id", input.planId)
            .eq("workspace_id", workspaceId)
            .maybeSingle();

        if (error) {
            console.warn("[generate-draft] SEO plan source lookup failed:", error);
        }
        if (data) {
            return {
                kind: "plan",
                id: data.id,
                title: data.title,
                slugSuggestion: data.slug_suggestion,
                primaryKeyword: data.primary_keyword,
                secondaryKeywords: asStringArray(data.secondary_keywords),
                intentStage: data.intent_stage,
                funnelStage: data.funnel_stage,
                targetConversionGoal: data.target_conversion_goal,
                briefMarkdown: data.brief_markdown,
                outline: data.outline,
                metadata: data.metadata,
                locale: data.locale,
            };
        }
    }

    if (input.opportunityId) {
        const { data, error } = await supabase
            .from("seo_content_opportunities")
            .select("id,title,topic,summary,rationale,target_intent,funnel_stage,target_conversion_goal,recommended_format,opportunity_type,cluster_id,cluster_name,plan_id,priority_score,strategic_importance_score,blue_ocean_score,analytics_score,inventory_snapshot,analytics_snapshot,metadata,locale")
            .eq("id", input.opportunityId)
            .eq("workspace_id", workspaceId)
            .maybeSingle();

        if (error) {
            console.warn("[generate-draft] SEO opportunity source lookup failed:", error);
        }
        if (data) {
            return {
                kind: "opportunity",
                id: data.id,
                title: data.title,
                topic: data.topic,
                summary: data.summary,
                rationale: data.rationale,
                targetIntent: data.target_intent,
                funnelStage: data.funnel_stage,
                targetConversionGoal: data.target_conversion_goal,
                recommendedFormat: data.recommended_format,
                opportunityType: data.opportunity_type,
                clusterId: data.cluster_id,
                clusterName: data.cluster_name,
                planId: data.plan_id,
                priorityScore: data.priority_score,
                strategicImportanceScore: data.strategic_importance_score,
                blueOceanScore: data.blue_ocean_score,
                analyticsScore: data.analytics_score,
                inventorySnapshot: data.inventory_snapshot,
                analyticsSnapshot: data.analytics_snapshot,
                metadata: data.metadata,
                locale: data.locale,
            };
        }
    }

    return null;
}

function applySeoSourceContextToBrief(brief: DraftBrief, sourceContext: SeoSourceContext | null): DraftBrief {
    if (!sourceContext) return brief;

    if (isSupportedDraftLocale(sourceContext.locale)) {
        brief.workspaceLocale = sourceContext.locale;
    }

    if (sourceContext.kind === "plan") {
        brief.title = sourceContext.title || brief.title;
        const keywords = [sourceContext.primaryKeyword, ...sourceContext.secondaryKeywords]
            .map(asNonEmptyString)
            .filter((item): item is string => Boolean(item));
        if (keywords.length > 0) {
            brief.keywords = Array.from(new Set([...keywords, ...(brief.keywords ?? [])]));
        }
    } else {
        brief.title = sourceContext.title || sourceContext.topic || brief.title;
        const opportunityKeywords = [sourceContext.topic, sourceContext.clusterName, sourceContext.targetIntent]
            .map(asNonEmptyString)
            .filter((item): item is string => Boolean(item));
        if (opportunityKeywords.length > 0) {
            brief.keywords = Array.from(new Set([...(brief.keywords ?? []), ...opportunityKeywords]));
        }
    }

    return brief;
}

function formatSeoSourceContextForPrompt(sourceContext: SeoSourceContext | null): string {
    if (!sourceContext) {
        return "No SEO strategist plan or opportunity record was supplied for this draft.";
    }

    if (sourceContext.kind === "plan") {
        return `SEO SOURCE TYPE: content plan
PLAN ID: ${sourceContext.id}
TITLE: ${sourceContext.title}
SLUG SUGGESTION: ${sourceContext.slugSuggestion ?? "not provided"}
PRIMARY KEYWORD: ${sourceContext.primaryKeyword ?? "not provided"}
SECONDARY KEYWORDS: ${sourceContext.secondaryKeywords.join(", ") || "not provided"}
INTENT STAGE: ${sourceContext.intentStage ?? "not provided"}
FUNNEL STAGE: ${sourceContext.funnelStage ?? "not provided"}
TARGET CONVERSION GOAL: ${sourceContext.targetConversionGoal ?? "not provided"}
LOCALE: ${sourceContext.locale ?? "not provided"}

BRIEF MARKDOWN:
${sourceContext.briefMarkdown ?? "not provided"}

OUTLINE JSON:
${safeJsonForPrompt(sourceContext.outline)}

PLAN METADATA:
${safeJsonForPrompt(sourceContext.metadata, "{}")}`;
    }

    return `SEO SOURCE TYPE: content opportunity
OPPORTUNITY ID: ${sourceContext.id}
TITLE: ${sourceContext.title}
TOPIC: ${sourceContext.topic}
SUMMARY: ${sourceContext.summary ?? "not provided"}
RATIONALE: ${sourceContext.rationale ?? "not provided"}
TARGET INTENT: ${sourceContext.targetIntent ?? "not provided"}
FUNNEL STAGE: ${sourceContext.funnelStage ?? "not provided"}
TARGET CONVERSION GOAL: ${sourceContext.targetConversionGoal ?? "not provided"}
RECOMMENDED FORMAT: ${sourceContext.recommendedFormat ?? "not provided"}
OPPORTUNITY TYPE: ${sourceContext.opportunityType}
CLUSTER: ${sourceContext.clusterName ?? sourceContext.clusterId ?? "not provided"}
LOCALE: ${sourceContext.locale ?? "not provided"}
PRIORITY SCORE: ${sourceContext.priorityScore}
STRATEGIC IMPORTANCE SCORE: ${sourceContext.strategicImportanceScore}
BLUE OCEAN SCORE: ${sourceContext.blueOceanScore}
ANALYTICS SCORE: ${sourceContext.analyticsScore}

INVENTORY SNAPSHOT:
${safeJsonForPrompt(sourceContext.inventorySnapshot)}

ANALYTICS SNAPSHOT:
${safeJsonForPrompt(sourceContext.analyticsSnapshot)}

OPPORTUNITY METADATA:
${safeJsonForPrompt(sourceContext.metadata, "{}")}`;
}

function normalizeArticleBlueprint(raw: Record<string, unknown>, brief: DraftBrief, sourceContext: SeoSourceContext | null): ArticleBlueprint {
    const sourcePrimary = sourceContext?.kind === "plan" ? sourceContext.primaryKeyword : null;
    // A full article title is not a usable SEO keyword: it can never appear
    // verbatim in a 35-65 character SEO title, which makes editorial validation
    // unsatisfiable. Fall back to the title's core phrase instead.
    const primaryKeyword = asNonEmptyString(raw.primaryKeyword) ?? sourcePrimary ?? brief.keywords[0] ?? resolveEffectivePrimaryKeyword(brief.title);
    const secondaryKeywords = Array.from(new Set([
        ...asStringArray(raw.secondaryKeywords),
        ...(sourceContext?.kind === "plan" ? sourceContext.secondaryKeywords : []),
        ...brief.keywords.slice(1),
    ])).slice(0, 12);

    const normalizeLink = (value: unknown): ArticleLinkSuggestion | null => {
        if (typeof value === "string") {
            const url = asNonEmptyString(value);
            return url ? { url, anchor: url, reason: "Suggested by blueprint" } : null;
        }
        if (!value || typeof value !== "object") return null;
        const obj = value as Record<string, unknown>;
        const url = asNonEmptyString(obj.url) ?? asNonEmptyString(obj.path) ?? asNonEmptyString(obj.slug);
        const anchor = asNonEmptyString(obj.anchor) ?? asNonEmptyString(obj.label) ?? url;
        if (!url || !anchor) return null;
        return {
            url,
            anchor,
            reason: asNonEmptyString(obj.reason) ?? "Relevant internal link target",
            targetSection: asNonEmptyString(obj.targetSection) ?? asNonEmptyString(obj.section) ?? undefined,
        };
    };

    const normalizeCitation = (value: unknown): ArticleCitationSuggestion | null => {
        if (typeof value === "string") {
            const url = normalizeHttpUrl(value);
            return url ? { title: url, url, reason: "Suggested by blueprint" } : null;
        }
        if (!value || typeof value !== "object") return null;
        const obj = value as Record<string, unknown>;
        const url = normalizeHttpUrl(obj.url);
        if (!url) return null;
        return {
            title: asNonEmptyString(obj.title) ?? url,
            url,
            publisher: asNonEmptyString(obj.publisher) ?? undefined,
            reason: asNonEmptyString(obj.reason) ?? "External evidence target",
            targetSection: asNonEmptyString(obj.targetSection) ?? asNonEmptyString(obj.section) ?? undefined,
        };
    };

    const normalizeFaq = (value: unknown): ArticleFaqSuggestion | null => {
        if (typeof value === "string") {
            const question = asNonEmptyString(value);
            return question ? { question, intent: "Answer a common search follow-up" } : null;
        }
        if (!value || typeof value !== "object") return null;
        const obj = value as Record<string, unknown>;
        const question = asNonEmptyString(obj.question);
        if (!question) return null;
        return {
            question,
            intent: asNonEmptyString(obj.intent) ?? "Answer a common search follow-up",
            answerAngle: asNonEmptyString(obj.answerAngle) ?? asNonEmptyString(obj.answer_angle) ?? undefined,
        };
    };

    const topInternalLinks = Array.isArray(raw.internalLinkTargets)
        ? raw.internalLinkTargets.map(normalizeLink).filter((item): item is ArticleLinkSuggestion => Boolean(item)).slice(0, 12)
        : [];
    const topExternalCitations = Array.isArray(raw.externalCitationTargets)
        ? raw.externalCitationTargets.map(normalizeCitation).filter((item): item is ArticleCitationSuggestion => Boolean(item)).slice(0, 12)
        : [];

    const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
    const sections = rawSections.map((section, index): ArticleBlueprintSection | null => {
        if (!section || typeof section !== "object") return null;
        const obj = section as Record<string, unknown>;
        const h2 = asNonEmptyString(obj.h2) ?? asNonEmptyString(obj.heading);
        if (!h2) return null;
        const rawH3s = Array.isArray(obj.h3s) ? obj.h3s : [];
        return {
            h2,
            role: asNonEmptyString(obj.role) ?? `Section ${index + 1}`,
            targetWordCount: typeof obj.targetWordCount === "number" ? obj.targetWordCount : undefined,
            h3s: rawH3s.map((h3): ArticleBlueprintSection["h3s"][number] | null => {
                if (typeof h3 === "string") {
                    const heading = asNonEmptyString(h3);
                    return heading ? { heading, role: "Subsection" } : null;
                }
                if (!h3 || typeof h3 !== "object") return null;
                const h3Obj = h3 as Record<string, unknown>;
                const heading = asNonEmptyString(h3Obj.heading) ?? asNonEmptyString(h3Obj.h3);
                return heading ? {
                    heading,
                    role: asNonEmptyString(h3Obj.role) ?? "Subsection",
                    requiredEvidence: asStringArray(h3Obj.requiredEvidence ?? h3Obj.required_evidence),
                } : null;
            }).filter((item): item is ArticleBlueprintSection["h3s"][number] => Boolean(item)).slice(0, 6),
            keyPoints: asStringArray(obj.keyPoints ?? obj.key_points).slice(0, 8),
            requiredEvidence: asStringArray(obj.requiredEvidence ?? obj.required_evidence).slice(0, 8),
            internalLinkTargets: Array.isArray(obj.internalLinkTargets)
                ? obj.internalLinkTargets.map(normalizeLink).filter((item): item is ArticleLinkSuggestion => Boolean(item)).slice(0, 4)
                : [],
            externalCitationTargets: Array.isArray(obj.externalCitationTargets)
                ? obj.externalCitationTargets.map(normalizeCitation).filter((item): item is ArticleCitationSuggestion => Boolean(item)).slice(0, 4)
                : [],
        };
    }).filter((item): item is ArticleBlueprintSection => Boolean(item));

    const sourceSearchIntent = sourceContext?.kind === "opportunity" ? sourceContext.targetIntent : null;

    return {
        primaryKeyword,
        secondaryKeywords,
        searchIntent: asNonEmptyString(raw.searchIntent) ?? asNonEmptyString(raw.intent) ?? sourceSearchIntent ?? "Informational search intent",
        intentStage: asNonEmptyString(raw.intentStage) ?? (sourceContext?.kind === "plan" ? sourceContext.intentStage : null),
        funnelStage: asNonEmptyString(raw.funnelStage) ?? sourceContext?.funnelStage ?? null,
        targetReader: asNonEmptyString(raw.targetReader) ?? brief.aiContext.targetAudience,
        conversionGoal: asNonEmptyString(raw.conversionGoal) ?? sourceContext?.targetConversionGoal ?? null,
        articleType: asNonEmptyString(raw.articleType) ?? (brief.narrative_style === "instructional" ? "how-to guide" : "SEO article"),
        thesis: asNonEmptyString(raw.thesis) ?? `A useful, evidence-led article about ${brief.title}.`,
        differentiationAngle: asNonEmptyString(raw.differentiationAngle) ?? "Operator-level specificity, concrete evidence, and clear next steps.",
        requiredEvidence: asStringArray(raw.requiredEvidence).slice(0, 12),
        internalLinkTargets: topInternalLinks,
        externalCitationTargets: topExternalCitations,
        faqQuestions: Array.isArray(raw.faqQuestions)
            ? raw.faqQuestions.map(normalizeFaq).filter((item): item is ArticleFaqSuggestion => Boolean(item)).slice(0, 8)
            : [],
        sections,
    };
}

function formatArticleBlueprintForPrompt(blueprint: ArticleBlueprint | null, brief: DraftBrief): string {
    const tierRule = BLOG_LENGTH_TIER_RULES[brief.length];
    if (!blueprint) {
        return `No pre-writing blueprint is available. Still follow Agent 1 editorial structure: ${tierRule.targetH2Label} H2 sections and at least ${tierRule.minH3} H3 subsection(s) for this ${brief.length} draft tier.`;
    }

    const sections = blueprint.sections.map((section, index) => {
        const h3s = section.h3s.length
            ? section.h3s.map((h3) => `    - ### ${h3.heading} — ${h3.role}${h3.requiredEvidence?.length ? `; evidence: ${h3.requiredEvidence.join("; ")}` : ""}`).join("\n")
            : "    - No H3 supplied; add H3s only where needed for depth and validation.";
        return `${index + 1}. ## ${section.h2}
   Role: ${section.role}
   Key points: ${section.keyPoints.join("; ") || "use research and brief"}
   Required evidence: ${section.requiredEvidence.join("; ") || "use verified research/fact sheet where relevant"}
   H3 plan:
${h3s}`;
    }).join("\n\n");

    return `ARTICLE BLUEPRINT — HARD INPUTS
- Primary keyword: ${blueprint.primaryKeyword}
- Secondary keywords: ${blueprint.secondaryKeywords.join(", ") || "none"}
- Search intent: ${blueprint.searchIntent}
- Intent stage: ${blueprint.intentStage ?? "not provided"}
- Funnel stage: ${blueprint.funnelStage ?? "not provided"}
- Target reader: ${blueprint.targetReader}
- Conversion goal: ${blueprint.conversionGoal ?? "not provided"}
- Article type: ${blueprint.articleType}
- Thesis: ${blueprint.thesis}
- Differentiation angle: ${blueprint.differentiationAngle}
- Required evidence across article: ${blueprint.requiredEvidence.join("; ") || "use verified research/fact sheet"}

Internal link targets to weave naturally:
${blueprint.internalLinkTargets.length ? blueprint.internalLinkTargets.map((link) => `- ${link.anchor} → ${link.url} (${link.reason}${link.targetSection ? `; target section: ${link.targetSection}` : ""})`).join("\n") : "- None supplied; suggest internal links only if they fit naturally."}

External citation targets:
${blueprint.externalCitationTargets.length ? blueprint.externalCitationTargets.map((citation) => `- ${citation.title} — ${citation.url}${citation.publisher ? ` (${citation.publisher})` : ""}: ${citation.reason}${citation.targetSection ? `; target section: ${citation.targetSection}` : ""}`).join("\n") : "- Use verified fact-sheet sources when relevant; do not invent citations."}

FAQ questions to answer if the article format allows it:
${blueprint.faqQuestions.length ? blueprint.faqQuestions.map((faq) => `- ${faq.question} (${faq.intent}${faq.answerAngle ? `; angle: ${faq.answerAngle}` : ""})`).join("\n") : "- None supplied."}

Section order and roles (follow unless verified facts require a safer adjustment):
${sections || "No sections supplied; create a structure that satisfies the tier rules."}

Agent 1 structure rule: this ${brief.length} tier needs ${tierRule.targetH2Label} H2 sections (minimum ${tierRule.minH2}) and at least ${tierRule.minH3} H3 subsection(s). If the blueprint has fewer H3s, add useful H3s inside the most complex H2 sections rather than padding.`;
}

async function buildArticleBlueprint(
    brief: DraftBrief,
    research: string,
    sourceContext: SeoSourceContext | null,
    factSheet: CanonicalFactSheet | null,
    evergreenSourcePass: EvergreenResearchSourcePass | null,
    evidencePack: SourceEvidencePack | null,
    ctx: MeterCtx,
    allowedLinksText?: string,
): Promise<ArticleBlueprint | null> {
    const tierRule = BLOG_LENGTH_TIER_RULES[brief.length];
    const factSheetBlock = factSheet ? formatFactSheetForPrompt(factSheet) : "No verified fact sheet was generated for this topic.";
    const evergreenSourcesBlock = formatEvergreenSourcesForPrompt(evergreenSourcePass);
    const evidencePackBlock = formatEvidencePackForPrompt(evidencePack ?? { topic: brief.title, checked_at: new Date().toISOString(), retrieval_mode: "none", stale: true, claims: [], documents: [] });

    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are a senior SEO editor building a pre-writing article blueprint. Return one valid JSON object only. No markdown fences, no commentary.

The blueprint must be production-safe, fact-aware, and usable by a writer as hard input. It must preserve workspace locale and source-plan constraints. Never invent external URLs; only use URLs visible in the research, fact sheet, or evergreen source pass.`,
            prompt: `${localeInstruction(brief.workspaceLocale)}

Build an SEO article blueprint for a ${brief.length} (${LENGTH_GUIDE[brief.length]}) blog post.

Agent 1 editorial structure rules for this tier:
- H2 target range: ${tierRule.targetH2Label}; minimum H2 count: ${tierRule.minH2}
- Minimum H3 count: ${tierRule.minH3}
- Long H2 sections above ${tierRule.longH2SectionWordThreshold} words need H3 depth
- Minimum internal link suggestions: ${tierRule.minInternalLinkSuggestions}
- Minimum research citations: ${tierRule.minResearchCitations}

WORKSPACE CONTEXT:
- Industry: ${brief.aiContext.industry}
- Target audience: ${brief.aiContext.targetAudience}
- Brand voice: ${brief.aiContext.brandVoice}
- Content pillars: ${brief.aiContext.contentPillars.join(", ")}

REQUEST BRIEF:
- Working title: ${brief.title}
- Keywords: ${brief.keywords.join(", ")}
- Narrative style: ${brief.narrative_style}
- Geography: ${brief.geography}

SEO SOURCE CONTEXT:
${formatSeoSourceContextForPrompt(sourceContext)}

VERIFIED FACT SHEET:
${factSheetBlock}

SOURCE INTELLIGENCE EVIDENCE PACK:
${evidencePackBlock}

EVERGREEN SOURCES (stable background citations, not freshness/status verification):
${evergreenSourcesBlock}

RESEARCH SYNTHESIS:
${research.slice(0, 16000)}

Return JSON with exactly these top-level keys:
{
  "primaryKeyword": "string",
  "secondaryKeywords": ["string"],
  "searchIntent": "string",
  "intentStage": "string or null",
  "funnelStage": "string or null",
  "targetReader": "string",
  "conversionGoal": "string or null",
  "articleType": "string",
  "thesis": "string",
  "differentiationAngle": "string",
  "requiredEvidence": ["string"],
  "internalLinkTargets": [{ "url": "string", "anchor": "string", "reason": "string", "targetSection": "string" }],
  "externalCitationTargets": [{ "title": "string", "url": "https://...", "publisher": "string", "reason": "string", "targetSection": "string" }],
  "faqQuestions": [{ "question": "string", "intent": "string", "answerAngle": "string" }],
  "sections": [{
    "h2": "string",
    "role": "string",
    "targetWordCount": 250,
    "h3s": [{ "heading": "string", "role": "string", "requiredEvidence": ["string"] }],
    "keyPoints": ["string"],
    "requiredEvidence": ["string"],
    "internalLinkTargets": [{ "url": "string", "anchor": "string", "reason": "string" }],
    "externalCitationTargets": [{ "title": "string", "url": "https://...", "publisher": "string", "reason": "string" }]
  }]
}

Rules:
- If SEO SOURCE CONTEXT is a plan, treat title, primary keyword, secondary keywords, brief markdown, outline, intent stage, funnel stage, conversion goal, slug suggestion, and locale as hard inputs.
- Create ${tierRule.targetH2Label} H2 sections, never fewer than ${tierRule.minH2}. You MUST distribute the topic outline logically to satisfy this exact section count requirement.
- The primaryKeyword MUST be included in the meta description (which is the default description), the opening introductory section, and at least one H2 heading. Specify these requirements in the blueprint sections and metadata.
- Include at least ${tierRule.minH3} H3 suggestions across the blueprint; H3s must add depth, not repeat H2 labels.
- Include enough requiredEvidence and citation targets to satisfy ${tierRule.minResearchCitations}+ research citations. For evergreen posts, prefer the evergreen source pass URLs for stable background evidence and do not treat them as time-sensitive status verification.
- Include enough internal link targets to satisfy ${tierRule.minInternalLinkSuggestions}+ internal link suggestions where source context/research supports them.
- FAQ questions should reflect real search follow-ups, not generic filler.
- Add at least one grounded practical-detail requirement for guide/how-to/comparison topics: a before/after workflow, implementation sequence, review gate, stack/process mention, or owner handoff. If support is weak, label it as an author framework or scenario model rather than a proven result.
- Separate evidence types in the blueprint language: external source, author framework, scenario model/internal estimate, and source context. Do not blur an author framework into external proof.

CRITICAL INTERNAL LINKING RULES:
You MUST only suggest internal links from the list of allowed pages and posts provided below. Never invent, guess, or hallucinate URLs (e.g. "/services/ai-integration-automation" or "/blog/operations-framework"). If you want to link to the home page, use its exact URL from the allowed list (e.g. '/en' or '/nl' or '/ar'), or '/' for the main home page. If a URL is not present in the allowed list, DO NOT write it under internalLinkTargets.
ALLOWED INTERNAL LINK TARGETS IN THIS WORKSPACE:
${allowedLinksText || "No existing published items in this locale. Suggest no internal links."}
`,
        });
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "build_article_blueprint" });
        const parsed = extractJsonObject(text);
        return normalizeArticleBlueprint(parsed, brief, sourceContext);
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.warn("[buildArticleBlueprint] blueprint pass failed; continuing without blueprint:", providerError.toJSON());
        return null;
    }
}

/**
 * Split a section body into paragraph slices with their absolute offset
 * inside the section so visuals can be inserted next to the most relevant
 * paragraph rather than always at the section's tail.
 */
interface ParagraphSlice {
    text: string;
    /** Char offset where this paragraph starts inside the section body. */
    startOffset: number;
    /** Char offset of the end of this paragraph (exclusive). */
    endOffset: number;
}
function splitSectionParagraphs(body: string): ParagraphSlice[] {
    // Strip the leading heading so we don't anchor visuals to the heading.
    const headingMatch = body.match(/^(#{2,3}\s+.+?\n+)/);
    const headerEnd = headingMatch ? headingMatch[1].length : 0;
    const tail = body.slice(headerEnd);
    const slices: ParagraphSlice[] = [];
    // Split on blank lines; track absolute offsets within the section body.
    const re = /[^\n]+(?:\n[^\n]+)*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tail)) !== null) {
        const text = m[0].trim();
        if (!text || /^#{2,6}\s+/.test(text) || text.startsWith("{{visual:")) continue;
        slices.push({
            text,
            startOffset: headerEnd + m.index,
            endOffset: headerEnd + m.index + m[0].length,
        });
    }
    return slices;
}

/**
 * Token-overlap score used to pick the paragraph inside a section that
 * best matches a visual. Cheap and dependency-free; lowercases, strips
 * punctuation, drops <4-char tokens, and counts shared content words.
 */
function paragraphAffinityScore(visual: BlogVisualBlock, paragraph: string): number {
    const STOP = new Set(["the", "a", "an", "of", "for", "to", "and", "or", "in", "on", "with", "your", "you", "this", "that", "these", "those"]);
    const tokenize = (s: string): Set<string> => {
        const toks = s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
        return new Set(toks.filter((t) => !STOP.has(t)));
    };
    const visualText = [visual.title, visual.description ?? "", visual.caption ?? ""].join(" ");
    const vTokens = tokenize(visualText);
    const pTokens = tokenize(paragraph);
    if (vTokens.size === 0 || pTokens.size === 0) return 0;
    let shared = 0;
    vTokens.forEach((t) => {
        if (pTokens.has(t)) shared += 1;
    });
    return shared;
}

/**
 * Score how well a placement hint matches a section heading. Returns 0 when no
 * meaningful overlap, higher = better. Rewards exact match, substring match,
 * and shared content words (length >= 4) so a hint like
 * "How welcome flows drive activation" matches "## The welcome flow blueprint".
 */
function scorePlacementMatch(hint: string, heading: string): number {
    const h = normalizeHeadingForMatch(hint);
    const s = normalizeHeadingForMatch(heading);
    if (!h || !s) return 0;
    if (h === s) return 1000;
    if (s.includes(h) || h.includes(s)) return 500 + Math.min(h.length, s.length);

    const stop = new Set(["the", "a", "an", "of", "for", "to", "and", "or", "in", "on", "with", "your", "you", "how", "why", "what", "this", "that"]);
    const hWords = new Set(h.split(" ").filter((w) => w.length >= 4 && !stop.has(w)));
    const sWords = new Set(s.split(" ").filter((w) => w.length >= 4 && !stop.has(w)));
    if (hWords.size === 0 || sWords.size === 0) return 0;
    let shared = 0;
    hWords.forEach((w) => {
        if (sWords.has(w)) shared += 1;
    });
    return shared > 0 ? shared * 50 : 0;
}

interface VisualTargetSection {
    heading: string;
    normalizedHeading: string;
    level: 2 | 3;
    parentH2: string | null;
    body: string;
    assigned: BlogVisualBlock[];
}

function splitMarkdownIntoVisualTargetSections(content: string): { intro: string; sections: VisualTargetSection[] } {
    const headingRe = /^(#{2,3})\s+(.+?)\s*$/gm;
    const matches = Array.from(content.matchAll(headingRe));
    if (matches.length === 0) {
        return { intro: content, sections: [] };
    }

    const intro = content.slice(0, matches[0].index ?? 0);
    let currentParentH2: string | null = null;
    const parentByMatch = matches.map((match) => {
        const level = match[1].length as 2 | 3;
        const heading = match[2].trim();
        const parentH2 = level === 2 ? null : currentParentH2;
        if (level === 2) currentParentH2 = heading;
        return parentH2;
    });

    const sections = matches.map((match, index): VisualTargetSection => {
        const level = match[1].length as 2 | 3;
        const heading = match[2].trim();
        const start = match.index ?? 0;
        const end = matches[index + 1]?.index ?? content.length;
        return {
            heading,
            normalizedHeading: normalizeHeadingForMatch(heading),
            level,
            parentH2: parentByMatch[index],
            body: content.slice(start, end).trimEnd(),
            assigned: [],
        };
    });

    return { intro, sections };
}

function findExactHeadingIndex(sections: readonly VisualTargetSection[], hint: string, level?: 2 | 3): number {
    const normalizedHint = normalizeHeadingForMatch(hint);
    if (!normalizedHint) return -1;
    return sections.findIndex((section) => section.normalizedHeading === normalizedHint && (level ? section.level === level : true));
}

function findBestHeadingIndex(sections: readonly VisualTargetSection[], hint: string): { index: number; score: number } {
    let bestIdx = -1;
    let bestScore = 0;
    sections.forEach((section, idx) => {
        const score = scorePlacementMatch(hint, section.heading);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = idx;
        }
    });
    return { index: bestIdx, score: bestScore };
}

/**
 * Distribute visual shortcodes inline across the article. Each block is placed
 * inside the H2 section whose heading best matches its placement_hint, AND
 * anchored next to the paragraph inside that section that shares the most
 * content words with the visual's title/caption — so the chart appears
 * mid-narrative when there's a clear topical hit, and at the section tail
 * only as a last resort.
 *
 * Key invariants:
 * - No section receives more than `Math.ceil(blocks.length / sections.length)`
 *   visuals. Excess visuals overflow to the next least-loaded section,
 *   preventing the "single section becomes a visual dump" failure mode.
 * - The least-loaded list is recomputed after every placement so a section
 *   that just received a leftover doesn't keep receiving them.
 * - Unmatched hints are logged so we can monitor model drift over time.
 */
function injectVisualShortcodes(content: string, blocks: BlogVisualBlock[]) {
    if (!blocks.length) return content;

    const { intro, sections } = splitMarkdownIntoVisualTargetSections(content);

    if (sections.length === 0) {
        const trailing = blocks.map((b) => `{{visual:${b.id}}}`).join("\n\n");
        return `${intro.trim()}\n\n${trailing}`.trim();
    }

    // Per-section ceiling. The previous formula pinned this at exactly one
    // visual per section — which is exactly the rigid module-per-section cadence
    // AI-detectors flag as templated. Loosen to allow some sections to host
    // 2-3 visuals while others stay prose-only, but still cap so a single
    // section doesn't swallow every diagram.
    const PER_SECTION_CAP = Math.max(2, Math.ceil((blocks.length / sections.length) * 1.5));

    /** Pick the next-best target index when the original choice is full. */
    const overflowTarget = (preferredIdx: number): number => {
        const candidates = sections
            .map((s, idx) => ({ idx, count: s.assigned.length }))
            .filter((s) => s.count < PER_SECTION_CAP && s.idx !== preferredIdx)
            .sort((a, b) => a.count - b.count || a.idx - b.idx);
        if (candidates.length > 0) return candidates[0].idx;
        // All sections at cap — fall back to least-loaded overall (allows
        // one section to exceed the cap rather than dropping the visual).
        const allSorted = sections
            .map((s, idx) => ({ idx, count: s.assigned.length }))
            .sort((a, b) => a.count - b.count || a.idx - b.idx);
        return allSorted[0].idx;
    };

    const unmatched: BlogVisualBlock[] = [];
    const unmatchedHints: string[] = [];

    blocks.forEach((block) => {
        const hint = block.placement_hint?.trim();
        if (!hint) {
            unmatched.push(block);
            return;
        }
        let bestIdx = -1;
        let bestScore = 0;
        const exactH3Idx = findExactHeadingIndex(sections, hint, 3);
        if (exactH3Idx >= 0) {
            bestIdx = exactH3Idx;
            bestScore = 1200;
        } else {
            const exactH2Idx = findExactHeadingIndex(sections, hint, 2);
            if (exactH2Idx >= 0) {
                bestIdx = exactH2Idx;
                bestScore = 1000;
            } else {
                const parentH2Idx = sections.findIndex((section) => section.level === 2 && section.normalizedHeading === normalizeHeadingForMatch(hint));
                if (parentH2Idx >= 0) {
                    bestIdx = parentH2Idx;
                    bestScore = 900;
                } else {
                    const best = findBestHeadingIndex(sections, hint);
                    bestIdx = best.index;
                    bestScore = best.score;
                }
            }
        }
        if (bestIdx < 0 || bestScore < 50) {
            unmatched.push(block);
            unmatchedHints.push(hint);
            return;
        }
        const targetIdx = sections[bestIdx].assigned.length < PER_SECTION_CAP
            ? bestIdx
            : overflowTarget(bestIdx);
        sections[targetIdx].assigned.push(block);
    });

    // Round-robin leftovers across least-loaded sections. Recompute the
    // pick after each placement so balance stays honest as we go.
    for (const block of unmatched) {
        const pick = sections
            .map((s, idx) => ({ idx, count: s.assigned.length }))
            .sort((a, b) => a.count - b.count || a.idx - b.idx)[0];
        sections[pick.idx].assigned.push(block);
    }

    if (unmatchedHints.length > 0) {
        console.log("[generate-draft] visual placement hints with no H2/H3 match", {
            count: unmatchedHints.length,
            hints: unmatchedHints.slice(0, 6),
            availableHeadings: sections.map((s) => s.level === 3 ? `${s.heading} (H3 under ${s.parentH2 ?? "unknown H2"})` : s.heading),
        });
    }

    // Render each section: visuals are inserted next to the paragraph they
    // best match, not all stacked at the tail. Multiple visuals in one
    // section spread across distinct paragraphs when possible.
    const enriched: string[] = [intro.trimEnd()];
    sections.forEach((section) => {
        const body = section.body.trimEnd();
        if (section.assigned.length === 0) {
            enriched.push(body);
            return;
        }
        const paragraphs = splitSectionParagraphs(body);
        if (paragraphs.length === 0) {
            // No internal paragraphs — append to section tail.
            const tokens = section.assigned.map((b) => `{{visual:${b.id}}}`).join("\n\n");
            enriched.push(`${body}\n\n${tokens}`);
            return;
        }

        // Map each visual to its best-matching paragraph, scoring all then
        // assigning greedy by descending score. Used paragraphs become
        // unavailable so two visuals don't crowd the same paragraph end.
        const usedParagraphIdxs = new Set<number>();
        const insertions: Array<{ afterOffset: number; visual: BlogVisualBlock; score: number }> = [];

        for (const visual of section.assigned) {
            const ranked = paragraphs
                .map((p, idx) => ({ idx, score: paragraphAffinityScore(visual, p.text) }))
                .filter((r) => !usedParagraphIdxs.has(r.idx))
                .sort((a, b) => b.score - a.score);
            const best = ranked[0];
            if (!best) {
                // All paragraphs used — anchor to last paragraph (overflow).
                const last = paragraphs[paragraphs.length - 1];
                insertions.push({ afterOffset: last.endOffset, visual, score: 0 });
                continue;
            }
            usedParagraphIdxs.add(best.idx);
            insertions.push({
                afterOffset: paragraphs[best.idx].endOffset,
                visual,
                score: best.score,
            });
        }

        // Sort by offset descending so we can splice without invalidating
        // earlier offsets.
        insertions.sort((a, b) => b.afterOffset - a.afterOffset);
        let mutated = body;
        for (const ins of insertions) {
            const before = mutated.slice(0, ins.afterOffset);
            const after = mutated.slice(ins.afterOffset);
            mutated = `${before.trimEnd()}\n\n{{visual:${ins.visual.id}}}\n${after}`;
        }
        enriched.push(mutated);
    });

    return enriched.join("\n\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function localeInstruction(locale: DraftBrief["workspaceLocale"]): string {
    return buildLocaleSystemPrompt(locale);
}

interface MeterCtx {
    workspaceId: string;
    profileId: string | null;
}

async function meterCall(
    ctx: MeterCtx,
    alias: AiModelAlias,
    usage: { inputTokens: number | undefined; outputTokens: number | undefined },
    metadata: Record<string, unknown>,
) {
    const modelMetadata = getModelMetadata(alias);
    const operation = typeof metadata.phase === "string" ? metadata.phase : "generation";
    const aiRequestMetadata = buildAiRequestMetadata({
        alias,
        workspaceId: ctx.workspaceId,
        routeName: ROUTE_NAME,
        operation,
    });

    await meterAndCharge({
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        route: ROUTE_NAME,
        usage: {
            unitType: "tokens",
            model: modelMetadata.modelId,
            tokensIn: usage.inputTokens ?? 0,
            tokensOut: usage.outputTokens ?? 0,
        },
        metadata: { ...metadata, ai: aiRequestMetadata },
    });
}

interface ResearchOutput {
    prose: string;
    factSheet: CanonicalFactSheet | null;
    freshnessRisk: ReturnType<typeof classifyTopicFreshnessRisk>;
    evergreenSourcePass: EvergreenResearchSourcePass | null;
    evidencePack: SourceEvidencePack | null;
}

// ─── Phase 1: Research ─────────────────────────────────────────────────────
function evergreenSourceTargetForLength(length: DraftBrief["length"]): number {
    if (length === "short") return 0;
    if (length === "medium") return 2;
    return 5;
}

async function buildEvergreenSourcePass(brief: DraftBrief, freshnessRisk: ReturnType<typeof classifyTopicFreshnessRisk>): Promise<EvergreenResearchSourcePass | null> {
    if (freshnessRisk !== "evergreen" || !brief.content_types.includes("blog_post")) return null;

    const targetCount = evergreenSourceTargetForLength(brief.length);
    if (targetCount <= 0) return null;
    if (!process.env.TAVILY_API_KEY) {
        return {
            checked_at: new Date().toISOString(),
            target_count: targetCount,
            sources: [],
            query: "",
            retrieval_mode: "none",
            notes: "TAVILY_API_KEY is not configured; skipped optional evergreen source pass.",
        };
    }

    const query = [
        brief.title,
        brief.keywords.slice(0, 4).join(" "),
        brief.aiContext.industry,
        brief.geography !== "global" ? brief.geography : null,
        "research guide evidence",
    ].filter(Boolean).join(" ").slice(0, 400);

    try {
        const result = await tavilySearch({
            query,
            search_depth: "basic",
            topic: "general",
            max_results: Math.max(targetCount + 2, 5),
            country: tavilyCountryForLocale(brief.workspaceLocale),
        });
        const ranked = rankEvidenceHybrid(
            (result.results ?? []).filter((source) => source.url && !isBlockedExternalUrl(source.url)),
            brief.title,
        ).slice(0, targetCount);

        return {
            checked_at: new Date().toISOString(),
            target_count: targetCount,
            sources: ranked,
            query,
            retrieval_mode: "tavily_evergreen_lightweight",
            notes: ranked.length >= targetCount
                ? `Met evergreen source target for ${brief.length} blog tier.`
                : `Found ${ranked.length} usable evergreen source(s); target for ${brief.length} blog tier is ${targetCount}.`,
        };
    } catch (err) {
        console.warn("[generate-draft] Evergreen source pass failed, continuing without evergreen sources:", err);
        return {
            checked_at: new Date().toISOString(),
            target_count: targetCount,
            sources: [],
            query,
            retrieval_mode: "none",
            notes: `Evergreen source pass failed: ${String(err).slice(0, 180)}`,
        };
    }
}

async function runResearch(brief: DraftBrief, ctx: MeterCtx): Promise<ResearchOutput> {
    const freshnessRisk = classifyTopicFreshnessRisk(brief.title, brief.keywords);

    let factSheet: CanonicalFactSheet | null = null;
    let factSheetSection = "";
    const evidencePack = await retrieveEvidencePack({
        workspaceId: ctx.workspaceId,
        topic: brief.title,
        keywords: brief.keywords,
        locale: brief.workspaceLocale,
        sectorTags: [brief.aiContext.industry, ...brief.aiContext.contentPillars],
    });
    const evidencePackSection = evidencePack.claims.length
        ? `\n\n---\n${formatEvidencePackForPrompt(evidencePack)}\n---\n`
        : "";
    const needsFallbackSources = evidencePack.claims.length === 0 || evidencePack.stale;
    const evergreenSourcePass = needsFallbackSources ? await buildEvergreenSourcePass(brief, freshnessRisk) : null;
    const evergreenSourcesSection = evergreenSourcePass?.sources.length
        ? `\n\n---\n${formatEvergreenSourcesForPrompt(evergreenSourcePass)}\n---\n`
        : "";

    if (freshnessRisk !== "evergreen" && needsFallbackSources) {
        try {
            factSheet = await buildFactSheet(brief.title, brief.keywords, freshnessRisk, brief.workspaceLocale);
            factSheetSection = `\n\n---\n${formatFactSheetForPrompt(factSheet)}\n---\n`;
            console.log(`[generate-draft] Freshness check complete: status=${factSheet.status}, risk=${freshnessRisk}`);
        } catch (err) {
            console.warn("[generate-draft] Tavily retrieval failed, continuing without fact sheet:", err);
        }
    }

    const { text, usage } = await generateText({
        model: resolveTextModel(RESEARCH_MODEL_ALIAS),
        system: `${brief.aiSystemContext}

You MUST follow the active workspace business context above in every decision and recommendation.`,
        prompt: `You are a senior research analyst for the ${brief.aiContext.industry} industry.
Your target audience is: ${brief.aiContext.targetAudience}
${localeInstruction(brief.workspaceLocale)}
${evidencePackSection}
${factSheetSection}
${evergreenSourcesSection}
Conduct deep research on the following topic brief and return a comprehensive research document, including:
1. A 3-sentence executive summary of the topic
2. Top 5 current trends and developments (cite sources where possible via grounded search)
3. Key data points, statistics, or benchmarks relevant to the ${brief.geography} market
4. Competitive landscape or context in this space
5. Key arguments and counter-arguments
6. Audience pain points and motivations
7. 10 recommended talking points or sub-topics for the article
${factSheet ? `\nIMPORTANT: The verified fact sheet above contains authoritative status information. Use it to ground your research. Do not contradict verified facts.` : ""}
${evidencePack?.claims.length ? `\nIMPORTANT: Prefer the Source Intelligence evidence pack above for claims and citations. If it is marked stale, use it as context and verify time-sensitive assertions through fallback sources.` : ""}
${evergreenSourcePass?.sources.length ? `\nIMPORTANT: The evergreen source pass above provides stable background citations only. Use those URLs for evidence-led evergreen claims, but do not describe them as a freshness/status fact sheet.` : ""}

TOPIC BRIEF:
- Title: ${brief.title}
- Keywords: ${brief.keywords.join(", ")}
- Target Geography: ${brief.geography}
- Narrative Style: ${brief.narrative_style}
- Brand Voice Tone: ${brief.aiContext.brandVoice}

Return the research as structured markdown with clear headings. Be thorough, factual, and specific.`,
    });
    await meterCall(ctx, RESEARCH_MODEL_ALIAS, usage, { phase: "research" });
    return { prose: text, factSheet, freshnessRisk, evergreenSourcePass, evidencePack };
}

// ─── Phase 2.5: Critique-and-revise pass ─────────────────────────────────────
/**
 * Second LLM call that critiques the just-written draft against the same
 * tells our AI-detection reviewer flagged and rewrites the worst offenders
 * inline. Negative prompt rules in the writer pass do not reliably suppress
 * strong training-data priors (tricolons, templated cards, civilizational
 * openers) — a dedicated revise step is the highest-leverage move.
 *
 * The revised markdown REPLACES the original. We keep the call latency-
 * bounded (a single shot, no chain-of-thought) and tolerate failure: if the
 * critique pass errors, we fall back to the original draft rather than
 * blocking publication.
 */
async function critiqueAndReviseBlogContent(
    brief: DraftBrief,
    originalMarkdown: string,
    ctx: MeterCtx,
): Promise<string> {
    if (!originalMarkdown || originalMarkdown.length < 200) return originalMarkdown;

    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(DRAFT_MODEL_ALIAS),
            system: `You are a senior editor reviewing a draft article for AI-detection tells. The draft was machine-generated and the goal is for it to read as written by an experienced operator in the ${brief.aiContext.industry} sector.

Apply the following rewrites in priority order. After each rewrite, re-read what you changed and tighten if it sounds awkward. Output ONLY the revised markdown — no preamble, no commentary, no XML tags.

REWRITE TARGETS (priority order):

1. TRICOLONS. Three parallel adjectives or noun phrases stacked together read as machine cadence. This includes BOTH single-word triples ("recorded, traced, and understood") AND multi-word phrase triples ("faster content generation, quicker data summaries, and enhanced productivity" / "higher accuracy, reduced hallucinations, and full compliance"). Cut to two items wherever possible. If the three items genuinely earn their place AND are not interchangeable, split into separate sentences. Real lists of proper nouns ("ChatGPT, Claude, and Gemini") stay.

2. TEMPLATED STEP/CARD SCAFFOLDING. Three variants all read as pipeline output and must be rewritten:
   (a) Stacked bullet bold-label cards: \`- **Term:** Single sentence explaining it.\` repeated five-plus times.
   (b) Inline numbered steps with title-cased labels: \`1. Audit Your Landscape: Begin by ... 2. Define Your Needs: Next, ... 3. Architect a Solution: Finally, ...\` all in one paragraph. Same template, different surface form.
   (c) Section-end "Approach" lists with title-cased bullets: \`Seamlessly Integrated / Legally Compliant / Optimized for Growth\`.
   Convert at least 40% of these into running prose paragraphs that integrate the same concepts naturally. Keep some structure for skimmability — do not flatten everything — but do not let any single section be 90% bold-labels.

3. SWEEPING CIVILIZATIONAL OPENERS. If the article opens with a generic claim about how an industry or technology is changing ("As small and medium-sized enterprises increasingly integrate AI..." / "In today's evolving landscape..." / "The conversation around X has moved beyond Y..."), replace the first sentence with a concrete observation, a named scenario, or a first-person operator anecdote. The first sentence should be something only someone working in the space would write.

4. META-EXPLAINER SENTENCES AFTER EXAMPLES. If a paragraph ends with a sentence that explains what the previous example demonstrated ("This systematic approach ensures..." / "This shows..." / "This illustrates the broader point that..."), delete it. The next paragraph must move the argument forward, not narrate the previous one.

5. COLON-STYLE SECTION HEADERS. \`## The X Strategy: Frictionless Logging\` / \`## The Platform Approach: Integrated, Compliant, Optimized\` — collapse to a single concept (\`## The API Gateway Strategy\`).

6. STOCK LLM PHRASES. Strip: "silent threat", "ticking liability", "false economy", "new frontier", "blind spot to", "dangerous blend", "digital backbone", "competitive edge", "unique selling proposition", "needle in a haystack", "digital supply chain", "comprehensive governance model", "data-driven process". Replace with plainer English.

7. "NOT X, IT'S Y" CADENCE — BOTH directions. Leading: "This is not just about mitigating risks; it's about leading the AI transition" → drop the first half. Trailing: "It is about automating workflows, not just providing a chat interface" → drop the trailing negation. Maximum one instance per article and only if the contrast is genuine and load-bearing.

8. ROUND-NUMBER STATS WITH WEAK ATTRIBUTION. If a percentage like "up to 60%" or "73%" is attributed to a single source AND the figure isn't load-bearing for the argument, replace with a qualitative description ("most teams report measurable improvements") or a specific concrete example. Keep stats only when they're essential and the source is named primary.

9. PARAGRAPH OPENER VARIETY. Vary the first word across paragraphs. Do not start more than two consecutive paragraphs with "The", "This", or a participial phrase. Mix declarative leads, scene-setting clauses, and direct claims.

10. AUDIENCE-NAMING OPENERS. Paragraphs that begin with "For founders and operations leads…" / "For CFOs and CTOs…" / "For SME leaders committed to…" are templated set-ups the model uses to feign relevance. Delete the audience-naming prefix and lead with the claim itself. The reader figures out the article is for them from the substance.

11. STOCK PHRASES the model overuses on this account: "stark contrast", "in stark contrast", "walled garden(s)", "data silos", "ring-fenced", "ring-fencing", "ChatGPT wrapper(s)", "thin wrapper(s)", "operational intelligence", "system-first" (any context), "digital backbone", "competitive edge", "unique selling proposition", "comprehensive governance", "data-driven process", "commercial imperative". Strip or replace with plainer English. For "system-first" specifically: name what the system actually does ("logged at the gateway", "enforced in the database") instead of using the abstract label.

PRESERVATION RULES:
- Preserve all \`{{visual:ID}}\` shortcodes verbatim and in their original positions.
- Preserve any named scenarios, dates, and metrics in the body (they came from a real client snippet — do not soften them into generalities).
- Preserve all H2 headings except for the colon-tagline rewrite in rule 5.
- Preserve approximate length (±15%). Do not collapse the article to a summary.

Output the revised markdown only. No commentary.`,
            prompt: `Working title: ${brief.title}
Audience: ${brief.aiContext.targetAudience}
Brand voice: ${brief.aiContext.brandVoice}

DRAFT TO REVISE:
${originalMarkdown}

Output the revised markdown only.`,
        });

        await meterCall(ctx, DRAFT_MODEL_ALIAS, usage, { phase: "critique_revise_blog" });

        const revised = String(text || "").trim();
        // Sanity guard: the revised draft must keep at least 70% of the
        // original length AND contain every visual shortcode that was in
        // the original. If either fails, fall back to the original.
        if (revised.length < originalMarkdown.length * 0.7) {
            console.warn(`[critiqueAndReviseBlogContent] revised draft is suspiciously short (${revised.length} vs ${originalMarkdown.length}). Falling back to original.`);
            return originalMarkdown;
        }
        const originalShortcodes = (originalMarkdown.match(/\{\{visual:[^}]+\}\}/g) ?? []).sort();
        const revisedShortcodes = (revised.match(/\{\{visual:[^}]+\}\}/g) ?? []).sort();
        if (originalShortcodes.join("\n") !== revisedShortcodes.join("\n")) {
            console.warn(`[critiqueAndReviseBlogContent] visual shortcodes mismatch after revision (${originalShortcodes.length} vs ${revisedShortcodes.length}). Falling back to original.`);
            return originalMarkdown;
        }
        return revised;
    } catch (err) {
        const providerError = normalizeAiProviderError(err, {
            provider: getModelMetadata(DRAFT_MODEL_ALIAS).provider,
            modelAlias: DRAFT_MODEL_ALIAS,
            modelId: getModelMetadata(DRAFT_MODEL_ALIAS).modelId,
        });
        console.warn("[critiqueAndReviseBlogContent] critique pass failed, using original draft:", providerError.toJSON());
        return originalMarkdown;
    }
}

// ─── Phase 2: Specialized Generators ────────────────────────────────────────
async function generateBlogPost(
    brief: DraftBrief,
    research: string,
    ctx: MeterCtx,
    factSheet: CanonicalFactSheet | null,
    evergreenSourcePass: EvergreenResearchSourcePass | null,
    caseSnippet: CaseSnippet | null,
    blueprint: ArticleBlueprint | null,
    sourceContext: SeoSourceContext | null,
    allowedLinksText?: string,
): Promise<Record<string, unknown>> {
    let resultText = "";

    const factSheetBlock = factSheet ? formatFactSheetForPrompt(factSheet) : null;
    const evergreenSourcesBlock = formatEvergreenSourcesForPrompt(evergreenSourcePass);
    const blueprintBlock = formatArticleBlueprintForPrompt(blueprint, brief);
    const sourceContextBlock = formatSeoSourceContextForPrompt(sourceContext);
    const tierRule = BLOG_LENGTH_TIER_RULES[brief.length];

    const bannedPhrasesInstruction = factSheet?.forbidden_phrases?.length
        ? `\n\nCRITICAL — BANNED PHRASES: The following phrases are FORBIDDEN because this topic is already "${factSheet.status}". Using any of them is a factual error:\n${factSheet.forbidden_phrases.map(p => `- "${p}"`).join("\n")}`
        : "";

    const statusInstruction = factSheet?.status === "released"
        ? `\n\nFACT: This topic/product is ALREADY RELEASED${factSheet.release_date ? ` (on ${factSheet.release_date})` : ""}. Write about it as an existing, active thing — never as upcoming or anticipated.`
        : factSheet?.status === "announced"
        ? `\n\nFACT: This topic/product has been ANNOUNCED but is not yet released. Use confirmed announcement details but avoid claiming it is available.`
        : "";

    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(DRAFT_MODEL_ALIAS),
            system: `You are an elite, highly-paid content writer for the ${brief.aiContext.industry} sector.
Your core brand voice is: ${brief.aiContext.brandVoice}
Your target audience is: ${brief.aiContext.targetAudience}
${localeInstruction(brief.workspaceLocale)}

${brief.aiSystemContext}

You MUST follow the active workspace business context above before generating any output.

You write for a ${brief.geography} audience.

${HUMAN_VOICE_RULES}
${buildCaseSnippetPromptBlock(caseSnippet)}
${statusInstruction}${bannedPhrasesInstruction}

PUBLIC COPY SAFETY:
- Never expose internal identifiers, event keys, database names, route names, snake_case, camelCase, or code-style labels in the public article.
- Do not wrap business concepts in inline code ticks. Write "welcome flow" as plain text, not as code. Write "consideration sequence" as plain text, not as code.
- Convert internal event names into reader-facing language: workspace_signup → workspace sign-up, newsletter_subscribe → newsletter subscription, form_submit → form submission, cta_click → call-to-action click, page_view → page visit.
- If a concept only makes sense to our internal implementation, translate it into plain business language or omit it.

IMPORTANT INSTRUCTION: You MUST format your response using EXACTLY the following XML-like tags. Do NOT output JSON. Do NOT wrap your output in markdown codeblocks. Just output the raw text with these tags:

DIAGRAM POLICY: Do NOT include mermaid, flowchart, graph TD/LR, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, journey, pie syntax, ASCII art diagrams, or box-drawing characters (┌, ─, └, │, ├, ┬) — fenced or unfenced — anywhere inside <CONTENT_MARKDOWN>. ASCII diagrams also include bracketed nodes connected with arrows, repeated equals/dashes, slashes/backslashes, carets, or v characters, even when wrapped in a plain code fence. Do NOT write lines like "flowchart TD A[Audit] --> B[Plan]" or draw text-based architecture sketches in the body. Diagrams are produced by a separate system from a structured JSON response and inserted via {{visual:ID}} shortcodes. Body markdown stays prose-only with standard markdown elements (headings, paragraphs, lists, blockquotes, inline code for technical identifiers only).

SEO KEYWORD POLICY (MANDATORY):
- The primary keyword ("${blueprint?.primaryKeyword ?? brief.keywords[0]}") MUST appear verbatim in:
  1. The meta description (<SEO_DESCRIPTION>)
  2. The opening introductory paragraph (first 120 words of <CONTENT_MARKDOWN>)
  3. At least one of the \`## H2\` headings (e.g. \`## Cost-saving strategies for corporate AI cost control\`).
- Place the keyword naturally without keyword-stuffing.

STRUCTURE POLICY (MANDATORY):
- The body MUST be broken into ${H2_SECTION_GUIDE[brief.length].target} \`## H2\` sections (minimum ${H2_SECTION_GUIDE[brief.length].min}). Never return one continuous body with no headings.
- If the ARTICLE BLUEPRINT has fewer than ${H2_SECTION_GUIDE[brief.length].min} H2 sections, you MUST split or expand the existing outline points to generate at least ${H2_SECTION_GUIDE[brief.length].min} distinct H2 sections (target: ${H2_SECTION_GUIDE[brief.length].target}).
- The body MUST include at least ${tierRule.minH3} useful \`### H3\` subsection(s) for this ${brief.length} tier. H3s must clarify complex H2 sections; never use decorative or duplicate H3s.
- Each H2 section is ${brief.length === "short" ? "100-200" : brief.length === "medium" ? "150-300" : brief.length === "long" ? "200-400" : "250-500"} words. No section may exceed 600 words without a sub-heading or paragraph break.
- Do NOT use a top-level \`# H1\` inside <CONTENT_MARKDOWN> — the article H1 is already the <TITLE> tag. Start the body with a short intro paragraph, then the first \`## H2\`.
- H2 headings must be plain concept labels (e.g. \`## How SaaS sprawl drains margin\`). Do NOT write tagline-style \`## Concept: Tagline\` headings.
- Do NOT include closing-section H2s like \`## Conclusion\`, \`## Final Thoughts\`, \`## Key Takeaways\`, \`## Summary\`, \`## Wrapping Up\`. End on a substantive paragraph instead.

BLUEPRINT POLICY (MANDATORY):
- Treat the ARTICLE BLUEPRINT below as hard editorial input. Follow its section order, section roles, thesis, differentiation angle, keywords, and evidence requirements unless verified facts make a safer adjustment necessary.
- If the SEO source is a content plan, its outline, brief, primary keyword, secondary keywords, intent stage, funnel stage, conversion goal, slug suggestion, and locale are hard inputs. Do not substitute a generic angle.
- Use the blueprint's FAQ questions only if they fit naturally; do not append a generic FAQ section when it weakens the article.
- Weave internal links and external citations naturally where the blueprint names them. Do not invent URLs.
- If an evergreen source pass is provided, use those URLs as stable background evidence for research-led evergreen claims. Do not call it a freshness fact sheet and do not imply it verified live release/status claims.

TRUST AND PRACTICALITY POLICY (MANDATORY):
- Make trust visible in the prose without hype: distinguish external-source evidence, author frameworks, scenario models/internal estimates, and contextual sources.
- Include at least one concrete implementation detail where the brief supports it: before/after workflow, review gate, owner handoff, operating sequence, stack/tool category, or process constraint.
- Never invent clients, screenshots, case studies, metrics, or named outcomes. If a workflow example is illustrative, label it as a scenario model. If a framework is the author's synthesis, say so plainly.
- Avoid repetitive exact-match keyword phrasing. Use natural synonyms after SEO-critical placements.

CRITICAL INTERNAL LINKING INVENTORY:
You must only use internal link URLs exactly as specified in the blueprint or in the following list of allowed published items. Do not invent internal URLs. Special-case the home page: to link to the home page, use its exact localized URL from the allowed list (e.g. '/en' or '/nl' or '/ar'), or '/' for the main home page.
Allowed Internal Link Targets:
${allowedLinksText || "No existing published items in this locale. Do not insert any internal links."}

<TITLE>Engaging, Non-Clickbaity H1 Title</TITLE>
<CONTENT_MARKDOWN>
Short intro paragraph (no heading).

## First section heading
Body paragraphs for the first section…

## Second section heading
Body paragraphs for the second section…

(continue with ${H2_SECTION_GUIDE[brief.length].target} sections total)
</CONTENT_MARKDOWN>
<SEO_TITLE>SEO Optimized Title (max 60 chars)</SEO_TITLE>
<SEO_DESCRIPTION>Meta description (max 160 chars)</SEO_DESCRIPTION>
<SEO_KEYWORDS>tag1, tag2, tag3</SEO_KEYWORDS>
<EXCERPT>A catchy, human-written two sentence summary for the blog post list view.</EXCERPT>`,
            prompt: `Using the research and article blueprint below, write a complete ${brief.length} (${LENGTH_GUIDE[brief.length]}) blog post.
The tone MUST dynamically adapt to perfectly fit the core emotion and nuance of the Working Title and Topic while strictly adhering to the brand voice: ${brief.aiContext.brandVoice}

Do not sound like a machine summarizing data; synthesize the research into a compelling, human narrative.

Working Title: ${brief.title}
Keywords to include naturally (do not force them): ${brief.keywords.join(", ")}
Style: ${brief.narrative_style}

SEO SOURCE CONTEXT:
${sourceContextBlock}

${blueprintBlock}

${factSheetBlock ? `\n## VERIFIED FACT SHEET (treat this as ground truth for any time-sensitive claims)\n${factSheetBlock}\n` : ""}
${evergreenSourcePass?.sources.length ? `\n## EVERGREEN SOURCES (stable background citations; not a freshness/status fact sheet)\n${evergreenSourcesBlock}\n` : ""}
RESEARCH CONTEXT:
${research}

Respond exclusively using the requested XML tags.`,
        });

        resultText = text;
        await meterCall(ctx, DRAFT_MODEL_ALIAS, usage, { phase: "generate_blog_post" });

        const extractTag = (tag: string, text: string) => {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
            const match = text.match(regex);
            return match ? match[1].trim() : "";
        };

        const titleResult = extractTag("TITLE", text);
        const contentResult = extractTag("CONTENT_MARKDOWN", text);
        const seoTitleResult = extractTag("SEO_TITLE", text);
        const seoDescResult = extractTag("SEO_DESCRIPTION", text);
        const keywordsResult = extractTag("SEO_KEYWORDS", text);
        const excerptResult = extractTag("EXCERPT", text);

        if (!contentResult) throw new Error("Failed to extract CONTENT_MARKDOWN tag");

        // Structural validator: if the writer emitted an under-structured long
        // form draft, retry once with a stricter restated rule. Without this,
        // deep-dive drafts can pass through as a single wall of prose; visual
        // placement then has no reliable H2/H3 anchors and dumps shortcodes at
        // the tail.
        let validatedContent = contentResult;
        let validatedTitle = titleResult;
        const requiredH2 = BLOG_LENGTH_TIER_RULES[brief.length].minH2;
        const requiredH3 = BLOG_LENGTH_TIER_RULES[brief.length].minH3;
        const initialStructure = summarizeDraftStructure(contentResult, brief.length);
        if (!initialStructure.valid) {
            console.warn(`[generateBlogPost] draft failed deterministic structure check (${initialStructure.reason}). Retrying once with stricter prompt.`, initialStructure);
            try {
                const retry = await generateText({
                    model: resolveTextModel(DRAFT_MODEL_ALIAS),
                    system: `You are rewriting a draft article that failed deterministic long-form structure checks. Rewrite it to satisfy ALL constraints: ${H2_SECTION_GUIDE[brief.length].target} \`## H2\` sections (minimum ${requiredH2}), at least ${requiredH3} useful \`### H3\` subsections, no thin H2 sections, and for deep-dive drafts preserve true long-form depth (roughly 4000-6000 words, never a short summary). Keep the substance, evidence, examples, and approximate length (±15%) of the original unless the original was too short for a deep-dive, in which case expand with concrete implementation detail and evidence-backed explanation. Do NOT use \`# H1\` inside the body. Do NOT use tagline-style colon headings. Do NOT use closing-section headings (Conclusion, Final Thoughts, etc.). Preserve every \`{{visual:ID}}\` shortcode verbatim. Never output ASCII art diagrams, box-drawing characters, raw Mermaid, or diagram DSL (flowchart/graph TD/LR, gantt, journey, pie, sequenceDiagram, classDiagram, stateDiagram, erDiagram, mindmap, timeline, quadrantChart, gitGraph, requirementDiagram, C4*) inside the body. Output ONLY the revised markdown with the same XML tags as before.`,
                    prompt: `Working title: ${brief.title}

FAILED STRUCTURE SUMMARY:
- Reason: ${initialStructure.reason}
- Words: ${initialStructure.wordCount}
- Characters: ${initialStructure.charCount}
- H2 count: ${initialStructure.h2Count} (required ${requiredH2}, target ${H2_SECTION_GUIDE[brief.length].target})
- H3 count: ${initialStructure.h3Count} (required ${requiredH3})
- H2 section word counts: ${initialStructure.sectionWordCounts.join(", ") || "none"}

ORIGINAL DRAFT (rewrite to add ${requiredH2}+ ## H2 sections):
<TITLE>${titleResult}</TITLE>
<CONTENT_MARKDOWN>
${contentResult}
</CONTENT_MARKDOWN>

Output the revised <TITLE> and <CONTENT_MARKDOWN> tags only.`,
                });
                await meterCall(ctx, DRAFT_MODEL_ALIAS, retry.usage, { phase: "generate_blog_post_structure_retry" });
                const retryContent = extractTag("CONTENT_MARKDOWN", retry.text);
                const retryTitle = extractTag("TITLE", retry.text);
                const retryStructure = summarizeDraftStructure(retryContent, brief.length);
                if (retryContent && retryStructure.valid && retryContent.length >= contentResult.length * 0.7) {
                    validatedContent = retryContent;
                    if (retryTitle) validatedTitle = retryTitle;
                } else {
                    console.warn(`[generateBlogPost] structure retry still failed (${retryStructure.reason}); keeping original.`, retryStructure);
                }
            } catch (retryErr) {
                const providerError = normalizeAiProviderError(retryErr, {
                    provider: getModelMetadata(DRAFT_MODEL_ALIAS).provider,
                    modelAlias: DRAFT_MODEL_ALIAS,
                    modelId: getModelMetadata(DRAFT_MODEL_ALIAS).modelId,
                });
                console.warn("[generateBlogPost] structure retry failed; keeping original:", providerError.toJSON());
            }
        }

        // Critique-and-revise pass. The first-pass writer reliably ignores
        // negative prompt rules against templated cadence (tricolons, bold-
        // label cards, civilizational openers); a second dedicated editor
        // call catches them. Falls back to the original on any error.
        const revisedContent = await critiqueAndReviseBlogContent(brief, validatedContent, ctx);

        // Deterministic structural post-processor. Cheap, fast, idempotent.
        // Catches the residual cadence tells the LLM editor may have left
        // (colon-tagline H2s, leftover tricolons, runs of bold-label cards).
        const restructuredContent = applyAntiTemplateTransforms(revisedContent);

        return {
            title: humanize(validatedTitle || brief.title, { preserveNewlines: false }),
            content_markdown: normalizeMarkdownForRender(sanitizePublicCopy(humanize(restructuredContent))),
            seo: {
                title: humanize(seoTitleResult, { preserveNewlines: false }),
                description: humanize(seoDescResult, { preserveNewlines: false }),
                keywords: keywordsResult.split(',').map(k => k.trim()).filter(Boolean)
            },
            excerpt: humanize(excerptResult, { preserveNewlines: false })
        };
    } catch (err) {
        const providerError = normalizeAiProviderError(err, {
            provider: getModelMetadata(DRAFT_MODEL_ALIAS).provider,
            modelAlias: DRAFT_MODEL_ALIAS,
            modelId: getModelMetadata(DRAFT_MODEL_ALIAS).modelId,
        });
        console.error("[generateBlogPost] Failed to generate or parse JSON:", providerError.toJSON());
        console.error("[generateBlogPost] Raw text was:", resultText);
        return {
            title: brief.title,
            content_markdown: resultText || "Failed to generate content.",
            seo: { title: brief.title, description: "", keywords: brief.keywords },
            excerpt: ""
        };
    }
}

async function generateChartBlocks(brief: DraftBrief, research: string, blogPost: Record<string, unknown>, ctx: MeterCtx, factSheet: CanonicalFactSheet | null, evergreenSourcePass: EvergreenResearchSourcePass | null, headings: VisualPlacementHeading[]): Promise<BlogVisualBlock[]> {
    let resultText = "";
    try {
        const density = brief.visual_density || "balanced";
        const headingEnum = formatHeadingEnum(headings);
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are a data visualization editor for premium SEO blog content. Return a single valid JSON object only.

Schema:
{
  "charts": [
    {
      "id": "stable-kebab-case-id",
      "type": "chart",
      "chart_type": "bar|line|donut|kpi|comparison_table",
      "title": "string",
      "description": "string",
      "caption": "string",
      "source_label": "string",
      "source_url": "exact https:// source URL when source_label is external; leave empty when no source URL is available",
      "evidence": {
        "claim_id": "stable claim id",
        "claim_text": "specific claim represented by the chart",
        "evidence_type": "verified_statistic|time_sensitive_benchmark|forecast|internal_estimate|unsupported",
        "source_quality": "primary|near_primary|secondary|vendor|internal|unknown",
        "source_label": "publisher/report/dataset label, with exact year for named datasets",
        "source_url": "exact https:// source URL or empty for internal_estimate",
        "publication_date": "YYYY-MM-DD or YYYY when available",
        "metric_definition": "what the number measures, including denominator/sample where feasible",
        "geography_and_sample": "geography/sample context when available",
        "confidence": "high|medium|low",
        "source_note": "methodology note or forecast caveat"
      },
      "seo_alt": "descriptive alt text",
      "placement_hint": "EXACT text of the H2 or H3 heading from the BLOG DRAFT where this chart belongs (no leading ##/###, no quotes). REQUIRED — must be copied verbatim from one of the H2/H3 targets present in the draft so it can be placed inline near the relevant narrative or nested subsection.",
      "unit": "%, EUR, USD, hours, etc optional",
      "data": [{ "label": "string", "value": 12.3, "group": "optional", "note": "optional" }]
    }
  ]
}

Rules:
${VISUAL_EVIDENCE_PROMPT_CONTRACT}

- Use ONLY numeric facts, counts, percentages, benchmarks, rankings, or clearly extractable scores supported by the research/article.
- If exact numbers are not supported, create KPI/comparison visuals only from explicit article facts or return {"charts":[]}.
- Do not fabricate statistics.
- Numeric charts MUST use evidence_type verified_statistic, time_sensitive_benchmark, forecast, or internal_estimate. If internal_estimate, source_url must be empty and evidence.source_note/metric_definition must explain the methodology.
- Exact values (percentages, currency, counts, scores) require evidence.publication_date or exact dataset year in source_label, plus evidence.metric_definition where feasible.
- Vendor blogs may support definitions/framing only; do not use them as quantitative proof for charts.
- Do not use Markdown formatting in any JSON string field. No **bold**, _italic_, bullet syntax, markdown links, or backticks.
- Every chart MUST cite a real external source URL whenever one is available in the verified list. Do not invent URLs.
- If source_label is a real publisher such as Content Marketing Institute, HubSpot, McKinsey, Statista, Gartner, etc., source_url is required and must be the exact page URL, not just a domain.
- NEVER use placeholder source labels. If no URL fits, leave source_label and source_url EMPTY — a post-generation pass will look up a real URL automatically.
- INLINE PLACEMENT (critical): set placement_hint to the EXACT text of one heading from the AVAILABLE VISUAL PLACEMENT TARGETS list in the prompt — either a listed H2 or a listed H3. Copy the target text verbatim, no "## " or "### " prefix, no H2/H3 label, no parenthetical parent context, no quotes, no paraphrase. The renderer uses this to interleave each chart inside its narrative section. Prefer a relevant H3 when the chart supports a nested subsection; use the parent H2 only when the chart supports the whole section.
- Place charts near relevant nested subsections, not just broad parent sections. Charts whose hint does not match any listed H2/H3 will be scattered as filler — avoid that.
- Distribute charts where they actually serve the narrative. Some H2 sections may have ZERO charts; data-rich H2/H3 areas may have 2. Do NOT mechanically place exactly one chart per H2 — that produces a templated, AI-detected cadence. Skip sections that don't need data support.
- Never assign more than two charts to a single H2/H3 target.
- Generate ${VISUAL_DENSITY_GUIDE[density]}.`,
            prompt: `Topic: ${brief.title}
Industry: ${brief.aiContext.industry}
Geography: ${brief.geography}
Language: ${brief.workspaceLocale}

${formatVisualSourceContextWithSources(getPromptResearchSources(factSheet, evergreenSourcePass?.sources ?? []))}

${headingEnum}

RESEARCH:
${research}

BLOG DRAFT (may be truncated; the H2/H3 target list above is authoritative for placement_hint):
${String(blogPost.content_markdown || "").slice(0, 12000)}

Return JSON only.`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_visual_charts" });
        const parsed = extractJsonObject(resultText);
        return sanitizeVisualBlocks(parsed.charts, "chart");
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.error("[generateChartBlocks] Failed:", providerError.toJSON());
        console.error("[generateChartBlocks] Raw text:", resultText);
        return [];
    }
}

async function generateDiagramBlocks(brief: DraftBrief, research: string, blogPost: Record<string, unknown>, ctx: MeterCtx, factSheet: CanonicalFactSheet | null, evergreenSourcePass: EvergreenResearchSourcePass | null, headings: VisualPlacementHeading[]): Promise<BlogVisualBlock[]> {
    let resultText = "";
    const asciiDiagramIntents = extractAsciiDiagramIntents(String(blogPost.content_markdown || ""));
    try {
        const density = brief.visual_density || "balanced";
        const headingEnum = formatHeadingEnum(headings);
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are a strategic information architect for premium SEO blog content. Return a single valid JSON object only.

Schema:
{
  "diagrams": [
    {
      "id": "stable-kebab-case-id",
      "type": "diagram",
      "diagram_type": "relational|flowchart|timeline|funnel|framework|comparison_matrix",
      "system_archetype": "causal_loop|reinforcing_loop|balancing_loop|limits_to_growth|fixes_that_fail|shifting_the_burden|success_to_the_successful|tragedy_of_the_commons|escalation|growth_and_underinvestment|system_map (relational diagrams only)",
      "feedback_type": "reinforcing|balancing|mixed|none (relational diagrams only)",
      "title": "string",
      "description": "string",
      "caption": "string",
      "source_label": "publisher name when one external source backs the diagram; otherwise leave empty",
      "source_url": "exact https:// source URL when the diagram depends on one external source; otherwise leave empty",
      "evidence": {
        "claim_id": "stable claim id",
        "claim_text": "specific framework/synthesis/source claim represented by the diagram",
        "evidence_type": "author_framework|author_synthesis|verified_statistic|time_sensitive_benchmark|forecast|internal_estimate|unsupported",
        "source_quality": "primary|near_primary|secondary|vendor|internal|unknown",
        "source_label": "publisher/framework label when external, otherwise empty",
        "source_url": "exact https:// source URL only when the diagram directly maps one external framework/source",
        "publication_date": "YYYY-MM-DD or YYYY when relevant",
        "metric_definition": "metric/process definition when relevant",
        "geography_and_sample": "geography/sample context when relevant",
        "confidence": "high|medium|low",
        "source_note": "say if this is author framework/synthesis and not external proof"
      },
      "seo_alt": "descriptive alt text",
      "placement_hint": "EXACT text of the H2 or H3 heading from the BLOG DRAFT where this diagram belongs (no leading ##/###, no quotes). REQUIRED — must be copied verbatim from one of the H2/H3 targets present in the draft so it can be placed inline near the relevant narrative or nested subsection.",
      "mermaid": "simple Mermaid syntax optional",
      "nodes": [
        { "id": "short-id", "label": "2-5 word label", "description": "one concise explanatory sentence", "node_type": "factor|stock|flow|actor|boundary|outcome" }
      ],
      "edges": [
        { "from": "node-id", "to": "node-id", "label": "1-3 word relationship", "polarity": "positive|negative|neutral", "delay": "boolean optional" }
      ]
    }
  ]
}

Rules:
${VISUAL_EVIDENCE_PROMPT_CONTRACT}

- Generate true diagrams only. Do NOT convert statistics, rankings, KPI lists, or table-like facts into diagrams; those belong to charts.
- RAW DIAGRAM CONVERSION (mandatory): every detected raw draft diagram intent listed in the prompt MUST become one structured diagram object. Copy its REQUIRED STRUCTURED DIAGRAM ID exactly, preserve its concepts as nodes/edges or comparison options, and use its containing heading as placement_hint. Never echo the raw text, ASCII connectors, or code fence. These conversions take priority over the normal density target.
- Prefer relational diagrams for blog posts. For every article, first look for a specific set of 3-8 interacting variables, actors, resources, constraints, or outcomes whose relationships explain the topic better than a list. When that structure exists, emit a relational diagram before considering a flowchart, timeline, funnel, framework, or comparison matrix.
- Do not force a diagram onto unrelated prose. Return {"diagrams":[]} only when the article has no defensible relationship, feedback loop, sequence, timeline, funnel, or decision structure. Templated "Pillar 1 / Pillar 2 / Pillar 3" or "Step 1 / Step 2 / Step 3" cards on every section are an AI-detection tell.
- Node labels MUST be specific to the article (e.g. "Vendor SOC 2 review", "Quarterly model audit"). Never use generic placeholders like "Pillar 1", "Step 1", "Phase 1", "Foundation", "Strategy", "Execution" — those read as scaffolding, not insight.
- Every diagram must have one clear logic type:
  - relational: 3-8 system elements connected by 2-12 explicit relationships. Use this as the default for causal models, feedback loops, system archetypes, stakeholder/resource maps, and interactions between constraints and outcomes. Select the closest system_archetype and feedback_type. Use polarity "positive" when variables move in the same direction, "negative" when they move in opposite directions, and "neutral" for non-causal structural links. Mark delay only when the effect is materially delayed. Include a closed loop only when the narrative supports one; do not manufacture causality.
  - flowchart: 3-6 sequential steps with edges connecting each step in order.
  - timeline: 3-6 chronological milestones. Node labels should begin with a time/order marker when relevant.
  - funnel: 3-5 narrowing conversion/decision stages from broad to specific.
  - framework: 3-6 specifically-named components around one central concept; use edges only when relationships are directional. AVOID generic "pillar" language in node labels. The renderer no longer adds "Pillar N" kicker labels — your node labels carry the entire weight, so they must be specific.
  - comparison_matrix: 2-4 comparable options or dimensions; avoid if it would be better as a numeric chart. Describe each option directly in its node label and description — do NOT produce nested sub-nodes named "Advantages", "Disadvantages", "Pros", "Cons", "Best For", "Ideal Use Cases", or any other generic sub-section label. Those generic templated sub-categories render as a structured comparison card that reads as AI scaffolding. One option = one node = one specific description.
- Keep node labels short: maximum 5 words. Put detail in description.
- Keep descriptions practical and non-overlapping.
- Edge labels must describe a relationship, not repeat node names.
- Every edge endpoint must exactly match one node id. Avoid duplicate edges and self-links.
- A systems archetype is an explanatory author model unless the research explicitly maps an external published model. Keep its evidence_type as author_framework or author_synthesis and do not present inferred causality as verified external proof.
- Do not use Markdown formatting in any JSON string field. No **bold**, _italic_, bullet syntax, markdown links, or backticks.
- If you cannot identify a clear process, timeline, funnel, framework, or decision map, return {"diagrams":[]}.
- Mermaid must be simple: flowchart TD only, no HTML, no links, no markdown tables.
- Always provide nodes and edges so the UI has a reliable visual fallback.
- If the diagram is based on one identifiable external framework/source, include source_url with the exact page URL.
- Author frameworks/syntheses MUST use evidence_type author_framework or author_synthesis, source_quality internal, and a source_note that says it is not external proof. Do not display them as external evidence.
- Diagrams should not carry exact quantitative proof. If the diagram depends on exact numbers, return a chart instead.
- NEVER use placeholder source labels. If no external source backs the diagram, leave source_label and source_url EMPTY — a post-generation pass will look up a real URL automatically.
- Do not cite a publisher in source_label unless source_url contains the exact source page.
- INLINE PLACEMENT (critical): set placement_hint to the EXACT text of one heading from the AVAILABLE VISUAL PLACEMENT TARGETS list in the prompt — either a listed H2 or a listed H3. Copy the target text verbatim, no "## " or "### " prefix, no H2/H3 label, no parenthetical parent context, no quotes, no paraphrase. The renderer uses this to interleave each diagram inside its narrative section. Prefer a relevant H3 when the diagram clarifies a nested process, framework, comparison, or timeline; use the parent H2 only when it clarifies the whole section.
- Place diagrams near relevant nested subsections, not just broad parent sections. Diagrams whose hint does not match any listed H2/H3 will be scattered as filler — avoid that.
- Distribute diagrams where they actually clarify the narrative. Some H2 sections will have ZERO diagrams; sections with a real process or framework may have 2. Do NOT mechanically place exactly one diagram per H2 — that produces a templated, AI-detected cadence. Skip sections that read better as pure prose.
- Never assign more than two diagrams to a single H2/H3 target.
- Generate ${VISUAL_DENSITY_GUIDE[density]}, but prefer fewer clear diagrams over confusing diagrams.`,
            prompt: `Topic: ${brief.title}
Industry: ${brief.aiContext.industry}
Geography: ${brief.geography}
Language: ${brief.workspaceLocale}

${formatVisualSourceContextWithSources(getPromptResearchSources(factSheet, evergreenSourcePass?.sources ?? []))}

${headingEnum}

RESEARCH:
${research}

RAW DRAFT DIAGRAM INTENTS THAT MUST BECOME STRUCTURED VISUALS:
${formatAsciiDiagramIntentsForPrompt(asciiDiagramIntents)}

BLOG DRAFT (may be truncated; the H2/H3 target list above is authoritative for placement_hint):
${String(blogPost.content_markdown || "").slice(0, 12000)}

Return JSON only.`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_visual_diagrams" });
        const parsed = extractJsonObject(resultText);
        const generated = sanitizeVisualBlocks(parsed.diagrams, "diagram");
        const generatedIds = new Set(generated.map((block) => block.id));
        const fallbacks = asciiDiagramIntents
            .filter((intent) => !generatedIds.has(`diagram_${intent.id}`))
            .map(buildAsciiDiagramFallback);
        return fallbacks.length
            ? [...generated, ...sanitizeVisualBlocks(fallbacks, "diagram")]
            : generated;
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.error("[generateDiagramBlocks] Failed:", providerError.toJSON());
        console.error("[generateDiagramBlocks] Raw text:", resultText);
        return sanitizeVisualBlocks(
            asciiDiagramIntents.map(buildAsciiDiagramFallback),
            "diagram",
        );
    }
}

async function generateVideoScript(brief: DraftBrief, research: string, ctx: MeterCtx): Promise<Record<string, unknown>> {
    const durationGuide: Record<DraftBrief["length"], string> = {
        short: "2-3 minute",
        medium: "5-7 minute",
        long: "10-15 minute",
        "deep-dive": "20-30 minute",
    };
    let resultText = "";
    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are an expert YouTube and video scriptwriter specializing in the ${brief.aiContext.industry} sector.
Your core brand voice is: ${brief.aiContext.brandVoice}
Your target audience is: ${brief.aiContext.targetAudience}
${localeInstruction(brief.workspaceLocale)}

${brief.aiSystemContext}

You MUST follow the active workspace business context above before generating any output.

Your scripts should sound conversational and dynamic. Write how a real creator actually speaks on camera, with natural pauses, relatable analogies, strong hooks, and direct audience engagement. The voice MUST adapt to the title and topic.

${HUMAN_VOICE_RULES}

IMPORTANT INSTRUCTION: You MUST return your ENTIRE response as a single, valid, parseable JSON object matching this schema.
CRITICAL: You MUST properly escape all double quotes inside your string values (e.g., use \\" instead of ") or use single quotes instead. Unescaped quotes will crash the parser.

{
  "title": "string",
  "scenes": [
    {
      "scene_number": 1,
      "visuals": "string (clear, creative visual directions)",
      "dialogue": "string (conversational, human-sounding dialogue)",
      "estimated_seconds": 10
    }
  ]
}`,
            prompt: `Using the research below, write a ${durationGuide[brief.length]} video script. Return the JSON object.
Focus on pacing, human empathy, and keeping the viewer hooked without sounding over-produced or robotic.
Title: ${brief.title}

RESEARCH CONTEXT:
${research}`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_video_script" });
        const match = resultText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON object found in response");
        return humanizeDeep(JSON.parse(match[0]) as Record<string, unknown>, ["slug", "url", "id", "type"]);
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.warn("[generateVideoScript] generation failed:", providerError.toJSON());
        return {};
    }
}

async function generateLinkedInPost(brief: DraftBrief, research: string, ctx: MeterCtx): Promise<Record<string, unknown>> {
    let resultText = "";
    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are a top-tier LinkedIn ghostwriter for executives in the ${brief.aiContext.industry} sector.
Your core brand voice is: ${brief.aiContext.brandVoice}
${localeInstruction(brief.workspaceLocale)}

${brief.aiSystemContext}

You MUST follow the active workspace business context above before generating any output.

Your posts should be highly engaging. Write with actual perspective, contrarian insights where the topic supports it, and clear, punchy formatting. The personality MUST shift to match the topic and title. Use line breaks strategically for readability. Avoid excessive emojis.

${HUMAN_VOICE_RULES}

IMPORTANT INSTRUCTION: You MUST return your ENTIRE response as a single, valid JSON object matching this schema.
CRITICAL: You MUST properly escape all double quotes inside your string values (e.g., use \\" instead of ") or use single quotes instead.

{
  "posts": [
    {
      "hook": "string (a scroll-stopping, intensely human-written hook)",
      "body": "string (insightful, fluff-free body paragraphs, spaced nicely)",
      "cta": "string (natural, conversational call to action)",
      "hashtags": ["string"]
    }
  ]
}`,
            prompt: `Write 2 distinctly different LinkedIn post variations based on this research. One should be story-driven and the other more analytical, but both MUST feel deeply human and authentic.
Topic: ${brief.title}
RESEARCH: ${research}

Return the JSON object.`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_linkedin" });
        const match = resultText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON object found in response");
        return humanizeDeep(JSON.parse(match[0]) as Record<string, unknown>, ["slug", "url", "id", "type"]);
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.warn("[generateLinkedInPost] generation failed:", providerError.toJSON());
        return {};
    }
}

async function generateTwitterThread(brief: DraftBrief, research: string, ctx: MeterCtx): Promise<Record<string, unknown>> {
    let resultText = "";
    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are a highly influential X/Twitter content creator in the ${brief.aiContext.industry} space.
Your brand voice is: ${brief.aiContext.brandVoice}
${localeInstruction(brief.workspaceLocale)}

${brief.aiSystemContext}

You MUST follow the active workspace business context above before generating any output.

Your writing style is sharp and insightful, with punchy pacing and a casual yet authoritative tone. Every tweet must provide stand-alone value while pulling the reader to the next.

${HUMAN_VOICE_RULES}

IMPORTANT INSTRUCTION: You MUST return your ENTIRE response as a single, valid JSON object matching this schema.
CRITICAL: You MUST properly escape all double quotes inside your string values (e.g., use \\" instead of ") or use single quotes instead.

{
  "thread": [
    {
      "position": 1,
      "text": "string (max 280 chars, human and engaging)"
    }
  ]
}`,
            prompt: `Write a viral 5-part Twitter/X thread. Make the first tweet an irresistible hook. No robotic summaries; keep it human, highly opinionated, and dynamic.
Topic: ${brief.title}
RESEARCH: ${research}

Return the JSON object.`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_twitter" });
        const match = resultText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON object found in response");
        return humanizeDeep(JSON.parse(match[0]) as Record<string, unknown>, ["slug", "url", "id", "type"]);
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.warn("[generateTwitterThread] generation failed:", providerError.toJSON());
        return {};
    }
}

async function generateInstagramPost(brief: DraftBrief, research: string, ctx: MeterCtx): Promise<Record<string, unknown>> {
    let resultText = "";
    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are a cutting-edge Instagram content strategist for brands targeting: ${brief.aiContext.targetAudience}.
Your sector is: ${brief.aiContext.industry}.
Your voice is: ${brief.aiContext.brandVoice}.
${localeInstruction(brief.workspaceLocale)}

${brief.aiSystemContext}

You MUST follow the active workspace business context above before generating any output.

Your captions and carousel texts should feel trendy and relatable. Speak directly to the community with a personality that fits the topic and title. Use emojis naturally, not excessively.

${HUMAN_VOICE_RULES}

IMPORTANT INSTRUCTION: You MUST return your ENTIRE response as a single, valid JSON object matching this schema.
CRITICAL: You MUST properly escape all double quotes inside your string values (e.g., use \\" instead of ") or use single quotes instead.

{
  "variations": [
    {
      "caption": "string (human, engaging, community-focused)",
      "hashtags": ["string"],
      "slides": [
        { "slide_number": 1, "text": "string short snappy text for image", "visual_idea": "string" }
      ]
    }
  ]
}`,
            prompt: `Create an Instagram carousel (5 slides) plus a highly engaging caption variation. The tone MUST be conversational, visual, and completely naturally flowing without sounding like an AI.
Topic: ${brief.title}
RESEARCH: ${research}

Return the JSON object.`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_instagram" });
        const match = resultText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON object found in response");
        return humanizeDeep(JSON.parse(match[0]) as Record<string, unknown>, ["slug", "url", "id", "type"]);
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.warn("[generateInstagramPost] generation failed:", providerError.toJSON());
        return {};
    }
}

/**
 * Newsletter issue generator — produces a short, scannable, inbox-friendly
 * format derived from the same research as the blog post.
 *
 * Why this exists: until this was added, the only "long-form" output the
 * orchestrator emitted was the SEO blog post. The newsletter campaign flow
 * (`createCampaignFromContentItem`) tried to load
 * `metadata.generated_formats.newsletter_issue`, found nothing, and silently
 * fell back to shipping the raw 5000-word article as the email body. The
 * user reported the resulting email reading like a wall of text — which it
 * was. This produces the format the newsletter expected.
 *
 * Style targets (newsletter best practice, not blog best practice):
 * - One hero idea, not a comprehensive overview
 * - Conversational opener, not a thesis statement
 * - 250-450 words total, not 1500+
 * - 3 short sections max, each scannable in 5 seconds
 * - One clear "what's next" line at the end
 * - No `{{visual:...}}` placeholders (email can't render them cleanly)
 * - Markdown headings stop at H3 (no walls of nested structure)
 *
 * Output is plain markdown — the renderer in
 * src/features/newsletter/lib/markdown-to-email-html.ts converts it to
 * email-safe HTML at campaign-create and dispatch time.
 */
async function generateNewsletterIssue(brief: DraftBrief, research: string, ctx: MeterCtx): Promise<Record<string, unknown>> {
    let resultText = "";
    try {
        const { text, usage } = await generateText({
            model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
            system: `You are an email newsletter writer for executives in the ${brief.aiContext.industry} sector.
Your brand voice is: ${brief.aiContext.brandVoice}
${localeInstruction(brief.workspaceLocale)}

${brief.aiSystemContext}

You MUST follow the active workspace business context above before generating any output.

You are writing for an INBOX, not a website. The reader is on their phone,
between meetings, has 60 seconds, and three other emails to triage. If the
first sentence doesn't land, they're gone.

NEWSLETTER FORMAT RULES — non-negotiable:
- 250–450 words total. Not more. Newsletters that feel like blog posts get unsubscribed.
- One hero idea. Pick the single most useful thing from the research and lead with it.
- Conversational opener (1–2 sentences). NEVER start with a thesis statement or "Businesses today are..." filler.
- 2–3 short sections max. Each section ≤ 3 short paragraphs. Use ### for section headers; no H1, no H2.
- One bullet list is fine if it earns its place. No more than 5 bullets.
- End with one clear "what's next" line — a single sentence that tells the reader what to do with the information.
- NO {{visual:...}} placeholders. Email cannot render them. Reference visuals in prose if needed ("the chart in the full piece shows…") and link the article instead.
- NO em-dashes used as faux-sophistication ("—"). Use commas, parens, or a new sentence.
- NO repeated subject-verb constructions across sentences.
- NO LLM tells: "in today's fast-paced world", "the importance of cannot be overstated", "in conclusion", "let's dive in", "leverage", "robust", "seamless", "holistic". Cut them.

${HUMAN_VOICE_RULES}

IMPORTANT: Return your ENTIRE response as a single, valid JSON object matching this schema.
CRITICAL: Properly escape all double quotes inside string values.

{
  "subject_lines": ["string (≤55 chars, 3 distinct options)", "string", "string"],
  "preheader": "string (50–110 chars, complements the subject; preview-pane teaser)",
  "body_markdown": "string (the full newsletter body, plain markdown, 250–450 words)"
}`,
            prompt: `Write a newsletter issue derived from this research. The reader has 60 seconds.
Topic: ${brief.title}
Keywords: ${brief.keywords.join(", ")}
RESEARCH: ${research}

Return the JSON object.`,
        });
        resultText = text;
        await meterCall(ctx, STRUCTURED_MODEL_ALIAS, usage, { phase: "generate_newsletter_issue" });
        const match = resultText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON object found in response");
        const parsed = humanizeDeep(JSON.parse(match[0]) as Record<string, unknown>, ["slug", "url", "id", "type"]);
        // Defensive: if the model emitted visual placeholders despite the
        // prompt, scrub them so they never reach the renderer in the
        // newsletter path. The blog path keeps them; this path does not.
        if (typeof parsed.body_markdown === "string") {
            parsed.body_markdown = parsed.body_markdown.replace(/\{\{\s*visual:[^}]+\}\}/g, "").replace(/\n{3,}/g, "\n\n").trim();
        }
        return parsed;
    } catch (error) {
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(STRUCTURED_MODEL_ALIAS).provider,
            modelAlias: STRUCTURED_MODEL_ALIAS,
            modelId: getModelMetadata(STRUCTURED_MODEL_ALIAS).modelId,
        });
        console.warn("[generateNewsletterIssue] generation failed:", providerError.toJSON());
        return {};
    }
}

export async function POST(req: NextRequest) {
    let generationRun: DraftGenerationRunHandle | null = null;
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rawRequest = await req.json().catch(() => null);
        const parsedRequest = parseDraftGenerationRequest(rawRequest);
        if (!parsedRequest.success) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const requestData = parsedRequest.data;
        const opportunityId = requestData.opportunity_id ?? null;
        const planId = requestData.plan_id ?? null;
        const requestedLocale = requestData.locale;

        const context = await resolveWorkspaceContext();
        if (!context || !context.activeWorkspace || !context.activeThemeVersion) {
            return NextResponse.json({ error: "No active workspace or theme bound" }, { status: 400 });
        }

        const activeWorkspace = context.activeWorkspace;
        const activeThemeVersion = context.activeThemeVersion;

        if (!context.effectiveCapabilities.includes("content.write")) {
            return NextResponse.json(
                { error: "Forbidden: missing content.write capability." },
                { status: 403 },
            );
        }

        if (!context.productFeatures.aiGeneration) {
            return NextResponse.json(
                { error: "AI generation is only available on Pro workspaces." },
                { status: 403 },
            );
        }

        const workspaceId = activeWorkspace.id;
        const rateLimit = await checkAiRateLimitPg(workspaceId, ROUTE_NAME, { maxPerWindow: 10 });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again shortly." },
                { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
            );
        }

        await assertSufficientAiBalance(workspaceId);

        const meterCtx: MeterCtx = { workspaceId, profileId: user.id };
        const resolvedTemplateId =
            activeWorkspace.legacy_template_id
            ?? activeThemeVersion.theme_key
            ?? activeThemeVersion.theme_id
            ?? null;

        if (!resolvedTemplateId) {
            return NextResponse.json(
                { error: "Unable to resolve template_id from active workspace/theme binding" },
                { status: 400 },
            );
        }

        const themeConfig = getThemeManifestConfig(context);
        const aiContext = extractThemeAiContext(themeConfig);
        const aiSystemContext = extractThemeAiSystemContext(themeConfig);

        if (!aiContext) {
            return NextResponse.json({ error: "Active theme is missing AI Context" }, { status: 400 });
        }

        generationRun = await startDraftGenerationRun({
            supabase,
            workspaceId,
            profileId: user.id,
            requestedFormats: requestData.content_types,
            inputSummary: {
                title: requestData.title,
                locale: requestedLocale ?? activeWorkspace.default_locale,
                requestedFormats: requestData.content_types,
                opportunityId,
                planId,
            },
        });
        const activeGenerationRun = generationRun;

        const brief = await runDraftGenerationPhase(
            activeGenerationRun,
            "brief_validation",
            async (): Promise<DraftBrief> => ({
                title: requestData.title,
                keywords: requestData.keywords,
                narrative_style: requestData.narrative_style,
                length: requestData.length,
                content_types: requestData.content_types,
                geography: requestData.geography,
                generate_charts: requestData.generate_charts,
                generate_diagrams: requestData.generate_diagrams,
                visual_density: requestData.visual_density,
                author_id: user.id,
                aiContext,
                aiSystemContext: aiSystemContext
                    || "Active Workspace Business Context: unavailable.",
                workspaceLocale: resolveGenerationLocale({
                    requested: requestedLocale,
                    workspaceDefault: activeWorkspace.default_locale,
                }),
            }),
            (validatedBrief) => ({
                locale: validatedBrief.workspaceLocale,
                requestedFormats: validatedBrief.content_types,
                templateId: resolvedTemplateId,
            }),
        );

        return runWithWorkspaceAiConfig(workspaceId, async () => {
            console.log(`[generate-draft] Starting: "${brief.title}" — types: ${brief.content_types.join(", ")}`);
            console.log("[generate-draft] Phase 1: Researching...");

            const evidencePhase = await runDraftGenerationPhase(
                activeGenerationRun,
                "evidence_retrieval",
                async () => {
                    const sourceContext = await fetchSeoSourceContext(
                        supabase,
                        workspaceId,
                        { planId, opportunityId },
                    );
                    applySeoSourceContextToBrief(brief, sourceContext);

                    const { data: inventory } = await supabase
                        .from("content_items")
                        .select("slug, type, title, locale")
                        .eq("workspace_id", workspaceId)
                        .eq("status", "published");

                    const allowedLinks = (inventory ?? [])
                        .filter((item) => (item.locale ?? "en") === brief.workspaceLocale)
                        .map((item) => {
                            const url = buildInternalContentHref({
                                slug: item.slug,
                                type: item.type,
                                locale: item.locale || brief.workspaceLocale,
                            });
                            return url
                                ? { title: item.title, url, type: item.type }
                                : null;
                        })
                        .filter((link): link is NonNullable<typeof link> => link !== null);
                    const allowedLinksText = allowedLinks.length > 0
                        ? allowedLinks
                            .map((link) => `- "${link.title}" (type: ${link.type}) → URL: ${link.url}`)
                            .join("\n")
                        : "No existing published items in this locale. Suggest no internal links.";

                    return {
                        sourceContext,
                        allowedLinksText,
                        allowedUrls: allowedLinks.map((link) => link.url),
                        researchOutput: await runResearch(brief, meterCtx),
                    };
                },
                (result) => ({
                    sourceKind: result.sourceContext?.kind ?? null,
                    internalLinkTargets: result.allowedUrls.length,
                    evidenceClaims: result.researchOutput.evidencePack?.claims.length ?? 0,
                    factSheetSources: result.researchOutput.factSheet?.sources.length ?? 0,
                    freshnessRisk: result.researchOutput.freshnessRisk,
                }),
            );
            const {
                sourceContext,
                allowedLinksText,
                allowedUrls,
                researchOutput,
            } = evidencePhase;
            const { prose: research, factSheet, freshnessRisk, evergreenSourcePass, evidencePack } = researchOutput;

            const articleBlueprint = await runDraftGenerationPhase(
                activeGenerationRun,
                "blueprint",
                async (): Promise<ArticleBlueprint | null> => {
                    if (!brief.content_types.includes("blog_post")) return null;
                    console.log("[generate-draft] Phase 1.5: Building SEO article blueprint...");
                    return buildArticleBlueprint(
                        brief,
                        research,
                        sourceContext,
                        factSheet,
                        evergreenSourcePass,
                        evidencePack,
                        meterCtx,
                        allowedLinksText,
                    );
                },
                (blueprint) => ({
                    generated: Boolean(blueprint),
                    sectionCount: blueprint?.sections.length ?? 0,
                    faqCount: blueprint?.faqQuestions.length ?? 0,
                }),
            );

            console.log("[generate-draft] Phase 1: Research complete. Moving to Phase 2...");

            await beginDraftGenerationPhase(activeGenerationRun, "format_generation");
            const generationTasks: Record<string, Promise<Record<string, unknown>>> = {};

            // Pull a workspace-supplied client anecdote for the writer to weave in.
            // This is the single highest-signal humanizing move per the AI-detection
            // review: a specific, named scenario the model could not have invented.
            // Returns null when the workspace has no eligible snippets — the
            // prompt is structured to degrade gracefully in that case.
            let caseSnippet: CaseSnippet | null = null;
            if (brief.content_types.includes("blog_post")) {
                try {
                    caseSnippet = await pickCaseSnippetForBrief({
                        workspaceId,
                        keywords: brief.keywords,
                        industry: brief.aiContext.industry,
                        title: brief.title,
                    });
                } catch (snippetErr) {
                    console.warn("[generate-draft] case snippet lookup failed (continuing without):", snippetErr);
                }
            }

            if (brief.content_types.includes("blog_post")) {
                generationTasks.blog_post = generateBlogPost(brief, research, meterCtx, factSheet, evergreenSourcePass, caseSnippet, articleBlueprint, sourceContext, allowedLinksText);
            }
            if (brief.content_types.includes("video_script")) {
                generationTasks.video_script = generateVideoScript(brief, research, meterCtx);
            }
            if (brief.content_types.includes("social_linkedin")) {
                generationTasks.social_linkedin = generateLinkedInPost(brief, research, meterCtx);
            }
            if (brief.content_types.includes("social_twitter")) {
                generationTasks.social_twitter = generateTwitterThread(brief, research, meterCtx);
            }
            if (brief.content_types.includes("social_instagram")) {
                generationTasks.social_instagram = generateInstagramPost(brief, research, meterCtx);
            }
            // Newsletter issue runs whenever requested, OR implicitly when a blog
            // post is requested. The implicit path is what closes the
            // "create campaign from this article" loop without forcing every
            // brief author to remember to tick the newsletter box.
            const wantsNewsletter = brief.content_types.includes("newsletter_issue") || brief.content_types.includes("blog_post");
            if (wantsNewsletter) {
                generationTasks.newsletter_issue = generateNewsletterIssue(brief, research, meterCtx);
            }

            const taskKeys = Object.keys(generationTasks);
            const taskResults = await Promise.all(Object.values(generationTasks));

            let generatedFormats: Record<string, unknown> = {};
            taskKeys.forEach((key, i) => {
                generatedFormats[key] = taskResults[i];
            });

            const normalizedFormats = normalizeGeneratedDraftFormats({
                generatedFormats,
                requestedFormats: brief.content_types,
                evidencePack: serializeEvidencePackForMetadata(evidencePack),
            });
            generatedFormats = normalizedFormats.generatedFormats;
            const derivedOutputs = normalizedFormats.derivedOutputs;

            // Record snippet usage on successful blog generation so the next pick
            // rotates to a less-used story. Best-effort, never blocks the response.
            if (caseSnippet && generatedFormats.blog_post) {
                void recordCaseSnippetUsage(caseSnippet.id).catch((err) =>
                    console.warn("[generate-draft] failed to record case snippet usage:", err),
                );
            }

            console.log("[generate-draft] Phase 2: All formats generated.");
            await completeDraftGenerationPhase(
                activeGenerationRun,
                "format_generation",
                {
                    generatedFormats: Object.keys(generatedFormats),
                    derivedOutputs,
                },
            );

            const shouldGenerateCharts = brief.generate_charts !== false && brief.content_types.includes("blog_post");
            const shouldGenerateDiagrams = brief.generate_diagrams !== false && brief.content_types.includes("blog_post");
            let visualBlocks: BlogVisualBlock[] = [];
            await beginDraftGenerationPhase(activeGenerationRun, "visual_enrichment", {
                chartsRequested: shouldGenerateCharts,
                diagramsRequested: shouldGenerateDiagrams,
            });

            interface BlogPostResult {
                content_markdown?: string;
                title?: string;
                seo?: Record<string, unknown>;
                excerpt?: string;
            }

            const blogData = (generatedFormats.blog_post as BlogPostResult) || {};
            if (generatedFormats.blog_post && (shouldGenerateCharts || shouldGenerateDiagrams)) {
                console.log("[generate-draft] Phase 3: Generating visual enrichment...");
                // Authoritative H2/H3 list extracted from the FULL markdown (not the
                // truncated body we hand to the LLM). Both generators receive the
                // same enum so they can target subsections that fall outside the
                // 12 000-char body window and so they can coordinate spread by
                // looking at the same set of placement targets.
                const visualPlacementHeadings = typeof blogData.content_markdown === "string"
                    ? extractVisualPlacementHeadings(blogData.content_markdown)
                    : [];
                const h2Count = visualPlacementHeadings.filter((heading) => heading.level === 2).length;
                const h3Count = visualPlacementHeadings.filter((heading) => heading.level === 3).length;
                console.log(`[generate-draft] Phase 3: ${h2Count} H2 and ${h3Count} H3 headings available for visual placement.`);
                const [charts, diagrams] = await Promise.all([
                    shouldGenerateCharts ? generateChartBlocks(brief, research, blogData as Record<string, unknown>, meterCtx, factSheet, evergreenSourcePass, visualPlacementHeadings) : Promise.resolve([]),
                    shouldGenerateDiagrams ? generateDiagramBlocks(brief, research, blogData as Record<string, unknown>, meterCtx, factSheet, evergreenSourcePass, visualPlacementHeadings) : Promise.resolve([]),
                ]);
                const rawBlocks = [...charts, ...diagrams];
                // Backfill source URLs for any visual the LLM left unattributed.
                // The pass tries the verified factSheet first (free) and only
                // burns a Tavily call when nothing matches. Replaces vague
                // placeholder source labels with a real publisher link.
                visualBlocks = await attachSourcesToVisualBlocks(rawBlocks, brief, factSheet, evergreenSourcePass?.sources ?? [], evidencePack);
                const attributed = visualBlocks.filter((b) => Boolean(b.source_url)).length;
                console.log(`[generate-draft] Phase 3: Generated ${visualBlocks.length} visual blocks (${attributed} with source URL).`);
            }
            await completeDraftGenerationPhase(
                activeGenerationRun,
                "visual_enrichment",
                {
                    visualBlockCount: visualBlocks.length,
                    attributedCount: visualBlocks.filter((block) => Boolean(block.source_url)).length,
                },
            );

            await beginDraftGenerationPhase(activeGenerationRun, "editorial_validation");
            let primaryContent = normalizeMarkdownForRender(String(
                visualBlocks.length && typeof blogData.content_markdown === "string"
                    ? injectVisualShortcodes(blogData.content_markdown, visualBlocks)
                    : blogData.content_markdown || (generatedFormats[taskKeys[0]] as string) || "",
            ));
            const finalTitle = blogData.title || brief.title;
            let seoData: Record<string, unknown> = repairSeoTitleWithLockedKeyword(blogData.seo || {}, sourceContext, brief.workspaceLocale);
            const excerptData = blogData.excerpt || "";

            const initialEditorialValidation = validateGeneratedBlogDraft(buildBlogEditorialValidationInput({
                markdown: primaryContent,
                brief,
                title: finalTitle,
                seoData,
                blueprint: articleBlueprint,
                sourceContext,
                visualBlocks,
                factSheet,
                evergreenSourcePass,
                templateId: resolvedTemplateId,
                allowedInternalLinks: allowedUrls,
            }));
            let editorialValidation = initialEditorialValidation;
            let editorialRepairAttempts = 0;
            let editorialRepaired = false;
            let editorialFallbackReason: string | null = null;

            const initialPublicationReadiness = assessBlogEditorialPublicationReadiness(
                initialEditorialValidation,
                {
                    locale: brief.workspaceLocale,
                    scoreFloor: getBlogEditorialPublicPolicy(resolvedTemplateId).publicationScoreFloor,
                },
            );
            if (!initialPublicationReadiness.ready && brief.content_types.includes("blog_post")) {
                console.log("[generate-draft] Final editorial validation found diagnostics; attempting targeted repair", {
                    issueCount: initialEditorialValidation.issues.length,
                    errorCount: initialEditorialValidation.issues.filter((issue) => issue.severity === "error").length,
                });
                const repairResult = await repairBlogDraftAgainstEditorialIssues({
                    markdown: primaryContent,
                    title: finalTitle,
                    seoData,
                    brief,
                    blueprint: articleBlueprint,
                    sourceContext,
                    visualBlocks,
                    factSheet,
                    evergreenSourcePass,
                    validation: initialEditorialValidation,
                    ctx: meterCtx,
                    templateId: resolvedTemplateId,
                    allowedInternalLinks: allowedUrls,
                });
                primaryContent = repairResult.markdown;
                seoData = repairResult.seoData;
                editorialValidation = repairResult.validation;
                editorialRepairAttempts = repairResult.attempts;
                editorialRepaired = repairResult.repaired;
                editorialFallbackReason = repairResult.fallbackReason;
            }

            if (typeof generatedFormats.blog_post === 'object') {
                generatedFormats.blog_post = primaryContent || "";
            }

            let faqs: { question: string; answer: string }[] = [];
            if (brief.content_types.includes("blog_post") && articleBlueprint?.faqQuestions && articleBlueprint.faqQuestions.length > 0) {
                console.log("[generate-draft] Phase 4: Generating FAQ answers...");
                try {
                    const forbiddenPublicTerms = getBlogEditorialPublicPolicy(
                        resolvedTemplateId,
                    ).forbiddenPublicTerms;
                    const { text: faqText, usage: faqUsage } = await generateText({
                        model: resolveTextModel(STRUCTURED_MODEL_ALIAS),
                        system: `You are an SEO structured data assistant. Given a blog post draft and a list of FAQ questions, provide concise, accurate answers for each question based on the post. Return ONLY a JSON object with a 'faqs' array containing objects with 'question' and 'answer' strings. Answer in the exact language of the provided blog post.${forbiddenPublicTerms.length > 0 ? ` Never mention these cross-client or internal terms: ${forbiddenPublicTerms.join(", ")}.` : ""}`,
                        prompt: `Blog Post:\n\n${primaryContent.slice(0, 20000)}\n\nQuestions to answer:\n${articleBlueprint.faqQuestions.map(q => q.question).join("\n")}`,
                    });
                    await meterCall(meterCtx, STRUCTURED_MODEL_ALIAS, faqUsage, { phase: "generate_faq_answers" });
                    const faqParsed = extractJsonObject(faqText);
                    if (Array.isArray(faqParsed.faqs)) {
                        faqs = faqParsed.faqs.filter((f: Record<string, unknown>) => typeof f.question === "string" && typeof f.answer === "string") as { question: string; answer: string }[];
                    }
                } catch (error) {
                    console.warn("[generate-draft] FAQ generation failed", error);
                }
            }

            if (brief.content_types.includes("blog_post")) {
                editorialValidation = validateGeneratedBlogDraft(buildBlogEditorialValidationInput({
                    markdown: primaryContent,
                    brief,
                    title: finalTitle,
                    seoData,
                    blueprint: articleBlueprint,
                    sourceContext,
                    visualBlocks,
                    factSheet,
                    evergreenSourcePass,
                    templateId: resolvedTemplateId,
                    allowedInternalLinks: allowedUrls,
                    faqItems: faqs,
                }));
            }

            assertSafeGeneratedOutput({
                title: finalTitle,
                contentMarkdown: primaryContent,
                seo: seoData,
                excerpt: excerptData,
                faqs,
                generatedFormats,
            });

            const editorialScorecard: EditorialScorecard = buildEditorialScorecard(editorialValidation.issues);
            await completeDraftGenerationPhase(
                activeGenerationRun,
                "editorial_validation",
                {
                    issueCount: editorialValidation.issues.length,
                    errorCount: editorialValidation.issues.filter(
                        (issue) => issue.severity === "error",
                    ).length,
                    repairAttempts: editorialRepairAttempts,
                    repaired: editorialRepaired,
                    faqCount: faqs.length,
                    scorecard: editorialScorecard,
                },
            );

            await beginDraftGenerationPhase(activeGenerationRun, "persistence");
            const slug = await createUniqueContentSlug(supabase, {
                title: finalTitle,
                templateId: resolvedTemplateId,
                locale: brief.workspaceLocale,
                sourceContext,
                blueprint: articleBlueprint,
            });

            // Let's use service role key for insert just in case RLS blocks insert on the server
            // Using standard client has the user's token though, so RLS might be fine.
            // We'll just try standard client first. If that fails, it means RLS.
            const { data: savedItem, error: saveError } = await supabase
                .from("content_items")
                .insert({
                    title: finalTitle,
                    slug,
                    type: "blog",
                    status: "draft",
                    content_markdown: primaryContent,
                    author_id: brief.author_id,
                    workspace_id: workspaceId,
                    template_id: resolvedTemplateId,
                    locale: brief.workspaceLocale,
                    metadata: {
                        faqs,
                        generated_formats: generatedFormats,
                        generation_run_id: activeGenerationRun.id,
                        requested_formats: brief.content_types,
                        derived_outputs: derivedOutputs,
                        research_brief: research,
                        generation_inputs: {
                            keywords: brief.keywords,
                            source_context: compactSourceContextForMetadata(sourceContext),
                            article_blueprint: articleBlueprint,
                            narrative_style: brief.narrative_style,
                            industry: brief.aiContext.industry,
                            length: brief.length,
                            geography: brief.geography,
                            applied_ai_context: brief.aiContext,
                            generate_charts: shouldGenerateCharts,
                            generate_diagrams: shouldGenerateDiagrams,
                            visual_density: brief.visual_density || "balanced",
                        },
                        seo: seoData,
                        excerpt: excerptData,
                        enrichment: {
                            schema_version: 2,
                            generated_at: new Date().toISOString(),
                            visual_blocks: visualBlocks,
                            evidence: visualBlocks.map((block) => normalizeVisualEvidenceAfterSourceAttachment(block, block.evidence)),
                            source_intelligence_evidence_pack: serializeEvidencePackForMetadata(evidencePack),
                            evergreen_source_pass: serializeEvergreenSourcePassForMetadata(evergreenSourcePass),
                            editorial_validation: serializeEditorialValidationForMetadata(
                                editorialValidation,
                                editorialRepairAttempts,
                                editorialRepaired,
                                editorialFallbackReason,
                            ),
                            editorial_scorecard: editorialScorecard,
                            seo_schema: buildSeoSchemaCandidateMetadata({
                                title: finalTitle,
                                slug,
                                markdown: primaryContent,
                                seoData,
                                excerpt: excerptData,
                                brief,
                                blueprint: articleBlueprint,
                                sourceContext,
                                visualBlocks,
                                factSheet,
                                evergreenSourcePass,
                                caseSnippet,
                                validation: editorialValidation,
                            }),
                        },
                        provenance: {
                            source_intelligence_evidence_pack: serializeEvidencePackForMetadata(evidencePack),
                            fallback_fact_sheet: factSheet,
                            fallback_evergreen_source_pass: serializeEvergreenSourcePassForMetadata(evergreenSourcePass),
                            fallback_used: !evidencePack || evidencePack.claims.length === 0 || evidencePack.stale,
                            ...(factSheet ? {
                            fact_sheet: factSheet,
                            checked_at: factSheet.checked_at,
                            freshness_risk: factSheet.freshness_risk,
                            topic_status: factSheet.status,
                            retrieval_mode: factSheet.retrieval_mode,
                            query_rewrites: factSheet.query_rewrites,
                            verification_notes: factSheet.verification_notes,
                            sources: factSheet.sources.slice(0, 10).map(s => ({
                                url: s.url,
                                title: s.title,
                                trust_tier: s.trust_tier,
                                published_date: s.published_date,
                            })),
                            } : {
                            retrieval_mode: evergreenSourcePass?.retrieval_mode ?? "none",
                            freshness_risk: freshnessRisk,
                            evergreen_source_pass: serializeEvergreenSourcePassForMetadata(evergreenSourcePass),
                            }),
                        },
                    },
                })
                .select()
                .single();

            if (saveError) {
                console.error("[generate-draft] Save error:", saveError);
                throw new Error(`Failed to persist generated content: ${saveError.message}`);
            }

            console.log(`[generate-draft] Saved item: ${savedItem.id}`);

            // Back-link the generated content_item to its source strategist opportunity/plan
            // so the SEO control center can show "View draft" and prevent duplicate generation.
            if (opportunityId) {
                const { error: linkError } = await supabase
                    .from("seo_content_opportunities")
                    .update({ draft_content_item_id: savedItem.id, status: "implemented" })
                    .eq("id", opportunityId)
                    .eq("workspace_id", workspaceId);
                if (linkError) console.warn("[generate-draft] opportunity link failed", linkError);
            }
            if (planId) {
                const { error: linkError } = await supabase
                    .from("seo_content_plans")
                    .update({ draft_content_item_id: savedItem.id, status: "in_progress" })
                    .eq("id", planId)
                    .eq("workspace_id", workspaceId);
                if (linkError) console.warn("[generate-draft] plan link failed", linkError);
            }

            await completeDraftGenerationPhase(
                activeGenerationRun,
                "persistence",
                {
                    contentItemId: savedItem.id,
                    slug: savedItem.slug,
                    opportunityLinked: Boolean(opportunityId),
                    planLinked: Boolean(planId),
                },
            );
            await completeDraftGenerationRun(activeGenerationRun, {
                contentItemId: savedItem.id,
                derivedOutputs,
            });

            return NextResponse.json({
                id: savedItem.id,
                title: savedItem.title,
                formats: Object.keys(generatedFormats),
                requested_formats: brief.content_types,
                derived_outputs: derivedOutputs,
                generation_run_id: activeGenerationRun.id,
                visual_blocks: visualBlocks.length,
                research_summary: research.substring(0, 500) + "...",
            });
        });
    } catch (error: unknown) {
        if (generationRun) {
            try {
                await failDraftGenerationRun(generationRun, error);
            } catch (stateError) {
                console.error("[generate-draft] Failed to persist failed run state:", stateError);
            }
        }
        if (error instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: error.message }, { status: 402 });
        }
        if (error instanceof GeneratedOutputSafetyError) {
            return NextResponse.json({ error: error.message }, { status: 422 });
        }
        const providerError = normalizeAiProviderError(error, {
            provider: getModelMetadata(DRAFT_MODEL_ALIAS).provider,
            modelAlias: DRAFT_MODEL_ALIAS,
            modelId: getModelMetadata(DRAFT_MODEL_ALIAS).modelId,
        });
        console.error("[generate-draft] Error:", providerError.toJSON());
        return NextResponse.json({ error: "Failed to generate draft. Please try again." }, {
            status: 500,
        });
    }
}
