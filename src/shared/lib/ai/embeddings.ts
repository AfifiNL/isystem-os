import "server-only";

import { embed, embedMany, type EmbeddingModel } from "ai";
import { getAiModel, getModelMetadata, normalizeAiProviderError, type AiModelAlias } from "@/shared/lib/ai/provider";
import { getVertexProvider } from "@/shared/lib/ai/vertex";

export const EMBEDDING_MODEL_ALIAS: Extract<AiModelAlias, "embedding.text"> = "embedding.text";
export const EMBEDDING_V2_MODEL_ID = "gemini-embedding-2";
export const EMBEDDING_MODEL_METADATA = getModelMetadata(EMBEDDING_MODEL_ALIAS, { provider: "vertex" });
export const EMBEDDING_MODEL = EMBEDDING_MODEL_METADATA.modelId;
export const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_TASK_TYPE = "SEMANTIC_SIMILARITY";

export const EMBEDDING_PROVIDER_OPTIONS = {
    vertex: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: EMBEDDING_TASK_TYPE,
    },
} as const;

function getVertexEmbeddingModel(): EmbeddingModel {
    return getAiModel(EMBEDDING_MODEL_ALIAS, { provider: "vertex" }) as EmbeddingModel;
}

/**
 * Generates a 768-dimension vector embedding for the given text.
 *
 * The Vertex `embedding.text` alias currently remains pinned to
 * `gemini-embedding-001`. Gemini Embedding 2 is a migration target only: changing
 * embedding models changes vector space even when dimensions stay at 768, so it
 * requires dual-write/reindex validation before activation.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    try {
        const { embedding } = await embed({
            model: getVertexEmbeddingModel(),
            value: text,
            providerOptions: EMBEDDING_PROVIDER_OPTIONS,
        });

        return embedding;
    } catch (error) {
        throw normalizeAiProviderError(error, {
            provider: EMBEDDING_MODEL_METADATA.provider,
            modelAlias: EMBEDDING_MODEL_ALIAS,
            modelId: EMBEDDING_MODEL,
        });
    }
}

/**
 * Generates vector embeddings for a list of texts in a batch.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
        const { embeddings } = await embedMany({
            model: getVertexEmbeddingModel(),
            values: texts,
            providerOptions: EMBEDDING_PROVIDER_OPTIONS,
        });

        return embeddings;
    } catch (error) {
        throw normalizeAiProviderError(error, {
            provider: EMBEDDING_MODEL_METADATA.provider,
            modelAlias: EMBEDDING_MODEL_ALIAS,
            modelId: EMBEDDING_MODEL,
        });
    }
}

/**
 * Generates the migration-target Gemini Embedding 2 vector. This is deliberately
 * separate from `generateEmbedding()` so active search never mixes vector spaces.
 */
export async function generateEmbeddingV2ForMigration(text: string): Promise<number[]> {
    try {
        const { embedding } = await embed({
            model: getVertexProvider().embeddingModel(EMBEDDING_V2_MODEL_ID) as EmbeddingModel,
            value: text,
            providerOptions: {
                vertex: {
                    outputDimensionality: EMBEDDING_DIMENSIONS,
                    taskType: EMBEDDING_TASK_TYPE,
                },
            },
        });

        return embedding;
    } catch (error) {
        throw normalizeAiProviderError(error, {
            provider: EMBEDDING_MODEL_METADATA.provider,
            modelAlias: EMBEDDING_MODEL_ALIAS,
            modelId: EMBEDDING_V2_MODEL_ID,
        });
    }
}
