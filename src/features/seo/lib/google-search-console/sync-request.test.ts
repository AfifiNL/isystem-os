import assert from "node:assert/strict";
import test from "node:test";

import { parseGscSyncDates } from "./sync-request";

test("accepts exact ISO dates and rejects invalid, reversed, or overlong ranges", () => {
    assert.deepEqual(parseGscSyncDates({ targetDate: "2026-08-01" }), ["2026-08-01"]);
    assert.deepEqual(parseGscSyncDates({ startDate: "2026-08-01", endDate: "2026-08-03" }), ["2026-08-01", "2026-08-02", "2026-08-03"]);
    assert.throws(() => parseGscSyncDates({ targetDate: "08/01/2026" }), /YYYY-MM-DD/);
    assert.throws(() => parseGscSyncDates({ startDate: "2026-08-03", endDate: "2026-08-01" }), /before or equal/);
    assert.throws(() => parseGscSyncDates({ startDate: "2026-01-01", endDate: "2026-04-01" }), /60 days/);
});
