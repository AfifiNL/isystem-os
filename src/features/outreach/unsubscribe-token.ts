import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_LEGACY_TOKEN_GRACE_END = "2026-07-09T00:00:00.000Z";

function getOutreachUnsubscribeSecret(env: NodeJS.ProcessEnv = process.env) {
    const dedicatedSecret = env.OUTREACH_UNSUBSCRIBE_SECRET?.trim();
    if (dedicatedSecret) return dedicatedSecret;

    // Safe fallback: RESEND_WEBHOOK_SECRET is already a server-only HMAC signing
    // secret in this app. Prefer OUTREACH_UNSUBSCRIBE_SECRET for independent rotation.
    const resendWebhookSecret = env.RESEND_WEBHOOK_SECRET?.trim();
    if (resendWebhookSecret) return resendWebhookSecret;

    return null;
}

function signingPayload(input: { workspaceId: string; messageId: string }) {
    return `${input.workspaceId}:${input.messageId}`;
}

function legacyDeterministicToken(input: { workspaceId: string; messageId: string }) {
    return Buffer.from(signingPayload(input)).toString("base64url");
}

function signOutreachUnsubscribePayload(input: { workspaceId: string; messageId: string }, secret: string) {
    return createHmac("sha256", secret).update(signingPayload(input)).digest("base64url");
}

function secureEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createOutreachUnsubscribeToken(
    input: { workspaceId: string; messageId: string },
    env: NodeJS.ProcessEnv = process.env,
) {
    const secret = getOutreachUnsubscribeSecret(env);
    if (!secret) throw new Error("OUTREACH_UNSUBSCRIBE_SECRET or RESEND_WEBHOOK_SECRET is not configured.");

    return `${TOKEN_VERSION}.${signOutreachUnsubscribePayload(input, secret)}`;
}

export function verifyOutreachUnsubscribeToken(
    input: { workspaceId: string; messageId: string; token: string },
    env: NodeJS.ProcessEnv = process.env,
) {
    const expectedToken = createOutreachUnsubscribeToken(input, env);
    if (secureEqual(input.token, expectedToken)) return true;

    const legacyOptIn = env.OUTREACH_ACCEPT_LEGACY_UNSUBSCRIBE_TOKENS === "true";
    const graceEnd = env.OUTREACH_LEGACY_UNSUBSCRIBE_GRACE_END ?? DEFAULT_LEGACY_TOKEN_GRACE_END;
    const withinGrace = Number.isFinite(Date.parse(graceEnd)) && Date.now() < Date.parse(graceEnd);
    if (!legacyOptIn && !withinGrace) return false;

    return secureEqual(input.token, legacyDeterministicToken(input));
}
