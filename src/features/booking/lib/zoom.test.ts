import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

type ZoomModule = typeof import("./zoom");
type NodeModuleLoader = { _load?: (request: string, parent: unknown, isMain: boolean) => unknown };
const require = createRequire(import.meta.url);

async function importZoomModule(): Promise<ZoomModule> {
    const moduleLoader = require("node:module") as NodeModuleLoader;
    const originalLoad = moduleLoader._load;
    if (originalLoad) {
        moduleLoader._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
            if (request === "server-only") return {};
            return originalLoad.call(this, request, parent, isMain);
        };
    }
    return import("./zoom");
}

const zoomEnv = {
    ZOOM_ACCOUNT_ID: "account-id",
    ZOOM_CLIENT_ID: "client-id",
    ZOOM_CLIENT_SECRET: "client-secret",
    ZOOM_HOST_USER_ID: "host@example.com",
};

function applyZoomEnv() {
    const previous = Object.fromEntries(Object.keys(zoomEnv).map((key) => [key, process.env[key]]));
    Object.assign(process.env, zoomEnv);
    return () => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    };
}

test("creates and removes a Zoom meeting canary", async () => {
    const restoreEnv = applyZoomEnv();
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string; body: string | null }> = [];
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: typeof init?.body === "string" ? init.body : null });
        if (url.includes("zoom.us/oauth/token")) return Response.json({ access_token: "test-token", expires_in: 3600 });
        if (method === "POST") return Response.json({ id: 123456789, join_url: "https://example.zoom.us/j/123456789", start_url: "https://example.zoom.us/s/secret" });
        if (method === "DELETE") return new Response(null, { status: 204 });
        return Response.json({ id: "host@example.com", status: "active" });
    };

    try {
        const { verifyZoomMeetingProvisioning } = await importZoomModule();
        const result = await verifyZoomMeetingProvisioning();
        assert.deepEqual(result, { meetingReady: true });
        const createCall = calls.find((call) => call.method === "POST" && call.url.includes("/meetings"));
        assert.ok(createCall);
        assert.match(createCall.body ?? "", /Booking Zoom health check/);
        assert.equal(calls.some((call) => call.method === "DELETE" && call.url.endsWith("/meetings/123456789")), true);
        assert.equal(JSON.stringify(result).includes("start_url"), false);
    } finally {
        globalThis.fetch = originalFetch;
        restoreEnv();
    }
});

test("removes a provider meeting when Zoom omits the customer join URL", async () => {
    const restoreEnv = applyZoomEnv();
    const originalFetch = globalThis.fetch;
    let deleted = false;
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("zoom.us/oauth/token")) return Response.json({ access_token: "test-token", expires_in: 3600 });
        if (method === "POST") return Response.json({ id: 987654321 });
        if (method === "DELETE") {
            deleted = true;
            return new Response(null, { status: 204 });
        }
        return Response.json({});
    };
    try {
        const { createZoomMeeting } = await importZoomModule();
        await assert.rejects(
            createZoomMeeting({ topic: "Test", startTime: new Date().toISOString(), durationMinutes: 30, reference: "TEST" }),
            /join URL/i,
        );
        assert.equal(deleted, true);
    } finally {
        globalThis.fetch = originalFetch;
        restoreEnv();
    }
});
