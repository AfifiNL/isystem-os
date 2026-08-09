import test from "node:test";
import assert from "node:assert/strict";

import {
    isReservationEligibleForCalendarSync,
    verifyGoogleCalendarConnectionAccess,
    verifyGoogleMeetingProvisioning,
} from "./google-calendar";

test("allows pre-confirmation calendar provisioning only when explicitly requested", () => {
    assert.equal(isReservationEligibleForCalendarSync("confirmed", false), true);
    assert.equal(isReservationEligibleForCalendarSync("completed", false), true);
    assert.equal(isReservationEligibleForCalendarSync("pending_review", false), false);
    assert.equal(isReservationEligibleForCalendarSync("pending_confirmation", false), false);
    assert.equal(isReservationEligibleForCalendarSync("pending_review", true), true);
    assert.equal(isReservationEligibleForCalendarSync("pending_confirmation", true), true);
    assert.equal(isReservationEligibleForCalendarSync("cancelled_by_customer", true), false);
});

test("tests Google access through the least-privilege Calendar List endpoint", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    let authorization = "";
    globalThis.fetch = async (input, init) => {
        requestedUrl = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return new Response(JSON.stringify({ id: "hossam@isystem.ai" }), {
            status: 200,
            headers: { "content-type": "application/json" },
        });
    };

    try {
        await verifyGoogleCalendarConnectionAccess("safe-test-token", "hossam@isystem.ai");
        assert.equal(
            requestedUrl,
            "https://www.googleapis.com/calendar/v3/users/me/calendarList/hossam%40isystem.ai?fields=id",
        );
        assert.equal(authorization, "Bearer safe-test-token");
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("keeps Google provider failures diagnostic without exposing response bodies", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
        error: {
            errors: [{ reason: "insufficientPermissions" }],
            message: "provider detail that should not be returned",
        },
    }), {
        status: 403,
        headers: { "content-type": "application/json" },
    });

    try {
        await assert.rejects(
            verifyGoogleCalendarConnectionAccess("safe-test-token", "primary"),
            (error: unknown) => error instanceof Error
                && error.message === "Google Calendar test failed (403, insufficientPermissions)."
                && !error.message.includes("provider detail"),
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("health-checks FreeBusy plus Meet creation and removes the canary event", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: typeof init?.body === "string" ? init.body : null });
        if (url.includes("/freeBusy")) {
            return Response.json({ calendars: { primary: { busy: [] } } });
        }
        if (method === "POST" && url.includes("/events?")) {
            return Response.json({
                id: "isystem-health-canary",
                conferenceData: {
                    conferenceId: "health-check",
                    entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }],
                },
            });
        }
        if (method === "DELETE") return new Response(null, { status: 204 });
        return Response.json({ id: "primary", items: [] });
    };

    try {
        const result = await verifyGoogleMeetingProvisioning("safe-test-token", "primary");
        assert.equal(result.meetingReady, true);
        assert.equal(calls.some((call) => call.url.includes("/freeBusy") && call.method === "POST"), true);
        const createCall = calls.find((call) => call.method === "POST" && call.url.includes("/events?"));
        assert.ok(createCall);
        assert.match(createCall.body ?? "", /hangoutsMeet/);
        assert.doesNotMatch(createCall.body ?? "", /attendees/);
        assert.equal(calls.some((call) => call.method === "DELETE" && call.url.includes("isystem-health-canary")), true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("removes the Google canary even when Meet provisioning is incomplete", async () => {
    const originalFetch = globalThis.fetch;
    let deleted = false;
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy: [] } } });
        if (method === "POST" && url.includes("/events?")) return Response.json({ id: "incomplete-canary" });
        if (method === "GET" && url.includes("/events/incomplete-canary")) return Response.json({ id: "incomplete-canary" });
        if (method === "DELETE") {
            deleted = true;
            return new Response(null, { status: 204 });
        }
        return Response.json({ id: "primary", items: [] });
    };
    try {
        await assert.rejects(
            verifyGoogleMeetingProvisioning("safe-test-token", "primary"),
            /Meet conference/i,
        );
        assert.equal(deleted, true);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
