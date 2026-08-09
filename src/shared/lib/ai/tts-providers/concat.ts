import type { TtsResult } from "./types";

/**
 * Concatenate multiple TTS segments into a single audio file.
 *
 * Constraints:
 *   * All segments MUST share the same provider — mixing Gemini WAV with
 *     ElevenLabs MP3 in one file requires transcoding via ffmpeg, which we
 *     leave to the downstream mixer.
 *   * Gemini segments are 24 kHz mono 16-bit PCM wrapped in WAV. We strip
 *     the 44-byte header from all but the first segment and rewrite the
 *     header's data length to match the merged total.
 *   * ElevenLabs segments are CBR MP3 at 128 kbps / 44.1 kHz. MP3 frames are
 *     self-contained so raw byte concatenation produces a valid file (and
 *     most players accept it).
 */
export function concatTtsResults(segments: TtsResult[]): TtsResult | null {
    if (segments.length === 0) return null;
    if (segments.length === 1) return segments[0];

    const provider = segments[0].provider;
    if (segments.some((s) => s.provider !== provider)) {
        throw new Error("Cannot concatenate TTS segments from different providers in this layer.");
    }

    if (provider === "gemini") {
        return concatGeminiWav(segments);
    }
    return concatRawBytes(segments);
}

function concatRawBytes(segments: TtsResult[]): TtsResult {
    const buffers = segments.map((s) => Buffer.from(s.base64Audio, "base64"));
    const merged = Buffer.concat(buffers);
    const totalChars = segments.reduce((acc, s) => acc + s.charCount, 0);
    const totalDuration = segments.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);
    return {
        base64Audio: merged.toString("base64"),
        mimeType: segments[0].mimeType,
        charCount: totalChars,
        durationSeconds: totalDuration,
        provider: segments[0].provider,
        providerModel: segments[0].providerModel,
    };
}

function concatGeminiWav(segments: TtsResult[]): TtsResult {
    const WAV_HEADER_BYTES = 44;
    const buffers = segments.map((s) => Buffer.from(s.base64Audio, "base64"));

    // Take the first segment's header, strip headers from the rest, sum the
    // PCM payloads, then rewrite dataLength + fileSize.
    const firstHeader = buffers[0].subarray(0, WAV_HEADER_BYTES);
    const pcmParts = buffers.map((b, i) => (i === 0 ? b.subarray(WAV_HEADER_BYTES) : b.subarray(WAV_HEADER_BYTES)));
    const totalPcm = Buffer.concat(pcmParts);

    const newHeader = Buffer.from(firstHeader);
    newHeader.writeUInt32LE(WAV_HEADER_BYTES + totalPcm.length - 8, 4);  // RIFF chunk size
    newHeader.writeUInt32LE(totalPcm.length, 40);                         // data chunk size
    const merged = Buffer.concat([newHeader, totalPcm]);

    const totalChars = segments.reduce((acc, s) => acc + s.charCount, 0);
    const totalDuration = segments.reduce((acc, s) => acc + (s.durationSeconds ?? 0), 0);
    return {
        base64Audio: merged.toString("base64"),
        mimeType: "audio/wav",
        charCount: totalChars,
        durationSeconds: totalDuration,
        provider: "gemini",
        providerModel: segments[0].providerModel,
    };
}

/**
 * Multi-speaker script segment.
 */
export interface ScriptSegment {
    speaker: "host" | "guest";
    text: string;
}

/**
 * Parse a script with `[HOST]:` and `[GUEST]:` tags into ordered segments.
 * Untagged content before the first tag is attributed to host.
 *
 *   [HOST]: Welcome back to the show.
 *   [GUEST]: Thanks for having me.
 *   [HOST]: Let's dive in.
 */
export function parseSpeakerScript(script: string): ScriptSegment[] {
    const trimmed = script.trim();
    if (!trimmed) return [];

    const tagRegex = /\[(HOST|GUEST)\]\s*:/gi;
    const segments: ScriptSegment[] = [];
    let lastIndex = 0;
    let currentSpeaker: "host" | "guest" = "host";
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(trimmed)) !== null) {
        const before = trimmed.slice(lastIndex, match.index).trim();
        if (before) {
            segments.push({ speaker: currentSpeaker, text: before });
        }
        currentSpeaker = match[1].toUpperCase() === "HOST" ? "host" : "guest";
        lastIndex = tagRegex.lastIndex;
    }

    const tail = trimmed.slice(lastIndex).trim();
    if (tail) {
        segments.push({ speaker: currentSpeaker, text: tail });
    }

    // Coalesce consecutive same-speaker segments to avoid micro-pauses in
    // the resulting audio (one upstream call covers more text).
    const coalesced: ScriptSegment[] = [];
    for (const seg of segments) {
        const prev = coalesced[coalesced.length - 1];
        if (prev && prev.speaker === seg.speaker) {
            prev.text = `${prev.text} ${seg.text}`;
        } else {
            coalesced.push({ ...seg });
        }
    }
    return coalesced;
}
