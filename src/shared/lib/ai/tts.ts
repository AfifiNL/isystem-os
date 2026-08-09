// Provider-aware TTS facade.
//
// Backwards compat: `generateTts(text, logPrefix?)` keeps its original
// signature (Gemini, default voice, single WAV out) so existing callers in
// generate-assets and voiceover routes work unchanged.
//
// New entry point: `generateTtsViaProvider({ provider, voiceId, ... })` for
// callers that need ElevenLabs cloned voices or non-default Gemini voices.
//
// The chunking + sentence splitter live in tts-providers/text-chunker.ts so
// each provider implements only its API call, not transport plumbing.

import { GEMINI_TTS_INFO } from "./tts-providers/gemini";
import { generateGoogleMultiSpeakerTts, generateGoogleTts, GOOGLE_TTS_INFO } from "./tts-providers/google-tts";
import { generateElevenLabsTts, ELEVENLABS_INFO } from "./tts-providers/elevenlabs";
import type { ScriptSegment } from "./tts-providers/concat";
import type { TtsProvider, TtsRequest, TtsResult } from "./tts-providers/types";

export type { TtsProvider, TtsResult } from "./tts-providers/types";

export interface GenerateTtsOptions {
    provider?: TtsProvider;
    voiceId?: string;
    model?: string;
    logPrefix?: string;
    languageCode?: string;
    deadlineAt?: number;
}

export async function generateTtsViaProvider(text: string, options: GenerateTtsOptions): Promise<TtsResult | null> {
    const provider = options.provider ?? "gemini";
    const request: TtsRequest = {
        provider,
        voiceId: options.voiceId ?? "",
        model: options.model,
        logPrefix: options.logPrefix,
        languageCode: options.languageCode,
        deadlineAt: options.deadlineAt,
    };

    if (provider === "elevenlabs") {
        return generateElevenLabsTts(text, request);
    }
    return generateGoogleTts(text, request);
}

export interface GenerateMultiSpeakerTtsOptions {
    provider: TtsProvider;
    hostVoiceId: string;
    guestVoiceId: string;
    model?: string;
    languageCode?: string;
    logPrefix?: string;
    deadlineAt?: number;
}

export async function generateMultiSpeakerTtsViaProvider(
    turns: ScriptSegment[],
    options: GenerateMultiSpeakerTtsOptions,
): Promise<TtsResult | null> {
    if (options.provider !== "gemini") return null;
    return generateGoogleMultiSpeakerTts({
        turns,
        hostVoiceId: options.hostVoiceId,
        guestVoiceId: options.guestVoiceId,
        model: options.model,
        languageCode: options.languageCode,
        logPrefix: options.logPrefix,
        deadlineAt: options.deadlineAt,
    });
}

/**
 * Backwards-compatible default-Gemini entry point. Existing callers keep their
 * signature; new callers should prefer `generateTtsViaProvider`.
 */
export async function generateTts(text: string, logPrefix = "[tts]"): Promise<TtsResult | null> {
    return generateTtsViaProvider(text, { provider: "gemini", logPrefix });
}

/**
 * Long-form alias kept for callers that imported the previous `generateTtsChunked`
 * — implementation now identical to `generateTts` since chunking is a provider
 * detail (Gemini chunks at 800; ElevenLabs at 2500).
 */
export async function generateTtsChunked(text: string, options: { voice?: string; logPrefix?: string } = {}): Promise<TtsResult | null> {
    return generateTtsViaProvider(text, {
        provider: "gemini",
        voiceId: options.voice,
        logPrefix: options.logPrefix,
    });
}

export const TTS_LIMITS = {
    defaultProvider: "gemini" as TtsProvider,
    gemini: GEMINI_TTS_INFO,
    vertex: GOOGLE_TTS_INFO,
    elevenlabs: ELEVENLABS_INFO,
    /** Legacy alias preserved for callers in generate-podcast-episode. */
    defaultVoice: GEMINI_TTS_INFO.defaultVoice,
    maxChunkChars: GEMINI_TTS_INFO.maxChunkChars,
} as const;
