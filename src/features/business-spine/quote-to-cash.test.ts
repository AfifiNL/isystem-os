import test from "node:test";
import assert from "node:assert/strict";
import {
    assertQuoteMutationAllowed,
    buildCommercialLinkIdempotencyKey,
} from "@/features/business-spine/quote-to-cash";

test("commercial link idempotency keys are stable for the same target", () => {
    const first = buildCommercialLinkIdempotencyKey({
        linkType: "booking_agreement",
        linkedRecordType: "legal_agreement",
        linkedRecordId: "00000000-0000-0000-0000-000000000001",
        linkedRecordRef: "booking-123",
    });
    const second = buildCommercialLinkIdempotencyKey({
        linkType: "booking_agreement",
        linkedRecordType: "legal_agreement",
        linkedRecordId: "00000000-0000-0000-0000-000000000001",
        linkedRecordRef: "booking-123",
    });

    assert.equal(first, second);
    assert.equal(first, "commercial-link:booking_agreement:no-quote:legal_agreement:00000000-0000-0000-0000-000000000001");
});

test("finalized quotes reject content mutation and allow correction links", () => {
    assert.deepEqual(assertQuoteMutationAllowed({
        currentStatus: "accepted",
        mutationKind: "content",
    }), {
        allowed: false,
        error: "Finalized quotes are immutable. Create a credit note or adjustment link instead.",
    });

    assert.deepEqual(assertQuoteMutationAllowed({
        currentStatus: "accepted",
        mutationKind: "correction_link",
    }), { allowed: true });
});

test("finalized quotes allow only bounded status transitions", () => {
    assert.deepEqual(assertQuoteMutationAllowed({
        currentStatus: "accepted",
        nextStatus: "converted",
        mutationKind: "status_transition",
    }), { allowed: true });

    assert.equal(assertQuoteMutationAllowed({
        currentStatus: "converted",
        nextStatus: "sent",
        mutationKind: "status_transition",
    }).allowed, false);
});
