import assert from "node:assert/strict";
import test from "node:test";
import { getAiProviderErrorTelemetry } from "./errors";

test("AI provider telemetry excludes customer-bearing error messages", () => {
    const telemetry = getAiProviderErrorTelemetry(
        new Error("Schema mismatch in generated private customer text"),
        {
            provider: "vertex",
            modelAlias: "text.writer",
            modelId: "gemini-test",
        },
    );

    assert.deepEqual(telemetry, {
        code: "schema_mismatch",
        provider: "vertex",
        modelAlias: "text.writer",
        modelId: "gemini-test",
        region: undefined,
        status: undefined,
        retryable: false,
    });
    assert.equal("message" in telemetry, false);
    assert.equal(JSON.stringify(telemetry).includes("private customer text"), false);
});
