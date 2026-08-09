import "server-only";

import { z } from "zod";
import { AiProviderError, normalizeAiProviderError } from "@/shared/lib/ai/errors";
import { getGoogleCloudAccessToken } from "@/shared/lib/ai/google-oauth";
import { getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import { getVertexConfig } from "@/shared/lib/ai/vertex";

const CHIRP_MODEL_ALIAS: Extract<AiModelAlias, "audio.transcribe"> = "audio.transcribe";
const CHIRP_REGION_OVERRIDE = "GOOGLE_CHIRP_LOCATION";

const ChirpAlternativeSchema = z.object({
    transcript: z.string().optional(),
});

const ChirpResultSchema = z.object({
    alternatives: z.array(ChirpAlternativeSchema).optional(),
});

const ChirpRecognizeResponseSchema = z.object({
    results: z.array(ChirpResultSchema).optional(),
});

export interface ChirpTranscriptionResult {
    transcript: string;
    modelId: string;
    region: string;
    durationSeconds?: number;
}

export interface ChirpTranscribeAudioParams {
    audioBuffer: ArrayBuffer;
    durationSeconds?: number | null;
    languageCodes?: string[];
}

function getChirpRegion(): string {
    const override = process.env[CHIRP_REGION_OVERRIDE]?.trim();
    if (override) return override;

    const configured = getVertexConfig().location;
    if (configured.startsWith("europe") || configured.startsWith("eu-")) return "eu";
    return "us";
}

export async function transcribeAudioWithChirp({
    audioBuffer,
    durationSeconds,
    languageCodes = ["en-US", "nl-NL", "ar-XA"],
}: ChirpTranscribeAudioParams): Promise<ChirpTranscriptionResult> {
    const metadata = getModelMetadata(CHIRP_MODEL_ALIAS, { provider: "vertex" });
    const config = getVertexConfig();
    const region = getChirpRegion();
    const token = await getGoogleCloudAccessToken();

    if (!token) {
        throw new AiProviderError({
            code: "auth_config_missing",
            message: "Speech-to-Text Chirp configuration error: OAuth token generation failed.",
            provider: "vertex",
            modelAlias: CHIRP_MODEL_ALIAS,
            modelId: metadata.modelId,
            region,
            retryable: false,
        });
    }

    const url = `https://${region}-speech.googleapis.com/v2/projects/${config.project}/locations/${region}/recognizers/_:recognize`;
    const body = {
        config: {
            autoDecodingConfig: {},
            languageCodes,
            model: metadata.modelId,
            features: {
                enableAutomaticPunctuation: true,
            },
        },
        content: Buffer.from(audioBuffer).toString("base64"),
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new AiProviderError({
                code: response.status === 429 ? "quota_rate_limit" : "model_region_unavailable",
                message: `Chirp upstream ${response.status}: ${text.slice(0, 240)}`,
                provider: "vertex",
                modelAlias: CHIRP_MODEL_ALIAS,
                modelId: metadata.modelId,
                region,
                retryable: response.status === 429 || response.status >= 500,
            });
        }

        const parsed = ChirpRecognizeResponseSchema.parse(await response.json());
        const transcript = (parsed.results ?? [])
            .map((result) => result.alternatives?.[0]?.transcript?.trim() ?? "")
            .filter(Boolean)
            .join("\n")
            .trim();

        if (!transcript) {
            throw new AiProviderError({
                code: "empty_output",
                message: "Chirp returned no transcript text.",
                provider: "vertex",
                modelAlias: CHIRP_MODEL_ALIAS,
                modelId: metadata.modelId,
                region,
                retryable: true,
            });
        }

        return {
            transcript,
            modelId: metadata.modelId,
            region,
            durationSeconds: typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0
                ? durationSeconds
                : undefined,
        };
    } catch (error) {
        throw normalizeAiProviderError(error, {
            provider: "vertex",
            modelAlias: CHIRP_MODEL_ALIAS,
            modelId: metadata.modelId,
            region,
        });
    }
}
