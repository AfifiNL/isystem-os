import test from "node:test";
import assert from "node:assert/strict";
import { createOutreachUnsubscribeToken, verifyOutreachUnsubscribeToken } from "@/features/outreach/unsubscribe-token";

const ids = {
    workspaceId: "00000000-0000-0000-0000-000000000001",
    messageId: "00000000-0000-0000-0000-000000000002",
};

test("creates and verifies HMAC outreach unsubscribe tokens", () => {
    const env = { OUTREACH_UNSUBSCRIBE_SECRET: "test-outreach-secret" } as unknown as NodeJS.ProcessEnv;
    const token = createOutreachUnsubscribeToken(ids, env);

    assert.match(token, /^v1\.[A-Za-z0-9_-]+$/);
    assert.equal(verifyOutreachUnsubscribeToken({ ...ids, token }, env), true);
    assert.equal(verifyOutreachUnsubscribeToken({ ...ids, messageId: "00000000-0000-0000-0000-000000000003", token }, env), false);
});

test("falls back to the documented server-only Resend webhook secret", () => {
    const env = { RESEND_WEBHOOK_SECRET: ["test", "resend", "webhook", "secret"].join("-") } as unknown as NodeJS.ProcessEnv;
    const token = createOutreachUnsubscribeToken(ids, env);

    assert.equal(verifyOutreachUnsubscribeToken({ ...ids, token }, env), true);
});

test("accepts the previous deterministic base64url token during the rotation grace window", () => {
    const env = {
        OUTREACH_UNSUBSCRIBE_SECRET: "test-outreach-secret",
        OUTREACH_LEGACY_UNSUBSCRIBE_GRACE_END: "2999-01-01T00:00:00.000Z",
    } as unknown as NodeJS.ProcessEnv;
    const previousToken = Buffer.from(`${ids.workspaceId}:${ids.messageId}`).toString("base64url");

    assert.equal(verifyOutreachUnsubscribeToken({ ...ids, token: previousToken }, env), true);
});

test("does not accept the previous deterministic base64url token after the grace window", () => {
    const env = {
        OUTREACH_UNSUBSCRIBE_SECRET: "test-outreach-secret",
        OUTREACH_LEGACY_UNSUBSCRIBE_GRACE_END: "2000-01-01T00:00:00.000Z",
    } as unknown as NodeJS.ProcessEnv;
    const previousToken = Buffer.from(`${ids.workspaceId}:${ids.messageId}`).toString("base64url");

    assert.equal(verifyOutreachUnsubscribeToken({ ...ids, token: previousToken }, env), false);
});
