// Lyria music generation via Google Vertex AI.
//
// Endpoint family:
// - Lyria 3: global v1beta1 Interactions API
// - Lyria 2: global publisher-model predict API

import { getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import { getGoogleCloudAccessToken } from "@/shared/lib/ai/google-oauth";
import { getVertexConfig, isVertexProviderEnabled } from "../vertex";
import { normalizeAiProviderError } from "../errors";
import { resolveProviderAttemptTimeoutMs, settleProviderPromiseWithin } from "../provider-timeout";
import {
    buildLyriaRequest,
    isLyria3Model,
    parseLyriaResponse,
    resolveLyriaEndpoint,
} from "./lyria-contract";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const LYRIA_STABLE_ALIAS: Extract<AiModelAlias, "music.stable"> = "music.stable";
const LYRIA_CLIP_ALIAS: Extract<AiModelAlias, "music.clip"> = "music.clip";
const LYRIA_PRO_ALIAS: Extract<AiModelAlias, "music.pro"> = "music.pro";

export const LYRIA_STABLE_MODEL = getModelMetadata(LYRIA_STABLE_ALIAS, { provider: "vertex" }).modelId;
export const LYRIA_CLIP_MODEL = getModelMetadata(LYRIA_CLIP_ALIAS, { provider: "vertex" }).modelId;
export const LYRIA_PRO_MODEL = getModelMetadata(LYRIA_PRO_ALIAS, { provider: "vertex" }).modelId;

export type LyriaMimeType = "audio/mpeg" | "audio/wav";

export type LyriaModel = typeof LYRIA_STABLE_MODEL | typeof LYRIA_CLIP_MODEL | typeof LYRIA_PRO_MODEL;

export interface GenerateMusicOptions {
    /** Free-form text prompt describing the music. */
    prompt: string;
    /** Approximate length of the clip in seconds. Lyria 3 Clip caps around 30s. */
    durationSeconds?: number;
    /** Sample count — vary to get multiple takes from the same prompt. */
    sampleCount?: number;
    /** Default: clip preview. Use Pro for longer structured songs. */
    model?: LyriaModel;
    /** Optional central alias. Defaults to music.stable unless a model override is supplied. */
    modelAlias?: Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro">;
    /** Optional seed for deterministic regeneration. */
    seed?: number;
    /** Optional negative prompt — things to avoid (e.g. "vocals, sound effects"). */
    negativePrompt?: string;
    /** For trace logging. */
    logPrefix?: string;
    /** Shared route-level deadline across primary and fallback model attempts. */
    deadlineAt?: number;
}

export interface GeneratedMusic {
    /** Raw provider audio bytes (Lyria 3 MP3 or Lyria 2 WAV). */
    bytes: Uint8Array;
    mimeType: LyriaMimeType;
    durationSeconds: number;
    model: LyriaModel;
}

export type GenerateMusicResult =
    | { ok: true; data: GeneratedMusic }
    | { ok: false; error: string; status?: number };

async function getGoogleAccessToken(): Promise<string | null> {
    return getGoogleCloudAccessToken();
}

/**
 * Generate a single music clip. Returns a structured result so callers can
 * decide whether to fall back to a different provider or surface the upstream
 * error.
 */
export async function generateMusic(options: GenerateMusicOptions): Promise<GenerateMusicResult> {
    const model = options.model ?? getMusicModelForAlias(options.modelAlias ?? LYRIA_STABLE_ALIAS);
    const durationSeconds = clampDuration(model, options.durationSeconds);
    const logPrefix = options.logPrefix ?? "[lyria]";
    const isVertex = isVertexProviderEnabled();
    const deadlineAt = options.deadlineAt ?? Date.now() + 45_000;

    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (isVertex) {
        const config = getVertexConfig();
        const authTimeoutMs = resolveProviderAttemptTimeoutMs(deadlineAt, { maxAttemptMs: 30_000 });
        if (authTimeoutMs === null) {
            return { ok: false, error: "Lyria generation deadline exhausted before OAuth." };
        }
        const token = await settleProviderPromiseWithin(
            getGoogleAccessToken(),
            authTimeoutMs,
            null,
        );
        if (!token) {
            return { ok: false, error: "Vertex AI Lyria configuration error: OAuth token generation failed" };
        }
        url = resolveLyriaEndpoint({ project: config.project, model });
        headers["Authorization"] = `Bearer ${token}`;
    } else {
        if (!API_KEY) {
            return { ok: false, error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured." };
        }
        if (isLyria3Model(model)) {
            return { ok: false, error: "Lyria 3 requires AI_PROVIDER=vertex and Google Cloud OAuth credentials." };
        }
        url = `${GEMINI_BASE}/models/${model}:predict?key=${API_KEY}`;
    }

    const body = buildLyriaRequest({
        model,
        prompt: options.prompt,
        negativePrompt: options.negativePrompt,
        sampleCount: options.sampleCount,
        durationSeconds,
        seed: options.seed,
    });

    try {
        const attemptTimeoutMs = resolveProviderAttemptTimeoutMs(
            deadlineAt,
            { maxAttemptMs: 45_000 },
        );
        if (attemptTimeoutMs === null) {
            return { ok: false, error: "Lyria generation deadline exhausted before the provider request." };
        }
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(attemptTimeoutMs),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`${logPrefix} Lyria API error (${res.status}):`, text);
            return {
                ok: false,
                status: res.status,
                error: `Lyria upstream ${res.status}: ${text.slice(0, 240)}`,
            };
        }
        const data = await res.json();
        const parsed = parseLyriaResponse(data);
        if (!parsed) {
            console.error(`${logPrefix} Lyria response missing audio bytes:`, JSON.stringify(data).slice(0, 500));
            return { ok: false, error: "Lyria response missing audio bytes." };
        }
        return {
            ok: true,
            data: {
                bytes: Uint8Array.from(atob(parsed.base64Audio), (c) => c.charCodeAt(0)),
                mimeType: parsed.mimeType === "audio/wav" ? "audio/wav" : "audio/mpeg",
                durationSeconds,
                model,
            },
        };
    } catch (err) {
        if (isVertex) {
            const config = getVertexConfig();
            const normalized = normalizeAiProviderError(err, {
                provider: "vertex",
                modelAlias: getMusicAliasForModel(model),
                modelId: model,
                region: config.location,
            });
            return { ok: false, error: normalized.message };
        }
        const message = err instanceof Error ? err.message : "unknown";
        console.error(`${logPrefix} Lyria fetch failed:`, err);
        return { ok: false, error: `Lyria network error: ${message}` };
    }
}

function clampDuration(model: LyriaModel, requested: number | undefined): number {
    if (model === LYRIA_CLIP_MODEL) {
        return 30;
    }
    if (model === LYRIA_STABLE_MODEL) {
        // Lyria 2 returns a fixed ~30-second instrumental WAV clip.
        return 30;
    }
    // Pro can produce longer structured songs.
    return Math.min(184, Math.max(10, Math.round(requested ?? 60)));
}

function getMusicModelForAlias(alias: Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro">): LyriaModel {
    return getModelMetadata(alias, { provider: "vertex" }).modelId as LyriaModel;
}

function getMusicAliasForModel(model: LyriaModel): Extract<AiModelAlias, "music.stable" | "music.clip" | "music.pro"> {
    if (model === LYRIA_PRO_MODEL) return LYRIA_PRO_ALIAS;
    if (model === LYRIA_CLIP_MODEL) return LYRIA_CLIP_ALIAS;
    return LYRIA_STABLE_ALIAS;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

export interface MusicPromptInput {
    role: "intro" | "bed" | "outro";
    mood: string;
    durationSeconds: number;
    /** Episode title — gives Lyria thematic context. */
    episodeTitle?: string;
    /** Episode summary or a one-line topic description. */
    episodeSummary?: string;
    /** Show-level subtitle for broader brand mood. */
    showSubtitle?: string;
    /** True if the listener is explicitly hosting a multi-speaker dialogue. */
    multiSpeaker?: boolean;
}

const ROLE_INSTRUCTIONS: Record<MusicPromptInput["role"], string> = {
    intro: "Build into a confident peak that resolves cleanly so a host can begin speaking. Keep the last 1.5 seconds nearly silent for a smooth handoff.",
    bed: "Loop-friendly, low-frequency emphasis pulled back so a human voice sits naturally on top. Avoid melodic peaks that compete with speech.",
    outro: "Begin gently and grow into a memorable closing motif. Fade the final 2 seconds.",
};

const MOOD_DESCRIPTORS: Record<string, string> = {
    upbeat: "bright tempo, optimistic chord progressions, modern pop-electronic palette",
    calm: "slow tempo, soft pads, warm Rhodes piano, gentle ambience",
    cinematic: "wide stereo strings, building percussion, modern film-score aesthetics",
    corporate: "polished mid-tempo, sparse piano with subtle synth bass, professional and trustworthy",
    lofi: "vinyl crackle, dusty drum samples, mellow Rhodes, jazz-tinged chords",
    dramatic: "tension-building strings, deep low end, sparse high accents",
    warm: "acoustic guitar, soft brushed drums, warm analog tape feel",
    tense: "minor key, pulsing low synth, restrained melody",
    playful: "marimba or pizzicato strings, bouncy syncopated rhythms, upbeat",
    ambient: "drifting pads, no perceptible pulse, evolving textures",
};

export function buildMusicPrompt(input: MusicPromptInput): string {
    const moodLine = MOOD_DESCRIPTORS[input.mood] ?? input.mood;
    const roleLine = ROLE_INSTRUCTIONS[input.role];

    const segments: string[] = [];
    segments.push(
        `Generate a ${input.durationSeconds}-second instrumental podcast ${input.role}.`,
    );
    segments.push(`Mood: ${moodLine}.`);
    if (input.episodeTitle) {
        segments.push(`Episode title: "${input.episodeTitle}".`);
    }
    if (input.episodeSummary) {
        segments.push(`Episode topic: ${input.episodeSummary}`);
    }
    if (input.showSubtitle) {
        segments.push(`Show vibe: ${input.showSubtitle}.`);
    }
    if (input.multiSpeaker && input.role === "bed") {
        segments.push("Two-person dialogue underneath — leave space across the mid frequencies for both voices.");
    }
    segments.push(roleLine);
    segments.push("Strictly instrumental — no vocals, no sound effects, no spoken word.");
    segments.push("Stereo mix, balanced loudness, broadcast-ready.");

    return segments.join(" ");
}

export const LYRIA_DEFAULT_NEGATIVE_PROMPT =
    "vocals, singing, spoken word, lyrics, sound effects, sirens, dialogue";
