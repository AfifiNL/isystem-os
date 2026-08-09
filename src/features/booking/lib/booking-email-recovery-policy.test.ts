import assert from "node:assert/strict";
import test from "node:test";

import { resolveRecoveredBookingEmailEvent } from "./booking-email-recovery-policy";

test("outbox recovery coalesces stale pre-confirmation events to the current booking state", () => {
    assert.equal(resolveRecoveredBookingEmailEvent("reservation_pending_review", "confirmed"), "reservation_confirmed");
    assert.equal(resolveRecoveredBookingEmailEvent("reservation_created", "completed"), "reservation_completed");
    assert.equal(resolveRecoveredBookingEmailEvent("reservation_pending_review", "cancelled_by_customer"), "reservation_cancelled");
    assert.equal(resolveRecoveredBookingEmailEvent("reservation_created", "expired"), "reservation_cancelled");
});

test("outbox recovery preserves events that are still current or carry independent meaning", () => {
    assert.equal(resolveRecoveredBookingEmailEvent("reservation_pending_review", "pending_review"), "reservation_pending_review");
    assert.equal(resolveRecoveredBookingEmailEvent("reservation_created", "pending_confirmation"), "reservation_created");
    assert.equal(resolveRecoveredBookingEmailEvent("payment_requested", "confirmed"), "payment_requested");
});
