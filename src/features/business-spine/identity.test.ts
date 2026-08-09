import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCustomerIdentityLookupPlan,
    normalizeCustomerEmail,
} from "@/features/business-spine/identity";

test("customer identity lookup plan prefers portal client before normalized email", () => {
    const plan = buildCustomerIdentityLookupPlan({
        portalClientId: "portal-123",
        email: "  Buyer@Example.COM ",
    });

    assert.deepEqual(plan, [
        { kind: "portal_client", value: "portal-123" },
        { kind: "email", value: "buyer@example.com" },
    ]);
});

test("customer identity lookup plan adds booking, legal agreement, and payment fallback lookups", () => {
    const plan = buildCustomerIdentityLookupPlan({
        bookingId: "booking-123",
        legalAgreementId: "agreement-123",
        paymentId: "payment-123",
    });

    assert.deepEqual(plan, [
        { kind: "booking", value: "booking-123" },
        { kind: "legal_agreement", value: "agreement-123" },
        { kind: "payment", value: "payment-123" },
    ]);
});

test("customer email normalization trims, lowercases, and rejects blank email input", () => {
    assert.equal(normalizeCustomerEmail("  Customer@Example.COM  "), "customer@example.com");
    assert.equal(normalizeCustomerEmail("   "), null);
    assert.equal(normalizeCustomerEmail(null), null);
});
