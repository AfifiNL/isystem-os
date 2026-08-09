import type { SourceDocumentRow, SourceRegistryRow } from "@/features/source-intelligence/types";

export type ExtractedSourceClaim = {
    claim_text: string;
    normalized_claim: string;
    evidence_type: "statistic" | "benchmark" | "supporting";
    confidence: number;
    metadata: Record<string, unknown>;
};

const NUMERIC_SENTENCE_RE = /(?:^|[.!?]\s+)([^.!?]*(?:\b\d+(?:[.,]\d+)?\s?%\b|\b\d+(?:[.,]\d+)?\s?(?:million|billion|trillion|hours?|days?|weeks?|months?|years?|eur|€|usd|\$)\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+in\s+\d+\b)[^.!?]*[.!?]?)/gi;
const METRIC_HINT_RE = /\b(?:percent|percentage|share|rate|growth|cost|revenue|saving|savings|productivity|hours|adoption|usage|roi|forecast|benchmark|survey|respondents|sample|companies|workers|employees|smes|mkb)\b/i;
const SAMPLE_RE = /\b(?:n\s?=\s?\d+|sample\s+of\s+\d+|survey(?:ed)?\s+\d+|\d+\s+(?:respondents|companies|workers|employees|leaders|smes|mkb))\b/i;
const GEO_RE = /\b(?:global|worldwide|europe|eu|netherlands|dutch|us|united states|mena|africa|asia|uk|germany|france)\b/i;

function normalizeClaim(text: string): string {
    return text.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function metricFromClaim(text: string): string | null {
    const match = text.match(/\b(?:adoption|usage|productivity|saving|savings|cost|revenue|roi|growth|forecast|benchmark|share|rate)\b/i);
    return match?.[0].toLowerCase() ?? null;
}

function evidenceTypeForClaim(text: string): ExtractedSourceClaim["evidence_type"] {
    if (/\b(?:benchmark|survey|study|report|dataset|index)\b/i.test(text)) return "benchmark";
    if (METRIC_HINT_RE.test(text)) return "statistic";
    return "supporting";
}

function confidenceForClaim(text: string, registry: SourceRegistryRow): number {
    let score = registry.quality === "authoritative" ? 82 : registry.quality === "high" ? 74 : registry.quality === "medium" ? 58 : 42;
    if (registry.trust_tier === "regulatory" || registry.trust_tier === "industry") score += 10;
    if (registry.trust_tier === "vendor") score -= 10;
    if (SAMPLE_RE.test(text)) score += 8;
    if (GEO_RE.test(text)) score += 4;
    if (/\b(?:may|could|might|estimate|estimated|forecast|projection|up to)\b/i.test(text)) score -= 10;
    return Math.max(20, Math.min(95, score));
}

export function extractConservativeClaims(input: {
    document: Pick<SourceDocumentRow, "raw_text" | "published_at" | "canonical_url">;
    registry: SourceRegistryRow;
    maxClaims?: number;
}): ExtractedSourceClaim[] {
    const text = input.document.raw_text ?? "";
    const claims: ExtractedSourceClaim[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    NUMERIC_SENTENCE_RE.lastIndex = 0;
    while ((match = NUMERIC_SENTENCE_RE.exec(text)) !== null && claims.length < (input.maxClaims ?? 24)) {
        const claim = match[1].replace(/\s+/g, " ").trim();
        if (claim.length < 45 || claim.length > 420) continue;
        if (!METRIC_HINT_RE.test(claim)) continue;
        const normalized = normalizeClaim(claim);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        claims.push({
            claim_text: claim,
            normalized_claim: normalized,
            evidence_type: evidenceTypeForClaim(claim),
            confidence: confidenceForClaim(claim, input.registry),
            metadata: {
                extraction: "rule_based_numeric_v1",
                metric: metricFromClaim(claim),
                geography: claim.match(GEO_RE)?.[0] ?? null,
                sample: claim.match(SAMPLE_RE)?.[0] ?? null,
                source_url: input.document.canonical_url,
                eligible_for_quantitative_visual: confidenceForClaim(claim, input.registry) >= 70 && ["authoritative", "high"].includes(input.registry.quality) && ["regulatory", "industry"].includes(input.registry.trust_tier),
            },
        });
    }
    return claims;
}
