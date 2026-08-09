import test from "node:test";
import assert from "node:assert/strict";

import { deriveBookingLifecycle } from "./lifecycle";

test("maps booking milestones to commercial lifecycle stages", () => {
    assert.equal(deriveBookingLifecycle({ status: "pending_confirmation", serviceKey: "systems-fit-call", paymentStatus: "requested" }), "lead");
    assert.equal(deriveBookingLifecycle({ status: "confirmed", serviceKey: "systems-fit-call", paymentStatus: null }), "qualified");
    assert.equal(deriveBookingLifecycle({ status: "confirmed", serviceKey: "systems-blueprint", paymentStatus: "verified" }), "customer");
});

test("does not promote an unpaid Blueprint or cancellation to customer", () => {
    assert.equal(deriveBookingLifecycle({ status: "confirmed", serviceKey: "systems-blueprint", paymentStatus: "requested" }), "lead");
    assert.equal(deriveBookingLifecycle({ status: "cancelled_by_customer", serviceKey: "systems-fit-call", paymentStatus: null }), "lead");
});

test("requires an explicit engagement-started milestone for active", () => {
    assert.equal(deriveBookingLifecycle({ status: "completed", serviceKey: "systems-fit-call", paymentStatus: null }), "qualified");
    assert.equal(deriveBookingLifecycle({ status: "completed", serviceKey: "systems-fit-call", paymentStatus: null, engagementStarted: true }), "active");
});
