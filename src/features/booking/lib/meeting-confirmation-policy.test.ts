import test from "node:test";
import assert from "node:assert/strict";

import {
    canConfirmReservationWithMeeting,
    stageReservationStatusForMeeting,
} from "./meeting-confirmation-policy";

test("stages auto-confirmable remote reservations until their room is ready", () => {
    assert.equal(stageReservationStatusForMeeting("confirmed", "google_meet"), "pending_review");
    assert.equal(stageReservationStatusForMeeting("confirmed", "zoom"), "pending_review");
});

test("does not change payment or operator-review states", () => {
    assert.equal(stageReservationStatusForMeeting("pending_confirmation", "google_meet"), "pending_confirmation");
    assert.equal(stageReservationStatusForMeeting("pending_review", "zoom"), "pending_review");
    assert.equal(stageReservationStatusForMeeting("confirmed", "none"), "confirmed");
});

test("requires a ready customer-safe URL before confirming Meet or Zoom", () => {
    assert.equal(canConfirmReservationWithMeeting({
        provider: "google_meet",
        meetingStatus: "ready",
        joinUrl: "https://meet.google.com/abc-defg-hij",
    }).allowed, true);
    assert.equal(canConfirmReservationWithMeeting({
        provider: "zoom",
        meetingStatus: "ready",
        joinUrl: "https://example.zoom.us/j/123456789",
    }).allowed, true);

    for (const candidate of [
        { provider: "google_meet" as const, meetingStatus: "failed", joinUrl: "https://meet.google.com/abc-defg-hij" },
        { provider: "google_meet" as const, meetingStatus: "ready", joinUrl: null },
        { provider: "zoom" as const, meetingStatus: "ready", joinUrl: "javascript:alert(1)" },
    ] as const) {
        const result = canConfirmReservationWithMeeting(candidate);
        assert.equal(result.allowed, false);
        assert.match(result.reason ?? "", /meeting/i);
    }
});

test("allows non-virtual services to retain their existing confirmation behavior", () => {
    assert.deepEqual(canConfirmReservationWithMeeting({
        provider: "none",
        meetingStatus: null,
        joinUrl: null,
    }), { allowed: true });
});
