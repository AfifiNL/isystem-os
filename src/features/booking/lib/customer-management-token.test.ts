import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    createBookingManagementToken,
    verifyBookingManagementToken,
} from "./customer-management-token";

const payload = {
    reservationId: "00000000-0000-4000-8000-000000000001",
    workspaceId: "00000000-0000-4000-8000-000000000002",
    expiresAt: "2026-08-30T12:00:00.000Z",
};

const bookingSecret = (label: string) => [label, "booking", "management", "secret", "rotation", "material"].join("-");

const env = {
    BOOKING_MANAGEMENT_SECRET: bookingSecret("test"),
} as unknown as NodeJS.ProcessEnv;

describe("customer booking management tokens", () => {
    it("round-trips a signed, opaque, time-limited reservation capability", () => {
        const token = createBookingManagementToken(payload, env);

        assert.match(token, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        assert.deepEqual(
            verifyBookingManagementToken(token, env, new Date("2026-08-01T12:00:00.000Z")),
            payload,
        );
        assert.equal(token.includes(payload.reservationId), false);
        assert.equal(token.includes(payload.workspaceId), false);
    });

    it("rejects tampering, malformed payloads, and expired capabilities", () => {
        const token = createBookingManagementToken(payload, env);
        const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

        assert.equal(
            verifyBookingManagementToken(tampered, env, new Date("2026-08-01T12:00:00.000Z")),
            null,
        );
        assert.equal(verifyBookingManagementToken("v1.invalid.signature", env), null);
        assert.equal(
            verifyBookingManagementToken(token, env, new Date("2026-09-01T12:00:00.000Z")),
            null,
        );
    });

    it("verifies outstanding links with an explicit previous booking secret", () => {
        const previousEnv = {
            BOOKING_MANAGEMENT_SECRET: bookingSecret("previous"),
        } as unknown as NodeJS.ProcessEnv;
        const token = createBookingManagementToken(payload, previousEnv);
        const rotatedEnv = {
            BOOKING_MANAGEMENT_SECRET: bookingSecret("current"),
            BOOKING_MANAGEMENT_SECRET_PREVIOUS: bookingSecret("previous"),
        } as unknown as NodeJS.ProcessEnv;
        assert.deepEqual(
            verifyBookingManagementToken(token, rotatedEnv, new Date("2026-08-01T12:00:00.000Z")),
            payload,
        );
    });

    it("never couples booking links to the Resend webhook secret", () => {
        const resendOnlyEnv = {
            RESEND_WEBHOOK_SECRET: ["test", "resend", "webhook", "secret"].join("-"),
        } as unknown as NodeJS.ProcessEnv;
        assert.throws(() => createBookingManagementToken(payload, resendOnlyEnv), /BOOKING_MANAGEMENT_SECRET/);
    });

    it("fails closed when no server-side signing secret exists", () => {
        assert.throws(
            () => createBookingManagementToken(payload, {} as NodeJS.ProcessEnv),
            /BOOKING_MANAGEMENT_SECRET/,
        );
        assert.equal(
            verifyBookingManagementToken("v1.payload.signature", {} as NodeJS.ProcessEnv),
            null,
        );
    });

    it("rejects current and previous secrets shorter than 32 UTF-8 bytes", () => {
        const weakCurrent = {
            BOOKING_MANAGEMENT_SECRET: "too-short",
        } as unknown as NodeJS.ProcessEnv;
        assert.throws(
            () => createBookingManagementToken(payload, weakCurrent),
            /at least 32 bytes/i,
        );
        assert.equal(verifyBookingManagementToken("v1.payload.signature", weakCurrent), null);

        const token = createBookingManagementToken(payload, env);
        const weakPrevious = {
            BOOKING_MANAGEMENT_SECRET: bookingSecret("current"),
            BOOKING_MANAGEMENT_SECRET_PREVIOUS: "weak",
        } as unknown as NodeJS.ProcessEnv;
        assert.throws(
            () => createBookingManagementToken(payload, weakPrevious),
            /BOOKING_MANAGEMENT_SECRET_PREVIOUS.*at least 32 bytes/i,
        );
        assert.equal(
            verifyBookingManagementToken(token, weakPrevious, new Date("2026-08-01T12:00:00.000Z")),
            null,
        );
    });
});
