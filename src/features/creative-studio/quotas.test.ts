import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    CREATIVE_STUDIO_RATE_LIMIT_KEYS,
    evaluateCreativeRenderBudgetGate,
} from "./quotas";
import type { CreativeRenderQuotaConfig } from "./quotas";

const baseConfig: CreativeRenderQuotaConfig = {
    higgsfield: {
        enabled: false,
        apiBaseUrl: null,
        apiKey: null,
        maxDurationSeconds: 8,
        maxPendingJobsPerWorkspace: 3,
        dailyRenderLimitPerWorkspace: 10,
        monthlyBudgetMillicents: 50_000,
    },
};

describe("Creative Studio render quota gates", () => {
    it("allows fake canary renders while the real provider remains disabled", () => {
        const result = evaluateCreativeRenderBudgetGate({
            provider: "fake",
            durationSeconds: 8,
            estimatedCostMillicents: 17_120,
            pendingJobsForWorkspace: 0,
            rendersTodayForWorkspace: 0,
            monthlySpendMillicents: 0,
            config: baseConfig,
        });

        assert.equal(result.allowed, true);
        assert.deepEqual(result.reasons, []);
    });

    it("fails closed for live Higgsfield when budget controls are missing", () => {
        const result = evaluateCreativeRenderBudgetGate({
            provider: "higgsfield",
            durationSeconds: 8,
            estimatedCostMillicents: 17_120,
            pendingJobsForWorkspace: 0,
            rendersTodayForWorkspace: 0,
            monthlySpendMillicents: 0,
            config: {
                ...baseConfig,
                higgsfield: {
                    ...baseConfig.higgsfield,
                    enabled: true,
                    apiBaseUrl: "https://api.higgsfield.example",
                    apiKey: "redacted",
                    monthlyBudgetMillicents: 0,
                },
            },
        });

        assert.equal(result.allowed, false);
        assert.ok(result.reasons.some((reason) => reason.includes("HIGGSFIELD_MONTHLY_BUDGET_MILLICENTS")));
    });

    it("blocks renders that would exceed the monthly provider budget cap", () => {
        const result = evaluateCreativeRenderBudgetGate({
            provider: "higgsfield",
            durationSeconds: 8,
            estimatedCostMillicents: 17_120,
            pendingJobsForWorkspace: 0,
            rendersTodayForWorkspace: 0,
            monthlySpendMillicents: 40_000,
            config: {
                ...baseConfig,
                higgsfield: {
                    ...baseConfig.higgsfield,
                    enabled: true,
                    apiBaseUrl: "https://api.higgsfield.example",
                    apiKey: "redacted",
                },
            },
        });

        assert.equal(result.allowed, false);
        assert.ok(result.reasons.some((reason) => reason.includes("monthly Higgsfield budget")));
    });

    it("defines stable route rate-limit keys for strategy, evaluate, and render submission", () => {
        assert.deepEqual(CREATIVE_STUDIO_RATE_LIMIT_KEYS, {
            strategy: "creative-studio:strategy",
            evaluate: "creative-studio:evaluate",
            renderSubmit: "creative-studio:render-submit",
        });
    });
});
