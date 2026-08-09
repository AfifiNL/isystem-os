import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("verified booking payments have an idempotent invoice linkage", () => {
    const migration = read("supabase/migrations/20260806130000_booking_payment_invoice_linkage.sql");
    const service = read("src/features/legal-vault/lib/invoice-from-booking-internal.ts");

    assert.match(migration, /booking_payment_id uuid/);
    assert.match(migration, /booking_id uuid/);
    assert.match(migration, /UNIQUE \(workspace_id, booking_payment_id\)/);
    assert.match(migration, /legal_invoice_lines_workspace_invoice_sort_key/);
    assert.match(migration, /FOREIGN KEY \(workspace_id, invoice_id\)/);
    assert.match(migration, /ON DELETE SET NULL \(booking_id\)/);
    assert.match(migration, /ON DELETE SET NULL \(booking_payment_id\)/);
    assert.match(migration, /duplicate \(workspace_id, invoice_id, sort_order\)/);
    assert.match(migration, /Deleting a reservation can execute its invoice SET NULL action before/);
    assert.match(service, /payment\.status !== "verified"/);
    assert.match(service, /net_amount_cents/);
    assert.match(service, /vat_amount_cents/);
    assert.match(service, /gross_amount_cents/);
    assert.match(service, /onConflict: "workspace_id,invoice_id,sort_order"/);
    assert.match(service, /recordLegalInvoiceBusinessEvent/);
});

test("the booking follow-up worker reconciles meetings and commercial artifacts", () => {
    const route = read("src/app/api/booking/payment-followups/route.ts");
    const reconciler = read("src/features/booking/lib/commercial-reconciliation.ts");
    const recorders = read("src/features/business-spine/recorders.ts");
    const businessSpine = read("src/features/business-spine/service.ts");
    const cron = read("scripts/booking-payment-followups-cron-trigger.ts");

    assert.match(route, /reconcileVerifiedBookingCommercialArtifacts/);
    assert.match(route, /commercialArtifactsReconciled/);
    assert.match(reconciler, /provisionAndConfirmReservation/);
    assert.match(reconciler, /ensureInvoiceFromBookingPayment/);
    assert.match(reconciler, /draftAgreementFromBookingInternal/);
    assert.match(reconciler, /recordPaymentBusinessEvent/);
    assert.match(reconciler, /recordBookingBusinessEvent/);
    assert.match(reconciler, /\.is\("commercial_artifacts_reconciled_at", null\)/);
    assert.match(reconciler, /commercial_reconciliation_attempted_at: attemptedAt/);
    assert.match(reconciler, /commercial_artifacts_reconciled_at: new Date\(\)\.toISOString\(\)/);
    assert.match(recorders, /booking_reservations!booking_payments_workspace_reservation_fk/);
    assert.doesNotMatch(recorders, /booking_reservations:reservation_id!booking_payments_workspace_reservation_fk/);
    assert.match(businessSpine, /const upsertedCustomerId = customerEmail \|\| portalClientId/);
    assert.match(cron, /commercial_artifacts_reconciled/);
    assert.match(cron, /commercial_bookings_confirmed/);
    assert.match(cron, /commercial_artifact_error_count/);
    assert.match(cron, /commercial_artifact_reconciliation_failed/);
    assert.doesNotMatch(cron, /commercial_artifact_errors\s*:/);
    assert.doesNotMatch(cron, /stuck_payments\s*:/);
});
