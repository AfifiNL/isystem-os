import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getProviderModelMetadata } from "./models";

describe("transcription provider metadata", () => {
    it("documents the Chirp-first transcription path and Gemini fallback", () => {
        const metadata = getProviderModelMetadata("audio.transcribe", "vertex");

        assert.equal(metadata.provider, "vertex");
        assert.equal(metadata.transport, "vertex-google-rest");
        assert.equal(metadata.modelId, "chirp_3");
        assert.deepEqual(metadata.fallbackAliases, ["text.fast"]);
        assert.deepEqual(metadata.fallbackModelIds, ["gemini-3.6-flash"]);
        assert.match(metadata.description, /Chirp-first/);
        assert.match(metadata.description, /Gemini multimodal/);
    });
});
