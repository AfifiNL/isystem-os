import test from "node:test";
import assert from "node:assert/strict";

import { provisionAndConfirmReservation } from "./meeting-confirmation-orchestrator";

test("never commits confirmation when meeting provisioning fails", async () => {
    let commitCalls = 0;
    const result = await provisionAndConfirmReservation({
        provider: "google_meet",
        provisionMeeting: async () => ({ status: "failed", joinUrl: null, error: "provider unavailable" }),
        commitConfirmation: async () => {
            commitCalls += 1;
            return true;
        },
    });

    assert.equal(result.confirmed, false);
    assert.equal(result.meetingStatus, "failed");
    assert.equal(commitCalls, 0);
});

test("commits only after a ready customer join URL exists", async () => {
    const order: string[] = [];
    const result = await provisionAndConfirmReservation({
        provider: "zoom",
        provisionMeeting: async () => {
            order.push("meeting-ready");
            return { status: "ready", joinUrl: "https://example.zoom.us/j/123" };
        },
        commitConfirmation: async () => {
            order.push("reservation-confirmed");
            return true;
        },
    });

    assert.deepEqual(order, ["meeting-ready", "reservation-confirmed"]);
    assert.equal(result.confirmed, true);
    assert.equal(result.joinUrl, "https://example.zoom.us/j/123");
});

test("reports a lost confirmation race without claiming success", async () => {
    const result = await provisionAndConfirmReservation({
        provider: "google_meet",
        provisionMeeting: async () => ({ status: "ready", joinUrl: "https://meet.google.com/abc-defg-hij" }),
        commitConfirmation: async () => false,
    });

    assert.equal(result.confirmed, false);
    assert.match(result.reason ?? "", /changed/i);
});
