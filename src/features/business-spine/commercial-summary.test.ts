import test from "node:test";
import assert from "node:assert/strict";
import { deriveAccountCommercialSummary } from "@/features/business-spine/commercial-summary";

test("derives account commercial summary from links and timeline events", () => {
    const summary = deriveAccountCommercialSummary({
        commercialLinks: [
            {
                id: "link-1",
                customerId: "customer-1",
                linkType: "agreement_invoice",
                linkedRecordType: "legal_invoice",
                linkedRecordId: "invoice-1",
                linkedRecordRef: null,
                createdAt: "2026-06-10T10:00:00.000Z",
            },
            {
                id: "link-2",
                customerId: "customer-1",
                linkType: "invoice_payment",
                linkedRecordType: "booking_payment",
                linkedRecordId: "payment-1",
                linkedRecordRef: "booking-1",
                createdAt: "2026-06-10T11:00:00.000Z",
            },
        ],
        timeline: [
            { eventType: "legal.invoice_draft", occurredAt: "2026-06-10T09:00:00.000Z" },
            { eventType: "payment.captured", occurredAt: "2026-06-11T09:00:00.000Z" },
            { eventType: "contact.submitted", occurredAt: "2026-06-12T09:00:00.000Z" },
        ],
    });

    assert.equal(summary.totalCommercialLinks, 2);
    assert.deepEqual(summary.linkCountsByType, { agreement_invoice: 1, invoice_payment: 1 });
    assert.equal(summary.invoiceLinkCount, 1);
    assert.equal(summary.paymentLinkCount, 1);
    assert.deepEqual(summary.invoiceStatusCounts, { draft: 1 });
    assert.deepEqual(summary.paymentEventCounts, { captured: 1 });
    assert.equal(summary.lastCommercialActivityAt, "2026-06-11T09:00:00.000Z");
});
