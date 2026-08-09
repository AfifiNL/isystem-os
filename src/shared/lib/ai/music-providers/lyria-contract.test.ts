import assert from "node:assert/strict";
import test from "node:test";

import {
    buildLyriaRequest,
    parseLyriaResponse,
    resolveLyriaEndpoint,
} from "./lyria-contract";
import { getProviderModelMetadata } from "../models";

test("music aliases keep preview models behind a GA stable fallback", () => {
    const stable = getProviderModelMetadata("music.stable", "vertex");
    const clip = getProviderModelMetadata("music.clip", "vertex");
    const pro = getProviderModelMetadata("music.pro", "vertex");

    assert.equal(stable.modelId, "lyria-002");
    assert.deepEqual(stable.fallbackAliases, undefined);
    assert.deepEqual(clip.fallbackAliases, ["music.stable"]);
    assert.deepEqual(pro.fallbackAliases, ["music.clip", "music.stable"]);
});

test("Lyria 3 uses the global Interactions API contract", () => {
    assert.equal(
        resolveLyriaEndpoint({ project: "project-123", model: "lyria-3-clip-preview" }),
        "https://aiplatform.googleapis.com/v1beta1/projects/project-123/locations/global/interactions",
    );
    assert.deepEqual(
        buildLyriaRequest({
            model: "lyria-3-clip-preview",
            prompt: "A calm instrumental podcast intro.",
            negativePrompt: "vocals",
            sampleCount: 1,
            durationSeconds: 15,
        }),
        {
            model: "lyria-3-clip-preview",
            input: [{ type: "text", text: "A calm instrumental podcast intro." }],
        },
    );
});

test("stable Lyria 2 fallback uses the global predict API and snake_case fields", () => {
    assert.equal(
        resolveLyriaEndpoint({ project: "project-123", model: "lyria-002" }),
        "https://aiplatform.googleapis.com/v1/projects/project-123/locations/global/publishers/google/models/lyria-002:predict",
    );
    assert.deepEqual(
        buildLyriaRequest({
            model: "lyria-002",
            prompt: "A warm instrumental podcast bed.",
            negativePrompt: "vocals, spoken word",
            sampleCount: 1,
            durationSeconds: 15,
        }),
        {
            instances: [{
                prompt: "A warm instrumental podcast bed.",
                negative_prompt: "vocals, spoken word",
            }],
            parameters: { sample_count: 1 },
        },
    );
});

test("Lyria responses are normalized across Interactions and predict APIs", () => {
    assert.deepEqual(
        parseLyriaResponse({
            outputs: [{ type: "text", text: "description" }, { type: "audio", mime_type: "audio/mpeg", data: "AAA=" }],
        }),
        { base64Audio: "AAA=", mimeType: "audio/mpeg" },
    );
    assert.deepEqual(
        parseLyriaResponse({ predictions: [{ audioContent: "BBB=", mimeType: "audio/wav" }] }),
        { base64Audio: "BBB=", mimeType: "audio/wav" },
    );
});
