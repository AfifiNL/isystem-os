import assert from "node:assert/strict";
import test from "node:test";
import {
    contentTranslationRetryDelayMs,
    shouldRetryContentTranslation,
} from "./translation-job-policy";

test("translation retry policy stops at max attempts", () => {
    assert.equal(shouldRetryContentTranslation({ attempts: 1, maxAttempts: 3 }), true);
    assert.equal(shouldRetryContentTranslation({ attempts: 3, maxAttempts: 3 }), false);
});

test("translation retry policy applies bounded exponential backoff", () => {
    assert.equal(contentTranslationRetryDelayMs(1), 60_000);
    assert.equal(contentTranslationRetryDelayMs(2), 120_000);
    assert.equal(contentTranslationRetryDelayMs(10), 30 * 60_000);
});
