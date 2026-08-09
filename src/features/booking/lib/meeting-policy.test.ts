import test from "node:test";
import assert from "node:assert/strict";

import {
    evaluateMeetingProviderSetup,
    resolveBookingMeetingProvider,
    validateMeetingProvider,
} from "./meeting-policy";

test("honors the configured provider for iSystem services instead of forcing Meet", () => {
    assert.equal(resolveBookingMeetingProvider("zoom"), "zoom");
    assert.equal(resolveBookingMeetingProvider("google_meet"), "google_meet");
    assert.equal(resolveBookingMeetingProvider(null), "none");
});

test("allows Google Meet for the Blueprint and Fit Call", () => {
    assert.deepEqual(validateMeetingProvider("google_meet", 90), { ok: true });
    assert.deepEqual(validateMeetingProvider("google_meet", 30), { ok: true });
});

test("limits free Zoom to forty minutes", () => {
    assert.deepEqual(validateMeetingProvider("zoom", 40), { ok: true });
    assert.equal(validateMeetingProvider("zoom", 41).ok, false);
    assert.deepEqual(validateMeetingProvider("none", 90), { ok: true });
});

test("accepts a Google Meet request but prevents auto-confirmation while OAuth is unavailable", () => {
    assert.deepEqual(evaluateMeetingProviderSetup({
        provider: "google_meet",
        durationMinutes: 90,
        autoCreate: true,
        googleCalendarConnected: false,
        zoomConfigured: false,
    }), {
        availability: "unavailable",
        bookingAllowed: true,
        autoConfirmationAllowed: false,
    });
});

test("accepts a Zoom request but prevents auto-confirmation while credentials are unavailable", () => {
    assert.deepEqual(evaluateMeetingProviderSetup({
        provider: "zoom",
        durationMinutes: 30,
        autoCreate: true,
        googleCalendarConnected: false,
        zoomConfigured: false,
    }), {
        availability: "unavailable",
        bookingAllowed: true,
        autoConfirmationAllowed: false,
    });
});

test("allows auto-confirmation only when the selected provider is operational", () => {
    assert.deepEqual(evaluateMeetingProviderSetup({
        provider: "google_meet",
        durationMinutes: 30,
        autoCreate: true,
        googleCalendarConnected: true,
        zoomConfigured: false,
    }), {
        availability: "automatic",
        bookingAllowed: true,
        autoConfirmationAllowed: true,
    });
    assert.deepEqual(evaluateMeetingProviderSetup({
        provider: "zoom",
        durationMinutes: 30,
        autoCreate: true,
        googleCalendarConnected: false,
        zoomConfigured: true,
    }), {
        availability: "automatic",
        bookingAllowed: true,
        autoConfirmationAllowed: true,
    });
});

test("still rejects a Zoom service that exceeds the free-provider limit", () => {
    const setup = evaluateMeetingProviderSetup({
        provider: "zoom",
        durationMinutes: 41,
        autoCreate: true,
        googleCalendarConnected: false,
        zoomConfigured: true,
    });
    assert.equal(setup.bookingAllowed, false);
    assert.equal(setup.availability, "unavailable");
    assert.match(setup.error ?? "", /40 minutes/);
});
