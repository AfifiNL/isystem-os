import type { EmbeddingModel, ImageModel, LanguageModel } from "ai";

/**
 * Stable capability aliases for AI call sites. Downstream route migrations
 * should depend on these aliases rather than hard-coded provider model IDs.
 */
export const AI_MODEL_ALIASES = [
    "text.bulk",
    "text.fast",
    "text.writer",
    "text.reasoning",
    "text.structured.bulk",
    "text.structured",
    "text.legal",
    "text.premium-review",
    "text.seo-automation",
    "text.translation",
    "embedding.text",
    "embedding.multilingual-lowcost",
    "image.fast",
    "image.quality",
    "image.edit",
    "image.premium",
    "audio.tts",
    "audio.transcribe",
    "audio.summarize",
    "music.stable",
    "music.clip",
    "music.pro",
    "video.lite",
    "video.fast",
    "video.quality",
    "video.generate",
] as const;

export type AiModelAlias = (typeof AI_MODEL_ALIASES)[number];

export type AiCapability =
    | "text"
    | "embedding"
    | "image"
    | "audio"
    | "music"
    | "video";

export type AiProviderId = "google-generative-ai" | "vertex" | "openai" | "elevenlabs";

export type AiModelTransport =
    | "google-generative-ai-sdk"
    | "vertex-google-sdk"
    | "vertex-google-rest"
    | "vertex-partner-anthropic"
    | "vertex-maas-openapi"
    | "external-elevenlabs";

export type AiModelHandle = LanguageModel | EmbeddingModel | ImageModel | string;

export interface AiModelMetadata {
    alias: AiModelAlias;
    provider: AiProviderId;
    transport: AiModelTransport;
    modelId: string;
    capability: AiCapability;
    fallbackAliases?: readonly AiModelAlias[];
    fallbackModelIds?: readonly string[];
    /**
     * True for aliases whose route-level integration is intentionally deferred
     * to later migration agents. `getAiModel` refuses these until enabled.
     */
    futureOnly?: boolean;
    description: string;
}

export const LEGACY_GOOGLE_MODEL_METADATA: Record<AiModelAlias, AiModelMetadata> = {
    "text.bulk": {
        alias: "text.bulk",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.fast"],
        description: "Current low-cost GA text alias for high-volume generation on the Gemini API.",
    },
    "text.fast": {
        alias: "text.fast",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        description: "Current GA Gemini text generation for draft, rewrite, and extraction routes.",
    },
    "text.writer": {
        alias: "text.writer",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        fallbackAliases: ["text.reasoning"],
        description: "Current GA long-form writing alias on Gemini Flash with Pro escalation metadata.",
    },
    "text.reasoning": {
        alias: "text.reasoning",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.1-pro-preview",
        capability: "text",
        description: "Higher-reasoning Gemini text generation for strategic synthesis.",
    },
    "text.structured.bulk": {
        alias: "text.structured.bulk",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.structured"],
        description: "Current low-cost GA structured-output alias on Gemini Flash-Lite.",
    },
    "text.structured": {
        alias: "text.structured",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        description: "Structured output on the current GA Gemini Flash model for object generation and schemas.",
    },
    "text.legal": {
        alias: "text.legal",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        fallbackAliases: ["text.reasoning"],
        description: "Current GA legal-assistant text alias on Gemini Flash.",
    },
    "text.premium-review": {
        alias: "text.premium-review",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.1-pro-preview",
        capability: "text",
        fallbackAliases: ["text.reasoning"],
        description: "Compatibility premium review alias on Gemini Pro.",
    },
    "text.seo-automation": {
        alias: "text.seo-automation",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.structured", "text.bulk"],
        description: "Compatibility background SEO automation alias for internal linking, metadata, audits, and retryable optimization jobs.",
    },
    "text.translation": {
        alias: "text.translation",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        fallbackAliases: ["text.fast", "text.bulk"],
        description: "Compatibility translation and localization alias for locale-aware background copy generation.",
    },
    "embedding.text": {
        alias: "embedding.text",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-embedding-001",
        capability: "embedding",
        description: "Text embeddings pinned to 768 dimensions by providerOptions at call sites.",
    },
    "embedding.multilingual-lowcost": {
        alias: "embedding.multilingual-lowcost",
        provider: "google-generative-ai",
        transport: "vertex-maas-openapi",
        modelId: "multilingual-e5-large",
        capability: "embedding",
        futureOnly: true,
        description: "Experimental multilingual E5 embedding path; requires MaaS OpenAPI transport and benchmarking.",
    },
    "image.fast": {
        alias: "image.fast",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.1-flash-lite-image",
        capability: "image",
        description: "Low-latency GA Gemini image generation for asset drafts at 1K resolution.",
    },
    "image.quality": {
        alias: "image.quality",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.1-flash-image",
        capability: "image",
        description: "GA Gemini image generation for higher-quality final assets.",
    },
    "image.edit": {
        alias: "image.edit",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-2.5-flash-image",
        capability: "image",
        fallbackAliases: ["image.fast"],
        futureOnly: true,
        description: "Compatibility Gemini image editing alias; route integration is deferred until image-edit workflows exist.",
    },
    "image.premium": {
        alias: "image.premium",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3-pro-image",
        capability: "image",
        fallbackAliases: ["image.quality"],
        futureOnly: true,
        description: "Compatibility premium Gemini image alias; route integration is deferred until premium visual workflows exist.",
    },
    "audio.tts": {
        alias: "audio.tts",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: typeof process !== "undefined" && process.env.USE_TTS_PREVIEW === "true"
            ? "gemini-3.1-flash-tts-preview"
            : "gemini-2.5-flash-tts",
        capability: "audio",
        description: "Gemini TTS model used by the existing TTS facade.",
    },
    "audio.transcribe": {
        alias: "audio.transcribe",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.6-flash",
        capability: "audio",
        description: "Audio transcription via Gemini structured output.",
    },
    "audio.summarize": {
        alias: "audio.summarize",
        provider: "google-generative-ai",
        transport: "google-generative-ai-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.fast"],
        description: "Compatibility post-transcription summary and action extraction alias.",
    },
    "music.stable": {
        alias: "music.stable",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "lyria-002",
        capability: "music",
        description: "Generally available Lyria 2 fallback for reliable instrumental podcast music generation.",
    },
    "music.clip": {
        alias: "music.clip",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "lyria-3-clip-preview",
        capability: "music",
        fallbackAliases: ["music.stable"],
        description: "Short-form music generation preview model.",
    },
    "music.pro": {
        alias: "music.pro",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "lyria-3-pro-preview",
        capability: "music",
        fallbackAliases: ["music.clip", "music.stable"],
        description: "Longer-form music generation preview model.",
    },
    "video.lite": {
        alias: "video.lite",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-fast-generate-001",
        capability: "video",
        futureOnly: true,
        description: "Future low-cost Veo generation alias; activation requires tier and explicit cost gates.",
    },
    "video.fast": {
        alias: "video.fast",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-fast-generate-001",
        capability: "video",
        fallbackAliases: ["video.lite"],
        futureOnly: true,
        description: "Future fast Veo generation alias; activation requires tier and explicit cost gates.",
    },
    "video.quality": {
        alias: "video.quality",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-generate-001",
        capability: "video",
        fallbackAliases: ["video.fast"],
        futureOnly: true,
        description: "Future highest-quality Veo generation alias; activation requires tier and explicit cost gates.",
    },
    "video.generate": {
        alias: "video.generate",
        provider: "google-generative-ai",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-fast-generate-001",
        capability: "video",
        fallbackAliases: ["video.fast"],
        futureOnly: true,
        description: "Compatibility video generation alias; prefer video.lite/video.fast/video.quality in new routes.",
    },
};

export const VERTEX_MODEL_METADATA: Record<AiModelAlias, AiModelMetadata> = {
    "text.bulk": {
        alias: "text.bulk",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.fast"],
        fallbackModelIds: ["gemini-3.1-flash-lite"],
        description: "Current low-cost GA Vertex Gemini text generation for high-volume tools, simple summaries, and retryable extraction.",
    },
    "text.fast": {
        ...LEGACY_GOOGLE_MODEL_METADATA["text.fast"],
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.6-flash",
        fallbackAliases: ["text.bulk"],
        fallbackModelIds: ["gemini-3.5-flash"],
        description: "Current GA Vertex Gemini workhorse for latency-sensitive, quality-sensitive prose.",
    },
    "text.writer": {
        alias: "text.writer",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        fallbackAliases: ["text.reasoning"],
        fallbackModelIds: ["gemini-3.5-flash"],
        description: "Current GA long-form content writing default with Pro escalation metadata.",
    },
    "text.reasoning": {
        ...LEGACY_GOOGLE_MODEL_METADATA["text.reasoning"],
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.1-pro-preview",
        fallbackModelIds: ["gemini-2.5-pro"],
        description: "Reasoning-first Vertex Gemini alias reserved for deep research, strategy, and hard synthesis.",
    },
    "text.structured.bulk": {
        alias: "text.structured.bulk",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.structured"],
        fallbackModelIds: ["gemini-3.1-flash-lite"],
        description: "Low-cost structured output for retryable simple JSON/schema generation.",
    },
    "text.structured": {
        ...LEGACY_GOOGLE_MODEL_METADATA["text.structured"],
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.6-flash",
        fallbackAliases: ["text.structured.bulk"],
        fallbackModelIds: ["gemini-3.5-flash"],
        description: "Default structured output alias for schema tasks where quality matters.",
    },
    "text.legal": {
        alias: "text.legal",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        fallbackAliases: ["text.premium-review", "text.reasoning"],
        fallbackModelIds: ["gemini-3.5-flash"],
        description: "Legal and bookkeeping prose/suggestions without defaulting to Pro-level cost.",
    },
    "text.premium-review": {
        alias: "text.premium-review",
        provider: "vertex",
        transport: "vertex-partner-anthropic",
        modelId: "claude-sonnet-4-6",
        capability: "text",
        fallbackAliases: ["text.reasoning"],
        futureOnly: true,
        description: "Optional premium review/judge alias for legal, SEO, and long-form quality gates via Vertex partner Anthropic transport.",
    },
    "text.seo-automation": {
        alias: "text.seo-automation",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.structured", "text.bulk"],
        fallbackModelIds: ["gemini-3.1-flash-lite"],
        description: "Dedicated low-cost Vertex alias for background SEO automation: internal links, metadata, audits, and retryable optimization jobs.",
    },
    "text.translation": {
        alias: "text.translation",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.6-flash",
        capability: "text",
        fallbackAliases: ["text.fast", "text.bulk"],
        fallbackModelIds: ["gemini-3.5-flash"],
        description: "Dedicated Vertex alias for background translation and localization jobs without hard-coded model IDs.",
    },
    "embedding.text": {
        ...LEGACY_GOOGLE_MODEL_METADATA["embedding.text"],
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-embedding-001",
        fallbackModelIds: ["gemini-embedding-2"],
        description: "Current production embedding alias pinned to Gemini Embedding 001. Gemini Embedding 2 remains a migration target that requires dual-write/reindex before activation.",
    },
    "embedding.multilingual-lowcost": {
        alias: "embedding.multilingual-lowcost",
        provider: "vertex",
        transport: "vertex-maas-openapi",
        modelId: "multilingual-e5-large",
        capability: "embedding",
        fallbackAliases: ["embedding.text"],
        futureOnly: true,
        description: "Experimental multilingual E5 embedding alias gated behind evaluation against Gemini Embedding 2.",
    },
    "image.fast": {
        ...LEGACY_GOOGLE_MODEL_METADATA["image.fast"],
        provider: "vertex",
        transport: "vertex-google-sdk",
        description: "Low-latency GA Gemini image generation through the global Vertex endpoint.",
    },
    "image.quality": {
        ...LEGACY_GOOGLE_MODEL_METADATA["image.quality"],
        provider: "vertex",
        transport: "vertex-google-sdk",
        description: "Higher-quality GA Gemini image generation through the global Vertex endpoint.",
    },
    "image.edit": {
        alias: "image.edit",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.1-flash-image",
        capability: "image",
        fallbackAliases: ["image.fast"],
        futureOnly: true,
        description: "GA Gemini image editing/reference-consistency alias for future image-edit workflows.",
    },
    "image.premium": {
        alias: "image.premium",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3-pro-image",
        capability: "image",
        fallbackAliases: ["image.quality"],
        futureOnly: true,
        description: "Premium Gemini image alias for reasoning-enhanced composition and text rendering.",
    },
    "audio.tts": {
        ...LEGACY_GOOGLE_MODEL_METADATA["audio.tts"],
        provider: "vertex",
        transport: "vertex-google-rest",
    },
    "audio.transcribe": {
        alias: "audio.transcribe",
        provider: "vertex",
        transport: "vertex-google-rest",
        modelId: "chirp_3",
        capability: "audio",
        fallbackAliases: ["text.fast"],
        fallbackModelIds: ["gemini-3.6-flash"],
        description: "Chirp-first Speech-to-Text v2 transcription over Vertex REST; falls back to Gemini multimodal structured output when Chirp is unavailable.",
    },
    "audio.summarize": {
        alias: "audio.summarize",
        provider: "vertex",
        transport: "vertex-google-sdk",
        modelId: "gemini-3.5-flash-lite",
        capability: "text",
        fallbackAliases: ["text.fast"],
        fallbackModelIds: ["gemini-3.1-flash-lite"],
        description: "Cheap post-transcription summaries and action extraction.",
    },
    "music.stable": {
        alias: "music.stable",
        provider: "vertex",
        transport: "vertex-google-rest",
        modelId: "lyria-002",
        capability: "music",
        description: "Generally available Lyria 2 fallback for reliable instrumental podcast music generation.",
    },
    "music.clip": {
        ...LEGACY_GOOGLE_MODEL_METADATA["music.clip"],
        provider: "vertex",
        transport: "vertex-google-rest",
        fallbackAliases: ["music.stable"],
        description: "Premium/newer short-form Lyria 3 clip preview alias.",
    },
    "music.pro": {
        ...LEGACY_GOOGLE_MODEL_METADATA["music.pro"],
        provider: "vertex",
        transport: "vertex-google-rest",
        fallbackAliases: ["music.clip", "music.stable"],
        description: "Premium longer-form Lyria 3 Pro preview alias.",
    },
    "video.lite": {
        alias: "video.lite",
        provider: "vertex",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-fast-generate-001",
        capability: "video",
        futureOnly: true,
        description: "Cost-controlled Veo 3.1 Fast path; must stay tier-gated with explicit generation cost controls.",
    },
    "video.fast": {
        alias: "video.fast",
        provider: "vertex",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-fast-generate-001",
        capability: "video",
        fallbackAliases: ["video.lite"],
        futureOnly: true,
        description: "Future low-latency Veo 3.1 generation alias; must stay tier-gated with explicit generation cost controls.",
    },
    "video.quality": {
        alias: "video.quality",
        provider: "vertex",
        transport: "vertex-google-rest",
        modelId: "veo-3.1-generate-001",
        capability: "video",
        fallbackAliases: ["video.fast"],
        futureOnly: true,
        description: "Future highest-quality Veo 3.1 generation alias; must stay tier-gated with explicit generation cost controls.",
    },
    "video.generate": {
        ...LEGACY_GOOGLE_MODEL_METADATA["video.generate"],
        provider: "vertex",
        transport: "vertex-google-rest",
        fallbackAliases: ["video.fast"],
        description: "Compatibility alias for existing future-only video metadata; prefer video.lite/video.fast/video.quality in new work.",
    },
};

export function isAiModelAlias(value: string): value is AiModelAlias {
    return (AI_MODEL_ALIASES as readonly string[]).includes(value);
}

export function getProviderModelMetadata(
    alias: AiModelAlias,
    provider: AiProviderId = "vertex",
): AiModelMetadata {
    if (provider === "vertex") return VERTEX_MODEL_METADATA[alias];
    return LEGACY_GOOGLE_MODEL_METADATA[alias];
}

// AI Service Definitions for Workspace Configurations
export const AI_SERVICES = [
    "copywriting",
    "reasoning",
    "structuring",
    "legal",
    "transcription",
    "seo_automation",
    "translation_localization",
] as const;

export type AiService = (typeof AI_SERVICES)[number];

export const INTERACTIVE_AI_SERVICES = [
    "copywriting",
    "reasoning",
    "structuring",
    "legal",
    "transcription",
] as const satisfies readonly AiService[];

export const BACKGROUND_AI_SERVICES = [
    "seo_automation",
    "translation_localization",
] as const satisfies readonly AiService[];

export interface AiServiceOption {
    id: string;
    name: string;
    provider: AiProviderId;
    transport: AiModelTransport;
    modelId: string;
    quality: number; // out of 10
    cost: number;    // out of 5 (EUR symbols)
    description: string;
}

/**
 * Historical option IDs retained only so stored workspace selections can be
 * migrated deterministically. Runtime and UI code must use AI_SERVICE_OPTIONS.
 */
const LEGACY_AI_SERVICE_OPTIONS: Record<AiService, AiServiceOption[]> = {
    copywriting: [
        {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.5,
            cost: 1,
            description: "Google's ultra-low-cost, high-performance champion."
        },
        {
            id: "claude-3.5-haiku",
            name: "Claude 3.5 Haiku",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-3-5-haiku@20241022",
            quality: 9.0,
            cost: 2,
            description: "Anthropic's fast and highly coherent model, great flow."
        },
        {
            id: "deepseek-v3",
            name: "DeepSeek V3",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "deepseek-ai/deepseek-v3.2-maas",
            quality: 9.3,
            cost: 1,
            description: "Flagship cost-efficient open model with strong reasoning."
        },
        {
            id: "qwen-3.7-plus",
            name: "Qwen 3.7 Plus",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "qwen/qwen3-next-80b-a3b-instruct-maas",
            quality: 9.2,
            cost: 1,
            description: "Alibaba's latest multimodal agent model, excellent translation."
        },
        {
            id: "llama-4-8b",
            name: "LLaMA 4 (8B)",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.0,
            cost: 1,
            description: "Meta's highly optimized, low-cost open-weights model."
        }
    ],
    reasoning: [
        {
            id: "gemini-3.1-pro",
            name: "Gemini 3.1 Pro",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-pro-preview",
            quality: 9.5,
            cost: 3,
            description: "Google's balanced high-tier reasoning model."
        },
        {
            id: "claude-3.5-sonnet",
            name: "Claude 3.5 Sonnet",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-3-5-sonnet-v2@20241022",
            quality: 10.0,
            cost: 4,
            description: "Anthropic's gold standard reasoning and synthesis engine."
        },
        {
            id: "deepseek-r1",
            name: "DeepSeek R1",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "deepseek-ai/deepseek-r1-0528-maas",
            quality: 9.8,
            cost: 2,
            description: "Top-tier open reasoning model via serverless MaaS."
        },
        {
            id: "qwen-3.7-max",
            name: "Qwen 3.7 Max",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "qwen/qwen3-next-80b-a3b-thinking-maas",
            quality: 9.8,
            cost: 2,
            description: "Alibaba's flagship agentic reasoning model for complex logic."
        },
        {
            id: "llama-4-70b",
            name: "LLaMA 4 (70B)",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-maverick-17b-128e-instruct-maas",
            quality: 9.5,
            cost: 2,
            description: "Meta's flagship open-weights reasoning model."
        }
    ],
    structuring: [
        {
            id: "gemini-3.1-flash-lite",
            name: "Gemini 3.1 Flash Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-flash-lite",
            quality: 8.5,
            cost: 1,
            description: "Absolute lowest cost for structured metadata outputs."
        },
        {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.5,
            cost: 1,
            description: "Extremely reliable JSON structuring under complex schemas."
        },
        {
            id: "deepseek-v3",
            name: "DeepSeek V3",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "deepseek-ai/deepseek-v3.2-maas",
            quality: 9.0,
            cost: 1,
            description: "Consistent JSON structured output at massive scale."
        },
        {
            id: "claude-3.5-haiku",
            name: "Claude 3.5 Haiku",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-3-5-haiku@20241022",
            quality: 9.5,
            cost: 2,
            description: "Fast, precise structural extraction and classification."
        },
        {
            id: "llama-4-8b",
            name: "LLaMA 4 (8B)",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.5,
            cost: 1,
            description: "Highly efficient open-weights structuring."
        }
    ],
    legal: [
        {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.0,
            cost: 1,
            description: "Massive 1M token context for long compliance contracts."
        },
        {
            id: "claude-3.5-sonnet",
            name: "Claude 3.5 Sonnet",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-3-5-sonnet-v2@20241022",
            quality: 10.0,
            cost: 4,
            description: "Unmatched contract synthesis and legal precision."
        },
        {
            id: "gemini-3.1-pro",
            name: "Gemini 3.1 Pro",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-pro-preview",
            quality: 9.5,
            cost: 3,
            description: "Deep logical reasoning for complex compliance drafting."
        },
        {
            id: "deepseek-r1",
            name: "DeepSeek R1",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "deepseek-ai/deepseek-r1-0528-maas",
            quality: 9.2,
            cost: 2,
            description: "Highly analytical and robust reasoning for policy verification."
        },
        {
            id: "llama-4-70b",
            name: "LLaMA 4 (70B)",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-maverick-17b-128e-instruct-maas",
            quality: 8.8,
            cost: 2,
            description: "Open weights model with excellent instruction alignment."
        }
    ],
    transcription: [
        {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.5,
            cost: 1,
            description: "Handles direct multimodal audio file input natively."
        },
        {
            id: "chirp-3",
            name: "Google Chirp 3",
            provider: "vertex",
            transport: "vertex-google-rest",
            modelId: "chirp_3",
            quality: 9.0,
            cost: 2,
            description: "Native Vertex speech model with high transcription speed."
        },
        {
            id: "gemini-3.1-flash-lite",
            name: "Gemini 3.1 Flash Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-flash-lite",
            quality: 8.0,
            cost: 1,
            description: "Ultra-low cost summarization of transcriptions."
        },
        {
            id: "qwen-3.7-plus",
            name: "Qwen 3.7 Plus",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "qwen/qwen3-next-80b-a3b-instruct-maas",
            quality: 9.2,
            cost: 1,
            description: "Native speech-to-text multimodal understanding."
        },
        {
            id: "llama-4-8b",
            name: "LLaMA 4 (8B)",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.0,
            cost: 1,
            description: "Fast post-transcription summarization."
        }
    ],
    seo_automation: [
        {
            id: "gemini-3.1-flash-lite",
            name: "Gemini 3.1 Flash Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-flash-lite",
            quality: 8.7,
            cost: 1,
            description: "Default low-cost background worker for internal linking, metadata, and bulk SEO checks."
        },
        {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.4,
            cost: 1,
            description: "Higher-quality SEO automation when summaries, rewrites, or mixed-language context need stronger prose."
        },
        {
            id: "deepseek-v3",
            name: "DeepSeek V3",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "deepseek-ai/deepseek-v3.2-maas",
            quality: 9.0,
            cost: 1,
            description: "Cost-efficient open model for large retryable SEO classification and extraction batches."
        },
        {
            id: "qwen-3.7-plus",
            name: "Qwen 3.7 Plus",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "qwen/qwen3-next-80b-a3b-instruct-maas",
            quality: 9.1,
            cost: 1,
            description: "Strong multilingual SEO analysis for locale-aware optimization and internal-link recommendations."
        },
        {
            id: "claude-3.5-haiku",
            name: "Claude 3.5 Haiku",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-3-5-haiku@20241022",
            quality: 9.2,
            cost: 2,
            description: "Fast partner model option for nuanced SEO recommendations at moderate cost."
        }
    ],
    translation_localization: [
        {
            id: "gemini-3.5-flash",
            name: "Gemini 3.5 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.4,
            cost: 1,
            description: "Default localization model for high-quality multilingual copy with stable production transport."
        },
        {
            id: "qwen-3.7-plus",
            name: "Qwen 3.7 Plus",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "qwen/qwen3-next-80b-a3b-instruct-maas",
            quality: 9.3,
            cost: 1,
            description: "Multilingual MaaS option with strong translation quality for large localization batches."
        },
        {
            id: "gemini-3.1-flash-lite",
            name: "Gemini 3.1 Flash Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-flash-lite",
            quality: 8.5,
            cost: 1,
            description: "Ultra-low-cost option for bulk translations where speed and price matter most."
        },
        {
            id: "claude-3.5-haiku",
            name: "Claude 3.5 Haiku",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-3-5-haiku@20241022",
            quality: 9.0,
            cost: 2,
            description: "Partner model option for careful tone preservation across localized copy."
        },
        {
            id: "deepseek-v3",
            name: "DeepSeek V3",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "deepseek-ai/deepseek-v3.2-maas",
            quality: 8.9,
            cost: 1,
            description: "Cost-efficient open model for high-volume translation drafts and secondary locales."
        }
    ]
};

export const AI_SERVICE_OPTIONS: Record<AiService, AiServiceOption[]> = {
    copywriting: [
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.7,
            cost: 2,
            description: "Current GA default for high-quality generation, multimodal work, and long-form copy.",
        },
        {
            id: "gemini-3.5-flash-rollback",
            name: "Gemini 3.5 Flash (Rollback)",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash",
            quality: 9.5,
            cost: 2,
            description: "Stable rollback target if a Gemini 3.6 behavior change affects a production workflow.",
        },
        {
            id: "claude-sonnet-4.6",
            name: "Claude Sonnet 4.6",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-sonnet-4-6",
            quality: 9.8,
            cost: 4,
            description: "Current GA Anthropic partner option for nuanced, premium-quality writing.",
        },
        {
            id: "llama-4-scout",
            name: "Llama 4 Scout",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.5,
            cost: 1,
            description: "Low-cost managed open-model alternative with a large context window.",
        },
    ],
    reasoning: [
        {
            id: "gemini-3.1-pro",
            name: "Gemini 3.1 Pro",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-pro-preview",
            quality: 9.8,
            cost: 3,
            description: "Google's current specialist model for deep reasoning and complex synthesis.",
        },
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.6,
            cost: 2,
            description: "GA reasoning alternative optimized for efficient multi-step execution.",
        },
        {
            id: "claude-sonnet-4.6",
            name: "Claude Sonnet 4.6",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-sonnet-4-6",
            quality: 9.9,
            cost: 4,
            description: "Premium GA partner model for long-context reasoning and review.",
        },
        {
            id: "llama-4-maverick",
            name: "Llama 4 Maverick",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-maverick-17b-128e-instruct-maas",
            quality: 9.0,
            cost: 2,
            description: "Managed open-model alternative for reasoning-heavy workloads.",
        },
    ],
    structuring: [
        {
            id: "gemini-3.5-flash-lite",
            name: "Gemini 3.5 Flash-Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash-lite",
            quality: 9.2,
            cost: 1,
            description: "Current GA default for high-throughput extraction and structured JSON output.",
        },
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.7,
            cost: 2,
            description: "Higher-quality GA option for complex schemas and mixed multimodal context.",
        },
        {
            id: "gemini-3.1-flash-lite-rollback",
            name: "Gemini 3.1 Flash-Lite (Rollback)",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-flash-lite",
            quality: 8.7,
            cost: 1,
            description: "Rollback target for structured workflows that require the prior Flash-Lite behavior.",
        },
        {
            id: "llama-4-scout",
            name: "Llama 4 Scout",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.5,
            cost: 1,
            description: "Managed open-model alternative for extraction and classification.",
        },
    ],
    legal: [
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.5,
            cost: 2,
            description: "Current GA default for long-context legal and bookkeeping drafting.",
        },
        {
            id: "gemini-3.1-pro",
            name: "Gemini 3.1 Pro",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-pro-preview",
            quality: 9.8,
            cost: 3,
            description: "Reasoning-first Google option for complex compliance review.",
        },
        {
            id: "claude-sonnet-4.6",
            name: "Claude Sonnet 4.6",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-sonnet-4-6",
            quality: 9.9,
            cost: 4,
            description: "Premium GA partner option for contract synthesis and review.",
        },
        {
            id: "llama-4-maverick",
            name: "Llama 4 Maverick",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-maverick-17b-128e-instruct-maas",
            quality: 8.8,
            cost: 2,
            description: "Managed open-model alternative for policy analysis.",
        },
    ],
    transcription: [
        {
            id: "chirp-3",
            name: "Google Chirp 3",
            provider: "vertex",
            transport: "vertex-google-rest",
            modelId: "chirp_3",
            quality: 9.2,
            cost: 2,
            description: "Dedicated production Speech-to-Text model and platform default.",
        },
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.6,
            cost: 2,
            description: "Current GA multimodal fallback for direct audio transcription and understanding.",
        },
        {
            id: "gemini-3.5-flash-lite",
            name: "Gemini 3.5 Flash-Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash-lite",
            quality: 8.8,
            cost: 1,
            description: "Low-cost GA option for short audio and post-transcription extraction.",
        },
    ],
    seo_automation: [
        {
            id: "gemini-3.5-flash-lite",
            name: "Gemini 3.5 Flash-Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash-lite",
            quality: 9.1,
            cost: 1,
            description: "Current GA default for high-volume metadata, internal-link, and audit jobs.",
        },
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.6,
            cost: 2,
            description: "Higher-quality GA option for nuanced SEO recommendations and rewrites.",
        },
        {
            id: "gemini-3.1-flash-lite-rollback",
            name: "Gemini 3.1 Flash-Lite (Rollback)",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.1-flash-lite",
            quality: 8.7,
            cost: 1,
            description: "Rollback option for prior high-volume SEO behavior.",
        },
        {
            id: "llama-4-scout",
            name: "Llama 4 Scout",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.6,
            cost: 1,
            description: "Managed open-model alternative for retryable classification and extraction.",
        },
    ],
    translation_localization: [
        {
            id: "gemini-3.6-flash",
            name: "Gemini 3.6 Flash",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.6-flash",
            quality: 9.7,
            cost: 2,
            description: "Current GA default for high-quality multilingual copy and localization.",
        },
        {
            id: "gemini-3.5-flash-lite",
            name: "Gemini 3.5 Flash-Lite",
            provider: "vertex",
            transport: "vertex-google-sdk",
            modelId: "gemini-3.5-flash-lite",
            quality: 9.0,
            cost: 1,
            description: "Low-cost GA option for high-volume localization batches.",
        },
        {
            id: "claude-sonnet-4.6",
            name: "Claude Sonnet 4.6",
            provider: "vertex",
            transport: "vertex-partner-anthropic",
            modelId: "claude-sonnet-4-6",
            quality: 9.6,
            cost: 4,
            description: "Premium partner option for careful tone and nuance preservation.",
        },
        {
            id: "llama-4-scout",
            name: "Llama 4 Scout",
            provider: "vertex",
            transport: "vertex-maas-openapi",
            modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
            quality: 8.5,
            cost: 1,
            description: "Managed open-model alternative for secondary locales.",
        },
    ],
};

export const AI_SERVICE_DEFAULT_MODELS: Record<AiService, string> = {
    copywriting: "gemini-3.6-flash",
    reasoning: "gemini-3.1-pro",
    structuring: "gemini-3.5-flash-lite",
    legal: "gemini-3.6-flash",
    transcription: "chirp-3",
    seo_automation: "gemini-3.5-flash-lite",
    translation_localization: "gemini-3.6-flash",
};

const AI_SERVICE_MODEL_REPLACEMENTS: Readonly<Record<string, string>> = {
    "gemini-3.5-flash": "gemini-3.6-flash",
    "gemini-3.1-flash-lite": "gemini-3.5-flash-lite",
    "claude-3.5-haiku": "claude-sonnet-4.6",
    "claude-3.5-sonnet": "claude-sonnet-4.6",
    "llama-4-8b": "llama-4-scout",
    "llama-4-70b": "llama-4-maverick",
};

const LEGACY_AI_SERVICE_OPTION_IDS = new Set(
    Object.values(LEGACY_AI_SERVICE_OPTIONS)
        .flat()
        .map((option) => option.id),
);

/**
 * Resolve a stored or newly selected option ID to the active catalog. Known
 * legacy IDs are migrated to their direct successor or the service default;
 * unknown values remain invalid so admin mutations can fail closed.
 */
export function migrateAiServiceOptionId(service: AiService, requestedId: string): string | null {
    const options = AI_SERVICE_OPTIONS[service];
    if (options.some((option) => option.id === requestedId)) return requestedId;

    const replacementId = AI_SERVICE_MODEL_REPLACEMENTS[requestedId];
    if (replacementId && options.some((option) => option.id === replacementId)) {
        return replacementId;
    }

    if (LEGACY_AI_SERVICE_OPTION_IDS.has(requestedId)) {
        return AI_SERVICE_DEFAULT_MODELS[service];
    }

    return null;
}

export function getAiServiceOption(service: AiService, requestedId?: string): AiServiceOption {
    const optionId = requestedId
        ? migrateAiServiceOptionId(service, requestedId) ?? AI_SERVICE_DEFAULT_MODELS[service]
        : AI_SERVICE_DEFAULT_MODELS[service];
    const option = AI_SERVICE_OPTIONS[service].find((candidate) => candidate.id === optionId);
    if (!option) {
        throw new Error(`AI service ${service} has no configured default model option.`);
    }
    return option;
}

export const ALIAS_TO_SERVICE_MAP: Record<AiModelAlias, AiService | null> = {
    "text.bulk": "structuring",
    "text.fast": "copywriting",
    "text.writer": "copywriting",
    "text.reasoning": "reasoning",
    "text.structured.bulk": "structuring",
    "text.structured": "structuring",
    "text.legal": "legal",
    "text.premium-review": "reasoning",
    "text.seo-automation": "seo_automation",
    "text.translation": "translation_localization",
    "audio.transcribe": "transcription",
    // Summary/extraction is a text stage. It must not inherit an STT model
    // choice such as Chirp, or the text SDK receives an incompatible model.
    "audio.summarize": null,
    // All non-text/non-transcription aliases are unmapped
    "embedding.text": null,
    "embedding.multilingual-lowcost": null,
    "image.fast": null,
    "image.quality": null,
    "image.edit": null,
    "image.premium": null,
    "audio.tts": null,
    "music.stable": null,
    "music.clip": null,
    "music.pro": null,
    "video.lite": null,
    "video.fast": null,
    "video.quality": null,
    "video.generate": null,
};
