import { createClient } from "@/shared/lib/supabase/server";
import { assertAuthorizedContentAccess } from "@/shared/lib/workspace/context";
import { NextRequest, NextResponse } from "next/server";
import { generateTts } from "@/shared/lib/ai/tts";
import { buildAiRequestMetadata } from "@/shared/lib/ai/provider";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";

export const maxDuration = 300;

const ROUTE_NAME = "voiceover";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: content_id } = await params;
        const searchParams = req.nextUrl.searchParams;
        const sceneIndexStr = searchParams.get("sceneIndex");

        if (!sceneIndexStr) {
            return NextResponse.json({ error: "sceneIndex query parameter is required." }, { status: 400 });
        }

        const sceneIndex = parseInt(sceneIndexStr, 10);
        if (isNaN(sceneIndex)) {
            return NextResponse.json({ error: "Invalid sceneIndex provided." }, { status: 400 });
        }

        const reqBody = await req.json().catch(() => ({}));
        const { editedDialogue } = reqBody;

        const { content, context: workspaceContext } = await assertAuthorizedContentAccess(content_id, { requireAiEnabled: true });
        const workspaceId = workspaceContext.activeWorkspace.id;

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const limit = await checkAiRateLimitPg(workspaceId, ROUTE_NAME, { maxPerWindow: 20 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Please try again shortly." },
                { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
            );
        }

        await assertSufficientAiBalance(workspaceId);

        const metadata = content.metadata || {};
        const formats = (metadata.generated_formats as Record<string, unknown> | undefined) || {};
        const videoScript = formats.video_script as { scenes?: Array<{ dialogue?: string }> } | undefined;
        const scenes = Array.isArray(videoScript?.scenes) ? videoScript.scenes : [];
        const scene = scenes[sceneIndex];

        if (!scene) {
            return NextResponse.json({ error: "No dialogue found for the specified scene index." }, { status: 400 });
        }

        const narrationScript = editedDialogue !== undefined && editedDialogue.trim() !== ""
            ? editedDialogue
            : scene.dialogue;

        if (!narrationScript) {
            return NextResponse.json({ error: "Extracted dialogue is empty." }, { status: 400 });
        }

        let dialogueChanged = false;
        if (editedDialogue !== undefined && editedDialogue !== scene.dialogue) {
            scene.dialogue = editedDialogue;
            dialogueChanged = true;
        }

        const ttsResult = await generateTts(narrationScript, "[voiceover]");
        if (!ttsResult) {
            return NextResponse.json({ error: "TTS generation failed on Google API." }, { status: 500 });
        }

        const requestMetadata = buildAiRequestMetadata({
            alias: "audio.tts",
            workspaceId,
            routeName: ROUTE_NAME,
            operation: "generate_voiceover",
        });

        await meterAndCharge({
            workspaceId,
            profileId: user.id,
            route: ROUTE_NAME,
            usage: { unitType: "tts_char", model: requestMetadata.model_id, charCount: narrationScript.length },
            metadata: {
                ...requestMetadata,
                sceneIndex,
            },
        });

        const filePath = `generated/${content_id}/scene_${sceneIndex}_voiceover.wav`;
        const fileBytes = Buffer.from(ttsResult.base64Audio, "base64");

        const { error: uploadError } = await supabase.storage
            .from("public-media")
            .upload(filePath, fileBytes, {
                contentType: ttsResult.mimeType,
                upsert: true,
            });

        if (uploadError) {
            console.error(`[voiceover] Upload fail for scene ${sceneIndex}:`, uploadError);
            return NextResponse.json({ error: "Failed to upload audio to storage." }, { status: 500 });
        }

        const { data: urlData } = supabase.storage.from("public-media").getPublicUrl(filePath);

        const currentAssets = (metadata.assets as Record<string, unknown> | undefined) || {};
        const existingSceneVoiceovers = currentAssets.video_voiceover_scenes;
        const sceneVoiceovers = Array.isArray(existingSceneVoiceovers)
            ? [...existingSceneVoiceovers]
            : new Array(scenes.length).fill(null);

        while (sceneVoiceovers.length <= sceneIndex) {
            sceneVoiceovers.push(null);
        }

        sceneVoiceovers[sceneIndex] = {
            url: urlData.publicUrl,
            type: ttsResult.mimeType,
            size: fileBytes.length,
        };

        await supabase
            .from("content_items")
            .update({
                metadata: {
                    ...metadata,
                    generated_formats: dialogueChanged ? formats : metadata.generated_formats,
                    assets: { ...currentAssets, video_voiceover_scenes: sceneVoiceovers },
                    assets_generated_at: new Date().toISOString(),
                },
            })
            .eq("id", content_id);

        return NextResponse.json({ success: true, url: urlData.publicUrl, sceneIndex });
    } catch (err: unknown) {
        if (err instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: err.message }, { status: 402 });
        }
        if (err instanceof Error) {
            if (err.message === "AI generation is only available on Pro workspaces.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }
            if (err.message === "Unauthorized: No active workspace session found.") {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            if (err.message === "Content item not found.") {
                return NextResponse.json({ error: err.message }, { status: 404 });
            }
            if (err.message === "Forbidden: content is outside the active workspace scope.") {
                return NextResponse.json({ error: err.message }, { status: 403 });
            }
        }
        console.error("[voiceover] Unhandled error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Internal server error during voiceover generation" },
            { status: 500 },
        );
    }
}
