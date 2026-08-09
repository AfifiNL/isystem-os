import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { createVertex } from "@ai-sdk/google-vertex";
import { generateImage } from "ai";

describe("Vertex Gemini image request contract", () => {
    it("uses global generateContent semantics and extracts inline image data", async () => {
        let requestUrl = "";
        let requestBody: Record<string, unknown> = {};
        const expectedImage = Buffer.from("valid-image-bytes");

        const vertex = createVertex({
            apiKey: "test-api-key",
            project: "test-project",
            location: "global",
            baseURL: "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google",
            fetch: async (input, init) => {
                requestUrl = String(input);
                requestBody = JSON.parse(String(init?.body ?? "{}"));
                return new Response(JSON.stringify({
                    candidates: [{
                        content: {
                            role: "model",
                            parts: [{
                                inlineData: {
                                    mimeType: "image/png",
                                    data: expectedImage.toString("base64"),
                                },
                            }],
                        },
                        finishReason: "STOP",
                    }],
                    usageMetadata: {
                        promptTokenCount: 4,
                        candidatesTokenCount: 1_120,
                        totalTokenCount: 1_124,
                    },
                }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            },
        });

        const result = await generateImage({
            model: vertex.image("gemini-3.1-flash-lite-image"),
            prompt: "A text-free editorial background.",
            aspectRatio: "16:9",
            n: 1,
        });

        assert.match(
            requestUrl,
            /\/locations\/global\/publishers\/google\/models\/gemini-3\.1-flash-lite-image:generateContent/,
        );

        const generationConfig = requestBody.generationConfig as Record<string, unknown>;
        assert.deepEqual(generationConfig.responseModalities, ["IMAGE"]);
        assert.deepEqual(generationConfig.imageConfig, { aspectRatio: "16:9" });
        assert.equal(generationConfig.candidateCount, undefined);
        assert.equal("negativePrompt" in generationConfig, false);
        assert.equal("personGeneration" in generationConfig, false);
        assert.equal("outputOptions" in generationConfig, false);
        assert.equal("enhancePrompt" in generationConfig, false);
        assert.equal("addWatermark" in generationConfig, false);

        assert.equal(result.images.length, 1);
        assert.equal(result.images[0]?.mediaType, "image/png");
        assert.deepEqual(Buffer.from(result.images[0]?.uint8Array ?? []), expectedImage);
    });

    it("keeps the application image provider and telemetry on the global location", async () => {
        const [vertexSource, providerSource] = await Promise.all([
            readFile(new URL("./vertex.ts", import.meta.url), "utf8"),
            readFile(new URL("./provider.ts", import.meta.url), "utf8"),
        ]);

        assert.match(vertexSource, /location:\s*VERTEX_IMAGE_LOCATION/);
        assert.match(vertexSource, /locations\/\$\{VERTEX_IMAGE_LOCATION\}\/publishers\/google/);
        assert.match(providerSource, /getVertexImageProvider\(\)\.image\(metadata\.modelId\)/);
        assert.match(providerSource, /metadata\.capability === "image"[\s\S]*VERTEX_IMAGE_LOCATION/);
    });

    it("makes the live smoke command fail closed when an endpoint check fails", async () => {
        const smokeSource = await readFile(
            new URL("../../../../scripts/smoke-vertex-ai-models.mjs", import.meta.url),
            "utf8",
        );

        assert.match(smokeSource, /failedChecks \+= 1/);
        assert.match(smokeSource, /if \(failedChecks > 0\)/);
        assert.match(smokeSource, /throw new Error\(`\$\{failedChecks\} Vertex AI smoke check/);
    });
});
