export type TtsProvider = "gemini" | "vertex" | "elevenlabs";

export interface TtsRequest {
    /** Provider selected by the workspace voice row. */
    provider: TtsProvider;
    /** Provider-side voice identifier (Gemini name or ElevenLabs voice_id). */
    voiceId: string;
    /** Optional override of the provider's default model. */
    model?: string;
    /** Output format hint — providers may ignore if unsupported. */
    output?: "wav" | "mp3";
    /** Log prefix for debugging. */
    logPrefix?: string;
    /** Target locale/language code */
    languageCode?: string;
    /** Optional enclosing-operation deadline shared across provider work. */
    deadlineAt?: number;
}

export interface TtsResult {
    /** Base64-encoded audio bytes. */
    base64Audio: string;
    /** MIME type of the audio. */
    mimeType: "audio/wav" | "audio/mpeg";
    /** Total characters billed for this generation. */
    charCount: number;
    /** Best-effort duration estimate in seconds (may be undefined). */
    durationSeconds?: number;
    /** Provider-side identifiers for observability + metering. */
    provider: TtsProvider;
    providerModel: string;
}
