import { z } from "zod";
import {
    EXTERNAL_PUBLICATION_ASSET_TYPES,
    EXTERNAL_PUBLICATION_EVENT_TYPES,
    EXTERNAL_PUBLICATION_PLATFORMS,
    EXTERNAL_PUBLICATION_RESEARCH_JOB_STATUSES,
    EXTERNAL_PUBLICATION_RESEARCH_JOB_TYPES,
    EXTERNAL_PUBLICATION_RESEARCH_PROVIDERS,
    EXTERNAL_PUBLICATION_SOURCE_TYPES,
    EXTERNAL_PUBLICATION_STATUSES,
} from "./types";

const jsonRecordSchema = z.record(z.string(), z.unknown());
const localeSchema = z.enum(["en", "nl", "ar"]);
const nullableUuidSchema = z.string().uuid().nullable().optional();

export const externalPublicationPlatformSchema = z.enum(EXTERNAL_PUBLICATION_PLATFORMS);
export const externalPublicationStatusSchema = z.enum(EXTERNAL_PUBLICATION_STATUSES);
export const externalPublicationSourceTypeSchema = z.enum(EXTERNAL_PUBLICATION_SOURCE_TYPES);
export const externalPublicationAssetTypeSchema = z.enum(EXTERNAL_PUBLICATION_ASSET_TYPES);
export const externalPublicationEventTypeSchema = z.enum(EXTERNAL_PUBLICATION_EVENT_TYPES);
export const externalPublicationResearchProviderSchema = z.enum(EXTERNAL_PUBLICATION_RESEARCH_PROVIDERS);
export const externalPublicationResearchJobTypeSchema = z.enum(EXTERNAL_PUBLICATION_RESEARCH_JOB_TYPES);
export const externalPublicationResearchJobStatusSchema = z.enum(EXTERNAL_PUBLICATION_RESEARCH_JOB_STATUSES);

export const externalPublicationCampaignDraftSchema = z.object({
    workspaceId: z.string().uuid(),
    templateId: z.string().trim().min(1).max(120).nullable().optional(),
    name: z.string().trim().min(3).max(180),
    goal: z.string().trim().min(8).max(1200),
    targetPersona: z.string().trim().max(240).nullable().optional(),
    targetGeographies: z.array(z.string().trim().min(1).max(120)).max(25).default([]),
    utmCampaign: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9_-]*$/),
    metadata: jsonRecordSchema.default({}),
});

export const externalPublicationPackageSourceSchema = z.object({
    sourceType: externalPublicationSourceTypeSchema,
    sourceContentId: nullableUuidSchema,
    sourceSeoPlanId: nullableUuidSchema,
    sourceSeoOpportunityId: nullableUuidSchema,
    metadata: jsonRecordSchema.default({}),
});

export const externalPublicationPackageDraftSchema = externalPublicationPackageSourceSchema.extend({
    workspaceId: z.string().uuid(),
    templateId: z.string().trim().min(1).max(120).nullable().optional(),
    campaignId: nullableUuidSchema,
    platform: externalPublicationPlatformSchema,
    locale: localeSchema.default("en"),
    topic: z.string().trim().min(3).max(240),
    primaryQuery: z.string().trim().max(240).nullable().optional(),
    targetUrl: z.string().url().max(1000),
    targetSlug: z.string().trim().max(240).nullable().optional(),
    utmSource: z.string().trim().min(1).max(80),
    utmMedium: z.string().trim().min(1).max(80).default("external_publishing"),
    utmCampaign: z.string().trim().min(2).max(120),
    utmContent: z.string().trim().min(2).max(160),
});

export const externalPublicationPlatformProfileInputSchema = z.object({
    platform: externalPublicationPlatformSchema,
    defaultDisclosure: z.string().trim().max(500).nullable().optional(),
    blockedCommunities: z.array(z.string().trim().min(1).max(180)).max(50).default([]),
    preferredCommunities: z.array(jsonRecordSchema).max(50).default([]),
    toneRules: jsonRecordSchema.default({}),
    metadata: jsonRecordSchema.default({}),
});

export const externalPublicationAssetManifestInputSchema = z.object({
    assetType: externalPublicationAssetTypeSchema.optional(),
    title: z.string().trim().max(180).nullable().optional(),
    description: z.string().trim().max(1200).nullable().optional(),
    imagePrompt: z.string().trim().max(4000).nullable().optional(),
    mermaid: z.string().trim().max(10000).nullable().optional(),
    altText: z.string().trim().max(500).nullable().optional(),
    caption: z.string().trim().max(800).nullable().optional(),
    metadata: jsonRecordSchema.default({}),
});

export const externalPublicationResearchJobInputSchema = z.object({
    workspaceId: z.string().uuid(),
    packageId: nullableUuidSchema,
    campaignId: nullableUuidSchema,
    provider: externalPublicationResearchProviderSchema,
    jobType: externalPublicationResearchJobTypeSchema,
    priority: z.number().int().min(0).max(10000).default(100),
    runAfter: z.string().datetime({ offset: true }).optional(),
    input: jsonRecordSchema.default({}),
});

export const externalPublicationResearchDocumentInputSchema = z.object({
    workspaceId: z.string().uuid(),
    packageId: nullableUuidSchema,
    researchJobId: nullableUuidSchema,
    provider: z.string().trim().min(1).max(120),
    sourceUrl: z.string().url().max(1000),
    canonicalUrl: z.string().url().max(1000),
    title: z.string().trim().max(300).nullable().optional(),
    excerpt: z.string().trim().max(4000).nullable().optional(),
    markdown: z.string().max(50000).nullable().optional(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
    sourceKind: z.string().trim().min(1).max(120),
    trustTier: z.number().int().min(1).max(5).nullable().optional(),
    metadata: jsonRecordSchema.default({}),
});

export type ExternalPublicationCampaignDraftInput = z.infer<typeof externalPublicationCampaignDraftSchema>;
export type ExternalPublicationPackageDraftInput = z.infer<typeof externalPublicationPackageDraftSchema>;
export type ExternalPublicationPlatformProfileInput = z.infer<typeof externalPublicationPlatformProfileInputSchema>;
export type ExternalPublicationAssetManifestInput = z.infer<typeof externalPublicationAssetManifestInputSchema>;
export type ExternalPublicationResearchJobInput = z.infer<typeof externalPublicationResearchJobInputSchema>;
export type ExternalPublicationResearchDocumentInput = z.infer<typeof externalPublicationResearchDocumentInputSchema>;
