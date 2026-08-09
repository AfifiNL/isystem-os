import type { TtsRequest, TtsResult } from "./types";
import { runWithConcurrency, splitTtsText } from "./text-chunker";
import { getModelMetadata } from "@/shared/lib/ai/provider";
import { getGoogleCloudAccessToken } from "@/shared/lib/ai/google-oauth";
import { getVertexConfig, isVertexProviderEnabled } from "../vertex";
import { normalizeAiProviderError } from "../errors";

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TTS_MODEL_METADATA = getModelMetadata("audio.tts", { provider: "vertex" });
const TTS_MODEL = TTS_MODEL_METADATA.modelId;
export const GEMINI_DEFAULT_VOICE = "Aoede";
export const GEMINI_MAX_CHUNK_CHARS = 800;
const TTS_SAMPLE_RATE = 24000;
const TTS_BITS_PER_SAMPLE = 16;
const TTS_CHANNELS = 1;
const TTS_CHUNK_CONCURRENCY = 4;

function buildWavHeader(dataLength: number): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const byteRate = TTS_SAMPLE_RATE * TTS_CHANNELS * (TTS_BITS_PER_SAMPLE / 8);
    const blockAlign = TTS_CHANNELS * (TTS_BITS_PER_SAMPLE / 8);
    const fileSize = 44 + dataLength - 8;

    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, fileSize, true);
    view.setUint32(8, 0x57415645, false);
    view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, TTS_CHANNELS, true);
    view.setUint32(24, TTS_SAMPLE_RATE, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, TTS_BITS_PER_SAMPLE, true);
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, dataLength, true);

    return new Uint8Array(header);
}

async function getGoogleAccessToken(): Promise<string | null> {
    return getGoogleCloudAccessToken();
}

async function generateGeminiChunkPcm(text: string, voice: string, logPrefix: string): Promise<Uint8Array | null> {
    const isVertex = isVertexProviderEnabled();
    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (isVertex) {
        const config = getVertexConfig();
        const token = await getGoogleAccessToken();
        if (!token) {
            console.error(`${logPrefix} Vertex AI TTS configuration error: OAuth token generation failed`);
            return null;
        }
        url = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.project}/locations/${config.location}/publishers/google/models/${TTS_MODEL}:generateContent`;
        headers["Authorization"] = `Bearer ${token}`;
    } else {
        if (!API_KEY) {
            console.error(`${logPrefix} GOOGLE_GENERATIVE_AI_API_KEY is not configured.`);
            return null;
        }
        url = `${GEMINI_BASE}/models/${TTS_MODEL}:generateContent?key=${API_KEY}`;
    }

    try {
        const res = await fetch(
            url,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    contents: [{ parts: [{ text }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                        },
                    },
                }),
            },
        );
        if (!res.ok) {
            console.error(`${logPrefix} Gemini TTS API error:`, await res.text());
            return null;
        }
        const data = await res.json();
        const audioPart = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!audioPart?.data) {
            console.error(`${logPrefix} No audio data in Gemini response`);
            return null;
        }
        return Uint8Array.from(atob(audioPart.data), (c) => c.charCodeAt(0));
    } catch (err) {
        console.error(`${logPrefix} Gemini chunk failed:`, err);
        return null;
    }
}

export async function generateGeminiTts(text: string, request: TtsRequest): Promise<TtsResult | null> {
    const voice = request.voiceId || GEMINI_DEFAULT_VOICE;
    const logPrefix = request.logPrefix ?? "[gemini-tts]";
    const chunks = splitTtsText(text, GEMINI_MAX_CHUNK_CHARS);
    if (chunks.length === 0) return null;

    const pcmChunks = await runWithConcurrency(chunks, TTS_CHUNK_CONCURRENCY, (chunk, i) =>
        generateGeminiChunkPcm(chunk, voice, `${logPrefix}[chunk ${i + 1}/${chunks.length}]`),
    );
    if (pcmChunks.some((c) => c === null)) {
        if (isVertexProviderEnabled()) {
            const config = getVertexConfig();
            throw normalizeAiProviderError(new Error("Gemini TTS chunk generation failed."), {
                provider: "vertex",
                modelAlias: "audio.tts",
                modelId: TTS_MODEL,
                region: config.location,
            });
        }
        return null;
    }

    const totalLength = pcmChunks.reduce((acc, c) => acc + (c as Uint8Array).length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunks) {
        merged.set(chunk as Uint8Array, offset);
        offset += (chunk as Uint8Array).length;
    }

    const wavHeader = buildWavHeader(merged.length);
    const wavFile = new Uint8Array(wavHeader.length + merged.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(merged, wavHeader.length);

    // Each PCM byte represents 1/(2*24000) of a second (mono 16-bit @ 24 kHz).
    const durationSeconds = Math.round(merged.length / (TTS_SAMPLE_RATE * (TTS_BITS_PER_SAMPLE / 8) * TTS_CHANNELS));

    return {
        base64Audio: Buffer.from(wavFile).toString("base64"),
        mimeType: "audio/wav",
        charCount: text.length,
        durationSeconds,
        provider: "gemini",
        providerModel: TTS_MODEL,
    };
}

export const GEMINI_TTS_INFO = {
    model: TTS_MODEL,
    defaultVoice: GEMINI_DEFAULT_VOICE,
    maxChunkChars: GEMINI_MAX_CHUNK_CHARS,
} as const;
