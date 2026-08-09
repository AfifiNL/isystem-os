import assert from "node:assert/strict";
import test from "node:test";

import { assertGscSyncRunUpdated, resolveGscSyncOutcome } from "./sync-outcome";

test("GSC returns non-2xx when every requested date fails", () => {
    assert.deepEqual(resolveGscSyncOutcome({
        "2026-08-01": { status: "failed_403", rowsSynced: 0, error: "forbidden" },
        "2026-08-02": { status: "failed_429", rowsSynced: 0, error: "rate limited" },
    }), { ok: false, status: 502, health: "failing", succeeded: 0, failed: 2 });
});

test("GSC exposes mixed results as partial success", () => {
    assert.deepEqual(resolveGscSyncOutcome({
        "2026-08-01": { status: "success", rowsSynced: 8 },
        "2026-08-02": { status: "failed_429", rowsSynced: 0, error: "rate limited" },
    }), { ok: true, status: 207, health: "degraded", succeeded: 1, failed: 1 });
});

test("GSC fails when recording a sync-run status fails", () => {
    assert.throws(
        () => assertGscSyncRunUpdated({ message: "write failed" }),
        /Failed to update GSC sync run: write failed/,
    );
    assert.doesNotThrow(() => assertGscSyncRunUpdated(null));
});
