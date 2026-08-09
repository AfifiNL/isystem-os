import type { TtsProvider } from "./types";
import { splitTtsTextByUtf8Bytes } from "./text-chunker";

interface GoogleTtsEndpointInput {
    provider: TtsProvider;
    vertexLocation: string;
    overrideLocation?: string;
}

interface GoogleTtsRequestInput {
    provider: TtsProvider;
    text: string;
    voiceId: string;
    languageCode?: string;
    model: string;
}

export interface GoogleMultiSpeakerTurn {
    speaker: "host" | "guest";
    text: string;
}

interface GoogleMultiSpeakerTtsRequestInput {
    turns: GoogleMultiSpeakerTurn[];
    hostVoiceId: string;
    guestVoiceId: string;
    languageCode?: string;
    model: string;
}

export const GOOGLE_TTS_LATENCY_SAFE_INPUT_BYTES = 2_000;

const LANGUAGE_CODE_DEFAULTS: Record<string, string> = {
    ar: "ar-XA",
    en: "en-US",
    nl: "nl-NL",
};

function normalizeLanguageCode(languageCode: string | undefined, voiceId: string): string {
    const explicit = languageCode?.trim();
    if (explicit) {
        return LANGUAGE_CODE_DEFAULTS[explicit.toLowerCase()] ?? explicit;
    }

    const voiceLocale = voiceId.match(/^([a-z]{2})-([A-Z]{2})-/)?.slice(1, 3);
    return voiceLocale ? `${voiceLocale[0]}-${voiceLocale[1]}` : "en-US";
}

function normalizeGeminiCloudTtsLocation(location: string): string {
    const normalized = location.trim().toLowerCase();
    if (!normalized || normalized === "global") return "global";
    if (normalized === "eu" || normalized.startsWith("europe-")) return "eu";
    if (normalized === "us" || normalized.startsWith("us-")) return "us";
    if (normalized === "northamerica-northeast1") return normalized;
    return "global";
}

export function resolveGoogleTtsEndpoint(input: GoogleTtsEndpointInput): string {
    const requestedLocation = input.overrideLocation?.trim() || input.vertexLocation.trim() || "global";
    const location = input.provider === "gemini"
        ? normalizeGeminiCloudTtsLocation(requestedLocation)
        : requestedLocation;
    const hostname = location === "global"
        ? "texttospeech.googleapis.com"
        : `${location}-texttospeech.googleapis.com`;
    return `https://${hostname}/v1/text:synthesize`;
}

export function buildGoogleTtsRequest(input: GoogleTtsRequestInput) {
    return {
        input: { text: input.text },
        voice: {
            languageCode: normalizeLanguageCode(input.languageCode, input.voiceId),
            name: input.voiceId,
            ...(input.provider === "gemini" ? { modelName: input.model } : {}),
        },
        audioConfig: {
            audioEncoding: "MP3",
        },
    };
}

export function buildGoogleMultiSpeakerTtsRequest(input: GoogleMultiSpeakerTtsRequestInput) {
    return {
        input: {
            prompt: "Speak as a natural two-person podcast conversation.",
            multiSpeakerMarkup: {
                turns: input.turns.map((turn) => ({
                    speaker: turn.speaker === "host" ? "Host" : "Guest",
                    text: turn.text,
                })),
            },
        },
        voice: {
            languageCode: normalizeLanguageCode(input.languageCode, input.hostVoiceId),
            modelName: input.model,
            multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                    { speakerAlias: "Host", speakerId: input.hostVoiceId },
                    { speakerAlias: "Guest", speakerId: input.guestVoiceId },
                ],
            },
        },
        audioConfig: {
            audioEncoding: "MP3",
        },
    };
}

/**
 * Keep every native dialogue request small enough for predictable synthesis
 * latency while preserving turn order and speaker identity. Callers may still
 * provide a larger cap for explicit provider-contract checks.
 */
export function splitGoogleMultiSpeakerTurns(
    turns: GoogleMultiSpeakerTurn[],
    maxBytes = GOOGLE_TTS_LATENCY_SAFE_INPUT_BYTES,
): GoogleMultiSpeakerTurn[][] {
    const cap = Math.max(512, Math.min(3_800, Math.floor(maxBytes)));
    const expanded: GoogleMultiSpeakerTurn[] = [];
    const byteLength = (value: GoogleMultiSpeakerTurn[]) =>
        new TextEncoder().encode(JSON.stringify(value)).length;

    for (const turn of turns) {
        const textParts = splitTtsTextByUtf8Bytes(turn.text, cap - 256);
        for (const text of textParts) {
            const pending = [text];
            while (pending.length > 0) {
                const candidateText = pending.shift();
                if (!candidateText) continue;

                const candidate = { speaker: turn.speaker, text: candidateText };
                if (byteLength([candidate]) <= cap) {
                    expanded.push(candidate);
                    continue;
                }

                const characters = Array.from(candidateText);
                let lower = 1;
                let upper = characters.length;
                let fittingLength = 0;
                while (lower <= upper) {
                    const midpoint = Math.floor((lower + upper) / 2);
                    const head = characters.slice(0, midpoint).join("");
                    if (byteLength([{ speaker: turn.speaker, text: head }]) <= cap) {
                        fittingLength = midpoint;
                        lower = midpoint + 1;
                    } else {
                        upper = midpoint - 1;
                    }
                }

                if (fittingLength === 0) {
                    throw new Error("Google TTS dialogue byte cap cannot fit one character.");
                }
                expanded.push({
                    speaker: turn.speaker,
                    text: characters.slice(0, fittingLength).join(""),
                });
                const remainder = characters.slice(fittingLength).join("");
                if (remainder) pending.unshift(remainder);
            }
        }
    }

    const batches: GoogleMultiSpeakerTurn[][] = [];
    let current: GoogleMultiSpeakerTurn[] = [];

    for (const turn of expanded) {
        const candidate = [...current, turn];
        if (current.length > 0 && byteLength(candidate) > cap) {
            batches.push(current);
            current = [turn];
        } else {
            current = candidate;
        }
    }
    if (current.length > 0) batches.push(current);
    return batches;
}

export function resolveGoogleTtsRetryDelayMs(
    status: number,
    retryAfter: string | null,
    attempt: number,
): number | null {
    if (status === 429) {
        const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
        if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
        if (retryAfter) {
            const retryAt = Date.parse(retryAfter);
            if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
        }
        return 60_000;
    }
    if ([408, 425, 500, 502, 503, 504].includes(status)) {
        return Math.min(8_000, 500 * Math.pow(4, Math.max(0, attempt - 1)));
    }
    return null;
}
