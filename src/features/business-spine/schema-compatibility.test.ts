import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const readMigration = (name: string) =>
    readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

describe("Business Spine legacy schema reconciliation", () => {
    it("makes canonical work-item statuses usable after the enum migration commits", () => {
        const sql = readMigration("20260729133000_core_business_spine_legacy_enum_reconciliation.sql");

        assert.match(sql, /ALTER TYPE public\.workspace_work_item_status ADD VALUE IF NOT EXISTS 'open'/);
        assert.match(sql, /ALTER TYPE public\.workspace_work_item_status ADD VALUE IF NOT EXISTS 'dismissed'/);
        assert.match(sql, /CREATE TYPE public\.business_lifecycle_status AS ENUM/);
    });

    it("adds every canonical customer, timeline, work-item, and workflow column used at runtime", () => {
        const sql = readMigration("20260729134000_core_business_spine_schema_reconciliation.sql");

        for (const column of [
            "display_name",
            "customer_kind",
            "lifecycle_status",
            "portal_client_id",
            "source_module",
            "deleted_at",
        ]) {
            assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `customer.${column}`);
        }
        for (const column of [
            "summary",
            "body",
            "actor_type",
            "source_module",
            "source_table",
            "source_id",
            "visibility",
            "idempotency_key",
        ]) {
            assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `timeline.${column}`);
        }
        for (const column of [
            "kind",
            "assigned_to_profile_id",
            "snoozed_until",
            "source_module",
            "source_entity_type",
            "source_entity_id",
            "idempotency_key",
        ]) {
            assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `work_item.${column}`);
        }
        for (const column of [
            "event_key",
            "source_module",
            "source_entity_type",
            "source_entity_id",
            "idempotency_key",
            "event_id",
        ]) {
            assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `workflow.${column}`);
        }
    });

    it("keeps the legacy and canonical columns synchronized without destructive schema changes", () => {
        const sql = readMigration("20260729134000_core_business_spine_schema_reconciliation.sql");

        for (const trigger of [
            "sync_workspace_customer_compatibility",
            "sync_workspace_timeline_compatibility",
            "sync_workspace_work_item_compatibility",
            "sync_workspace_workflow_event_compatibility",
        ]) {
            assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${trigger}`));
            assert.match(sql, new RegExp(`CREATE TRIGGER ${trigger}`));
        }

        assert.match(sql, /workspace_customers_primary_email_unique/);
        assert.match(sql, /workspace_customer_timeline_idempotency_unique/);
        assert.match(sql, /workspace_work_items_idempotency_unique/);
        assert.match(sql, /workspace_workflow_events_idempotency_unique/);
        assert.match(sql, /workspace_workflow_runs_workspace_event_fk/);
        assert.match(sql, /FOREIGN KEY \(workspace_id, portal_client_id\)/);
        assert.match(sql, /FOREIGN KEY \(workspace_id, event_id\)/);
        assert.match(sql, /enforce_workspace_work_item_assignee_scope/);
        assert.match(sql, /workspace_work_items_assigned_profile_fk_idx/);
        assert.match(sql, /WHERE display_name IS NULL/);
        assert.match(sql, /WHERE kind IS NULL/);
        assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
    });
});
