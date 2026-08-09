import { getExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublicationPlatform } from "../types";
import { validateExternalPublishingBacklinks, type ExternalPublishingLinkCandidate } from "./backlink-policy";

export interface ExternalPublishingUsefulnessInput {
    platform: ExternalPublicationPlatform;
    title: string;
    bodyMarkdown?: string | null;
    noLinkBodyMarkdown?: string | null;
    evidenceCount: number;
    targetPersona?: string | null;
    linkCandidates: ExternalPublishingLinkCandidate[];
    hasNewPlatformNativeAngle?: boolean;
    hasActionableChecklist?: boolean;
    hasCredibleCaveats?: boolean;
    hasUsefulVisualPlan?: boolean;
    containsUnsupportedClaims?: boolean;
    siteUrl?: string | null;
}

export interface ExternalPublishingUsefulnessResult {
    usefulnessScore: number;
    hardFailures: string[];
    warnings: string[];
    dimensions: Record<string, number>;
}

const AI_SLOP_PATTERN = /\b(unlock|game-changing|revolutionize|in today's fast-paced|ultimate guide|delve|seamless|leverage cutting-edge)\b/i;
const UNVERIFIABLE_STATS_PATTERN = /\b\d{2,3}%|\b\d+x\b/i;

function wordCount(value: string): number {
    return value.trim().split(/\s+/).filter(Boolean).length;
}

function clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreExternalPublishingUsefulness(input: ExternalPublishingUsefulnessInput): ExternalPublishingUsefulnessResult {
    const adapter = getExternalPublishingPlatformAdapter(input.platform);
    const body = input.bodyMarkdown ?? "";
    const words = wordCount(body);
    const warnings: string[] = [];
    const hardFailures: string[] = [];
    const backlinkResult = validateExternalPublishingBacklinks({
        platform: input.platform,
        links: input.linkCandidates,
        siteUrl: input.siteUrl,
    });

    hardFailures.push(...backlinkResult.hardFailures);
    warnings.push(...backlinkResult.warnings);

    if (input.evidenceCount <= 0 && UNVERIFIABLE_STATS_PATTERN.test(body)) {
        hardFailures.push("Factual/statistical claims require a non-empty evidence pack.");
    }
    if (!input.hasNewPlatformNativeAngle) hardFailures.push("Package needs a new platform-native angle, not duplicated owned blog copy.");
    if (AI_SLOP_PATTERN.test(`${input.title} ${body}`)) hardFailures.push("Copy contains generic AI-sounding or hype phrases.");
    if (input.containsUnsupportedClaims) hardFailures.push("Copy contains unsupported legal/compliance/performance claims.");
    if (adapter.linkPolicy.noLinkVersionRequired && !input.noLinkBodyMarkdown?.trim()) {
        hardFailures.push(`${adapter.label} requires a no-link version.`);
    }
    if (words < adapter.bodyGuidance.minWords) warnings.push(`Body is shorter than ${adapter.label} guidance (${words}/${adapter.bodyGuidance.minWords} words).`);
    if (words > adapter.bodyGuidance.maxWords) warnings.push(`Body is longer than ${adapter.label} guidance (${words}/${adapter.bodyGuidance.maxWords} words).`);

    const dimensions = {
        specificity: /\b(checklist|framework|steps?|example|template|workflow|mistake|tradeoff)\b/i.test(body) ? 12 : 5,
        actionable: input.hasActionableChecklist ? 16 : 6,
        evidence: Math.min(14, input.evidenceCount * 4),
        personaFit: input.targetPersona?.trim() ? 10 : 5,
        platformFit: words >= adapter.bodyGuidance.minWords && words <= adapter.bodyGuidance.maxWords ? 12 : 7,
        lowPromotion: input.linkCandidates.length <= Math.max(1, adapter.maxLinks) && !adapter.salesToneRedFlags.some((flag) => body.toLowerCase().includes(flag)) ? 12 : 4,
        visualUsefulness: input.hasUsefulVisualPlan ? 8 : 3,
        caveats: input.hasCredibleCaveats ? 8 : 2,
        nextStep: /\b(try this|next step|use this|ask|critique|compare|audit)\b/i.test(body) ? 8 : 3,
    };

    const rawScore = Object.values(dimensions).reduce((sum, value) => sum + value, 0) - hardFailures.length * 20 - warnings.length * 3;
    return {
        usefulnessScore: clampScore(rawScore),
        hardFailures,
        warnings,
        dimensions,
    };
}
