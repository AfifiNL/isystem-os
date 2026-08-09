import { z } from "zod";

const assetGenerationRequestSchema = z.object({
    content_id: z.string().uuid(),
    generate_images: z.boolean().optional(),
    generate_tts: z.boolean().optional(),
}).strict();

export type AssetGenerationRequestResult =
    | {
        ok: true;
        value: {
            contentId: string;
            generateImages: boolean;
        };
    }
    | {
        ok: false;
        error: string;
        code: "invalid_request" | "narration_workflow_required" | "no_supported_assets_requested";
        workflow?: "podcast_episode";
    };

export function parseAssetGenerationRequest(input: unknown): AssetGenerationRequestResult {
    const parsed = assetGenerationRequestSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error: "A valid content_id and boolean generation options are required.",
            code: "invalid_request",
        };
    }

    if (parsed.data.generate_tts === true) {
        return {
            ok: false,
            error: "Narration is generated through Podcast Production, where show, voice, and music settings are preserved.",
            code: "narration_workflow_required",
            workflow: "podcast_episode",
        };
    }

    if (parsed.data.generate_images !== true) {
        return {
            ok: false,
            error: "No supported assets were requested. Use Podcast Production for narration.",
            code: "no_supported_assets_requested",
            workflow: "podcast_episode",
        };
    }

    return {
        ok: true,
        value: {
            contentId: parsed.data.content_id,
            generateImages: true,
        },
    };
}
