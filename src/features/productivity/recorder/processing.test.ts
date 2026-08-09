import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVoiceMemoCommitmentFingerprint, calculateVoiceMemoRetryAt, toSafeVoiceMemoProcessingError } from "./processing";

describe("voice memo processing helpers", () => {
    it("calculates bounded exponential retry delays", () => {
        const base = new Date("2026-06-13T22:00:00.000Z");

        assert.equal(calculateVoiceMemoRetryAt(1, base), "2026-06-13T22:01:00.000Z");
        assert.equal(calculateVoiceMemoRetryAt(3, base), "2026-06-13T22:04:00.000Z");
        assert.equal(calculateVoiceMemoRetryAt(99, base), "2026-06-13T23:00:00.000Z");
    });

    it("normalizes stored processing errors for UI observability", () => {
        assert.equal(toSafeVoiceMemoProcessingError(new Error("  provider\nfailed\tbadly  ")), "provider failed badly");
        assert.equal(toSafeVoiceMemoProcessingError(""), "Voice memo processing failed.");
        assert.equal(toSafeVoiceMemoProcessingError("x".repeat(600)).length, 500);
    });

    it("builds deterministic fingerprints for SLA idempotency", () => {
        const first = buildVoiceMemoCommitmentFingerprint({
            title: " Follow up with client ",
            description: " Send proposal ",
            priority: "High",
        });
        const retry = buildVoiceMemoCommitmentFingerprint({
            title: "follow up with client",
            description: "send proposal",
            priority: "high",
        });

        assert.equal(retry, first);
        assert.notEqual(buildVoiceMemoCommitmentFingerprint({ title: "Different", priority: "high" }), first);
    });
});
