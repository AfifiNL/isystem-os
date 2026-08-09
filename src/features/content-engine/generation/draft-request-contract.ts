import { z } from "zod";

export const DRAFT_CONTENT_TYPES = [
    "blog_post",
    "video_script",
    "social_linkedin",
    "social_twitter",
    "social_instagram",
    "newsletter_issue",
] as const;

export type DraftContentType = typeof DRAFT_CONTENT_TYPES[number];

const draftGenerationRequestSchema = z.object({
    title: z.string().trim().min(1).max(300),
    keywords: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    narrative_style: z.enum([
        "analytical",
        "storytelling",
        "instructional",
        "persuasive",
        "conversational",
    ]).default("analytical"),
    length: z.enum(["short", "medium", "long", "deep-dive"]).default("medium"),
    content_types: z.array(z.enum(DRAFT_CONTENT_TYPES))
        .min(1)
        .max(DRAFT_CONTENT_TYPES.length)
        .refine(
            (formats) => new Set(formats).size === formats.length,
            "Content formats must be unique.",
        ),
    geography: z.enum(["global", "us", "europe", "africa", "asia", "mena"]).default("global"),
    locale: z.enum(["en", "nl", "ar"]).optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    plan_id: z.string().uuid().optional().nullable(),
    generate_charts: z.boolean().optional(),
    generate_diagrams: z.boolean().optional(),
    visual_density: z.enum(["light", "balanced", "rich"]).optional(),
}).strict();

export type DraftGenerationRequest = z.infer<typeof draftGenerationRequestSchema>;

export function parseDraftGenerationRequest(value: unknown) {
    return draftGenerationRequestSchema.safeParse(value);
}
