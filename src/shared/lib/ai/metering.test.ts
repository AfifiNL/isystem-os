import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeUsageBreakdown } from "./metering";

describe("AI metering video usage", () => {
    it("computes video_seconds cost with platform fee for scaffolded video models", () => {
        const breakdown = computeUsageBreakdown({
            unitType: "video_seconds",
            model: "higgsfield-video-scaffold-v1",
            durationSeconds: 8,
        });

        assert.deepEqual(breakdown, {
            baseCostMillicents: 16_000,
            platformFeeMillicents: 1_120,
            chargedMillicents: 17_120,
        });
    });

    it("returns null for missing video pricing so render gates can fail closed", () => {
        assert.equal(
            computeUsageBreakdown({
                unitType: "video_seconds",
                model: "unknown-higgsfield-model",
                durationSeconds: 8,
            }),
            null,
        );
    });
});
