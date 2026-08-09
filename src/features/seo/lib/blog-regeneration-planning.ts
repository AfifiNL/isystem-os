import { jaccardSimilarity, tokenizeForOverlap } from "@/features/seo/lib/text-overlap";
import type { BlogDraftLengthTier } from "@/features/content-engine/lib/blog-editorial-validation";
import { BLOG_LENGTH_TIER_RULES } from "@/features/content-engine/lib/blog-editorial-validation";

type SupportedLocale = "en" | "nl" | "ar";

type RegenerationEvidenceSource = {
    id?: string;
    title: string;
    publisher: string | null;
    citationUrl: string;
};

type SeoSnapshot = {
    title: string;
    description: string;
    keywords: string[];
};

export type BlogRegenerationPromptInput = {
    contentId: string;
    currentTitle: string;
    currentMarkdown: string;
    currentSeo: SeoSnapshot;
    generationInputs: Record<string, unknown>;
    researchBrief: unknown;
    evidencePack: unknown;
    publicEvidencePrompt: string;
    gscSignalsPrompt: string;
    internalInventoryPrompt: string;
    visualRequirementsPrompt: string;
    locale: SupportedLocale | string;
    lengthTier: BlogDraftLengthTier;
    existingWordCount: number;
    retryReason?: string;
};

export type BlogRegenerationSimilarityVerdict = {
    acceptable: boolean;
    reason: "distinct" | "near_duplicate" | "insufficient_content";
    similarity: number;
    tokenSimilarity: number;
    shingleSimilarity: number;
    headingSimilarity: number;
};

const MARKDOWN_HEADING_RE = /^#{2,3}\s+(.+)$/gm;
const TOKEN_RE = /\p{L}[\p{L}\p{N}\p{M}]+/gu;
const VISUAL_SHORTCODE_RE = /\{\{visual:[^}]+\}\}/g;
const MARKDOWN_LINK_RE = /\[[^\]]+]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EVIDENCE_SOURCES_H2_RE = /^##\s+(?:Evidence sources|Research sources|Sources)\s*$/i;
const H2_RE = /^##(?!#)\s+\S/;
const NEAR_DUPLICATE_THRESHOLD = 0.9;
const SHINGLE_NEAR_DUPLICATE_THRESHOLD = 0.82;
const HEADING_NEAR_DUPLICATE_THRESHOLD = 0.92;

function normalizeHost(value: string): string {
    try {
        return new URL(value).hostname.replace(/^www\./, "").toLocaleLowerCase();
    } catch {
        return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLocaleLowerCase();
    }
}

function isExternalHttpUrl(value: string, siteHost?: string): boolean {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        return siteHost ? normalizeHost(url.hostname) !== normalizeHost(siteHost) : true;
    } catch {
        return false;
    }
}

function normalizeCitationUrl(value: string, siteHost?: string): string | null {
    if (!isExternalHttpUrl(value, siteHost)) return null;
    try {
        const url = new URL(value);
        url.hash = "";
        if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
        return url.toString();
    } catch {
        return null;
    }
}

function extractExternalMarkdownLinks(markdown: string, siteHost?: string): Set<string> {
    const urls = new Set<string>();
    let match: RegExpExecArray | null;
    MARKDOWN_LINK_RE.lastIndex = 0;
    while ((match = MARKDOWN_LINK_RE.exec(markdown)) !== null) {
        const normalized = normalizeCitationUrl(match[1], siteHost);
        if (normalized) urls.add(normalized);
    }
    return urls;
}

function escapeMarkdownLinkText(value: string): string {
    return value.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim() || "Evidence source";
}

function sourceLabel(source: RegenerationEvidenceSource): string {
    const title = escapeMarkdownLinkText(source.title);
    return source.publisher ? `${title} (${escapeMarkdownLinkText(source.publisher)})` : title;
}

function uniquePublicEvidenceSources(sources: readonly RegenerationEvidenceSource[], siteHost?: string): Array<RegenerationEvidenceSource & { citationUrl: string }> {
    const seen = new Set<string>();
    const out: Array<RegenerationEvidenceSource & { citationUrl: string }> = [];
    sources.forEach((source) => {
        const citationUrl = normalizeCitationUrl(source.citationUrl, siteHost);
        if (!citationUrl) return;
        const key = citationUrl.toLocaleLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ ...source, citationUrl });
    });
    return out;
}

function evidenceSourcesParagraph(sources: ReadonlyArray<RegenerationEvidenceSource & { citationUrl: string }>): string {
    const links = sources.map((source) => `[${sourceLabel(source)}](${source.citationUrl})`).join(", ");
    return `Evidence sources: This regenerated article uses the public source material attached to the original post as citation context${links ? `, including ${links}` : ""}. These references are listed to keep research-led claims inspectable and separate from private workspace knowledge, implementation assumptions, or client-specific outcomes that should not be presented as public evidence.`;
}

function replaceEvidenceSourcesH2(markdown: string, sources: ReadonlyArray<RegenerationEvidenceSource & { citationUrl: string }>): { markdown: string; replaced: boolean } {
    if (sources.length === 0 || !/^##\s+(?:Evidence sources|Research sources|Sources)\s*$/im.test(markdown)) {
        return { markdown, replaced: false };
    }

    const replacement = evidenceSourcesParagraph(sources);
    const lines = markdown.split(/\r?\n/);
    const out: string[] = [];
    let replaced = false;

    for (let index = 0; index < lines.length;) {
        if (EVIDENCE_SOURCES_H2_RE.test(lines[index])) {
            if (!replaced) out.push(replacement);
            replaced = true;
            index += 1;
            while (index < lines.length && !H2_RE.test(lines[index])) {
                index += 1;
            }
            continue;
        }
        out.push(lines[index]);
        index += 1;
    }

    return {
        markdown: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
        replaced,
    };
}

function clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function normalizeMarkdownForSimilarity(markdown: string): string {
    return markdown
        .replace(VISUAL_SHORTCODE_RE, " ")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/\[[^\]]+]\(([^)]+)\)/g, " $1 ")
        .toLocaleLowerCase()
        .normalize("NFKC");
}

function orderedTokens(markdown: string): string[] {
    return normalizeMarkdownForSimilarity(markdown).match(TOKEN_RE) ?? [];
}

function shingles(tokens: readonly string[], size: number): Set<string> {
    const out = new Set<string>();
    if (tokens.length < size) return out;
    for (let index = 0; index <= tokens.length - size; index += 1) {
        out.add(tokens.slice(index, index + size).join(" "));
    }
    return out;
}

function markdownHeadings(markdown: string, locale: string): Set<string> {
    const headings = new Set<string>();
    for (const match of markdown.matchAll(MARKDOWN_HEADING_RE)) {
        const text = match[1]?.replace(/[*_`#]/g, "").trim() ?? "";
        const tokens = [...tokenizeForOverlap(text, locale)].sort();
        if (tokens.length > 0) headings.add(tokens.join(" "));
    }
    return headings;
}

/**
 * Deterministic guard for the review preview: a regeneration can target the
 * same query and reuse the same evidence, but it must not preserve the same
 * paragraph architecture. We combine content-word overlap, ordered 5-gram
 * overlap, and heading overlap so exact or near-exact rewrites are rejected
 * while topic-consistent but structurally new articles can pass.
 */
export function evaluateBlogRegenerationSimilarity(input: {
    currentMarkdown: string;
    regeneratedMarkdown: string;
    locale?: SupportedLocale | string | null;
}): BlogRegenerationSimilarityVerdict {
    const locale = input.locale ?? undefined;
    const currentTokens = orderedTokens(input.currentMarkdown);
    const regeneratedTokens = orderedTokens(input.regeneratedMarkdown);

    if (currentTokens.length < 80 || regeneratedTokens.length < 80) {
        return {
            acceptable: true,
            reason: "insufficient_content",
            similarity: 0,
            tokenSimilarity: 0,
            shingleSimilarity: 0,
            headingSimilarity: 0,
        };
    }

    const tokenSimilarity = jaccardSimilarity(
        tokenizeForOverlap(input.currentMarkdown, locale),
        tokenizeForOverlap(input.regeneratedMarkdown, locale),
    );
    const shingleSimilarity = jaccardSimilarity(shingles(currentTokens, 5), shingles(regeneratedTokens, 5));
    const headingSimilarity = jaccardSimilarity(
        markdownHeadings(input.currentMarkdown, locale ?? ""),
        markdownHeadings(input.regeneratedMarkdown, locale ?? ""),
    );
    const rawSimilarity = clamp(Math.max(
        tokenSimilarity * 0.55 + shingleSimilarity * 0.35 + headingSimilarity * 0.1,
        shingleSimilarity,
    ));
    const nearDuplicate = rawSimilarity >= NEAR_DUPLICATE_THRESHOLD
        || shingleSimilarity >= SHINGLE_NEAR_DUPLICATE_THRESHOLD
        || (headingSimilarity >= HEADING_NEAR_DUPLICATE_THRESHOLD && shingleSimilarity >= 0.62);
    const similarity = nearDuplicate ? Math.max(rawSimilarity, NEAR_DUPLICATE_THRESHOLD) : rawSimilarity;

    return {
        acceptable: !nearDuplicate,
        reason: nearDuplicate ? "near_duplicate" : "distinct",
        similarity,
        tokenSimilarity,
        shingleSimilarity,
        headingSimilarity,
    };
}

export function ensureRegeneratedMarkdownHasEvidenceCitations(input: {
    markdown: string;
    lengthTier: BlogDraftLengthTier;
    publicEvidenceSources: readonly RegenerationEvidenceSource[];
    siteHost?: string;
}): { markdown: string; insertedCitationCount: number; availableCitationCount: number; requiredCitationCount: number } {
    const requiredCitationCount = BLOG_LENGTH_TIER_RULES[input.lengthTier].minResearchCitations;
    const publicSources = uniquePublicEvidenceSources(input.publicEvidenceSources, input.siteHost);
    const evidenceSectionRepair = replaceEvidenceSourcesH2(input.markdown, publicSources.slice(0, Math.max(requiredCitationCount, 1)));
    const markdown = evidenceSectionRepair.markdown;
    const existingLinks = extractExternalMarkdownLinks(markdown, input.siteHost);
    if (existingLinks.size >= requiredCitationCount) {
        return {
            markdown,
            insertedCitationCount: evidenceSectionRepair.replaced ? Math.min(existingLinks.size, requiredCitationCount) : 0,
            availableCitationCount: existingLinks.size,
            requiredCitationCount,
        };
    }

    const sources = publicSources
        .filter((source) => !existingLinks.has(source.citationUrl))
        .slice(0, Math.max(0, requiredCitationCount - existingLinks.size));
    if (sources.length === 0) {
        return {
            markdown,
            insertedCitationCount: evidenceSectionRepair.replaced ? Math.min(existingLinks.size, requiredCitationCount) : 0,
            availableCitationCount: existingLinks.size,
            requiredCitationCount,
        };
    }

    const section = evidenceSourcesParagraph(sources);

    return {
        markdown: `${markdown.trimEnd()}\n\n${section}`.trim(),
        insertedCitationCount: sources.length + (evidenceSectionRepair.replaced ? Math.min(existingLinks.size, requiredCitationCount) : 0),
        availableCitationCount: existingLinks.size + sources.length,
        requiredCitationCount,
    };
}

export function buildBlogRegenerationPrompt(input: BlogRegenerationPromptInput): string {
    const retryBlock = input.retryReason
        ? `\n\nRETRY ESCALATION:\nThe previous regeneration was rejected because ${input.retryReason}. Create a more differentiated version now: replace the outline, intro route, section order, examples, and transitions while preserving source-backed factual constraints.`
        : "";

    return `POST ID: ${input.contentId}

REGENERATION MISSION:
Create a complete replacement article using the full content-generation stack: original requested constraints, research notes, source/evidence collection, SEO intent, visual enrichment requirements, editorial validation rules, and metadata sync requirements.

MANDATORY UNIQUENESS REQUIREMENTS:
- Build a new article architecture, not a paragraph-level paraphrase.
- Create a new outline before drafting: different section order, different intro framing, different examples, different transitions, and a different concluding move.
- Treat the CURRENT MARKDOWN FOR CONTRAST ONLY as a risk checklist for what not to repeat. Do not use it as the main source of prose.
- Preserve the core intent, requested constraints, factual truth, public URL intent, locale, and evidence discipline.
- Preserve required visual shortcode IDs and source/citation constraints, but integrate them into the new architecture where they fit.
- When public evidence sources are provided, include enough exact inline markdown links in the article body or a final prose paragraph that starts with "Evidence sources:" using only those URLs so editorial validation can count the research citations. Do not create a "## Evidence sources" H2.
- Do not describe a source without its markdown link; use the provided public evidence URLs exactly and never invent substitute URLs.
- Keep the article ${input.lengthTier} and approximately the same depth as the current article (current word count about ${input.existingWordCount}).
- Do not invent public URLs, client outcomes, metrics, case studies, or source names.
${retryBlock}

CURRENT TITLE:
${input.currentTitle}

SEO METADATA AND KEYWORDS:
${JSON.stringify(input.currentSeo, null, 2)}

ORIGINAL GENERATION INPUTS:
${JSON.stringify(input.generationInputs, null, 2).slice(0, 7000)}

RESEARCH BRIEF:
${JSON.stringify(input.researchBrief, null, 2).slice(0, 9000)}

SEARCH CONSOLE SIGNALS:
${input.gscSignalsPrompt}

INTERNAL LINK INVENTORY:
${input.internalInventoryPrompt}

SOURCE/EVIDENCE PACK:
${JSON.stringify(input.evidencePack, null, 2).slice(0, 9000)}

PUBLIC EVIDENCE SOURCES:
${input.publicEvidencePrompt}

VISUAL ENRICHMENT REQUIREMENTS:
${input.visualRequirementsPrompt}

CURRENT MARKDOWN FOR CONTRAST ONLY — DO NOT PARAPHRASE THIS STRUCTURE:
${input.currentMarkdown.slice(0, 32000)}

Return a complete regenerated article and synchronized metadata. Keep markdown prose-only: no raw mermaid, no ASCII diagrams, no top-level # H1.`;
}
