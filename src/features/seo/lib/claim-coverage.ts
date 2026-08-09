// Loop C — claim-coverage from persisted fact sheet (zero API cost).
//
// During AI draft generation, `buildFactSheet()` searches live sources via
// Tavily, ranks them by trust tier, and extracts `key_claims` bound to those
// sources. The full sheet is persisted at metadata.provenance.fact_sheet.
//
// Once the article is published, users edit it, and later they open the SEO
// enhance modal. The Tavily-driven external-ref generator re-runs searches
// on sampled paragraphs — but we ALREADY HAVE a claim→source map from the
// fact sheet. This generator reads those claims, checks which ones are still
// uncited in the markdown, and proposes a citation sentence for each uncited
// claim using the source that was paired with it at draft time.
//
// No new Tavily calls. No new Gemini calls. The research cost was paid at
// generation; we are consuming the receipt.

import { randomUUID } from "node:crypto";
import type { BlogEnhancementProposal } from "@/features/seo/types";
import {
    stripMarkdownTemplatePlaceholders,
    type MdBlockNode,
    type MdInlineLink,
    type MdProtectedRange,
} from "@/features/seo/lib/markdown-offsets";
import { jaccardSimilarity, tokenizeForOverlap } from "@/features/seo/lib/text-overlap";

const MAX_CLAIM_COVERAGE_PROPOSALS = 3;
const MIN_PARAGRAPH_LEN_FOR_CLAIM = 80;
const MIN_JACCARD_FOR_MATCH = 0.05;

const TRUST_TIER_LABELS: Record<number, string> = {
    5: "Official docs",
    4: "Vendor blog",
    3: "Tech press",
    2: "Research/benchmark",
    1: "General web",
};

interface PersistedFactSheet {
    key_claims?: string[];
    official_source_url?: string | null;
    sources?: Array<{ url: string; title: string; trust_tier: number }>;
}

interface ClaimCoverageInput {
    metadata: Record<string, unknown>;
    contentMarkdown: string;
    /** Locale used for stopword filtering and Unicode-aware tokenization. */
    workspaceLocale?: string | null;
}

export function gatherClaimCoverageProposals(
    input: ClaimCoverageInput,
    scan: { paragraphs: MdBlockNode[]; links: MdInlineLink[]; protectedRanges?: MdProtectedRange[] },
): BlogEnhancementProposal[] {
    const locale = input.workspaceLocale ?? null;
    const provenance = (input.metadata.provenance ?? {}) as Record<string, unknown>;
    const factSheet = provenance.fact_sheet as PersistedFactSheet | undefined;
    if (!factSheet) return [];

    const claims = (factSheet.key_claims ?? []).filter((c) => c && c.length >= 20);
    const sources = factSheet.sources ?? [];
    if (claims.length === 0 || sources.length === 0) return [];

    // Build the set of URLs already cited somewhere in the article. Dropping
    // the query string and trailing slash keeps the comparison tolerant of
    // UTM params and minor URL variations between the fact sheet and what
    // the author may have pasted by hand.
    const citedUrls = new Set<string>();
    for (const link of scan.links) {
        const normalized = normalizeUrlForComparison(link.href);
        if (normalized) citedUrls.add(normalized);
    }

    const proposals: BlogEnhancementProposal[] = [];
    const usedParagraphOffsets = new Set<number>();

    // Claims are paired with sources by index in buildFactSheet() (top 3
    // sources → top 3 claims). Walk pairwise; skip claims whose source URL
    // is already cited anywhere in the article.
    const claimCount = Math.min(claims.length, sources.length, MAX_CLAIM_COVERAGE_PROPOSALS);
    for (let i = 0; i < claimCount; i++) {
        if (proposals.length >= MAX_CLAIM_COVERAGE_PROPOSALS) break;

        const claim = claims[i].trim();
        const source = sources[i];
        if (!source || !claim) continue;

        const sourceUrlNormalized = normalizeUrlForComparison(source.url);
        if (!sourceUrlNormalized || citedUrls.has(sourceUrlNormalized)) continue;

        const targetParagraph = findBestParagraphForClaim(claim, scan.paragraphs, usedParagraphOffsets, locale);
        if (!targetParagraph) continue;

        usedParagraphOffsets.add(targetParagraph.endOffset);

        const tierLabel = TRUST_TIER_LABELS[source.trust_tier] ?? "General web";
        const insertion = ` ${claim} ([${source.title}](${source.url}))`;

        proposals.push({
            id: randomUUID(),
            type: "external_citation_sentence",
            category: "links",
            startOffset: targetParagraph.endOffset,
            endOffset: targetParagraph.endOffset,
            metaPath: null,
            original: "",
            proposed: insertion,
            rationale: `Covers a verified claim from this article's fact sheet that is not yet cited in the body. [Source: ${tierLabel} · ${source.title} · from draft-time research]`,
            riskFlags: ["changes_meaning"],
            estimatedCostMillicents: 0,
        });
    }

    return proposals;
}

function normalizeUrlForComparison(url: string): string | null {
    if (!url || !/^https?:/i.test(url)) return null;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const path = parsed.pathname.replace(/\/+$/, "") || "/";
        return `${host}${path}`;
    } catch {
        return url.toLowerCase();
    }
}

// Pick the paragraph whose vocabulary overlaps most with the claim. Jaccard
// over word sets gives a cheap, deterministic "this paragraph is about the
// same thing" signal without needing an embedding call.
function findBestParagraphForClaim(
    claim: string,
    paragraphs: MdBlockNode[],
    excludeOffsets: Set<number>,
    locale: string | null,
): MdBlockNode | null {
    const claimTokens = tokenizeForOverlap(claim, locale);
    if (claimTokens.size === 0) return null;

    let bestParagraph: MdBlockNode | null = null;
    let bestScore = 0;

    for (const paragraph of paragraphs) {
        if (excludeOffsets.has(paragraph.endOffset)) continue;
        const paragraphText = stripMarkdownTemplatePlaceholders(paragraph.innerText);
        if (paragraphText.length < MIN_PARAGRAPH_LEN_FOR_CLAIM) continue;

        const paragraphTokens = tokenizeForOverlap(paragraphText, locale);
        if (paragraphTokens.size === 0) continue;

        const score = jaccardSimilarity(claimTokens, paragraphTokens);
        if (score > bestScore) {
            bestScore = score;
            bestParagraph = paragraph;
        }
    }

    // Require a minimum overlap so we do not attach an off-topic claim to
    // an unrelated paragraph just to hit the proposal cap.
    return bestScore >= MIN_JACCARD_FOR_MATCH ? bestParagraph : null;
}
