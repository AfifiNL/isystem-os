import assert from "node:assert/strict";
import test from "node:test";

import { resolveBookingFollowupOutcome } from "./booking-followup-outcome";

test("aggregates reconciliation, query, exhausted retry, persistence, and delivery failures", () => {
    assert.deepEqual(resolveBookingFollowupOutcome({ attempted: 4, failures: 0 }), { ok: true, health: "healthy", status: 200 });
    assert.deepEqual(resolveBookingFollowupOutcome({ attempted: 4, failures: 1 }), { ok: true, health: "degraded", status: 207 });
    assert.deepEqual(resolveBookingFollowupOutcome({ attempted: 4, failures: 4 }), { ok: false, health: "failing", status: 502 });
});
