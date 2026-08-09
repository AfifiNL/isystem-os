export interface LyriaContractInput {
    model: string;
    prompt: string;
    negativePrompt?: string;
    durationSeconds?: number;
    sampleCount?: number;
    seed?: number;
}

export function isLyria3Model(model: string): boolean {
    return model.startsWith("lyria-3-");
}

export function resolveLyriaEndpoint(input: { project: string; model: string }): string {
    if (isLyria3Model(input.model)) {
        return `https://aiplatform.googleapis.com/v1beta1/projects/${input.project}/locations/global/interactions`;
    }
    return `https://aiplatform.googleapis.com/v1/projects/${input.project}/locations/global/publishers/google/models/${input.model}:predict`;
}

export function buildLyriaRequest(input: LyriaContractInput): Record<string, unknown> {
    if (isLyria3Model(input.model)) {
        return {
            model: input.model,
            input: [{ type: "text", text: input.prompt }],
        };
    }

    return {
        instances: [{
            prompt: input.prompt,
            ...(input.negativePrompt?.trim() ? { negative_prompt: input.negativePrompt.trim() } : {}),
            ...(typeof input.seed === "number" ? { seed: input.seed } : {}),
        }],
        parameters: typeof input.seed === "number"
            ? {}
            : { sample_count: Math.max(1, Math.min(4, input.sampleCount ?? 1)) },
    };
}

export function parseLyriaResponse(data: unknown): { base64Audio: string; mimeType: string } | null {
    if (!data || typeof data !== "object") return null;
    const record = data as Record<string, unknown>;

    if (Array.isArray(record.outputs)) {
        const audio = record.outputs.find((item) => {
            if (!item || typeof item !== "object") return false;
            return (item as Record<string, unknown>).type === "audio";
        }) as Record<string, unknown> | undefined;
        if (typeof audio?.data === "string") {
            return {
                base64Audio: audio.data,
                mimeType: typeof audio.mime_type === "string" ? audio.mime_type : "audio/mpeg",
            };
        }
    }

    if (Array.isArray(record.predictions)) {
        const prediction = record.predictions[0] as Record<string, unknown> | undefined;
        const base64Audio = prediction?.audioContent ?? prediction?.bytesBase64Encoded;
        if (typeof base64Audio === "string") {
            return {
                base64Audio,
                mimeType: typeof prediction?.mimeType === "string" ? prediction.mimeType : "audio/wav",
            };
        }
    }
    return null;
}
