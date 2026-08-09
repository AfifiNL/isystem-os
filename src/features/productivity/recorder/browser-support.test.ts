import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getRecorderSupportMessage, normalizeRecorderPermissionError } from "./browser-support";

describe("recorder browser support helpers", () => {
    it("explains missing media APIs without throwing", () => {
        assert.equal(
            getRecorderSupportMessage({ hasMediaDevices: false, hasGetUserMedia: false, hasMediaRecorder: true }),
            "This browser cannot access microphone recording APIs. Use a current browser over HTTPS, then try again.",
        );
        assert.equal(
            getRecorderSupportMessage({ hasMediaDevices: true, hasGetUserMedia: true, hasMediaRecorder: false }),
            "This browser can request a microphone, but it cannot encode recordings with MediaRecorder. Use a current Chrome, Edge, Safari, or Firefox build.",
        );
        assert.equal(
            getRecorderSupportMessage({ hasMediaDevices: true, hasGetUserMedia: true, hasMediaRecorder: true }),
            null,
        );
    });

    it("normalizes permission-policy and browser denial errors for inline UX", () => {
        assert.equal(
            normalizeRecorderPermissionError(new DOMException("Permission denied", "NotAllowedError")),
            "Microphone access is blocked. Use HTTPS, enable microphone permission in your browser/site settings, then press Retry microphone.",
        );
        assert.equal(
            normalizeRecorderPermissionError(new DOMException("No input device", "NotFoundError")),
            "No microphone was found. Connect or enable a microphone in your system settings, then press Retry microphone.",
        );
        assert.equal(
            normalizeRecorderPermissionError(new Error("Permissions policy violation: microphone is not allowed in this document.")),
            "This page is blocked by the site microphone policy. Reload /dashboard/recorder over HTTPS, then press Retry microphone.",
        );
    });
});
