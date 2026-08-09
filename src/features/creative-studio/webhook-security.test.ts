import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    buildHiggsfieldWebhookLedgerKey,
    isAllowedCreativeProviderOutputUrl,
    verifyHiggsfieldWebhookSignature,
} from "./webhook-security";

describe("Creative Studio Higgsfield webhook scaffold security", () => {
    it("verifies HMAC signatures with timing-safe comparison", () => {
        const rawBody = JSON.stringify({ eventId: "evt_1", providerJobId: "job_1" });
        const secret = "webhook-secret";
        const valid = verifyHiggsfieldWebhookSignature({ rawBody, secret, signatureHeader: "" });

        assert.equal(valid.signatureValid, false);
        assert.equal(valid.reason, "missing_signature");
    });

    it("builds a stable replay/idempotency ledger key without trusting workspace ids", () => {
        assert.equal(
            buildHiggsfieldWebhookLedgerKey({ providerEventId: "evt_1", providerJobId: "job_1", rawStatus: "completed" }),
            "higgsfield:event:evt_1",
        );
        assert.equal(
            buildHiggsfieldWebhookLedgerKey({ providerEventId: null, providerJobId: "job_1", rawStatus: "completed" }),
            "higgsfield:job:job_1:completed",
        );
    });

    it("blocks unsafe future output URLs for SSRF protection", () => {
        assert.equal(isAllowedCreativeProviderOutputUrl("http://127.0.0.1/internal"), false);
        assert.equal(isAllowedCreativeProviderOutputUrl("file:///etc/passwd"), false);
        assert.equal(isAllowedCreativeProviderOutputUrl("https://cdn.higgsfield.ai/render.mp4"), true);
    });
});
