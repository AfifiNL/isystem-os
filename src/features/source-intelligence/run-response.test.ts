import test from "node:test";
import assert from "node:assert/strict";
import { buildSourceIntelligenceRunResponse } from "./run-response";

const baseResult = {
    runId: "run-1",
    trigger: "cron" as const,
    reason: "scheduled" as const,
    requestedAt: "2026-07-27T08:00:00.000Z",
    enqueued: 1,
    processed: 1,
    failed: 0,
    sourceFailed: 0,
    workerFailed: 0,
    skipped: 0,
    existingQueued: 0,
    existingRunning: 0,
    results: [],
};

test("Source Intelligence run response is healthy when every drained job succeeds", () => {
    const response = buildSourceIntelligenceRunResponse(baseResult, "2026-07-27T08:00:01.000Z");

    assert.equal(response.ok, true);
    assert.equal(response.degraded, false);
    assert.equal(response.failed, 0);
});

test("Source Intelligence run response stays operational but degraded for source fetch failures", () => {
    const response = buildSourceIntelligenceRunResponse(
        { ...baseResult, processed: 0, failed: 1, sourceFailed: 1 },
        "2026-07-27T08:00:01.000Z",
    );

    assert.equal(response.ok, true);
    assert.equal(response.degraded, true);
    assert.equal(response.failed, 1);
    assert.equal(response.sourceFailed, 1);
    assert.equal(response.workerFailed, 0);
});

test("Source Intelligence run response fails for worker failures", () => {
    const response = buildSourceIntelligenceRunResponse(
        { ...baseResult, processed: 0, failed: 1, workerFailed: 1 },
        "2026-07-27T08:00:01.000Z",
    );

    assert.equal(response.ok, false);
    assert.equal(response.degraded, true);
    assert.equal(response.sourceFailed, 0);
    assert.equal(response.workerFailed, 1);
});
