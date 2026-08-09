import { NextRequest, NextResponse } from "next/server";
import { generateText, type LanguageModel } from "ai";
import sharp from "sharp";
import { generatePodcastCoverOverlay } from "./overlay";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAdminOrManager, assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import {
    extractThemeAiSystemContext,
    getThemeManifestConfig,
} from "@/shared/lib/workspace/theme-manifest";
import { generateMultiSpeakerTtsViaProvider, generateTtsViaProvider, TTS_LIMITS, type TtsResult, type TtsProvider } from "@/shared/lib/ai/tts";
import { parseSpeakerScript } from "@/shared/lib/ai/tts-providers/concat";
import { concatTtsSegmentsViaFfmpeg } from "@/shared/lib/ai/tts-providers/ffmpeg-tts-concat";
import { sanitizeNarrationScript } from "@/shared/lib/ai/tts-providers/script-sanitize";
import { retryAsyncWithBackoff } from "@/shared/lib/ai/tts-providers/text-chunker";
import { HUMAN_VOICE_RULES, humanize } from "@/shared/lib/ai/human-voice";
import { assertSafeGeneratedOutput } from "@/shared/lib/ai/output-safety";
import { buildLocaleSystemPrompt, resolveGenerationLocale } from "@/shared/lib/ai/locale";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
    meterAndCharge,
} from "@/shared/lib/ai/metering";
import { buildAiRequestMetadata, getModelMetadata, getAiModel, normalizeAiProviderError, type AiModelAlias, runWithWorkspaceAiConfig } from "@/shared/lib/ai/provider";
import { generateVertexImage, type VertexImageAlias } from "@/shared/lib/ai/vertex-media";
import { resolveWorkspaceBrandLogoDataUri } from "@/shared/lib/client-config/media-branding";
import { isReadyMultiSpeakerPodcastScript } from "./podcast-script-contract";
import {
    PODCAST_FINALIZATION_RESERVE_MS,
    PODCAST_ROUTE_TIMEOUT_MS,
    PODCAST_TTS_RESERVE_MS,
    resolvePodcastPhaseTimeoutMs,
} from "./podcast-generation-deadline";

export const maxDuration = 300;

const ROUTE_NAME = "generate-podcast-episode";
const IMAGE_MODEL_ALIAS: VertexImageAlias = "image.fast";
const SCRIPT_MODEL_ALIAS: AiModelAlias = "text.writer";
const IMAGE_MODEL_METADATA = getModelMetadata(IMAGE_MODEL_ALIAS, { provider: "vertex" });

const DRAFTS_BUCKET = "podcast-drafts";
const COVER_BUCKET = "audio-episodes"; // covers are public by design (used in feed + social)
const COVER_TARGET_PX = 1400; // Apple Podcasts requires ≥1400×1400 (≤3000)

interface GeneratePodcastEpisodeBody {
    episodeId: string;
    sourceText?: string;
    /** Legacy field — Gemini prebuilt voice name. Prefer hostVoiceId/guestVoiceId. */
    voice?: string;
    hostVoiceId?: string;
    guestVoiceId?: string;
    /**
     * If true, instruct the script LLM to output a two-host dialogue using
     * [HOST]: / [GUEST]: speaker tags. Requires guestVoiceId.
     */
    multiSpeaker?: boolean;
    /** Override locale for the generated script. Falls back to the linked content item's locale, then workspace default. */
    locale?: string;
    generateCoverArt?: boolean;
    coverArtPrompt?: string;
}

interface ResolvedVoice {
    voiceId: string;            // workspace_voices.id (or null for default)
    provider: "gemini" | "vertex" | "elevenlabs";
    providerVoiceId: string;
    model?: string;
    displayName: string;
    languageCode?: string;
}

async function resolveVoice(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
    voiceRowId: string | null | undefined,
    fallbackProviderVoiceId: string,
): Promise<ResolvedVoice | { error: string }> {
    if (!voiceRowId) {
        return {
            voiceId: "",
            provider: "gemini",
            providerVoiceId: fallbackProviderVoiceId,
            displayName: `Gemini ${fallbackProviderVoiceId}`,
        };
    }
    const { data, error } = await supabase
        .from("workspace_voices")
        .select("id, workspace_id, provider, provider_voice_id, display_name, voice_type, model_preference, archived_at, provider_status, language_code")
        .eq("id", voiceRowId)
        .maybeSingle();
    if (error) return { error: error.message };
    if (!data || data.workspace_id !== workspaceId) return { error: "Voice not found in this workspace." };
    if (data.archived_at) return { error: "Voice is archived." };
    if (data.provider_status !== "ready") return { error: `Voice not ready (status: ${data.provider_status}).` };
    if (data.provider === "elevenlabs" && (data.voice_type === "prebuilt" || data.voice_type === "library")) {
        return { error: "Legacy ElevenLabs preset voices are no longer supported. Use a Google preset or an ElevenLabs cloned voice." };
    }

    return {
        voiceId: data.id,
        provider: data.provider as "gemini" | "vertex" | "elevenlabs",
        providerVoiceId: data.provider_voice_id,
        model: data.model_preference ?? undefined,
        displayName: data.display_name,
        languageCode: data.language_code,
    };
}

async function generateVoiceTtsWithRetries(
    text: string,
    voice: ResolvedVoice,
    logPrefix: string,
    deadlineAt: number,
): Promise<TtsResult | null> {
    const generate = () => generateTtsViaProvider(text, {
        provider: voice.provider,
        voiceId: voice.providerVoiceId,
        model: voice.model,
        languageCode: voice.languageCode,
        logPrefix,
        deadlineAt,
    });

    // Google TTS handles HTTP status-aware retries internally, including the
    // minute-scale wait required by 429 quota windows. Keep the generic short
    // retry loop for ElevenLabs, whose adapter returns null on transient errors.
    if (voice.provider !== "elevenlabs") return generate();
    return retryAsyncWithBackoff(generate, {
        attempts: 3,
        initialDelayMs: 500,
        logPrefix,
        deadlineAt,
    });
}

// Rough WebVTT generation from a narration script + estimated total duration.
// We don't have word-level timestamps from TTS providers (Gemini and ElevenLabs
// both return audio + char count, not alignment), so we synthesize cues by
// splitting on sentence boundaries and distributing time proportionally to
// character length. This gives a usable captions track for accessibility / SEO
// without requiring a separate forced-alignment pass. Future work could swap
// this for an alignment service (Whisper, Deepgram) when budget allows.
// Walk a multi-speaker script and emit `{speaker, text}` per sentence so the
// VTT builder can wrap each cue in a `<v Speaker>` voice span. Untagged
// content before the first tag is attributed to host (matches parser).
function splitSentencesWithSpeaker(script: string): Array<{ speaker: "host" | "guest" | null; text: string }> {
    const tagRegex = /\[(HOST|GUEST)\]\s*:/gi;
    const trimmed = script.trim();
    if (!trimmed) return [];

    const turns: Array<{ speaker: "host" | "guest" | null; text: string }> = [];
    let lastIndex = 0;
    let currentSpeaker: "host" | "guest" | null = null;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(trimmed)) !== null) {
        const before = trimmed.slice(lastIndex, match.index).trim();
        if (before) turns.push({ speaker: currentSpeaker, text: before });
        currentSpeaker = match[1].toUpperCase() === "HOST" ? "host" : "guest";
        lastIndex = tagRegex.lastIndex;
    }
    const tail = trimmed.slice(lastIndex).trim();
    if (tail) turns.push({ speaker: currentSpeaker, text: tail });

    const out: Array<{ speaker: "host" | "guest" | null; text: string }> = [];
    for (const turn of turns) {
        const sentences = turn.text
            .replace(/\s+/g, " ")
            .match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)
            ?.map((s) => s.trim())
            .filter(Boolean) ?? [turn.text];
        for (const sentence of sentences) {
            out.push({ speaker: turn.speaker, text: sentence });
        }
    }
    return out;
}

function buildSyntheticVtt(script: string, totalSeconds: number): string {
    const sentencesWithSpeaker = splitSentencesWithSpeaker(script);
    if (sentencesWithSpeaker.length === 0) return "WEBVTT\n";

    const totalChars = sentencesWithSpeaker.reduce((sum, s) => sum + s.text.length, 0) || 1;
    const safeDuration = Math.max(1, totalSeconds);

    const cues: string[] = ["WEBVTT", ""];
    let runningSeconds = 0;
    sentencesWithSpeaker.forEach(({ speaker, text }, idx) => {
        const fraction = text.length / totalChars;
        const cueDuration = Math.max(1, Math.round(fraction * safeDuration));
        const start = runningSeconds;
        const end = idx === sentencesWithSpeaker.length - 1
            ? safeDuration
            : Math.min(safeDuration, runningSeconds + cueDuration);
        cues.push(String(idx + 1));
        cues.push(`${formatVttTime(start)} --> ${formatVttTime(end)}`);
        // WebVTT voice spans (`<v Host>...</v>`) let players surface speaker
        // attribution without polluting the displayed text. Players that
        // don't support voice spans still render the inner text correctly.
        if (speaker === "host" || speaker === "guest") {
            const label = speaker === "host" ? "Host" : "Guest";
            cues.push(`<v ${label}>${text}</v>`);
        } else {
            cues.push(text);
        }
        cues.push("");
        runningSeconds = end;
    });
    return cues.join("\n");
}

function formatVttTime(totalSeconds: number): string {
    const safe = Math.max(0, totalSeconds);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe - h * 3600 - m * 60;
    const sStr = s.toFixed(3).padStart(6, "0");
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sStr}`;
}

// Estimate audio duration in seconds from byte count. TTS outputs are either
// MP3 (audio/mpeg) at ~16 KB/s for 128 kbps speech or WAV PCM 16-bit. Both are
// rough; the mixer probes ffprobe later for the canonical value.
function estimateDurationSeconds(byteSize: number, mimeType: string): number {
    if (mimeType === "audio/mpeg") return Math.max(1, Math.round(byteSize / 16_000));
    return Math.max(1, Math.round(byteSize / 48_000));
}



// Cover-art generation. We DO NOT ask the image model to render text —
// Image models routinely produce garbled letterforms. Instead we generate clean
// abstract artwork, then composite the episode title via SVG so glyphs are
// pixel-perfect and locale-aware.
async function generateCoverArt(
    backgroundPrompt: string,
    titleOverlay: string | null,
    abortSignal: AbortSignal,
    logoDataUri?: string | null,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
    try {
        // Forbid text rendering in the background so we don't fight the SVG
        // overlay with generated letterforms.
        const sanitizedPrompt = `${backgroundPrompt} Strictly no text, no letters, no words, no typography, no logos, no captions, no titles, no watermarks, no signage, no numbers, no embedded text artifacts. Abstract editorial imagery only. Aspect ratio 1:1.`;

        const result = await generateVertexImage({
            alias: IMAGE_MODEL_ALIAS,
            prompt: sanitizedPrompt,
            aspectRatio: "1:1",
            negativePrompt: "text, letters, words, typography, logos, captions, titles, watermarks, signage, numbers, embedded text artifacts",
            abortSignal,
        });
        const image = result.images[0];
        if (!image?.base64) return null;
        const png = Buffer.from(image.base64, "base64");

        // Resize to canonical cover size first, then composite the title.
        let pipeline = sharp(png)
            .resize(COVER_TARGET_PX, COVER_TARGET_PX, { fit: "cover", position: "attention" });

        if (titleOverlay && titleOverlay.trim().length > 0) {
            const overlaySvgBuffer = generatePodcastCoverOverlay(titleOverlay.trim(), logoDataUri);
            pipeline = pipeline.composite([{ input: overlaySvgBuffer, top: 0, left: 0 }]);
        }

        const optimized = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
        return { buffer: optimized, mimeType: "image/jpeg" };
    } catch (err) {
        const providerError = normalizeAiProviderError(err, {
            provider: "vertex",
            modelAlias: IMAGE_MODEL_ALIAS,
            modelId: IMAGE_MODEL_METADATA.modelId,
        });
        console.error("[generate-podcast-episode] cover art failed:", providerError.toJSON());
        return null;
    }
}

export async function POST(request: NextRequest) {
    const routeDeadlineAt = Date.now() + PODCAST_ROUTE_TIMEOUT_MS;
    try {
        const context = await assertWorkspaceAiEnabled();
        // Mutating a podcast episode also requires admin/manager.
        await assertWorkspaceAdminOrManager();

        const workspaceId = context.activeWorkspace.id;
        const brandLogoDataUri = await resolveWorkspaceBrandLogoDataUri(context.activeWorkspace.metadata);

        const limit = await checkAiRateLimitPg(workspaceId, ROUTE_NAME, { maxPerWindow: 5 });
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded. Try again shortly." },
                { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
            );
        }
        await assertSufficientAiBalance(workspaceId);

        return await runWithWorkspaceAiConfig(workspaceId, async () => {
            const body = (await request.json()) as GeneratePodcastEpisodeBody;
            if (!body.episodeId) {
                return NextResponse.json({ error: "episodeId required" }, { status: 400 });
            }

            const supabase = await createClient();

            // Load episode + ensure it's in the active workspace and editable.
            const { data: episode, error: episodeError } = await supabase
                .from("podcast_episodes")
                .select("id, workspace_id, show_id, title, description, content_item_id, status, host_voice_id, guest_voice_id")
                .eq("id", body.episodeId)
                .maybeSingle();

            if (episodeError) {
                return NextResponse.json({ error: episodeError.message }, { status: 500 });
            }
            if (!episode || episode.workspace_id !== workspaceId) {
                return NextResponse.json({ error: "Episode not found" }, { status: 404 });
            }
            if (episode.status === "published") {
                return NextResponse.json(
                    { error: "Cannot regenerate audio on a published episode. Unpublish first." },
                    { status: 409 },
                );
            }

            // Resolve narration source — explicit > linked content > description.
            let sourceText = body.sourceText?.trim();
            let sourceLocale: string | null = null;
            if (!sourceText && episode.content_item_id) {
                const { data: content } = await supabase
                    .from("content_items")
                    .select("title, content_markdown, locale")
                    .eq("id", episode.content_item_id)
                    .maybeSingle();
                sourceText = (content?.content_markdown ?? "").trim() || null!;
                sourceLocale = content?.locale ?? null;
            }
            if (!sourceText) sourceText = (episode.description ?? "").trim();
            if (!sourceText) {
                return NextResponse.json(
                    { error: "No narration source. Provide sourceText, attach a content item, or set a description." },
                    { status: 400 },
                );
            }

            // Resolve voices. host_voice_id may be supplied in the body (one-off
            // override) or stored on the episode row. Same for guest.
            const hostVoiceId = body.hostVoiceId ?? episode.host_voice_id ?? null;
            const guestVoiceId = body.guestVoiceId ?? episode.guest_voice_id ?? null;

            const hostVoice = await resolveVoice(supabase, workspaceId, hostVoiceId, body.voice ?? TTS_LIMITS.defaultVoice);
            if ("error" in hostVoice) {
                return NextResponse.json({ error: `Host voice: ${hostVoice.error}` }, { status: 400 });
            }
            let guestVoice: ResolvedVoice | null = null;
            const wantMultiSpeaker = Boolean(body.multiSpeaker || guestVoiceId);
            if (wantMultiSpeaker && guestVoiceId) {
                const resolved = await resolveVoice(supabase, workspaceId, guestVoiceId, "");
                if ("error" in resolved) {
                    return NextResponse.json({ error: `Guest voice: ${resolved.error}` }, { status: 400 });
                }
                guestVoice = resolved;
            }

            // Theme-aware narration prompt — keeps generated voice on-brand.
            const themeConfig = getThemeManifestConfig(context);
            const aiSystemContext = extractThemeAiSystemContext(themeConfig)
                || "Active Workspace Business Context: unavailable.";

            // Locale priority: explicit body locale → linked content item's
            // locale → workspace default. The narration script must match the
            // language of the source content; otherwise the TTS voice will read
            // English text in a Dutch/Arabic-configured workspace.
            const narrationLocale = resolveGenerationLocale({
                requested: body.locale ?? sourceLocale,
                workspaceDefault: context.activeWorkspace.default_locale,
            });
            const localePrompt = buildLocaleSystemPrompt(narrationLocale);

            // Source-text safety budget so prompt + system fits well within limits.
            const truncatedSource = sourceText.slice(0, 8000);

            const scriptInstruction = guestVoice
                ? `Convert this into a two-person podcast dialogue between a HOST (interviewer) and a GUEST. Use the format:

[HOST]: <line>
[GUEST]: <line>
[HOST]: <line>
...

Keep the total under 12000 characters. The host introduces topics and asks questions; the guest gives substantive answers grounded in the source content. Title: "${episode.title}".

Source content:
${truncatedSource}`
                : `Convert this into a flowing spoken narration. Keep it under 12000 characters total. Use short, natural sentences with appropriate pauses (commas, periods). Title of the episode: "${episode.title}".

Source content:
${truncatedSource}`;

            const scriptSystem = guestVoice
                ? `${aiSystemContext}

${localePrompt}

You are writing a two-person podcast dialogue. Output ONLY the dialogue lines using the [HOST]: and [GUEST]: speaker tags as instructed. Do NOT add sound effects, stage directions, or scene markers. The host and guest should each say multiple lines.

${HUMAN_VOICE_RULES}`
                : `${aiSystemContext}

${localePrompt}

You are a professional podcast narrator. Convert written content into a natural spoken narration script for a single host. Remove markdown formatting, links, and headers. Do NOT add sound effects, stage directions, host names, or "[intro music]" markers. Output ONLY the words to be spoken.

${HUMAN_VOICE_RULES}`;

            const sourceIsReadyDialogue = Boolean(
                guestVoice && isReadyMultiSpeakerPodcastScript(truncatedSource),
            );
            const scriptMetadata = sourceIsReadyDialogue
                ? null
                : getModelMetadata(SCRIPT_MODEL_ALIAS);
            let scriptRaw = truncatedSource;

            if (!sourceIsReadyDialogue) {
                const scriptTimeoutMs = resolvePodcastPhaseTimeoutMs({
                    deadlineAt: routeDeadlineAt,
                    maxPhaseMs: 90_000,
                    reserveMs: PODCAST_TTS_RESERVE_MS + PODCAST_FINALIZATION_RESERVE_MS,
                });
                if (scriptTimeoutMs === null) {
                    return NextResponse.json(
                        { error: "Podcast generation could not start within the route deadline. Please retry." },
                        { status: 504 },
                    );
                }
                const scriptModel = getAiModel(SCRIPT_MODEL_ALIAS) as LanguageModel;
                const generatedScript = await generateText({
                    model: scriptModel,
                    system: scriptSystem,
                    prompt: scriptInstruction,
                    abortSignal: AbortSignal.timeout(scriptTimeoutMs),
                });
                scriptRaw = generatedScript.text;

                const scriptRequestMetadata = buildAiRequestMetadata({
                    alias: SCRIPT_MODEL_ALIAS,
                    workspaceId,
                    routeName: ROUTE_NAME,
                    operation: "narration_script_llm",
                });

                await meterAndCharge({
                    workspaceId,
                    profileId: context.userId,
                    route: ROUTE_NAME,
                    usage: {
                        unitType: "tokens",
                        model: scriptRequestMetadata.model_id,
                        tokensIn: generatedScript.usage.inputTokens ?? 0,
                        tokensOut: generatedScript.usage.outputTokens ?? 0,
                    },
                    metadata: {
                        ...scriptRequestMetadata,
                        episodeId: episode.id,
                    },
                });
            }
            // Strip stage directions, parentheticals, foreign speaker tags, and
            // markdown survivors before any downstream consumer (TTS or VTT) sees
            // them. The sanitizer also normalizes recognized HOST/GUEST tag
            // whitespace and case so parseSpeakerScript hits clean input.
            const sanitized = sanitizeNarrationScript(humanize(scriptRaw).trim());
            const narrationScript = sanitized.script;
            const scriptWarnings = sanitized.warnings;
            assertSafeGeneratedOutput(narrationScript);

            if (!narrationScript) {
                return NextResponse.json({ error: "Narration script came back empty." }, { status: 500 });
            }

            // Generate narration. Gemini dialogue uses the provider's native
            // multi-speaker contract, collapsing many turns into a few byte-
            // bounded requests. Other providers remain per-turn but run
            // sequentially so long episodes cannot burst through provider quota.
            let ttsResult: TtsResult | null;
            const ttsDeadlineAt = routeDeadlineAt - PODCAST_FINALIZATION_RESERVE_MS;
            const perSegmentMetering: Array<{ provider: TtsProvider; charCount: number; speaker: "host" | "guest" }> = [];
            if (guestVoice) {
                const segments = parseSpeakerScript(narrationScript);
                if (segments.length === 0) {
                    return NextResponse.json({ error: "Multi-speaker script came back empty." }, { status: 500 });
                }

                if (hostVoice.provider === "gemini" && guestVoice.provider === "gemini") {
                    ttsResult = await generateMultiSpeakerTtsViaProvider(segments, {
                        provider: "gemini",
                        hostVoiceId: hostVoice.providerVoiceId,
                        guestVoiceId: guestVoice.providerVoiceId,
                        model: hostVoice.model ?? guestVoice.model,
                        languageCode: hostVoice.languageCode ?? guestVoice.languageCode,
                        logPrefix: "[generate-podcast-episode][dialogue]",
                        deadlineAt: ttsDeadlineAt,
                    });
                    if (!ttsResult) {
                        return NextResponse.json(
                            { error: "Native multi-speaker TTS failed after quota-aware retries (gemini)." },
                            { status: 502 },
                        );
                    }
                    for (const segment of segments) {
                        perSegmentMetering.push({
                            provider: "gemini",
                            charCount: segment.text.length,
                            speaker: segment.speaker,
                        });
                    }
                } else {
                    const audioSegments: Array<{
                        result: TtsResult | null;
                        speaker: "host" | "guest";
                        voice: ResolvedVoice;
                    }> = [];

                    for (let index = 0; index < segments.length; index += 1) {
                        const seg = segments[index];
                        const voice = seg.speaker === "host" ? hostVoice : guestVoice;
                        const result = await generateVoiceTtsWithRetries(
                            seg.text,
                            voice,
                            `[generate-podcast-episode][${seg.speaker}][seg ${index + 1}/${segments.length}]`,
                            ttsDeadlineAt,
                        );
                        audioSegments.push({ result, speaker: seg.speaker, voice });
                        if (!result) break;
                    }

                    const failedIndex = audioSegments.findIndex((entry) => !entry.result);
                    if (failedIndex >= 0 || audioSegments.length !== segments.length) {
                        const failed = audioSegments[failedIndex >= 0 ? failedIndex : audioSegments.length - 1];
                        return NextResponse.json(
                            { error: `TTS failed for ${failed.speaker} on segment ${Math.max(1, failedIndex + 1)} of ${segments.length} after retries (${failed.voice.provider}).` },
                            { status: 502 },
                        );
                    }

                    const ttsSegments = audioSegments.map((entry) => entry.result as TtsResult);
                    for (let i = 0; i < ttsSegments.length; i += 1) {
                        perSegmentMetering.push({
                            provider: ttsSegments[i].provider,
                            charCount: ttsSegments[i].charCount,
                            speaker: audioSegments[i].speaker,
                        });
                    }
                    ttsResult = await concatTtsSegmentsViaFfmpeg(ttsSegments, {
                        interSegmentSilenceMs: 350,
                        loudnorm: true,
                        logPrefix: "[generate-podcast-episode][concat]",
                    });
                    if (!ttsResult) {
                        return NextResponse.json(
                            { error: "Multi-speaker concat produced an empty or invalid result." },
                            { status: 502 },
                        );
                    }
                }
            } else {
                ttsResult = await generateVoiceTtsWithRetries(
                    narrationScript,
                    hostVoice,
                    "[generate-podcast-episode]",
                    ttsDeadlineAt,
                );
                if (ttsResult) {
                    perSegmentMetering.push({
                        provider: ttsResult.provider,
                        charCount: ttsResult.charCount,
                        speaker: "host",
                    });
                }
            }
            if (!ttsResult) {
                return NextResponse.json({ error: "TTS generation failed after retries." }, { status: 502 });
            }

            const audioBuffer = Buffer.from(ttsResult.base64Audio, "base64");
            const narrationExtension = ttsResult.mimeType === "audio/mpeg" ? "mp3" : "wav";
            const narrationStoragePath = `${workspaceId}/${episode.id}/narration.${narrationExtension}`;

            const { error: uploadError } = await supabase.storage
                .from(DRAFTS_BUCKET)
                .upload(narrationStoragePath, audioBuffer, {
                    contentType: ttsResult.mimeType,
                    upsert: true,
                });
            if (uploadError) {
                return NextResponse.json({ error: `Narration upload failed: ${uploadError.message}` }, { status: 500 });
            }

            // Aggregate per-segment metering so the billing layer can see how the
            // total split across host/guest, and across providers in mixed-future
            // scenarios. Today provider is uniform per multi-speaker job (asserted
            // upstream) but the breakdown lets ops audit cost attribution.
            const segmentBreakdown = perSegmentMetering.reduce<Record<string, { charCount: number; segmentCount: number }>>((acc, entry) => {
                const key = `${entry.provider}:${entry.speaker}`;
                const bucket = acc[key] ?? { charCount: 0, segmentCount: 0 };
                bucket.charCount += entry.charCount;
                bucket.segmentCount += 1;
                acc[key] = bucket;
                return acc;
            }, {});
            const requestMetadata = buildAiRequestMetadata({
                alias: "audio.tts",
                workspaceId,
                routeName: ROUTE_NAME,
                operation: "narration_tts",
            });

            await meterAndCharge({
                workspaceId,
                profileId: context.userId,
                route: ROUTE_NAME,
                usage: {
                    unitType: "tts_char",
                    model: requestMetadata.model_id,
                    charCount: ttsResult.charCount,
                },
                metadata: {
                    ...requestMetadata,
                    episodeId: episode.id,
                    multiSpeaker: Boolean(guestVoice),
                    segmentCount: perSegmentMetering.length,
                    segmentBreakdown,
                    scriptWarnings,
                },
            });

            // Synthetic VTT captions track. Always generated alongside narration —
            // hosted publicly so the <track> tag on the player can load it without
            // a signed URL. Path is stable across regeneration.
            // Prefer the ffmpeg-probed duration from concat output when available
            // (accurate to the second). Fall back to the byte-rate heuristic for
            // single-speaker WAV that didn't go through ffmpeg.
            const estimatedSeconds = ttsResult.durationSeconds && ttsResult.durationSeconds > 0
                ? ttsResult.durationSeconds
                : estimateDurationSeconds(audioBuffer.length, ttsResult.mimeType);
            const vttBody = buildSyntheticVtt(narrationScript, estimatedSeconds);
            const vttPath = `${workspaceId}/${episode.id}/transcript.vtt`;
            let transcriptVttUrl: string | null = null;
            const { error: vttError } = await supabase.storage
                .from(COVER_BUCKET)
                .upload(vttPath, Buffer.from(vttBody, "utf-8"), {
                    contentType: "text/vtt",
                    upsert: true,
                    cacheControl: "public, max-age=300",
                });
            if (!vttError) {
                const { data: vttUrlData } = supabase.storage.from(COVER_BUCKET).getPublicUrl(vttPath);
                transcriptVttUrl = vttUrlData.publicUrl;
            } else {
                console.warn("[generate-podcast-episode] VTT upload failed:", vttError.message);
            }

            // Optional cover art generation. Public bucket so feed/RSS can link
            // directly. Bound to the published path even before publish so the
            // path stays stable across publish/unpublish cycles.
            let coverArtUrl: string | null = null;
            let coverArtFailed = false;
            if (body.generateCoverArt) {
                const coverTimeoutMs = resolvePodcastPhaseTimeoutMs({
                    deadlineAt: routeDeadlineAt,
                    maxPhaseMs: 90_000,
                    reserveMs: PODCAST_FINALIZATION_RESERVE_MS,
                });
                if (coverTimeoutMs === null) {
                    coverArtFailed = true;
                    console.warn("[generate-podcast-episode] skipped cover art to preserve the route finalization budget.");
                } else {
                // Background prompt focuses purely on imagery — the episode title
                // is rendered via SVG composite inside generateCoverArt, not by
                // the image model. Operator-supplied prompts override the
                // default, but the "no text" guardrail is appended either way.
                const coverPrompt = body.coverArtPrompt?.trim()
                    || `Square podcast cover art for a thoughtful editorial episode. Evocative imagery, modern editorial style, high contrast, rich color palette, cinematic lighting.`;
                const cover = await generateCoverArt(
                    coverPrompt,
                    episode.title,
                    AbortSignal.timeout(coverTimeoutMs),
                    brandLogoDataUri,
                );
                if (cover) {
                    const coverPath = `${workspaceId}/${episode.id}/cover.jpg`;
                    const { error: coverError } = await supabase.storage
                        .from(COVER_BUCKET)
                        .upload(coverPath, cover.buffer, {
                            contentType: cover.mimeType,
                            upsert: true,
                            cacheControl: "public, max-age=31536000, immutable",
                        });
                    if (!coverError) {
                        const { data: urlData } = supabase.storage.from(COVER_BUCKET).getPublicUrl(coverPath);
                        coverArtUrl = urlData.publicUrl;
                        await meterAndCharge({
                            workspaceId,
                            profileId: context.userId,
                            route: ROUTE_NAME,
                            usage: { unitType: "image", model: IMAGE_MODEL_METADATA.modelId, imageCount: 1 },
                            metadata: {
                                phase: "cover_art_generation",
                                episodeId: episode.id,
                                ai: buildAiRequestMetadata({
                                    alias: IMAGE_MODEL_ALIAS,
                                    provider: "vertex",
                                    workspaceId,
                                    routeName: ROUTE_NAME,
                                    operation: "cover_art_generation",
                                }),
                            },
                        });
                    } else {
                        coverArtFailed = true;
                        console.warn("[generate-podcast-episode] cover upload failed:", coverError.message);
                    }
                } else {
                    coverArtFailed = true;
                }
                }
            }

            // Persist generation results.
            // NOTE: `voice_id` (text) is the legacy provider-voice column from
            // before workspace_voices existed. New code uses `host_voice_id` /
            // `guest_voice_id` (uuid FK). We deliberately do not write `voice_id`
            // anymore — it will be dropped in a follow-up migration.
            const updates: Record<string, unknown> = {
                narration_only_url: narrationStoragePath, // intentionally a storage PATH (bucket is private)
                transcript_text: narrationScript,
                audio_mime_type: ttsResult.mimeType,
                audio_byte_size: audioBuffer.length,
                generation_metadata: {
                    generated_at: new Date().toISOString(),
                    tts_provider: ttsResult.provider,
                    tts_model: ttsResult.providerModel,
                    script_model: scriptMetadata?.modelId ?? null,
                    script_source: sourceIsReadyDialogue ? "provided_dialogue" : "generated",
                    source_chars: truncatedSource.length,
                    script_chars: narrationScript.length,
                    multi_speaker: Boolean(guestVoice),
                    segment_count: perSegmentMetering.length,
                    segment_breakdown: segmentBreakdown,
                    duration_seconds: estimatedSeconds,
                    script_warnings: scriptWarnings,
                    host_voice: { id: hostVoice.voiceId || null, display_name: hostVoice.displayName, provider_voice_id: hostVoice.providerVoiceId },
                    guest_voice: guestVoice
                        ? { id: guestVoice.voiceId, display_name: guestVoice.displayName, provider_voice_id: guestVoice.providerVoiceId }
                        : null,
                },
            };
            if (coverArtUrl) updates.cover_art_url = coverArtUrl;
            if (transcriptVttUrl) updates.transcript_vtt_url = transcriptVttUrl;
            // Persist host/guest assignments if they came from the request body so
            // re-generation reuses the same voices.
            if (body.hostVoiceId !== undefined) updates.host_voice_id = body.hostVoiceId;
            if (body.guestVoiceId !== undefined) updates.guest_voice_id = body.guestVoiceId;

            const { error: updateError } = await supabase
                .from("podcast_episodes")
                .update(updates)
                .eq("id", episode.id);
            if (updateError) {
                throw new Error(`Episode update failed: ${updateError.message}`);
            }

            const warnings: string[] = [...scriptWarnings];
            if (coverArtFailed) {
                warnings.push("Cover art generation failed. The narration audio is saved; you can retry cover art separately or upload one manually.");
            }
            if (!transcriptVttUrl) {
                warnings.push("Caption track upload failed. Captions will be unavailable on the public page until regenerated.");
            }

            return NextResponse.json({
                episodeId: episode.id,
                narrationStoragePath,
                coverArtUrl,
                transcriptVttUrl,
                scriptChars: narrationScript.length,
                durationSeconds: estimatedSeconds,
                segmentCount: perSegmentMetering.length,
                warnings: warnings.length > 0 ? warnings : undefined,
            });
        });
    } catch (err: unknown) {
        if (err instanceof InsufficientAiBalanceError) {
            return NextResponse.json({ error: err.message }, { status: 402 });
        }
        const message = err instanceof Error ? err.message : "Generation failed";
        console.error("[generate-podcast-episode] error:", err);
        const status = message.startsWith("Forbidden") ? 403 : message.startsWith("Unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
