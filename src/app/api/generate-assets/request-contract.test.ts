import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAssetGenerationRequest } from "./request-contract";

const CONTENT_ID = "019f90e6-b40a-7152-9312-dae2f33fbe8b";

describe("generate-assets request contract", () => {
    it("accepts image generation and normalizes the supported operation", () => {
        assert.deepEqual(
            parseAssetGenerationRequest({
                content_id: CONTENT_ID,
                generate_images: true,
            }),
            {
                ok: true,
                value: {
                    contentId: CONTENT_ID,
                    generateImages: true,
                },
            },
        );
    });

    it("rejects legacy TTS requests instead of reporting a false success", () => {
        assert.deepEqual(
            parseAssetGenerationRequest({
                content_id: CONTENT_ID,
                generate_images: false,
                generate_tts: true,
            }),
            {
                ok: false,
                error: "Narration is generated through Podcast Production, where show, voice, and music settings are preserved.",
                code: "narration_workflow_required",
                workflow: "podcast_episode",
            },
        );
    });

    it("rejects an empty operation instead of performing a no-op", () => {
        const result = parseAssetGenerationRequest({
            content_id: CONTENT_ID,
            generate_images: false,
        });

        assert.equal(result.ok, false);
        if (!result.ok) {
            assert.equal(result.code, "no_supported_assets_requested");
            assert.equal(result.workflow, "podcast_episode");
        }
    });

    it("rejects implicit image generation and caller-selected workspace fields", () => {
        assert.equal(parseAssetGenerationRequest({
            content_id: CONTENT_ID,
        }).ok, false);
        assert.equal(parseAssetGenerationRequest({
            content_id: CONTENT_ID,
            generate_images: true,
            workspace_id: "attacker-selected-workspace",
        }).ok, false);
    });
});
