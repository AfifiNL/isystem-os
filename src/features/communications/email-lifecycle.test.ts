import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    getBookingEmailPlan,
    getInquiryEmailPlan,
    getPortalActivationPlan,
    getTransactionalWebhookSourceStatuses,
    isClaimableDelivery,
    isRetryableDelivery,
    selectAutomationRecipients,
} from "./email-lifecycle";

describe("inquiry email lifecycle", () => {
    it("always acknowledges the customer and alerts managers without silently subscribing", () => {
        assert.deepEqual(getInquiryEmailPlan({ marketingConsent: false, locale: "nl" }), {
            customer: { event: "inquiry_received", locale: "nl" },
            manager: { event: "inquiry_received", locale: "en" },
            subscribeToNewsletter: false,
        });
    });

    it("adds newsletter double opt-in only after explicit marketing consent", () => {
        assert.equal(
            getInquiryEmailPlan({ marketingConsent: true, locale: "ar" }).subscribeToNewsletter,
            true,
        );
    });
});

describe("contact-triggered newsletter automations", () => {
    const contacts = [
        { id: "contact-a", status: "subscribed" as const },
        { id: "contact-b", status: "subscribed" as const },
        { id: "contact-c", status: "unsubscribed" as const },
    ];

    it("targets only the contact whose enrollment created the campaign", () => {
        assert.deepEqual(selectAutomationRecipients(contacts, "contact-b"), [contacts[1]]);
    });

    it("never falls back to a whole audience when the target is absent or unsubscribed", () => {
        assert.deepEqual(selectAutomationRecipients(contacts, "missing-contact"), []);
        assert.deepEqual(selectAutomationRecipients(contacts, "contact-c"), []);
    });
});

describe("booking email lifecycle", () => {
    it("alerts both customer and managers for operational state changes", () => {
        for (const event of [
            "reservation_created",
            "reservation_reschedule_requested",
            "reservation_confirmed",
            "reservation_rescheduled",
            "reservation_cancelled",
            "reservation_completed",
            "reservation_no_show",
            "payment_requested",
            "payment_failed",
            "payment_expired",
            "payment_refunded",
        ] as const) {
            const plan = getBookingEmailPlan(event, "nl");
            assert.deepEqual(plan.recipients, ["customer", "manager"], event);
            assert.equal(plan.customerLocale, "nl", event);
            assert.equal(plan.managerLocale, "en", event);
        }
    });

    it("sends timed appointment reminders to the customer without duplicating manager alerts", () => {
        const plan = getBookingEmailPlan("appointment_reminder_24h", "ar");
        assert.deepEqual(plan.recipients, ["customer"]);
        assert.equal(plan.customerLocale, "ar");
    });

    it("normalizes unsupported locales to English", () => {
        assert.equal(getBookingEmailPlan("reservation_confirmed", "de").customerLocale, "en");
    });
});

describe("delivery retries", () => {
    const now = new Date("2026-07-29T18:00:00.000Z");

    it("retries transient and provider-failure states up to the attempt limit", () => {
        for (const status of ["pending", "failed", "skipped"] as const) {
            assert.equal(isRetryableDelivery({ status, attempts: 2, maxAttempts: 5 }), true, status);
        }
    });

    it("does not retry successful, terminal, or exhausted deliveries", () => {
        assert.equal(isRetryableDelivery({ status: "sent", attempts: 1, maxAttempts: 5 }), false);
        assert.equal(isRetryableDelivery({ status: "delivered", attempts: 1, maxAttempts: 5 }), false);
        assert.equal(isRetryableDelivery({ status: "bounced", attempts: 1, maxAttempts: 5 }), false);
        assert.equal(isRetryableDelivery({ status: "complained", attempts: 1, maxAttempts: 5 }), false);
        assert.equal(isRetryableDelivery({ status: "failed", attempts: 5, maxAttempts: 5 }), false);
    });

    it("recovers a running delivery only after its claim lease has expired", () => {
        assert.equal(
            isClaimableDelivery({
                status: "running",
                attempts: 1,
                maxAttempts: 5,
                updatedAt: "2026-07-29T17:45:00.000Z",
                now,
            }),
            true,
        );
        assert.equal(
            isClaimableDelivery({
                status: "running",
                attempts: 1,
                maxAttempts: 5,
                updatedAt: "2026-07-29T17:50:00.000Z",
                now,
            }),
            false,
        );
    });

    it("never recovers terminal or exhausted deliveries", () => {
        assert.equal(
            isClaimableDelivery({
                status: "delivered",
                attempts: 1,
                maxAttempts: 5,
                updatedAt: "2026-07-29T16:00:00.000Z",
                now,
            }),
            false,
        );
        assert.equal(
            isClaimableDelivery({
                status: "running",
                attempts: 5,
                maxAttempts: 5,
                updatedAt: "2026-07-29T16:00:00.000Z",
                now,
            }),
            false,
        );
    });
});

describe("transactional email webhook transitions", () => {
    it("does not let late provider events regress terminal delivery states", () => {
        assert.equal(getTransactionalWebhookSourceStatuses("sent").includes("delivered"), false);
        assert.equal(getTransactionalWebhookSourceStatuses("sent").includes("bounced"), false);
        assert.equal(getTransactionalWebhookSourceStatuses("failed").includes("delivered"), false);
        assert.equal(getTransactionalWebhookSourceStatuses("failed").includes("complained"), false);
    });

    it("allows terminal evidence to supersede earlier non-terminal states", () => {
        assert.equal(getTransactionalWebhookSourceStatuses("delivered").includes("failed"), true);
        assert.equal(getTransactionalWebhookSourceStatuses("bounced").includes("delivered"), true);
        assert.equal(getTransactionalWebhookSourceStatuses("complained").includes("bounced"), true);
    });
});

describe("portal activation", () => {
    it("sends a password-setup activation for a newly provisioned booking user", () => {
        assert.deepEqual(getPortalActivationPlan({ authUserCreated: true, locale: "nl" }), {
            event: "portal_activation",
            locale: "nl",
            requiresOneTimeLink: true,
        });
    });

    it("sends a portal access notice for an existing auth user", () => {
        assert.deepEqual(getPortalActivationPlan({ authUserCreated: false, locale: "ar" }), {
            event: "portal_access_granted",
            locale: "ar",
            requiresOneTimeLink: false,
        });
    });
});
