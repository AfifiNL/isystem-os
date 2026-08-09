import { z } from "zod";

const listFromText = z.string().trim().max(2000).optional().default("").transform((value) => (
    value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50)
));

export const outreachCampaignSchema = z.object({
    name: z.string().trim().min(3, "Campaign name is required.").max(160),
    brief: z.string().trim().min(20, "Brief needs enough context for governed discovery.").max(4000),
    icpDescription: z.string().trim().min(20, "ICP description is required.").max(4000),
    sectors: listFromText,
    geographies: listFromText,
    exclusions: listFromText,
});

export type OutreachCampaignInput = z.infer<typeof outreachCampaignSchema>;

export const outreachSettingsSchema = z.object({
    fromName: z.string().trim().max(120).optional().or(z.literal("")),
    fromEmail: z.string().trim().email().optional().or(z.literal("")),
    replyToEmail: z.string().trim().email().optional().or(z.literal("")),
    companyAddress: z.string().trim().max(280).optional().or(z.literal("")),
    dailyWorkspaceCap: z.coerce.number().int().min(0).max(500).default(25),
    dailySenderCap: z.coerce.number().int().min(0).max(250).default(20),
    dailyDomainCap: z.coerce.number().int().min(0).max(50).default(2),
    requireHumanApproval: z.coerce.boolean().default(true),
    warmupEnabled: z.coerce.boolean().default(true),
});

export type OutreachSettingsInput = z.infer<typeof outreachSettingsSchema>;

export const outreachReviewSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(["approved", "rejected", "needs_changes"]),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const outreachCsvImportSchema = z.object({
    campaignId: z.string().uuid("Campaign is required."),
    lawfulBasis: z.enum(["manual_warranty", "unknown"]).default("unknown"),
});

export type OutreachCsvImportInput = z.infer<typeof outreachCsvImportSchema>;

export const outreachScheduleMessageSchema = z.object({
    messageId: z.string().uuid(),
    scheduledFor: z.string().datetime({ offset: true }).optional().or(z.literal("")),
});
