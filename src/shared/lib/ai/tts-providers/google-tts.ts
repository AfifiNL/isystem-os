import type { TtsRequest, TtsResult } from "./types";
import { mapWithBoundedConcurrency, withGlobalConcurrencyPermit } from "./bounded-concurrency";
import { splitTtsTextByUtf8Bytes } from "./text-chunker";
import {
    buildGoogleMultiSpeakerTtsRequest,
    buildGoogleTtsRequest,
    GOOGLE_TTS_LATENCY_SAFE_INPUT_BYTES,
    resolveGoogleTtsEndpoint,
    splitGoogleMultiSpeakerTurns,
    type GoogleMultiSpeakerTurn,
} from "./google-tts-contract";
import { concatTtsSegmentsViaFfmpeg } from "./ffmpeg-tts-concat";
import { requestGoogleTtsAudioWithRetry } from "./google-tts-request";
import { getGoogleCloudAccessToken } from "@/shared/lib/ai/google-oauth";
import { resolveProviderAttemptTimeoutMs, settleProviderPromiseWithin } from "@/shared/lib/ai/provider-timeout";
import { getModelMetadata } from "@/shared/lib/ai/provider";
import { getVertexConfig } from "@/shared/lib/ai/vertex";

// Google Cloud Text-to-Speech API Details
const GOOGLE_TTS_MAX_CHUNK_CHARS = 2000; // Legacy metadata exposed through TTS_LIMITS.
const GOOGLE_TTS_MAX_INPUT_BYTES = GOOGLE_TTS_LATENCY_SAFE_INPUT_BYTES;
const GOOGLE_TTS_BATCH_CONCURRENCY = 2;
// Keep provider work inside the route's 300-second execution limit while
// reserving time for script generation, ffmpeg, storage, and persistence.
const GOOGLE_TTS_OPERATION_TIMEOUT_MS = 150_000;
const GEMINI_TTS_MODEL = getModelMetadata("audio.tts", { provider: "vertex" }).modelId;

async function synthesizeGoogleCloudTtsMp3(
    request: TtsRequest,
    requestBody: Record<string, unknown>,
    logPrefix: string,
    deadlineAt: number,
): Promise<Uint8Array | null> {
    try {
        const authTimeoutMs = resolveProviderAttemptTimeoutMs(deadlineAt, { maxAttemptMs: 30_000 });
        if (authTimeoutMs === null) return null;
        const token = await settleProviderPromiseWithin(
            getGoogleCloudAccessToken(),
            authTimeoutMs,
            null,
        );
        if (!token) {
            console.error(`${logPrefix} Google Cloud access token retrieval failed.`);
            return null;
        }

        const projectConfig = getVertexConfig();
        const url = resolveGoogleTtsEndpoint({
            provider: request.provider,
            vertexLocation: projectConfig.location,
            overrideLocation: process.env.GOOGLE_TTS_LOCATION,
        });

        return withGlobalConcurrencyPermit(
            GOOGLE_TTS_BATCH_CONCURRENCY,
            () => requestGoogleTtsAudioWithRetry(
                url,
                {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                    "X-Goog-User-Project": projectConfig.project,
                },
                requestBody,
                logPrefix,
                { deadlineAt },
            ),
            { deadlineAt },
        );
    } catch (err) {
        console.error(`${logPrefix} Google Cloud TTS chunk failed:`, err);
        return null;
    }
}

async function concatGoogleTtsResults(
    segments: TtsResult[],
    logPrefix: string,
): Promise<TtsResult | null> {
    if (segments.length === 0) return null;
    if (segments.length === 1) return segments[0];
    return concatTtsSegmentsViaFfmpeg(segments, {
        interSegmentSilenceMs: 0,
        loudnorm: false,
        logPrefix,
    });
}

export async function generateGoogleTts(text: string, request: TtsRequest): Promise<TtsResult | null> {
    const logPrefix = request.logPrefix ?? "[google-tts]";
    const voiceId = request.voiceId || "Aoede";
    const normalizedRequest = { ...request, voiceId };
    const chunks = splitTtsTextByUtf8Bytes(text, GOOGLE_TTS_MAX_INPUT_BYTES);
    if (chunks.length === 0) return null;
    const deadlineAt = Math.min(
        request.deadlineAt ?? Number.POSITIVE_INFINITY,
        Date.now() + GOOGLE_TTS_OPERATION_TIMEOUT_MS,
    );

    // Keep parallelism bounded: a full fan-out can exceed Gemini's per-model
    // request quota, while strict serialization exhausts the route deadline.
    const results = await mapWithBoundedConcurrency(chunks, GOOGLE_TTS_BATCH_CONCURRENCY, async (chunk, index) => {
        const audio = await synthesizeGoogleCloudTtsMp3(
            normalizedRequest,
            buildGoogleTtsRequest({
                provider: request.provider,
                text: chunk,
                voiceId,
                languageCode: request.languageCode,
                model: request.model || GEMINI_TTS_MODEL,
            }),
            `${logPrefix}[chunk ${index + 1}/${chunks.length}]`,
            deadlineAt,
        );
        if (!audio) return null;
        return {
            base64Audio: Buffer.from(audio).toString("base64"),
            mimeType: "audio/mpeg",
            charCount: chunk.length,
            durationSeconds: Math.round(audio.length / 16000),
            provider: request.provider,
            providerModel: request.provider === "gemini"
                ? (request.model || GEMINI_TTS_MODEL)
                : `google-cloud-tts:${voiceId}`,
        } satisfies TtsResult;
    }, { stopWhen: (result) => result === null });
    if (results.some((result) => !result)) return null;

    const combined = await concatGoogleTtsResults(results as TtsResult[], `${logPrefix}[concat]`);
    return combined ? { ...combined, charCount: text.length } : null;
}

export interface GenerateGoogleMultiSpeakerTtsOptions {
    turns: GoogleMultiSpeakerTurn[];
    hostVoiceId: string;
    guestVoiceId: string;
    model?: string;
    languageCode?: string;
    logPrefix?: string;
    deadlineAt?: number;
}

/**
 * Use Gemini TTS's native two-speaker contract. A 20-turn episode becomes a
 * handful of byte-bounded requests instead of 20 independently retried calls.
 */
export async function generateGoogleMultiSpeakerTts(
    options: GenerateGoogleMultiSpeakerTtsOptions,
): Promise<TtsResult | null> {
    const model = options.model || GEMINI_TTS_MODEL;
    const logPrefix = options.logPrefix ?? "[google-multi-speaker-tts]";
    const batches = splitGoogleMultiSpeakerTurns(options.turns, GOOGLE_TTS_MAX_INPUT_BYTES);
    if (batches.length === 0) return null;
    const deadlineAt = Math.min(
        options.deadlineAt ?? Number.POSITIVE_INFINITY,
        Date.now() + GOOGLE_TTS_OPERATION_TIMEOUT_MS,
    );

    const request: TtsRequest = {
        provider: "gemini",
        voiceId: options.hostVoiceId,
        model,
        languageCode: options.languageCode,
        logPrefix,
    };
    const results = await mapWithBoundedConcurrency(batches, GOOGLE_TTS_BATCH_CONCURRENCY, async (batch, index) => {
        const audio = await synthesizeGoogleCloudTtsMp3(
            request,
            buildGoogleMultiSpeakerTtsRequest({
                turns: batch,
                hostVoiceId: options.hostVoiceId,
                guestVoiceId: options.guestVoiceId,
                languageCode: options.languageCode,
                model,
            }),
            `${logPrefix}[batch ${index + 1}/${batches.length}]`,
            deadlineAt,
        );
        if (!audio) return null;
        return {
            base64Audio: Buffer.from(audio).toString("base64"),
            mimeType: "audio/mpeg",
            charCount: batch.reduce((sum, turn) => sum + turn.text.length, 0),
            durationSeconds: Math.round(audio.length / 16000),
            provider: "gemini",
            providerModel: model,
        } satisfies TtsResult;
    }, { stopWhen: (result) => result === null });
    if (results.some((result) => !result)) return null;

    return concatGoogleTtsResults(results as TtsResult[], `${logPrefix}[concat]`);
}

export const GOOGLE_TTS_INFO = {
    maxChunkChars: GOOGLE_TTS_MAX_CHUNK_CHARS,
} as const;
