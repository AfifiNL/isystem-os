import assert from "node:assert/strict";
import test from "node:test";

import { resolveProviderAttemptTimeoutMs, settleProviderPromiseWithin } from "./provider-timeout";

test("settleProviderPromiseWithin returns the provider result before the deadline", async () => {
    const value = await settleProviderPromiseWithin(Promise.resolve("token"), 1_000, null);

    assert.equal(value, "token");
});

test("settleProviderPromiseWithin returns the fallback when the provider stalls", async () => {
    const stalled = new Promise<string>(() => undefined);
    const value = await settleProviderPromiseWithin(stalled, 1, null);

    assert.equal(value, null);
});

test("resolveProviderAttemptTimeoutMs caps attempts to the remaining operation budget", () => {
    assert.equal(resolveProviderAttemptTimeoutMs(100_000, {
        nowMs: 20_000,
        maxAttemptMs: 45_000,
    }), 45_000);
    assert.equal(resolveProviderAttemptTimeoutMs(100_000, {
        nowMs: 80_000,
        maxAttemptMs: 45_000,
    }), 19_000);
    assert.equal(resolveProviderAttemptTimeoutMs(100_000, {
        nowMs: 99_500,
        maxAttemptMs: 45_000,
    }), null);
});
