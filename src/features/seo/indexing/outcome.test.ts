import test from "node:test";
import assert from "node:assert/strict";
import { buildIndexingProcessingOutcome, buildIndexingRequeueState } from "@/features/seo/indexing/outcome";

test("terminal provider failures surface the provider error", () => {
    const outcome = buildIndexingProcessingOutcome({
        indexed: false,
        hasInspection: true,
        errors: ["url_inspection: invalid_grant"],
        attemptCount: 4,
    });

    assert.deepEqual(outcome, {
        success: false,
        status: "failed",
        terminalFailure: true,
        message: "Indexing providers failed after 4 attempts: url_inspection: invalid_grant",
    });
});

test("an indexed URL remains successful when a secondary provider fails", () => {
    const outcome = buildIndexingProcessingOutcome({
        indexed: true,
        hasInspection: true,
        errors: ["sitemap: quota exceeded"],
        attemptCount: 4,
    });

    assert.deepEqual(outcome, {
        success: true,
        status: "indexed",
        terminalFailure: false,
        message: "URL inspection reports indexed.",
    });
});

test("retryable provider failures remain submitted before the attempt limit", () => {
    const outcome = buildIndexingProcessingOutcome({
        indexed: false,
        hasInspection: false,
        errors: ["url_inspection: temporarily unavailable"],
        attemptCount: 3,
    });

    assert.deepEqual(outcome, {
        success: true,
        status: "submitted",
        terminalFailure: false,
        message: "Indexing providers processed; URL is submitted or pending inspection.",
    });
});

test("requeueing a terminal job starts a fresh bounded retry cycle", () => {
    const now = "2026-08-06T18:30:00.000Z";

    assert.deepEqual(buildIndexingRequeueState(now), {
        status: "queued",
        attempt_count: 0,
        next_attempt_at: now,
        last_attempt_at: null,
        last_error: null,
        last_inspection: null,
    });
});
