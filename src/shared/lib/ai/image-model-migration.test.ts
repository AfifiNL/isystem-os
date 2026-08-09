import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getProviderModelMetadata } from "./models";
import {
    getModelPricing,
    getProviderModelPricingMetadata,
    PROVIDER_MODEL_PRICING_METADATA,
} from "./pricing";
import { VERTEX_IMAGE_LOCATION } from "./vertex";

const DISCONTINUED_IMAGE_MODEL_IDS = new Set([
    "imagen-3.0-capability-001",
    "imagen-3.0-capability-002",
    "imagen-3.0-fast-generate-001",
    "imagen-3.0-generate-001",
    "imagen-3.0-generate-002",
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-generate-001",
    "imagen-4.0-ultra-generate-001",
]);

describe("GA Gemini image model migration", () => {
    it("maps active and staged image aliases away from retired endpoints", () => {
        for (const provider of ["vertex", "google-generative-ai"] as const) {
            const fast = getProviderModelMetadata("image.fast", provider);
            const quality = getProviderModelMetadata("image.quality", provider);

            assert.equal(fast.modelId, "gemini-3.1-flash-lite-image");
            assert.equal(quality.modelId, "gemini-3.1-flash-image");
            assert.equal(fast.futureOnly, undefined);
            assert.equal(quality.futureOnly, undefined);
        }

        assert.equal(
            getProviderModelMetadata("image.edit", "vertex").modelId,
            "gemini-3.1-flash-image",
        );
    });

    it("routes GA image models through their supported global Vertex location", () => {
        assert.equal(VERTEX_IMAGE_LOCATION, "global");
    });

    it("prices the default 1K output for both GA image endpoints", () => {
        assert.deepEqual(getModelPricing("gemini-3.1-flash-lite-image"), {
            kind: "image",
            perImage: 300,
        });
        assert.deepEqual(getModelPricing("gemini-3.1-flash-image"), {
            kind: "image",
            perImage: 590,
        });

        assert.deepEqual(
            getProviderModelPricingMetadata("vertex", "gemini-3.1-flash-lite-image")?.aliases,
            ["image.fast"],
        );
        assert.deepEqual(
            getProviderModelPricingMetadata("vertex", "gemini-3.1-flash-image")?.aliases,
            ["image.quality"],
        );
        assert.equal(
            getProviderModelPricingMetadata("vertex", "gemini-3.1-flash-lite-image")?.pricingStatus,
            "scaffold",
        );
        assert.equal(
            getProviderModelPricingMetadata("vertex", "gemini-3.1-flash-image")?.pricingStatus,
            "scaffold",
        );
    });

    it("keeps discontinued Imagen endpoint IDs out of the active pricing catalog", () => {
        const activeLegacyEntries = PROVIDER_MODEL_PRICING_METADATA.filter(
            (entry) => DISCONTINUED_IMAGE_MODEL_IDS.has(entry.modelId),
        );

        assert.deepEqual(activeLegacyEntries, []);
    });
});
