
import {
    generateObject,
    generateText,
    type GenerateObjectResult,
    type LanguageModel,
} from "ai";
import type { ZodType } from "zod";
import { normalizeAiProviderError } from "@/shared/lib/ai/errors";
import { getAiModel, getModelMetadata, type AiModelAlias } from "@/shared/lib/ai/provider";
import type { AiModelTransport, AiModelMetadata } from "@/shared/lib/ai/models";
import { assertSafeGeneratedOutput } from "@/shared/lib/ai/output-safety";

type GenerateTextParams = Parameters<typeof generateText>[0];
type GenerateObjectParams = Parameters<typeof generateObject>[0];

export interface AiRuntimeFallbackAttempt {
    alias: AiModelAlias;
    modelId: string;
    transport: AiModelTransport;
    failed: boolean;
    error?: string;
}

export interface AiRuntimeFallbackMetadata {
    selectedAlias: AiModelAlias;
    selectedModelId: string;
    attempts: AiRuntimeFallbackAttempt[];
}

export type GenerateTextWithFallbackResult = Awaited<ReturnType<typeof generateText>> & {
    runtimeFallback: AiRuntimeFallbackMetadata;
};

export type GenerateObjectWithFallbackResult<T> = GenerateObjectResult<T> & {
    runtimeFallback: AiRuntimeFallbackMetadata;
};

function fallbackChain(alias: AiModelAlias): AiModelAlias[] {
    const metadata = getModelMetadata(alias);
    return [
        alias,
        ...(metadata.fallbackAliases ?? []).filter((fallbackAlias) => {
            const fallbackMetadata = getModelMetadata(fallbackAlias);
            return fallbackMetadata.transport === "vertex-google-sdk" && !fallbackMetadata.futureOnly;
        }),
    ];
}

function shouldRetry(error: unknown, metadata?: Omit<AiModelMetadata, "alias">): boolean {
    const errorName = (error as { name?: unknown })?.name;
    if (errorName === "NoObjectGeneratedError" || errorName === "AI_NoObjectGeneratedError" || errorName === "ZodError") {
        if (metadata && metadata.transport !== "vertex-google-sdk") {
            return true;
        }
        return false;
    }

    const providerError = normalizeAiProviderError(error, {
        provider: "vertex",
        modelAlias: "text.fast",
        modelId: "unknown",
    });

    return providerError.retryable || [
        "model_region_unavailable",
        "quota_rate_limit",
        "permission_denied",
        "empty_output",
    ].includes(providerError.code);
}

function withModel(params: GenerateTextParams, alias: AiModelAlias): GenerateTextParams;
function withModel(params: GenerateObjectParams, alias: AiModelAlias): GenerateObjectParams;
function withModel(params: GenerateTextParams | GenerateObjectParams, alias: AiModelAlias) {
    return {
        ...params,
        model: getAiModel(alias) as LanguageModel,
    };
}

export async function generateTextWithFallback(
    alias: AiModelAlias,
    params: Omit<GenerateTextParams, "model">,
): Promise<GenerateTextWithFallbackResult> {
    const attempts: AiRuntimeFallbackAttempt[] = [];
    let lastError: unknown;

    for (const candidateAlias of fallbackChain(alias)) {
        const metadata = getModelMetadata(candidateAlias);
        try {
            const result = await generateText(withModel(params as unknown as GenerateTextParams, candidateAlias));
            assertSafeGeneratedOutput(result.text);
            const selectedMetadata = getModelMetadata(candidateAlias);
            attempts.push({ alias: candidateAlias, modelId: selectedMetadata.modelId, transport: selectedMetadata.transport, failed: false });
            return Object.assign(result, {
                runtimeFallback: {
                    selectedAlias: candidateAlias,
                    selectedModelId: selectedMetadata.modelId,
                    attempts,
                },
            });
        } catch (error) {
            lastError = error;
            const providerError = normalizeAiProviderError(error, {
                provider: metadata.provider,
                modelAlias: candidateAlias,
                modelId: metadata.modelId,
            });
            attempts.push({ alias: candidateAlias, modelId: metadata.modelId, transport: metadata.transport, failed: true, error: providerError.message });
            if (!shouldRetry(error, metadata)) break;
        }
    }

    throw lastError;
}

export async function generateObjectWithFallback<T>(
    alias: AiModelAlias,
    params: Omit<GenerateObjectParams, "model"> & { schema: ZodType<T> },
): Promise<GenerateObjectWithFallbackResult<T>> {
    const attempts: AiRuntimeFallbackAttempt[] = [];
    let lastError: unknown;

    for (const candidateAlias of fallbackChain(alias)) {
        const metadata = getModelMetadata(candidateAlias);
        try {
            const result = await generateObject(
                withModel(params as unknown as GenerateObjectParams, candidateAlias),
            ) as unknown as GenerateObjectResult<T>;
            assertSafeGeneratedOutput(result.object);
            const selectedMetadata = getModelMetadata(candidateAlias);
            attempts.push({ alias: candidateAlias, modelId: selectedMetadata.modelId, transport: selectedMetadata.transport, failed: false });
            return Object.assign(result, {
                runtimeFallback: {
                    selectedAlias: candidateAlias,
                    selectedModelId: selectedMetadata.modelId,
                    attempts,
                },
            });
        } catch (error) {
            lastError = error;
            const providerError = normalizeAiProviderError(error, {
                provider: metadata.provider,
                modelAlias: candidateAlias,
                modelId: metadata.modelId,
            });
            attempts.push({ alias: candidateAlias, modelId: metadata.modelId, transport: metadata.transport, failed: true, error: providerError.message });
            if (!shouldRetry(error, metadata)) break;
        }
    }

    throw lastError;
}
