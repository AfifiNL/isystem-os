import type { TtsRequest, TtsResult } from "./types";
import { mapWithBoundedConcurrency } from "./bounded-concurrency";
import { splitTtsText } from "./text-chunker";
import { resolveProviderAttemptTimeoutMs } from "@/shared/lib/ai/provider-timeout";

const API_BASE = "https://api.elevenlabs.io/v1";
export const ELEVENLABS_DEFAULT_MODEL = "eleven_multilingual_v2";
export const ELEVENLABS_AVAILABLE_MODELS = [
    "eleven_multilingual_v2",
    "eleven_v3",
    "eleven_flash_v2_5",
    "eleven_flash_v2",
] as const;
export type ElevenLabsModel = (typeof ELEVENLABS_AVAILABLE_MODELS)[number];

// ElevenLabs accepts up to ~5000 chars per call, but staying under 2500 keeps
// per-call latency low and lets us parallelize with concurrency 3 (Starter
// plan rate-limit-friendly).
const ELEVENLABS_MAX_CHUNK_CHARS = 2500;
const ELEVENLABS_CHUNK_CONCURRENCY = 3;
const ELEVENLABS_OPERATION_TIMEOUT_MS = 150_000;
const ELEVENLABS_MAX_ATTEMPT_MS = 60_000;

function getApiKey(): string | null {
    return process.env.ELEVENLABS_API_KEY?.trim() || null;
}

export function isElevenLabsConfigured(): boolean {
    return !!getApiKey();
}

interface CloneVoiceParams {
    name: string;
    description?: string;
    audioFiles: File[];           // browser/edge File objects (multipart upload)
    labels?: Record<string, string>;
}

export interface CloneVoiceResult {
    voiceId: string;
    requiresVerification: boolean;
}

/**
 * Create an Instant Voice Clone. Sample bytes are streamed to ElevenLabs
 * in a single multipart request and never persisted in our storage.
 */
export async function createInstantVoiceClone(params: CloneVoiceParams): Promise<CloneVoiceResult> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

    const form = new FormData();
    form.append("name", params.name);
    if (params.description) form.append("description", params.description);
    if (params.labels) form.append("labels", JSON.stringify(params.labels));
    for (const file of params.audioFiles) {
        form.append("files", file, file.name);
    }
    form.append("remove_background_noise", "true");

    const res = await fetch(`${API_BASE}/voices/add`, {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`ElevenLabs clone failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    const voiceId = data.voice_id ?? data.id;
    if (!voiceId) {
        throw new Error("ElevenLabs clone response missing voice_id.");
    }
    return {
        voiceId,
        requiresVerification: Boolean(data.requires_verification),
    };
}

/**
 * Delete a voice from the ElevenLabs account. Used when an admin archives
 * a workspace voice and wants to free up a clone slot.
 */
export async function deleteElevenLabsVoice(voiceId: string): Promise<void> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");
    const res = await fetch(`${API_BASE}/voices/${encodeURIComponent(voiceId)}`, {
        method: "DELETE",
        headers: { "xi-api-key": apiKey },
    });
    // 200 (deleted) and 404 (already gone) are both acceptable.
    if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`ElevenLabs voice delete failed (${res.status}): ${text}`);
    }
}

async function generateElevenLabsChunkMp3(
    text: string,
    voiceId: string,
    model: string,
    logPrefix: string,
    deadlineAt: number,
): Promise<Uint8Array | null> {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error(`${logPrefix} ELEVENLABS_API_KEY is not configured.`);
        return null;
    }
    try {
        const attemptTimeoutMs = resolveProviderAttemptTimeoutMs(deadlineAt, {
            maxAttemptMs: ELEVENLABS_MAX_ATTEMPT_MS,
        });
        if (attemptTimeoutMs === null) return null;
        const res = await fetch(
            `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": apiKey,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
                body: JSON.stringify({ text, model_id: model }),
                signal: AbortSignal.timeout(attemptTimeoutMs),
            },
        );
        if (!res.ok) {
            console.error(`${logPrefix} ElevenLabs TTS error (${res.status}):`, await res.text());
            return null;
        }
        const buffer = await res.arrayBuffer();
        return new Uint8Array(buffer);
    } catch (err) {
        console.error(`${logPrefix} ElevenLabs chunk failed:`, err);
        return null;
    }
}

export async function generateElevenLabsTts(text: string, request: TtsRequest): Promise<TtsResult | null> {
    if (!request.voiceId) return null;
    const model = (request.model as ElevenLabsModel) || ELEVENLABS_DEFAULT_MODEL;
    const logPrefix = request.logPrefix ?? "[elevenlabs-tts]";

    const chunks = splitTtsText(text, ELEVENLABS_MAX_CHUNK_CHARS);
    if (chunks.length === 0) return null;
    const deadlineAt = Math.min(
        request.deadlineAt ?? Number.POSITIVE_INFINITY,
        Date.now() + ELEVENLABS_OPERATION_TIMEOUT_MS,
    );

    const audioChunks = await mapWithBoundedConcurrency(chunks, ELEVENLABS_CHUNK_CONCURRENCY, (chunk, i) =>
        generateElevenLabsChunkMp3(
            chunk,
            request.voiceId,
            model,
            `${logPrefix}[chunk ${i + 1}/${chunks.length}]`,
            deadlineAt,
        ),
        { stopWhen: (result) => result === null },
    );
    if (audioChunks.some((c) => c === null)) return null;

    const totalLength = audioChunks.reduce((acc, c) => acc + (c as Uint8Array).length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
        merged.set(chunk as Uint8Array, offset);
        offset += (chunk as Uint8Array).length;
    }

    // Rough proxy: 128 kbps MP3 = 16 KB/s.
    const durationSeconds = Math.round(merged.length / 16384);

    return {
        base64Audio: Buffer.from(merged).toString("base64"),
        mimeType: "audio/mpeg",
        charCount: text.length,
        durationSeconds,
        provider: "elevenlabs",
        providerModel: model,
    };
}

export const ELEVENLABS_INFO = {
    defaultModel: ELEVENLABS_DEFAULT_MODEL,
    availableModels: ELEVENLABS_AVAILABLE_MODELS,
    maxChunkChars: ELEVENLABS_MAX_CHUNK_CHARS,
} as const;
