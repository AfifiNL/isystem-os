
import { AsyncLocalStorage } from "node:async_hooks";
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import type { AiService, AiModelAlias, AiModelHandle, AiModelMetadata } from "@/shared/lib/ai/models";
import { getProviderModelMetadata, getAiServiceOption, ALIAS_TO_SERVICE_MAP } from "@/shared/lib/ai/models";
import { AiProviderError } from "@/shared/lib/ai/errors";
import {
    getVertexConfig,
    getVertexProvider,
    getVertexImageProvider,
    getVertexAnthropicProvider,
    getVertexMaasProvider,
    VERTEX_ANTHROPIC_LOCATION,
    VERTEX_GOOGLE_LOCATION,
    VERTEX_IMAGE_LOCATION,
    VERTEX_MAAS_LOCATION,
    isVertexProviderEnabled
} from "@/shared/lib/ai/vertex";
import { createAdminClient } from "@/shared/lib/supabase/admin";

export type { AiCapability, AiModelAlias, AiModelMetadata, AiProviderId } from "@/shared/lib/ai/models";
export { AI_MODEL_ALIASES, getProviderModelMetadata, isAiModelAlias } from "@/shared/lib/ai/models";
export { AiProviderError, normalizeAiProviderError } from "@/shared/lib/ai/errors";
export {
    getVertexConfig,
    getVertexProvider,
    getVertexImageProvider,
    getVertexAnthropicProvider,
    getVertexMaasProvider,
    isVertexProviderEnabled
} from "@/shared/lib/ai/vertex";

export interface AiModelContext {
    /** Explicit override for gradual route migration; defaults to AI_PROVIDER. */
    provider?: "vertex" | "google-generative-ai";
    /** Permit future aliases such as video.generate only in explicitly migrated routes. */
    allowFuture?: boolean;
}

export interface AiRequestMetadataInput {
    alias: AiModelAlias;
    workspaceId: string;
    routeName: string;
    operation: string;
    provider?: "vertex" | "google-generative-ai";
}

export interface AiResolvedRequestMetadataInput extends Omit<AiRequestMetadataInput, "alias"> {
    alias: AiModelAlias;
    metadata: AiModelMetadata;
}

export interface AiRequestMetadataLabels {
    provider: string;
    transport: string;
    model_alias: string;
    model_id: string;
    fallback_model_aliases: string;
    fallback_model_ids: string;
    region: string;
    workspace_id: string;
    route_name: string;
    capability: string;
    operation: string;
}

// Request-scoped storage for workspace AI model configurations
export const aiConfigStore = new AsyncLocalStorage<Record<string, string>>();

/**
 * Runs a callback within a request context populated with a workspace's chosen model configs.
 * Calls to `getAiModel` inside this block will dynamically route to the custom models.
 */
export async function runWithWorkspaceAiConfig<T>(
    workspaceId: string | undefined,
    callback: () => Promise<T>
): Promise<T> {
    if (!workspaceId) {
        return callback();
    }

    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("workspaces")
            .select("ai_model_configs")
            .eq("id", workspaceId)
            .maybeSingle();

        if (error) {
            console.warn("[ai-provider] Failed to fetch workspace AI config (will use defaults):", error.message);
            return callback();
        }

        const configs = parseWorkspaceAiModelConfigs(data?.ai_model_configs);
        const hasOverrides = Object.keys(configs).length > 0;
        console.info("[ai-provider] workspace config resolved", {
            workspaceId,
            hasOverrides,
            configs: hasOverrides ? configs : "(none — using defaults)",
        });

        return aiConfigStore.run(configs, callback);
    } catch (err) {
        console.error("[ai-provider] Unexpected error resolving workspace AI config (will use defaults):", err);
        return callback();
    }
}

export function getActiveAiServiceConfig(): Record<string, string> | undefined {
    return aiConfigStore.getStore();
}

function parseWorkspaceAiModelConfigs(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
}

export function getServiceModelMetadata(service: AiService): Omit<AiModelMetadata, "alias"> | null {
    const configs = getActiveAiServiceConfig();
    const chosenOptionId = configs?.[service];
    if (!chosenOptionId) return null;

    const matchedOption = getAiServiceOption(service, chosenOptionId);

    return {
        provider: matchedOption.provider,
        transport: matchedOption.transport,
        modelId: matchedOption.modelId,
        capability: service === "transcription" ? "audio" : "text",
        description: matchedOption.description,
    };
}

let cachedGoogle: GoogleGenerativeAIProvider | null = null;

function getLegacyGoogleProvider(): GoogleGenerativeAIProvider {
    if (cachedGoogle) return cachedGoogle;

    cachedGoogle = createGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
    });
    return cachedGoogle;
}

export function getModelMetadata(alias: AiModelAlias, context: AiModelContext = {}): AiModelMetadata {
    const provider = context.provider ?? (isVertexProviderEnabled() ? "vertex" : "google-generative-ai");
    const baseMetadata = getProviderModelMetadata(alias, provider);

    // Resolve workspace override if present in request store
    const storeConfigs = aiConfigStore.getStore();
    const service = ALIAS_TO_SERVICE_MAP[alias];
    if (storeConfigs && service && storeConfigs[service]) {
        const chosenOptionId = storeConfigs[service];
        const matchedOption = getAiServiceOption(service, chosenOptionId);

        console.info("[ai-provider] model resolution", {
            alias,
            service,
            chosenOptionId,
            matchedOption: matchedOption.modelId,
        });

        return {
            ...baseMetadata,
            modelId: matchedOption.modelId,
            transport: matchedOption.transport,
            provider: matchedOption.provider,
        };
    } else {
        console.info("[ai-provider] using default model", {
            alias,
            service: service ?? "(unmapped alias)",
            reason: !storeConfigs ? "no workspace config in store" : !service ? "alias unmapped" : "no override for service",
            defaultModelId: baseMetadata.modelId,
        });
    }

    return baseMetadata;
}

/**
 * Central model handle resolver. Text routes can pass `getAiModel(alias)`
 * directly to `generateText`/`generateObject`; embedding and image routes get
 * the matching Vercel AI SDK model type. Non-SDK media aliases return model IDs
 * for route-specific transport implemented by later migration agents.
 */
export function getAiModel(alias: AiModelAlias, context: AiModelContext = {}): AiModelHandle {
    const metadata = getModelMetadata(alias, context);
    if (metadata.futureOnly && !context.allowFuture) {
        throw new AiProviderError({
            code: "model_region_unavailable",
            message: `AI model alias ${alias} is reserved for a future/feature-flagged route migration.`,
            provider: metadata.provider,
            modelAlias: alias,
            modelId: metadata.modelId,
            retryable: false,
        });
    }

    if (metadata.provider !== "vertex") {
        const google = getLegacyGoogleProvider();
        switch (metadata.capability) {
            case "text":
            case "audio":
                return google(metadata.modelId);
            case "embedding":
                return google.embeddingModel(metadata.modelId);
            case "image":
                return google.image(metadata.modelId);
            case "video":
                return google.video(metadata.modelId) as unknown as AiModelHandle;
            case "music":
                return metadata.modelId;
        }
    }

    // Resolve Vertex AI transports
    if (metadata.transport === "vertex-google-sdk") {
        switch (metadata.capability) {
            case "text":
            case "audio":
                return getVertexProvider()(metadata.modelId);
            case "embedding":
                return getVertexProvider().embeddingModel(metadata.modelId);
            case "image":
                return getVertexImageProvider().image(metadata.modelId);
            case "video":
                return getVertexProvider().video(metadata.modelId) as unknown as AiModelHandle;
            case "music":
                return metadata.modelId;
        }
    } else if (metadata.transport === "vertex-partner-anthropic") {
        const anthropic = getVertexAnthropicProvider();
        if (metadata.capability === "text") {
            return anthropic(metadata.modelId);
        }
    } else if (metadata.transport === "vertex-maas-openapi") {
        const maas = getVertexMaasProvider();
        if (metadata.capability === "text") {
            return maas(metadata.modelId);
        }
    }

    if (metadata.capability === "music" || metadata.capability === "video") {
        return metadata.modelId;
    }

    throw new AiProviderError({
        code: "model_region_unavailable",
        message: `AI model alias ${alias} uses unsupported transport ${metadata.transport} for capability ${metadata.capability}.`,
        provider: metadata.provider,
        modelAlias: alias,
        modelId: metadata.modelId,
        retryable: false,
    });
}

export function buildAiRequestMetadata(input: AiRequestMetadataInput): AiRequestMetadataLabels {
    const metadata = getModelMetadata(input.alias, { provider: input.provider });
    return buildResolvedAiRequestMetadata({ ...input, metadata });
}

export function buildResolvedAiRequestMetadata(input: AiResolvedRequestMetadataInput): AiRequestMetadataLabels {
    const metadata = input.metadata;
    const region = metadata.provider === "vertex"
        ? metadata.capability === "image"
            ? VERTEX_IMAGE_LOCATION
            : metadata.transport === "vertex-google-sdk"
                ? VERTEX_GOOGLE_LOCATION
                : metadata.transport === "vertex-partner-anthropic"
                    ? VERTEX_ANTHROPIC_LOCATION
                    : metadata.transport === "vertex-maas-openapi"
                        ? VERTEX_MAAS_LOCATION
                        : getVertexConfig().location
        : "global";

    return {
        provider: metadata.provider,
        transport: metadata.transport,
        model_alias: input.alias,
        model_id: metadata.modelId,
        fallback_model_aliases: (metadata.fallbackAliases ?? []).join(","),
        fallback_model_ids: (metadata.fallbackModelIds ?? []).join(","),
        region,
        workspace_id: input.workspaceId,
        route_name: input.routeName,
        capability: metadata.capability,
        operation: input.operation,
    };
}
