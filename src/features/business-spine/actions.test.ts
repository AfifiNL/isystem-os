import test from "node:test";
import assert from "node:assert/strict";
import {
    buildCustomerNoteTimelinePayload,
    validateBusinessLifecycleStatus,
} from "@/features/business-spine/account-record";
import { buildLegalInvoiceBusinessTimelinePayload } from "@/features/business-spine/recorders";

test("validates customer lifecycle status against the BOS enum", () => {
    assert.equal(validateBusinessLifecycleStatus("prospect"), "prospect");
    assert.equal(validateBusinessLifecycleStatus("active"), "active");
    assert.equal(validateBusinessLifecycleStatus("archived"), null);
    assert.equal(validateBusinessLifecycleStatus(""), null);
});

test("builds operator customer note timeline payload", () => {
    const payload = buildCustomerNoteTimelinePayload({
        note: "  Follow up after pricing call.  ",
        authorProfileId: "00000000-0000-4000-8000-000000000001",
    });

    assert.equal(payload.eventType, "customer.note");
    assert.equal(payload.summary, "Follow up after pricing call.");
    assert.equal(payload.body, "Follow up after pricing call.");
    assert.equal(payload.actorType, "workspace_manager");
    assert.equal(payload.sourceModule, "business_spine");
    assert.equal(payload.visibility, "internal");
    assert.deepEqual(payload.payload, {
        note: "Follow up after pricing call.",
        authored_by_profile_id: "00000000-0000-4000-8000-000000000001",
        created_from: "dashboard_customer_detail",
    });
});

test("truncates long customer note summaries without truncating body", () => {
    const note = "A".repeat(120);
    const payload = buildCustomerNoteTimelinePayload({ note, authorProfileId: null });

    assert.equal(payload.summary.length, 96);
    assert.equal(payload.summary, `${"A".repeat(93)}...`);
    assert.equal(payload.body, note);
});

test("builds legal invoice business timeline payload without revenue inference", () => {
    const payload = buildLegalInvoiceBusinessTimelinePayload({
        eventType: "draft",
        invoiceId: "invoice-1",
        clientName: "Acme BV",
        totalCents: 12100,
        currency: "EUR",
        dueDate: "2026-07-01",
    });

    assert.equal(payload.eventType, "legal.invoice_draft");
    assert.equal(payload.summary, "Invoice draft: Invoice invoice-1");
    assert.equal(payload.sourceModule, "legal");
    assert.equal(payload.sourceTable, "legal_invoices");
    assert.equal(payload.idempotencyKey, "legal-invoice:invoice-1:draft");
    assert.deepEqual(payload.payload, {
        invoiceId: "invoice-1",
        invoiceNumber: null,
        clientName: "Acme BV",
        relatedAgreementId: null,
        totalCents: 12100,
        currency: "EUR",
        dueDate: "2026-07-01",
    });
});
