import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
    AI_SERVICE_DEFAULT_MODELS,
    AI_SERVICE_OPTIONS,
    getAiServiceOption,
    getProviderModelMetadata,
} from "./models";
import { getModelPricing } from "./pricing";
import {
    VERTEX_ANTHROPIC_LOCATION,
    VERTEX_GOOGLE_LOCATION,
    VERTEX_MAAS_LOCATION,
} from "./vertex";
import { aiConfigStore, getModelMetadata } from "./provider";

const GEMINI_36_ALIASES = [
    "text.fast",
    "text.writer",
    "text.structured",
    "text.legal",
    "text.translation",
] as const;

const GEMINI_35_LITE_ALIASES = [
    "text.bulk",
    "text.structured.bulk",
    "text.seo-automation",
    "audio.summarize",
] as const;

const RETIRED_OR_RETIRING_OPTION_MODEL_IDS = new Set([
    "claude-3-5-haiku@20241022",
    "claude-3-5-sonnet-v2@20241022",
    "deepseek-ai/deepseek-r1-0528-maas",
    "deepseek-ai/deepseek-v3.2-maas",
    "qwen/qwen3-next-80b-a3b-instruct-maas",
    "qwen/qwen3-next-80b-a3b-thinking-maas",
]);

describe("2026 generation model upgrade", () => {
    it("routes production text aliases to the current GA Gemini models", () => {
        for (const alias of GEMINI_36_ALIASES) {
            const metadata = getProviderModelMetadata(alias, "vertex");
            assert.equal(metadata.modelId, "gemini-3.6-flash", alias);
            assert.deepEqual(metadata.fallbackModelIds, ["gemini-3.5-flash"], alias);
        }

        for (const alias of GEMINI_35_LITE_ALIASES) {
            const metadata = getProviderModelMetadata(alias, "vertex");
            assert.equal(metadata.modelId, "gemini-3.5-flash-lite", alias);
            assert.deepEqual(metadata.fallbackModelIds, ["gemini-3.1-flash-lite"], alias);
        }
    });

    it("upgrades saved legacy workspace choices while preserving explicit rollback options", () => {
        assert.equal(
            getAiServiceOption("copywriting", "gemini-3.5-flash").id,
            "gemini-3.6-flash",
        );
        assert.equal(
            getAiServiceOption("structuring", "gemini-3.1-flash-lite").id,
            "gemini-3.5-flash-lite",
        );
        assert.equal(
            getAiServiceOption("copywriting", "gemini-3.5-flash-rollback").modelId,
            "gemini-3.5-flash",
        );

        assert.equal(AI_SERVICE_DEFAULT_MODELS.copywriting, "gemini-3.6-flash");
        assert.equal(AI_SERVICE_DEFAULT_MODELS.structuring, "gemini-3.5-flash-lite");
    });

    it("keeps retired or imminently retiring managed models out of selectable options", () => {
        const selectableModelIds = Object.values(AI_SERVICE_OPTIONS)
            .flat()
            .map((option) => option.modelId);

        for (const modelId of selectableModelIds) {
            assert.equal(
                RETIRED_OR_RETIRING_OPTION_MODEL_IDS.has(modelId),
                false,
                modelId,
            );
        }
    });

    it("uses current dedicated generation endpoints without changing embedding dimensions", () => {
        assert.equal(
            getProviderModelMetadata("image.premium", "vertex").modelId,
            "gemini-3-pro-image",
        );
        assert.equal(
            getProviderModelMetadata("audio.tts", "vertex").modelId,
            "gemini-2.5-flash-tts",
        );
        assert.equal(
            getProviderModelMetadata("video.lite", "vertex").modelId,
            "veo-3.1-fast-generate-001",
        );
        assert.equal(
            getProviderModelMetadata("video.fast", "vertex").modelId,
            "veo-3.1-fast-generate-001",
        );
        assert.equal(
            getProviderModelMetadata("video.quality", "vertex").modelId,
            "veo-3.1-generate-001",
        );
        assert.equal(
            getProviderModelMetadata("embedding.text", "vertex").modelId,
            "gemini-embedding-001",
        );
    });

    it("uses global Vertex endpoints required by the new Google and Anthropic models", () => {
        assert.equal(VERTEX_GOOGLE_LOCATION, "global");
        assert.equal(VERTEX_ANTHROPIC_LOCATION, "global");
        assert.equal(VERTEX_MAAS_LOCATION, "global");
    });

    it("keeps speech selection separate from the text-only summary stage", () => {
        const cases = [
            ["chirp-3", "chirp_3", "vertex-google-rest"],
            ["gemini-3.6-flash", "gemini-3.6-flash", "vertex-google-sdk"],
            ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite", "vertex-google-sdk"],
        ] as const;

        for (const [optionId, speechModelId, speechTransport] of cases) {
            aiConfigStore.run({ transcription: optionId }, () => {
                const speech = getModelMetadata("audio.transcribe", { provider: "vertex" });
                const summary = getModelMetadata("audio.summarize", { provider: "vertex" });

                assert.equal(speech.modelId, speechModelId, optionId);
                assert.equal(speech.transport, speechTransport, optionId);
                assert.equal(summary.modelId, "gemini-3.5-flash-lite", optionId);
                assert.equal(summary.transport, "vertex-google-sdk", optionId);
            });
        }
    });

    it("meters the new Gemini defaults with current token rates", () => {
        assert.deepEqual(getModelPricing("gemini-3.6-flash"), {
            kind: "tokens",
            inputPerMillionTokens: 13_200,
            outputPerMillionTokens: 65_900,
        });
        assert.deepEqual(getModelPricing("gemini-3.5-flash-lite"), {
            kind: "tokens",
            inputPerMillionTokens: 2_700,
            outputPerMillionTokens: 22_000,
        });
    });

    it("does not send sampling parameters deprecated by Gemini 3.6", () => {
        const generationSources = [
            "src/features/external-publishing/lib/ai-generator.ts",
            "src/features/blog/translation-service.ts",
            "src/features/outreach/ai/generate-sequence.ts",
            "src/features/tools/shared/ai.ts",
            "src/app/api/humanize-blog/[id]/route.ts",
            "src/app/api/generate-node/route.ts",
            "src/app/api/repair-editorial/[id]/route.ts",
        ];

        for (const path of generationSources) {
            const source = readFileSync(path, "utf8");
            assert.doesNotMatch(source, /\b(?:temperature|topP|topK)\s*:/, path);
        }
    });
});
