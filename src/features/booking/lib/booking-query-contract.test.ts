import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actionsSource = readFileSync(new URL("../actions.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(
    new URL("../../../../supabase/migrations/20260804120000_core_booking_payment_and_meetings.sql", import.meta.url),
    "utf8",
);

test("availability embeds booking services through the tenant-bound composite foreign key", () => {
    assert.match(migrationSource, /CONSTRAINT booking_reservations_workspace_service_fk/);
    assert.match(
        actionsSource,
        /booking_services!booking_reservations_workspace_service_fk\(buffer_before_minutes,buffer_after_minutes\)/,
    );
    assert.doesNotMatch(
        actionsSource,
        /booking_services:service_id\(buffer_before_minutes,buffer_after_minutes\)/,
    );
    assert.equal(
        actionsSource.match(/\.select\(BOOKING_RESERVATION_AVAILABILITY_SELECT\)/g)?.length,
        2,
    );
});

test("the booking migration replaces the legacy single-capacity fence and is repeat-safe", () => {
    assert.match(
        migrationSource,
        /DROP CONSTRAINT IF EXISTS booking_reservations_resource_no_overlap/,
    );
    assert.match(migrationSource, /pg_advisory_xact_lock/);
    assert.match(migrationSource, /ON DELETE SET NULL \(resource_id\) NOT VALID/);
    assert.match(migrationSource, /ON DELETE SET NULL \(location_id\) NOT VALID/);
    assert.equal(
        migrationSource.match(/ON DELETE SET NULL \(booking_payment_id\) NOT VALID/g)?.length,
        2,
    );
    assert.equal(
        migrationSource.match(/ON DELETE SET NULL \(reservation_id\) NOT VALID/g)?.length,
        2,
    );
    assert.match(
        migrationSource,
        /DROP POLICY IF EXISTS payment_webhook_events_workspace_select_policy/,
    );
    assert.match(
        migrationSource,
        /DROP POLICY IF EXISTS payment_webhook_events_service_policy/,
    );
    assert.match(migrationSource, /REVOKE ALL ON TABLE public\.payment_webhook_events FROM PUBLIC, anon, authenticated/);
    assert.doesNotMatch(migrationSource, /CREATE POLICY payment_webhook_events_workspace_select_policy/);
    assert.match(migrationSource, /parent deletion may detach only the three/i);
    assert.match(migrationSource, /payment_webhook_attempts_workspace_received_idx/);
    assert.match(migrationSource, /booking_payments_commercial_reconciliation_queue_idx/);
    assert.match(migrationSource, /commercial_artifacts_reconciled_at IS NULL/);
    assert.match(migrationSource, /REVOKE ALL ON TABLE public\.payment_webhook_delivery_attempts FROM PUBLIC, anon, authenticated/);
    assert.match(migrationSource, /NEW\.booking_payment_id IS NULL[\s\S]*?NOT EXISTS \([\s\S]*?public\.booking_payments/);
    assert.match(migrationSource, /NEW\.reservation_id IS NULL[\s\S]*?NOT EXISTS \([\s\S]*?public\.booking_reservations/);
});
