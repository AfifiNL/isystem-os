// Gemini pricing configuration for the AI credit system.
//
// Unit: millicents EUR. 1 millicent = 1/100 of a euro cent = 1/10,000 of EUR 1.
// Integer math only — no floating-point drift. BIGINT-safe on the DB side.
//
// Pricing verification checklist (run quarterly):
// 1. Check ai.google.dev/pricing for current USD rates per model.
// 2. Convert USD → EUR using the prevailing ECB rate on the review date.
// 3. Update the numbers below and bump LAST_VERIFIED_AT.
// 4. Spot-check a recent ai_usage_events row: divide charged_millicents by
//    (1 + PLATFORM_FEE_BPS/10000) to get base cost, then verify against the
//    provider invoice.
//
// All per-1M-token figures are charged-to-customer rates BEFORE the platform
// fee is applied. The fee is added downstream in meterAndCharge().

export const LAST_VERIFIED_AT = "2026-08-09";

export interface TokenPricing {
    kind: "tokens";
    inputPerMillionTokens: number;   // millicents per 1,000,000 input tokens
    outputPerMillionTokens: number;  // millicents per 1,000,000 output tokens
}

export interface ImagePricing {
    kind: "image";
    perImage: number; // millicents per generated image
}

export interface TtsPricing {
    kind: "tts_char";
    perCharacter: number; // millicents per input character
}

export interface MusicPricing {
    kind: "music_seconds";
    perSecond: number; // millicents per generated second of audio
}

export interface SpeechTranscriptionPricing {
    kind: "speech_seconds";
    perSecond: number; // millicents per input second of audio
}

export interface VideoPricing {
    kind: "video_seconds";
    perSecond: number; // millicents per generated second of video
}

export type ModelPricing = TokenPricing | ImagePricing | TtsPricing | MusicPricing | SpeechTranscriptionPricing | VideoPricing;

export interface ModelPricingMetadata {
    provider: "google-generative-ai" | "vertex" | "elevenlabs" | "higgsfield";
    modelId: string;
    aliases?: readonly string[];
    pricing: ModelPricing;
    pricingStatus?: "active" | "scaffold";
    notes?: string;
}

// Placeholder numbers — verify against ai.google.dev/pricing before launch.
// Current values assume approximate EU rates as of April 2026.
const MODELS: Record<string, ModelPricing> = {
    "gemini-2.5-flash": {
        kind: "tokens",
        inputPerMillionTokens: 7_500,      // ~€0.075 per 1M in
        outputPerMillionTokens: 30_000,    // ~€0.30 per 1M out
    },
    "gemini-2.5-pro": {
        kind: "tokens",
        inputPerMillionTokens: 125_000,    // ~€1.25 per 1M in
        outputPerMillionTokens: 1_000_000, // ~€10.00 per 1M out
    },
    // Conservative scaffolds for the 2026 Vertex alias migration. These keep
    // newly-active aliases billable while exact regional invoices are verified.
    // Never remove these without replacing them with verified production rates.
    "gemini-3.1-flash-lite": {
        kind: "tokens",
        inputPerMillionTokens: 7_500,
        outputPerMillionTokens: 30_000,
    },
    "gemini-3.5-flash-lite": {
        kind: "tokens",
        // USD 0.30 / 1.1389 USD per EUR, rounded up from the ECB reference rate.
        inputPerMillionTokens: 2_700,
        // USD 2.50 / 1.1389 USD per EUR, rounded up from the ECB reference rate.
        outputPerMillionTokens: 22_000,
    },
    "gemini-3.5-flash": {
        kind: "tokens",
        inputPerMillionTokens: 15_000,
        outputPerMillionTokens: 60_000,
    },
    "gemini-3.6-flash": {
        kind: "tokens",
        // USD 1.50 / 1.1389 USD per EUR, rounded up from the ECB reference rate.
        inputPerMillionTokens: 13_200,
        // USD 7.50 / 1.1389 USD per EUR, rounded up from the ECB reference rate.
        outputPerMillionTokens: 65_900,
    },
    "gemini-3.1-pro-preview": {
        kind: "tokens",
        inputPerMillionTokens: 125_000,
        outputPerMillionTokens: 1_000_000,
    },
    "gemini-embedding-2": {
        kind: "tokens",
        inputPerMillionTokens: 10_000,
        outputPerMillionTokens: 0,
    },
    "chirp_3": {
        kind: "speech_seconds",
        perSecond: 16,
    },
    "gemini-3.1-flash-lite-image": {
        kind: "image",
        // USD 0.034 / 1.1389 USD per EUR, rounded up from the 2026-07-27 ECB reference rate.
        perImage: 300,
    },
    "gemini-3.1-flash-image": {
        kind: "image",
        // USD 0.067 / 1.1389 USD per EUR, rounded up from the 2026-07-27 ECB reference rate.
        perImage: 590,
    },
    "gemini-2.5-flash-preview-tts": {
        kind: "tts_char",
        perCharacter: 1,                   // ~€0.00001 per character
    },
    "gemini-2.5-flash-tts": {
        kind: "tts_char",
        perCharacter: 1,
    },
    "gemini-3.1-flash-tts-preview": {
        kind: "tts_char",
        perCharacter: 1,
    },
    // ElevenLabs is credit-based; converted to per-character at the platform
    // layer using the 2026 Q2 character-cost equivalent. Verify against
    // elevenlabs.io/pricing on each LAST_VERIFIED_AT bump.
    "eleven_multilingual_v2": {
        kind: "tts_char",
        perCharacter: 18,                  // ~€0.00018 per character
    },
    "eleven_v3": {
        kind: "tts_char",
        perCharacter: 30,                  // ~€0.00030 per character (premium expressive)
    },
    "eleven_flash_v2_5": {
        kind: "tts_char",
        perCharacter: 9,                   // ~€0.00009 per character (low-latency)
    },
    "eleven_flash_v2": {
        kind: "tts_char",
        perCharacter: 9,
    },
    // Lyria 3 (Google) — preview music generation. Verify against the latest
    // Vertex/Gemini pricing on each LAST_VERIFIED_AT bump. Numbers below are
    // approximate per-second equivalents at typical 2026 Q2 rates.
    "lyria-3-clip-preview": {
        kind: "music_seconds",
        perSecond: 200,                    // ~€0.002 per second of audio
    },
    "lyria-002": {
        kind: "music_seconds",
        perSecond: 200,                    // scaffold; alias remains on Lyria 3 Clip until model ID is smoke-tested
    },
    "lyria-3-pro-preview": {
        kind: "music_seconds",
        perSecond: 600,                    // ~€0.006 per second (longer, structured)
    },
    // Vertex AI aliases use the same underlying Google model IDs during the
    // migration. Keep these IDs active so existing metering continues to work;
    // provider-specific metadata below records the Vertex mapping separately.
    "veo-3.1-fast-generate-preview": {
        kind: "video_seconds",
        perSecond: 2_000,                  // scaffold only; verify before enabling video routes
    },
    "veo-3.1-fast-generate-001": {
        kind: "video_seconds",
        perSecond: 2_000,
    },
    "veo-3.1-generate-001": {
        kind: "video_seconds",
        perSecond: 4_000,
    },
    "higgsfield-video-scaffold-v1": {
        kind: "video_seconds",
        perSecond: 2_000,                  // scaffold only; replace after official Higgsfield pricing verification
    },
    "deepseek-ai/deepseek-v3.2-maas": {
        kind: "tokens",
        inputPerMillionTokens: 10_000,
        outputPerMillionTokens: 40_000,
    },
    "deepseek-ai/deepseek-r1-0528-maas": {
        kind: "tokens",
        inputPerMillionTokens: 20_000,
        outputPerMillionTokens: 80_000,
    },
    "qwen/qwen3-next-80b-a3b-instruct-maas": {
        kind: "tokens",
        inputPerMillionTokens: 10_000,
        outputPerMillionTokens: 40_000,
    },
    "qwen/qwen3-next-80b-a3b-thinking-maas": {
        kind: "tokens",
        inputPerMillionTokens: 20_000,
        outputPerMillionTokens: 80_000,
    },
    "meta/llama-4-scout-17b-16e-instruct-maas": {
        kind: "tokens",
        inputPerMillionTokens: 10_000,
        outputPerMillionTokens: 40_000,
    },
    "meta/llama-4-maverick-17b-128e-instruct-maas": {
        kind: "tokens",
        inputPerMillionTokens: 20_000,
        outputPerMillionTokens: 80_000,
    },
    "claude-3-5-haiku@20241022": {
        kind: "tokens",
        inputPerMillionTokens: 80_000,
        outputPerMillionTokens: 400_000,
    },
    "claude-3-5-sonnet-v2@20241022": {
        kind: "tokens",
        inputPerMillionTokens: 300_000,
        outputPerMillionTokens: 1_500_000,
    },
    "claude-sonnet-4-6": {
        kind: "tokens",
        inputPerMillionTokens: 26_400,
        outputPerMillionTokens: 131_700,
    },
};

export const PROVIDER_MODEL_PRICING_METADATA: readonly ModelPricingMetadata[] = [
    ...Object.entries(MODELS).map(([modelId, pricing]) => ({
        provider: modelId.startsWith("eleven_") ? "elevenlabs" as const : "google-generative-ai" as const,
        modelId,
        pricing,
        pricingStatus: modelId.startsWith("veo-") ? "scaffold" as const : "active" as const,
    })),
    {
        provider: "vertex",
        modelId: "gemini-2.5-flash",
        aliases: ["text.fast", "text.structured", "audio.transcribe"],
        pricing: MODELS["gemini-2.5-flash"],
        pricingStatus: "scaffold",
        notes: "Vertex migration scaffold; verify regional Vertex invoice rates before cutover.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.1-flash-lite",
        aliases: ["text.bulk", "text.structured.bulk", "text.seo-automation", "audio.summarize"],
        pricing: MODELS["gemini-3.1-flash-lite"],
        pricingStatus: "scaffold",
        notes: "Conservative active scaffold for 2026 Vertex alias migration; verify exact regional invoice rates before launch.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.5-flash-lite",
        aliases: ["text.bulk", "text.structured.bulk", "text.seo-automation", "audio.summarize"],
        pricing: MODELS["gemini-3.5-flash-lite"],
        pricingStatus: "active",
        notes: "GA model priced from Google's 2026-07-21 public rate card and converted to EUR.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.5-flash",
        aliases: ["text.fast", "text.writer", "text.structured", "text.legal", "text.translation", "audio.transcribe"],
        pricing: MODELS["gemini-3.5-flash"],
        pricingStatus: "scaffold",
        notes: "Conservative active scaffold for 2026 Vertex alias migration; verify exact regional invoice rates before launch.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.6-flash",
        aliases: ["text.fast", "text.writer", "text.structured", "text.legal", "text.translation", "audio.transcribe"],
        pricing: MODELS["gemini-3.6-flash"],
        pricingStatus: "active",
        notes: "GA model priced from Google's 2026-07-21 public rate card and converted to EUR.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.1-pro-preview",
        aliases: ["text.reasoning"],
        pricing: MODELS["gemini-3.1-pro-preview"],
        pricingStatus: "scaffold",
        notes: "Preview reasoning alias scaffold; runtime fallback to Gemini 2.5 Pro should remain available.",
    },
    {
        provider: "vertex",
        modelId: "gemini-2.5-pro",
        aliases: ["text.reasoning"],
        pricing: MODELS["gemini-2.5-pro"],
        pricingStatus: "scaffold",
        notes: "Vertex migration scaffold; verify regional Vertex invoice rates before cutover.",
    },
    {
        provider: "vertex",
        modelId: "gemini-embedding-001",
        aliases: ["embedding.text"],
        pricing: {
            kind: "tokens",
            inputPerMillionTokens: 10_000,
            outputPerMillionTokens: 0,
        },
        pricingStatus: "scaffold",
        notes: "Embedding pricing scaffold; existing embedding routes are not yet charged by token usage.",
    },
    {
        provider: "vertex",
        modelId: "gemini-embedding-2",
        aliases: ["embedding.text:migration-target"],
        pricing: MODELS["gemini-embedding-2"],
        pricingStatus: "scaffold",
        notes: "Migration target only until dual-write/reindex completes; kept priced so migration jobs cannot run unmetered.",
    },
    {
        provider: "vertex",
        modelId: "chirp_3",
        aliases: ["audio.transcribe"],
        pricing: MODELS["chirp_3"],
        pricingStatus: "active",
        notes: "Dedicated production Speech-to-Text model; Gemini remains the multimodal fallback.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.1-flash-lite-image",
        aliases: ["image.fast"],
        pricing: MODELS["gemini-3.1-flash-lite-image"],
        pricingStatus: "scaffold",
        notes: "GA global endpoint. Default 1K output converted with the 2026-07-27 ECB reference rate; reconcile local Cloud SKU pricing and prompt tokens against the Vertex invoice before marking active.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.1-flash-image",
        aliases: ["image.quality"],
        pricing: MODELS["gemini-3.1-flash-image"],
        pricingStatus: "scaffold",
        notes: "GA global endpoint. Default 1K output converted with the 2026-07-27 ECB reference rate; reconcile local Cloud SKU pricing before marking active, and add resolution-aware metering before enabling higher resolutions.",
    },
    {
        provider: "vertex",
        modelId: "gemini-2.5-flash-preview-tts",
        aliases: ["audio.tts"],
        pricing: MODELS["gemini-2.5-flash-preview-tts"],
        pricingStatus: "scaffold",
        notes: "TTS transport remains route-owned until media migration agents wire Vertex.",
    },
    {
        provider: "vertex",
        modelId: "gemini-2.5-flash-tts",
        aliases: ["audio.tts"],
        pricing: MODELS["gemini-2.5-flash-tts"],
        pricingStatus: "active",
        notes: "Stable production Gemini TTS model.",
    },
    {
        provider: "vertex",
        modelId: "gemini-3.1-flash-tts-preview",
        aliases: ["audio.tts"],
        pricing: MODELS["gemini-3.1-flash-tts-preview"],
        pricingStatus: "scaffold",
        notes: "Preview Gemini TTS model with vocal controllability.",
    },
    {
        provider: "vertex",
        modelId: "lyria-3-clip-preview",
        aliases: ["music.clip"],
        pricing: MODELS["lyria-3-clip-preview"],
        pricingStatus: "scaffold",
        notes: "Music generation scaffold; transport remains route-owned until later agents.",
    },
    {
        provider: "vertex",
        modelId: "lyria-002",
        aliases: ["music.stable"],
        pricing: MODELS["lyria-002"],
        pricingStatus: "scaffold",
        notes: "Lyria 2 stable music generation scaffold; verify exact regional Vertex invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "lyria-3-pro-preview",
        aliases: ["music.pro"],
        pricing: MODELS["lyria-3-pro-preview"],
        pricingStatus: "scaffold",
        notes: "Music generation scaffold; transport remains route-owned until later agents.",
    },
    {
        provider: "vertex",
        modelId: "veo-3.1-fast-generate-001",
        aliases: ["video.fast", "video.generate"],
        pricing: MODELS["veo-3.1-fast-generate-001"],
        pricingStatus: "scaffold",
        notes: "Future video alias only; do not enable route call sites without feature flag and pricing verification.",
    },
    {
        provider: "vertex",
        modelId: "veo-3.1-generate-001",
        aliases: ["video.quality"],
        pricing: MODELS["veo-3.1-generate-001"],
        pricingStatus: "scaffold",
        notes: "Future video alias only; do not enable route call sites without feature flag and pricing verification.",
    },
    {
        provider: "higgsfield",
        modelId: "higgsfield-video-scaffold-v1",
        aliases: ["creative-studio:video", "creative-studio:fake-canary-video"],
        pricing: MODELS["higgsfield-video-scaffold-v1"],
        pricingStatus: "scaffold",
        notes: "Temporary Higgsfield video-second scaffold for Creative Studio metering only. Official API pricing, model IDs, and rate cards must be verified before live Higgsfield transport is enabled.",
    },
    {
        provider: "vertex",
        modelId: "deepseek-ai/deepseek-v3.2-maas",
        aliases: ["workspace-ai:copywriting", "workspace-ai:structuring"],
        pricing: MODELS["deepseek-ai/deepseek-v3.2-maas"],
        pricingStatus: "scaffold",
        notes: "Vertex MaaS open-model scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "deepseek-ai/deepseek-r1-0528-maas",
        aliases: ["workspace-ai:reasoning", "workspace-ai:legal"],
        pricing: MODELS["deepseek-ai/deepseek-r1-0528-maas"],
        pricingStatus: "scaffold",
        notes: "Vertex MaaS reasoning scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "qwen/qwen3-next-80b-a3b-instruct-maas",
        aliases: ["workspace-ai:copywriting", "workspace-ai:transcription"],
        pricing: MODELS["qwen/qwen3-next-80b-a3b-instruct-maas"],
        pricingStatus: "scaffold",
        notes: "Vertex MaaS Qwen scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "qwen/qwen3-next-80b-a3b-thinking-maas",
        aliases: ["workspace-ai:reasoning"],
        pricing: MODELS["qwen/qwen3-next-80b-a3b-thinking-maas"],
        pricingStatus: "scaffold",
        notes: "Vertex MaaS Qwen thinking scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "meta/llama-4-scout-17b-16e-instruct-maas",
        aliases: ["workspace-ai:copywriting", "workspace-ai:structuring", "workspace-ai:transcription"],
        pricing: MODELS["meta/llama-4-scout-17b-16e-instruct-maas"],
        pricingStatus: "scaffold",
        notes: "Vertex MaaS Llama scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "meta/llama-4-maverick-17b-128e-instruct-maas",
        aliases: ["workspace-ai:reasoning", "workspace-ai:legal"],
        pricing: MODELS["meta/llama-4-maverick-17b-128e-instruct-maas"],
        pricingStatus: "scaffold",
        notes: "Vertex MaaS Llama reasoning scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "claude-3-5-haiku@20241022",
        aliases: ["workspace-ai:copywriting", "workspace-ai:structuring"],
        pricing: MODELS["claude-3-5-haiku@20241022"],
        pricingStatus: "scaffold",
        notes: "Vertex Anthropic partner scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "claude-3-5-sonnet-v2@20241022",
        aliases: ["workspace-ai:reasoning", "workspace-ai:legal"],
        pricing: MODELS["claude-3-5-sonnet-v2@20241022"],
        pricingStatus: "scaffold",
        notes: "Vertex Anthropic partner scaffold; verify exact regional invoice rates before production launch.",
    },
    {
        provider: "vertex",
        modelId: "claude-sonnet-4-6",
        aliases: ["workspace-ai:copywriting", "workspace-ai:reasoning", "workspace-ai:legal", "workspace-ai:translation"],
        pricing: MODELS["claude-sonnet-4-6"],
        pricingStatus: "active",
        notes: "GA Vertex Anthropic partner pricing converted from the public USD rate card.",
    },
];

export const PLATFORM_FEE_BPS = 700;              // 7.00% — matches service agreement wording
export const MIN_BALANCE_FLOOR_MILLICENTS = 10_000; // €0.10 — block before call if below this

// One-time warning on first pricing lookup — keeps the "verify me" flag loud
// in dev logs until someone acknowledges the rates are correct for production.
let pricingWarnedOnce = false;

export function getModelPricing(model: string): ModelPricing | null {
    if (!pricingWarnedOnce && process.env.NODE_ENV !== "test") {
        console.warn(
            `[ai-pricing] Using pricing table verified ${LAST_VERIFIED_AT}. ` +
            `Confirm against ai.google.dev/pricing before production launch.`,
        );
        pricingWarnedOnce = true;
    }
    return MODELS[model] ?? null;
}

export function getProviderModelPricingMetadata(
    provider: ModelPricingMetadata["provider"],
    modelId: string,
): ModelPricingMetadata | null {
    return PROVIDER_MODEL_PRICING_METADATA.find((entry) => entry.provider === provider && entry.modelId === modelId) ?? null;
}

export interface CostBreakdown {
    baseCostMillicents: number;
    platformFeeMillicents: number;
    chargedMillicents: number;
}

function applyFee(baseCost: number): CostBreakdown {
    const fee = Math.ceil((baseCost * PLATFORM_FEE_BPS) / 10_000);
    return {
        baseCostMillicents: baseCost,
        platformFeeMillicents: fee,
        chargedMillicents: baseCost + fee,
    };
}

export function computeTokenCost(model: string, tokensIn: number, tokensOut: number): CostBreakdown | null {
    const pricing = getModelPricing(model);
    if (!pricing || pricing.kind !== "tokens") return null;
    const base = Math.ceil((tokensIn * pricing.inputPerMillionTokens + tokensOut * pricing.outputPerMillionTokens) / 1_000_000);
    return applyFee(base);
}

export function computeImageCost(model: string, imageCount: number): CostBreakdown | null {
    const pricing = getModelPricing(model);
    if (!pricing || pricing.kind !== "image") return null;
    return applyFee(pricing.perImage * imageCount);
}

export function computeTtsCost(model: string, charCount: number): CostBreakdown | null {
    const pricing = getModelPricing(model);
    if (!pricing || pricing.kind !== "tts_char") return null;
    return applyFee(Math.ceil(pricing.perCharacter * charCount));
}

export function computeMusicCost(model: string, durationSeconds: number): CostBreakdown | null {
    const pricing = getModelPricing(model);
    if (!pricing || pricing.kind !== "music_seconds") return null;
    return applyFee(Math.ceil(pricing.perSecond * durationSeconds));
}

export function computeSpeechTranscriptionCost(model: string, durationSeconds: number): CostBreakdown | null {
    const pricing = getModelPricing(model);
    if (!pricing || pricing.kind !== "speech_seconds") return null;
    return applyFee(Math.ceil(pricing.perSecond * durationSeconds));
}

export function computeVideoCost(model: string, durationSeconds: number): CostBreakdown | null {
    const pricing = getModelPricing(model);
    if (!pricing || pricing.kind !== "video_seconds") return null;
    return applyFee(Math.ceil(pricing.perSecond * durationSeconds));
}

// ─── Display helpers for admin UI ────────────────────────────────────────────

export function millicentsToEuros(millicents: number): number {
    return millicents / 10_000;
}

export function eurosToMillicents(euros: number): number {
    return Math.round(euros * 10_000);
}

export function formatEur(millicents: number): string {
    return `€${millicentsToEuros(millicents).toFixed(2)}`;
}
