import assert from "node:assert/strict";
import test from "node:test";

import {
    addBookingEmailDeliveryOutcome,
    bookingEmailCronStatus,
    emptyBookingEmailDeliveryOutcome,
} from "./booking-email-delivery-outcome";

test("booking email outcomes count sent, skipped, failed, suppressed, and persistence-degraded deliveries honestly", () => {
    let outcome = emptyBookingEmailDeliveryOutcome();
    outcome = addBookingEmailDeliveryOutcome(outcome, "sent");
    outcome = addBookingEmailDeliveryOutcome(outcome, "skipped");
    outcome = addBookingEmailDeliveryOutcome(outcome, "failed");
    outcome = addBookingEmailDeliveryOutcome(outcome, "suppressed");
    outcome = addBookingEmailDeliveryOutcome(outcome, "persistence_degraded");

    assert.deepEqual(outcome, { sent: 1, skipped: 1, failed: 1, suppressed: 1, persistence_degraded: 1 });
    assert.equal(bookingEmailCronStatus(outcome), "degraded");
});

test("booking email cron status is failed when no attempted delivery succeeds", () => {
    assert.equal(bookingEmailCronStatus({ sent: 0, skipped: 2, failed: 1, suppressed: 0, persistence_degraded: 0 }), "failed");
    assert.equal(bookingEmailCronStatus({ sent: 2, skipped: 0, failed: 0, suppressed: 1, persistence_degraded: 0 }), "healthy");
});
