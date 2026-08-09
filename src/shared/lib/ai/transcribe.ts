import "server-only";

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getAiModel, getModelMetadata, normalizeAiProviderError, type AiModelAlias } from "@/shared/lib/ai/provider";
import { transcribeAudioWithChirp } from "@/shared/lib/ai/transcribe-providers/chirp";
import { getVertexProvider } from "@/shared/lib/ai/vertex";

export const TRANSCRIPTION_MODEL_ALIAS: Extract<AiModelAlias, "audio.transcribe"> = "audio.transcribe";
const TRANSCRIPTION_SUMMARY_MODEL_ALIAS: Extract<AiModelAlias, "audio.summarize"> = "audio.summarize";
export const TRANSCRIPTION_MODEL_METADATA = getModelMetadata(TRANSCRIPTION_MODEL_ALIAS, { provider: "vertex" });
export const TRANSCRIPTION_MODEL = TRANSCRIPTION_MODEL_METADATA.modelId;

export const TranscriptionResultSchema = z.object({
    transcript: z.string().describe("A clean, verbatim transcript of the audio recording, identifying speakers if possible."),
    summary: z.string().describe("A 2-3 paragraph summary of the meeting, sales call, or voice memo."),
    commitments: z.array(
        z.object({
            title: z.string().describe("A concise title for the task, next action, or commitment."),
            description: z.string().describe("Detailed description of the task, what needs to be delivered, and any specific requirements mentioned."),
            priority: z.enum(["high", "medium", "low"]).describe("The urgency or priority of the commitment based on context."),
            suggested_due_days: z.number().nullable().describe("Number of days from now when this should be delivered. Use null if not specified or clear."),
        })
    ).describe("A list of next steps, action items, commitments, or deliverables identified from the discussion."),
});

export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>;

export interface TranscriptionBillingMetadata {
    provider: "vertex";
    modelAlias: AiModelAlias;
    modelId: string;
    region?: string;
    unitType: "tokens" | "speech_seconds";
    tokensIn?: number;
    tokensOut?: number;
    durationSeconds?: number;
    summaryTokensIn?: number;
    summaryTokensOut?: number;
    fallbackUsed: boolean;
    speechModelId?: string;
    summaryModelId?: string;
}

export type TranscriptionResultWithBilling = TranscriptionResult & {
    billing: TranscriptionBillingMetadata;
};

interface TranscribeAudioParams {
    audioBuffer: ArrayBuffer;
    mimeType: string;
    durationSeconds?: number | null;
}

interface GeminiTranscriptionParams extends TranscribeAudioParams {
    model: LanguageModel;
    modelId: string;
    fallbackUsed: boolean;
}

async function transcribeAudioWithGemini({
    audioBuffer,
    mimeType,
    model,
    modelId,
    fallbackUsed,
}: GeminiTranscriptionParams): Promise<TranscriptionResultWithBilling> {
    const response = await generateObject({
        model,
        schema: TranscriptionResultSchema,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `Analyze this audio recording. Perform the following steps:
1. Provide a clean, verbatim transcription of the entire conversation/audio. Identify different speakers (e.g., Speaker A, Speaker B) if there are multiple voices.
2. Formulate a summary capturing key themes, decisions made, and customer sentiment or pain points.
3. Extract all explicit and implicit action items, commitments, deliverables, and tasks, including who is responsible and estimated timelines if mentioned.
`,
                    },
                    {
                        type: "file",
                        data: audioBuffer,
                        mediaType: mimeType,
                    },
                ],
            },
        ],
    });

    return {
        ...response.object,
        billing: {
            provider: "vertex",
            modelAlias: TRANSCRIPTION_MODEL_ALIAS,
            modelId,
            unitType: "tokens",
            tokensIn: response.usage?.inputTokens ?? Math.max(1, Math.ceil(audioBuffer.byteLength / 256)),
            tokensOut: response.usage?.outputTokens ?? Math.max(1, Math.ceil((response.object.transcript.length + response.object.summary.length) / 4)),
            fallbackUsed,
        },
    };
}

/**
 * Transcribes audio and extracts meeting summaries and structured commitments
 * through Chirp 3 Speech-to-Text plus a cheap Gemini summary/extraction pass.
 * If Chirp is not available in the configured speech region, the facade falls
 * back to the previous Gemini multimodal path and returns billing metadata for
 * the actual model used.
 */
export async function transcribeAudio({ audioBuffer, mimeType, durationSeconds }: TranscribeAudioParams): Promise<TranscriptionResultWithBilling> {
    const speechMetadata = getModelMetadata(TRANSCRIPTION_MODEL_ALIAS, { provider: "vertex" });
    const useChirp = speechMetadata.transport === "vertex-google-rest" && speechMetadata.modelId === "chirp_3";

    if (!useChirp) {
        try {
            return await transcribeAudioWithGemini({
                audioBuffer,
                mimeType,
                durationSeconds,
                model: getAiModel(TRANSCRIPTION_MODEL_ALIAS, { provider: "vertex" }) as LanguageModel,
                modelId: speechMetadata.modelId,
                fallbackUsed: false,
            });
        } catch (error) {
            throw normalizeAiProviderError(error, {
                provider: speechMetadata.provider,
                modelAlias: TRANSCRIPTION_MODEL_ALIAS,
                modelId: speechMetadata.modelId,
            });
        }
    }

    try {
        const chirp = await transcribeAudioWithChirp({ audioBuffer, durationSeconds });
        const summaryMetadata = getModelMetadata(TRANSCRIPTION_SUMMARY_MODEL_ALIAS, { provider: "vertex" });
        const response = await generateObject({
            model: getAiModel(TRANSCRIPTION_SUMMARY_MODEL_ALIAS, { provider: "vertex" }) as LanguageModel,
            schema: TranscriptionResultSchema.pick({ summary: true, commitments: true }),
            system: `You summarize speech transcripts and extract commitments as strict JSON.
Do not invent facts. If a due date or responsible person is unclear, say so in the description and use null for suggested_due_days.`,
            prompt: `Transcript:\n${chirp.transcript}`,
        });

        const tokensIn = response.usage?.inputTokens ?? Math.max(1, Math.ceil(chirp.transcript.length / 4));
        const tokensOut = response.usage?.outputTokens ?? Math.max(1, Math.ceil((response.object.summary.length + JSON.stringify(response.object.commitments).length) / 4));

        const billableDurationSeconds = Math.max(1, Math.ceil(chirp.durationSeconds ?? 1));

        return {
            transcript: chirp.transcript,
            summary: response.object.summary,
            commitments: response.object.commitments,
            billing: {
                provider: "vertex",
                modelAlias: TRANSCRIPTION_MODEL_ALIAS,
                modelId: speechMetadata.modelId,
                region: chirp.region,
                unitType: "speech_seconds",
                durationSeconds: billableDurationSeconds,
                summaryTokensIn: tokensIn,
                summaryTokensOut: tokensOut,
                fallbackUsed: false,
                speechModelId: chirp.modelId,
                summaryModelId: summaryMetadata.modelId,
            },
        };
    } catch (chirpError) {
        console.warn(
            "[transcribe] Chirp transcription unavailable; falling back to Gemini multimodal transcription.",
            chirpError instanceof Error ? chirpError.message : chirpError,
        );
    }

    const fallbackModelId = speechMetadata.fallbackModelIds?.[0] ?? "gemini-3.6-flash";
    try {
        return await transcribeAudioWithGemini({
            audioBuffer,
            mimeType,
            durationSeconds,
            model: getVertexProvider()(fallbackModelId),
            modelId: fallbackModelId,
            fallbackUsed: true,
        });
    } catch (error) {
        throw normalizeAiProviderError(error, {
            provider: speechMetadata.provider,
            modelAlias: TRANSCRIPTION_MODEL_ALIAS,
            modelId: fallbackModelId,
        });
    }
}
