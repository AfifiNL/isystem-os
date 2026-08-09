import { z } from "zod";
import { getExternalPublishingPlatformAdapter } from "./platform-adapters";
import { externalPublicationPlatformSchema } from "./schema";
import type { ExternalPublicationPlatform } from "./types";
import { validateExternalPublishingBacklinks, type ExternalPublishingLinkCandidate } from "./lib/backlink-policy";
import { scoreExternalPublishingUsefulness } from "./lib/usefulness-score";

export const externalPublishingPackageValidationInputSchema = z.object({
    platform: externalPublicationPlatformSchema,
    titleOptions: z.array(z.string().trim().min(1)).default([]),
    bodyMarkdown: z.string().nullable().optional(),
    noLinkBodyMarkdown: z.string().nullable().optional(),
    links: z.array(z.object({
        url: z.string().url(),
        anchorText: z.string().trim().min(1),
        rationale: z.string().trim().nullable().optional(),
        placement: z.string().trim().nullable().optional(),
    })).default([]),
    evidencePack: z.array(z.object({
        title: z.string().optional(),
        url: z.string().url().optional(),
        excerpt: z.string().optional(),
    })).default([]),
    targetPersona: z.string().nullable().optional(),
    hasNewPlatformNativeAngle: z.boolean().default(true),
    hasActionableChecklist: z.boolean().default(false),
    hasCredibleCaveats: z.boolean().default(false),
    hasUsefulVisualPlan: z.boolean().default(false),
    containsUnsupportedClaims: z.boolean().default(false),
    siteUrl: z.string().url().nullable().optional(),
});

export type ExternalPublishingPackageValidationInput = z.infer<typeof externalPublishingPackageValidationInputSchema>;

export interface ExternalPublishingValidationResult {
    valid: boolean;
    platform: ExternalPublicationPlatform;
    qualityScore: number;
    usefulnessScore: number;
    backlinkSafetyScore: number;
    warnings: string[];
    hardFailures: string[];
    adapterNotes: {
        maxLinks: number;
        noLinkVersionRequired: boolean;
        canonicalGuidance: string[];
        moderationNotes: string[];
    };
}

export function validateExternalPublishingPackage(input: ExternalPublishingPackageValidationInput): ExternalPublishingValidationResult {
    const parsed = externalPublishingPackageValidationInputSchema.parse(input);
    const adapter = getExternalPublishingPlatformAdapter(parsed.platform);
    const titleWarnings = parsed.titleOptions
        .filter((title) => title.length > adapter.titleGuidance.maxLength)
        .map((title) => `Title exceeds ${adapter.label} max length (${title.length}/${adapter.titleGuidance.maxLength}): ${title.slice(0, 80)}`);
    const backlinkResult = validateExternalPublishingBacklinks({
        platform: parsed.platform,
        links: parsed.links as ExternalPublishingLinkCandidate[],
        siteUrl: parsed.siteUrl,
    });
    const usefulness = scoreExternalPublishingUsefulness({
        platform: parsed.platform,
        title: parsed.titleOptions[0] ?? "Untitled",
        bodyMarkdown: parsed.bodyMarkdown,
        noLinkBodyMarkdown: parsed.noLinkBodyMarkdown,
        evidenceCount: parsed.evidencePack.length,
        targetPersona: parsed.targetPersona,
        linkCandidates: parsed.links as ExternalPublishingLinkCandidate[],
        hasNewPlatformNativeAngle: parsed.hasNewPlatformNativeAngle,
        hasActionableChecklist: parsed.hasActionableChecklist,
        hasCredibleCaveats: parsed.hasCredibleCaveats,
        hasUsefulVisualPlan: parsed.hasUsefulVisualPlan,
        containsUnsupportedClaims: parsed.containsUnsupportedClaims,
        siteUrl: parsed.siteUrl,
    });
    const warnings = [...titleWarnings, ...backlinkResult.warnings, ...usefulness.warnings];
    const hardFailures = [...backlinkResult.hardFailures, ...usefulness.hardFailures];
    const qualityScore = Math.max(0, Math.min(100, Math.round((usefulness.usefulnessScore + backlinkResult.backlinkSafetyScore) / 2 - hardFailures.length * 10)));
    return {
        valid: hardFailures.length === 0 && qualityScore >= 70 && usefulness.usefulnessScore >= 65 && backlinkResult.backlinkSafetyScore >= (parsed.links.length > 0 ? 90 : 70),
        platform: parsed.platform,
        qualityScore,
        usefulnessScore: usefulness.usefulnessScore,
        backlinkSafetyScore: backlinkResult.backlinkSafetyScore,
        warnings,
        hardFailures,
        adapterNotes: {
            maxLinks: adapter.maxLinks,
            noLinkVersionRequired: adapter.linkPolicy.noLinkVersionRequired,
            canonicalGuidance: adapter.canonicalGuidance,
            moderationNotes: adapter.moderationNotes,
        },
    };
}
