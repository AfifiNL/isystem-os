import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    hashEmailForAnalytics,
    sanitizeAnalyticsMetadataForExport,
} from "./privacy";

describe("analytics privacy helpers", () => {
    it("normalizes email before hashing and never returns the raw email", () => {
        const first = hashEmailForAnalytics(" Lead@Example.COM ");
        const second = hashEmailForAnalytics("lead@example.com");

        assert.equal(first, second);
        assert.match(first ?? "", /^[a-f0-9]{64}$/);
        assert.notEqual(first, "lead@example.com");
    });

    it("sanitizes legacy raw email metadata into a fingerprint and drops direct identifiers", () => {
        const sanitized = sanitizeAnalyticsMetadataForExport({
            email: "person@example.com",
            firstName: "Raw",
            contact: { email: "person@example.com" },
            contactId: "contact-123",
            source: "contact_form",
        });

        assert.match(String(sanitized.emailHash), /^[a-f0-9]{64}$/);
        assert.equal(sanitized.contactId, "contact-123");
        assert.equal(sanitized.source, "contact_form");
        assert.equal("email" in sanitized, false);
        assert.equal("firstName" in sanitized, false);
        assert.equal("contact" in sanitized, false);
    });

    it("keeps product-loop analytics metadata while dropping unknown or personal fields", () => {
        const sanitized = sanitizeAnalyticsMetadataForExport({
            serviceId: "svc-123",
            templateKey: "consultation",
            selectedSlot: "2026-06-05T10:00:00.000Z",
            sourceChannel: "booking_flow",
            sourceCampaign: "spring_launch",
            popupId: "popup-123",
            campaignName: "Launch popup",
            episodeSlug: "episode-one",
            showSlug: "founder-show",
            customerEmail: "lead@example.com",
            customer: "Raw Lead",
            unsafeNested: { raw: "value" },
        });

        assert.equal(sanitized.serviceId, "svc-123");
        assert.equal(sanitized.templateKey, "consultation");
        assert.equal(sanitized.selectedSlot, "2026-06-05T10:00:00.000Z");
        assert.equal(sanitized.sourceChannel, "booking_flow");
        assert.equal(sanitized.sourceCampaign, "spring_launch");
        assert.equal(sanitized.popupId, "popup-123");
        assert.equal(sanitized.campaignName, "Launch popup");
        assert.equal(sanitized.episodeSlug, "episode-one");
        assert.equal(sanitized.showSlug, "founder-show");
        assert.match(String(sanitized.emailHash), /^[a-f0-9]{64}$/);
        assert.equal("customerEmail" in sanitized, false);
        assert.equal("customer" in sanitized, false);
        assert.equal("unsafeNested" in sanitized, false);
    });
});
