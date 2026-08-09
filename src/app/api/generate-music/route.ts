import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAdminOrManager, assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import {
    LYRIA_CLIP_MODEL,
    LYRIA_PRO_MODEL,
    LYRIA_STABLE_MODEL,
    LYRIA_DEFAULT_NEGATIVE_PROMPT,
    buildMusicPrompt,
    generateMusic,
    type LyriaModel,
} from "@/shared/lib/ai/music-providers/lyria";
import { buildAiRequestMetadata, getModelMetadata } from "@/shared/lib/ai/provider";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import type { AiModelAlias } from "@/shared/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 120;

const ROUTE_NAME = "generate-music";
const MUSIC_BUCKET = "workspace-music";
const DEFAULT_MUSIC_ALIAS: Extract<AiModelAlias, "music.stable"> = "music.stable";

const VALID_MOODS = new Set([
    "upbeat", "calm", "cinematic", "corporate", "lofi",
    "dramatic", "warm", "tense", "playful", "ambient",
] as const);

const VALID_ROLES = new Set(["intro", "bed", "outro"] as const);

interface GenerateMusicBody {
    /** Optional: contextualize generation around a specific episode. */
    episodeId?: string;
    /** "intro" | "bed" | "outro" — drives the role flag + prompt template. */
    role: "intro" | "bed" | "outro";
    /** One of MUSIC_MOODS. */
    mood: string;
    /** Target clip length. Clamped to model limits. */
    durationSeconds?: number;
    /** Custom display name for the resulting library track. */
    title?: string;
    /** Override the auto-generated prompt. */
    promptOverride?: string;
    /** Override the model. Defaults to the central music.stable alias. */
    model?: LyriaModel;
    /** Override via the central alias layer. Defaults to music.stable. */
    modelAlias?: Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro">;
    /** When true and episodeId set, the new track is auto-attached to that role on the episode. */
    attachToEpisode?: boolean;
}

export async function POST(request: NextRequest) {
    try {
        const context = await assertWorkspaceAiEnabled();
        await assertWorkspaceAdminOrManager();
        const workspaceId = context.activeWorkspace.id;

        const limit = await checkAiRateLimitPg(workspaceId, ROUTE_NAME, { maxPerWindow: 10 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Try again shortly." },
                { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
            );
        }
        await assertSufficientAiBalance(workspaceId);

        const body = (await request.json()) as GenerateMusicBody;

        if (!body.role || !VALID_ROLES.has(body.role)) {
            return NextResponse.json({ error: "role must be intro, bed, or outro" }, { status: 400 });
        }
        if (!body.mood || !VALID_MOODS.has(body.mood as never)) {
            return NextResponse.json({ error: "mood is required and must be a valid mood" }, { status: 400 });
        }

        const supabase = await createClient();

        // Optionally pull episode context for prompt construction.
        let episodeContext: {
            id: string;
            title: string;
            summary: string | null;
            multiSpeaker: boolean;
            showSubtitle: string | null;
        } | null = null;

        if (body.episodeId) {
            const { data: episode, error: epError } = await supabase
                .from("podcast_episodes")
                .select(`
                    id, workspace_id, title, summary,
                    guest_voice_id, generation_metadata,
                    podcast_shows!inner(subtitle, workspace_id)
                `)
                .eq("id", body.episodeId)
                .maybeSingle();
            if (epError) return NextResponse.json({ error: epError.message }, { status: 500 });
            if (!episode || episode.workspace_id !== workspaceId) {
                return NextResponse.json({ error: "Episode not found in this workspace." }, { status: 404 });
            }
            const show = Array.isArray(episode.podcast_shows) ? episode.podcast_shows[0] : episode.podcast_shows;
            episodeContext = {
                id: episode.id,
                title: episode.title,
                summary: episode.summary ?? null,
                multiSpeaker: Boolean(episode.guest_voice_id),
                showSubtitle: show?.subtitle ?? null,
            };
        }

        const modelAlias = body.modelAlias ?? getMusicAliasForModel(body.model) ?? DEFAULT_MUSIC_ALIAS;
        const model = body.model;
        const requestedDuration = body.durationSeconds ?? (body.role === "bed" ? 30 : 15);

        const prompt = body.promptOverride?.trim() || buildMusicPrompt({
            role: body.role,
            mood: body.mood,
            durationSeconds: requestedDuration,
            episodeTitle: episodeContext?.title,
            episodeSummary: episodeContext?.summary ?? undefined,
            showSubtitle: episodeContext?.showSubtitle ?? undefined,
            multiSpeaker: episodeContext?.multiSpeaker,
        });

        // Fallback chain based on modelAlias metadata
        const initialAlias = modelAlias;
        const aliasMetadata = getModelMetadata(initialAlias);
        const aliasCascade: Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro">[] = [
            initialAlias,
            ...(aliasMetadata.fallbackAliases ?? []).filter((a): a is Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro"> =>
                ["music.stable", "music.clip", "music.pro"].includes(a)
            ),
        ];

        type ProviderOutput = {
            bytes: Uint8Array;
            mimeType: string;
            durationSeconds: number;
            providerLabel: string;
            providerModel: string;
            usedAlias: Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro">;
        };

        let providerOutput: ProviderOutput | null = null;
        const providerErrors: string[] = [];
        // Leave 30 seconds of the 120-second route budget for authentication,
        // storage, metering, persistence, and a controlled HTTP response.
        const providerDeadlineAt = Date.now() + 90_000;

        for (const currentAlias of aliasCascade) {
            const currentMetadata = getModelMetadata(currentAlias);
            // If the user specified a custom model override, we only use that model
            // for the first attempt, then fall back using getModelMetadata for subsequent aliases.
            const currentModel = currentAlias === initialAlias && model
                ? model
                : currentMetadata.modelId as LyriaModel;

            const lyriaResponse = await generateMusic({
                prompt,
                durationSeconds: requestedDuration,
                negativePrompt: LYRIA_DEFAULT_NEGATIVE_PROMPT,
                model: currentModel,
                modelAlias: currentAlias,
                logPrefix: `[generate-music][${currentAlias}]`,
                deadlineAt: providerDeadlineAt,
            });

            if (lyriaResponse.ok) {
                providerOutput = {
                    bytes: lyriaResponse.data.bytes,
                    mimeType: lyriaResponse.data.mimeType,
                    durationSeconds: lyriaResponse.data.durationSeconds,
                    providerLabel: "lyria",
                    providerModel: lyriaResponse.data.model,
                    usedAlias: currentAlias,
                };
                break;
            } else {
                providerErrors.push(`lyria (${currentAlias}): ${lyriaResponse.error}`);
            }
        }

        if (!providerOutput) {
            return NextResponse.json(
                {
                    error: "Music generation failed.",
                    detail: providerErrors,
                    hint: "Check that Vertex AI is configured properly with appropriate credentials and quotas.",
                },
                { status: 502 },
            );
        }

        // Upload to workspace-music bucket. Path layout matches the bucket
        // RLS policy: first folder segment is the workspace id.
        const trackId = randomUUID();
        const storageExtension = providerOutput.mimeType === "audio/wav" ? "wav" : "mp3";
        const storagePath = `${workspaceId}/${trackId}.${storageExtension}`;
        const { error: uploadError } = await supabase.storage
            .from(MUSIC_BUCKET)
            .upload(storagePath, Buffer.from(providerOutput.bytes), {
                contentType: providerOutput.mimeType,
                upsert: false,
            });
        if (uploadError) {
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        // Compute base + fee for cost_millicents persistence (separate from the
        // metering RPC which records the same charge against the workspace
        // balance).
        const requestMetadata = buildAiRequestMetadata({
            alias: providerOutput.usedAlias,
            workspaceId,
            routeName: ROUTE_NAME,
            operation: "generate_music",
            provider: "vertex",
        });

        const meterResult = await meterAndCharge({
            workspaceId,
            profileId: context.userId,
            route: ROUTE_NAME,
            usage: { unitType: "music_seconds", model: providerOutput.providerModel, durationSeconds: providerOutput.durationSeconds },
            metadata: {
                ...(requestMetadata ?? {}),
                role: body.role,
                mood: body.mood,
                episodeId: body.episodeId ?? null,
                provider: providerOutput.providerLabel,
            },
        });

        const title = body.title?.trim() || (episodeContext
            ? `${episodeContext.title} — ${body.role}`
            : `Lyria ${body.mood} ${body.role}`);

        const { data: trackRow, error: insertError } = await supabase.from("workspace_music_tracks").insert({
            id: trackId,
            workspace_id: workspaceId,
            template_id: context.activeWorkspace.legacy_template_id,
            created_by_profile_id: context.userId,
            title,
            mood: body.mood,
            duration_seconds: providerOutput.durationSeconds,
            storage_path: storagePath,
            audio_mime_type: providerOutput.mimeType,
            audio_byte_size: providerOutput.bytes.length,
            prompt_text: prompt,
            source: "generated",
            generator_model: providerOutput.providerModel,
            cost_millicents: meterResult?.chargedMillicents ?? 0,
            is_intro: body.role === "intro",
            is_outro: body.role === "outro",
            is_bed: body.role === "bed",
            // Generated intros / outros target a clean tail/head and aren't
            // loop-safe. Beds are crafted for looping, but real-world loop
            // safety needs human verification — leave false by default.
            loop_safe: false,
            metadata: {
                episode_id: body.episodeId ?? null,
                provider: providerOutput.providerLabel,
                provider_model: providerOutput.providerModel,
                fallback_used: providerOutput.usedAlias !== initialAlias,
                provider_errors: providerErrors.length > 0 ? providerErrors : undefined,
            },
        })
            .select("*")
            .single();

        if (insertError) {
            // Best-effort: try to clean up the uploaded blob so we don't
            // leave orphans pointing at a missing row.
            await supabase.storage.from(MUSIC_BUCKET).remove([storagePath]);
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Optional auto-attachment to the source episode at the role slot.
        if (body.attachToEpisode && body.episodeId) {
            // Replace any existing attachment at the same role.
            await supabase
                .from("podcast_episode_music")
                .delete()
                .eq("episode_id", body.episodeId)
                .eq("role", body.role);

            const { error: attachError } = await supabase.from("podcast_episode_music").insert({
                episode_id: body.episodeId,
                track_id: trackId,
                role: body.role,
            });
            if (attachError) {
                console.error("[generate-music] auto-attach failed:", attachError.message);
            }
        }

        return NextResponse.json({
            track: trackRow,
            attached: Boolean(body.attachToEpisode && body.episodeId),
            promptUsed: prompt,
            provider: providerOutput.providerLabel,
            fallbackUsed: providerOutput.usedAlias !== initialAlias,
            warnings: providerErrors.length > 0
                ? [`Primary model alias unavailable, used fallback: ${providerOutput.usedAlias}.`]
                : undefined,
        });
    } catch (err: unknown) {
        if (err instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: err.message }, { status: 402 });
        }
        const message = err instanceof Error ? err.message : "Generation failed";
        console.error("[generate-music] error:", err);
        const status = message.startsWith("Forbidden") ? 403 : message.startsWith("Unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

function getMusicAliasForModel(
    model: LyriaModel | undefined,
): Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro"> | undefined {
    if (!model) return undefined;
    if (model === LYRIA_PRO_MODEL) return "music.pro";
    if (model === LYRIA_CLIP_MODEL) return "music.clip";
    if (model === LYRIA_STABLE_MODEL) return "music.stable";
    return undefined;
}
