import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
    BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG,
    BUSINESS_SPINE_WORKFLOW_EVENT_KEYS,
    WORKFLOW_EVENT_CATEGORIES,
    buildWorkflowEventPayload,
    buildWorkflowIdempotencyKey,
    dispatchBusinessSpineWorkflowEvent,
    dispatchRecorderWorkflowEvent,
    getWorkflowEventDefinition,
    mapRecorderSignalToWorkflowEvent,
} from "@/features/business-spine/workflow-events";
import { WORKFLOW_RULE_CANONICAL_COLUMNS, WORKFLOW_RULE_INSERT_COLUMNS, WORKFLOW_TEMPLATE_EXCLUSIONS, WORKFLOW_TEMPLATES, buildWorkflowTemplateRuleRows, buildWorkflowRuleWritePayload, formatWorkflowRuleSchemaError, getMissingWorkflowRuleSchemaCacheColumn } from "@/features/business-spine/workflow-templates";
import { normalizeWorkflowActions } from "@/features/business-spine/workflow-engine";

test("catalog exposes unique typed event keys across required BOS categories", () => {
    const keys = BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG.map((event) => event.key);

    assert.equal(keys.length, new Set(keys).size);
    assert.deepEqual([...BUSINESS_SPINE_WORKFLOW_EVENT_KEYS].sort(), [...keys].sort());

    for (const category of WORKFLOW_EVENT_CATEGORIES) {
        assert.ok(
            BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG.some((event) => event.category === category),
            `missing category ${category}`,
        );
    }
});

test("idempotency builders are deterministic and sanitize fallback parts", () => {
    assert.equal(
        buildWorkflowIdempotencyKey("booking.pending_review", { reservationId: "reservation-123" }),
        buildWorkflowIdempotencyKey("booking.pending_review", { reservationId: "reservation-123" }),
    );
    assert.equal(
        buildWorkflowIdempotencyKey("newsletter.subscribed", { contactId: "Contact A/B" }),
        "workflow:newsletter.subscribed:Contact-A-B",
    );
    assert.equal(
        buildWorkflowIdempotencyKey("integration.failing", { provider: "Google Search Console", integrationKey: "search/perf" }),
        "workflow:integration.failing:Google-Search-Console:search-perf",
    );
});

test("payload helper keeps workflow payloads JSON-safe and catalog scoped", () => {
    const payload = buildWorkflowEventPayload("payment.captured", {
        paymentId: "pay_123",
        amountCents: 15900,
        nested: { ok: true },
        ignored: undefined,
    });

    assert.deepEqual(payload, {
        paymentId: "pay_123",
        amountCents: 15900,
        nested: { ok: true },
    });
});

test("recorder signal mapping normalizes existing direct recorder event names", () => {
    assert.equal(mapRecorderSignalToWorkflowEvent("legal", "legal.agreement_signed"), "legal.agreement.signed");
    assert.equal(mapRecorderSignalToWorkflowEvent("gsc", "gsc.opportunity_detected"), "gsc.opportunity.detected");
    assert.equal(mapRecorderSignalToWorkflowEvent("source-intelligence", "source.ingestion_failed"), "source-intelligence.ingestion.failed");
    assert.equal(mapRecorderSignalToWorkflowEvent("booking", "booking.pending_review"), "booking.pending_review");
    assert.equal(mapRecorderSignalToWorkflowEvent("booking", "booking.cancelled"), "booking.cancelled");
    assert.equal(mapRecorderSignalToWorkflowEvent("booking", "booking.completed"), "booking.completed");
    assert.equal(
        mapRecorderSignalToWorkflowEvent("payments", "payment.captured_after_terminal"),
        "payment.captured_after_terminal",
    );
});

test("starter workflow templates use catalog trigger keys", () => {
    for (const template of WORKFLOW_TEMPLATES) {
        assert.ok(getWorkflowEventDefinition(template.triggerKey), `missing catalog key for ${template.triggerKey}`);
    }
});

test("every catalog workflow event has a starter template or an explicit safe exclusion", () => {
    const templatedTriggerKeys = new Set(WORKFLOW_TEMPLATES.map((template) => template.triggerKey));
    const excludedTriggerKeys = new Set(WORKFLOW_TEMPLATE_EXCLUSIONS.map((exclusion) => exclusion.triggerKey));

    for (const event of BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG) {
        assert.ok(
            templatedTriggerKeys.has(event.key) || excludedTriggerKeys.has(event.key),
            `missing starter template or exclusion for ${event.key}`,
        );
    }

    for (const exclusion of WORKFLOW_TEMPLATE_EXCLUSIONS) {
        assert.ok(getWorkflowEventDefinition(exclusion.triggerKey), `missing catalog key for excluded ${exclusion.triggerKey}`);
        assert.equal(templatedTriggerKeys.has(exclusion.triggerKey), false, `${exclusion.triggerKey} must not be both templated and excluded`);
        assert.ok(exclusion.reason.length >= 20, `${exclusion.triggerKey} should document why no starter template is seeded`);
    }
});

test("starter workflow templates are safe disabled approval-required create_work_item rules", () => {
    const ids = new Set(WORKFLOW_TEMPLATES.map((template) => template.id));

    assert.equal(WORKFLOW_TEMPLATES.length, ids.size);
    assert.ok(WORKFLOW_TEMPLATES.length >= 19);

    for (const template of WORKFLOW_TEMPLATES) {
        const normalized = normalizeWorkflowActions(template.actionJson);

        assert.equal(normalized.ok, true, `${template.id} action_json should normalize`);
        assert.deepEqual(normalized.actions.map((action) => action.type), ["create_work_item"], `${template.id} should only create work items`);
        const [action] = normalized.actions;
        assert.equal(action.type, "create_work_item");
        assert.ok(action.description, `${template.id} should explain the operator task`);
        assert.deepEqual(action.metadata?.template, template.id, `${template.id} should carry metadata.template`);
    }
});

test("no-throw dispatch helper returns telemetry when workflow dispatch fails", async () => {
    const telemetry = await dispatchBusinessSpineWorkflowEvent({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        eventKey: "booking.pending_review",
        sourceEntityType: "booking_reservation",
        sourceEntityId: "00000000-0000-4000-8000-000000000002",
        idempotencyValues: { reservationId: "reservation-123" },
        dispatch: async () => {
            throw new Error("database unavailable");
        },
    });

    assert.equal(telemetry.ok, false);
    assert.equal(telemetry.eventKey, "booking.pending_review");
    assert.equal(telemetry.idempotencyKey, "workflow:booking.pending_review:reservation-123");
    assert.equal(telemetry.sourceModule, "booking");
    assert.equal(telemetry.eventId, null);
    assert.equal(telemetry.error, "database unavailable");
});

test("recorder workflow dispatcher maps existing recorder signals and does not throw on dispatch failure", async () => {
    const telemetry = await dispatchRecorderWorkflowEvent({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        sourceModule: "payments",
        recorderEventKey: "payment.captured",
        sourceEntityType: "booking_payment",
        sourceEntityId: "payment-123",
        payload: { paymentId: "payment-123", amountCents: 15900 },
        idempotencyValues: { paymentId: "payment-123" },
        dispatch: async () => {
            throw new Error("workflow store unavailable");
        },
    });

    assert.equal(telemetry?.ok, false);
    assert.equal(telemetry?.eventKey, "payment.captured");
    assert.equal(telemetry?.idempotencyKey, "workflow:payment.captured:payment-123");
    assert.equal(telemetry?.error, "workflow store unavailable");
});

test("recorder workflow dispatcher skips unmapped recorder signals", async () => {
    let calls = 0;
    const telemetry = await dispatchRecorderWorkflowEvent({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        sourceModule: "unknown",
        recorderEventKey: "unknown.event",
        dispatch: async () => {
            calls += 1;
            return { eventId: "event", matchedRules: 1, enqueuedRuns: 1, failedRules: 0, skippedRules: 0 };
        },
    });

    assert.equal(telemetry, null);
    assert.equal(calls, 0);
});

test("workflow template rows carry stable install metadata and safe defaults", () => {
    const rows = buildWorkflowTemplateRuleRows("00000000-0000-4000-8000-000000000001");

    assert.equal(rows.length, WORKFLOW_TEMPLATES.length);
    assert.equal(rows[0].is_enabled, false);
    assert.equal(rows[0].requires_approval, true);
    assert.equal(rows[0].metadata.installed_template, WORKFLOW_TEMPLATES[0].id);
    assert.equal(rows[0].metadata.installed_trigger_key, WORKFLOW_TEMPLATES[0].triggerKey);

    for (const row of rows) {
        assert.equal(row.is_enabled, false);
        assert.equal(row.requires_approval, true);
    }
});

test("workflow template install rows match the workflow rule schema contract", () => {
    const rows = buildWorkflowTemplateRuleRows("00000000-0000-4000-8000-000000000001");
    const migrationSql = readFileSync(new URL("../../../supabase/migrations/20260609170000_business_os_spine.sql", import.meta.url), "utf8");
    const repairSql = readFileSync(new URL("../../../supabase/migrations/20260613111500_workflow_rules_canonical_repair.sql", import.meta.url), "utf8");
    const tableDefinition = migrationSql.match(/CREATE TABLE IF NOT EXISTS public\.workspace_workflow_rules \(([\s\S]*?)\n\);/)?.[1] ?? "";

    for (const column of WORKFLOW_RULE_CANONICAL_COLUMNS) {
        assert.match(tableDefinition, new RegExp(`\\n\\s+${column}\\b`), `canonical migration should define ${column}`);
        assert.match(repairSql, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`), `repair migration should repair ${column}`);
    }

    for (const column of WORKFLOW_RULE_INSERT_COLUMNS) {
        assert.ok(WORKFLOW_RULE_CANONICAL_COLUMNS.includes(column), `${column} must be part of the canonical workflow rule contract`);
    }

    assert.match(tableDefinition, /\n\s+condition_json jsonb NOT NULL DEFAULT '\{\}'::jsonb,/);
    assert.match(tableDefinition, /\n\s+action_json jsonb NOT NULL DEFAULT '\{\}'::jsonb,/);
    assert.match(repairSql, /ALTER COLUMN condition_json SET NOT NULL/);
    assert.match(repairSql, /ADD COLUMN IF NOT EXISTS action_json jsonb DEFAULT '\{\}'::jsonb/);
    assert.match(repairSql, /CREATE INDEX IF NOT EXISTS workspace_workflow_rules_workspace_idx/);
    assert.match(repairSql, /CREATE TRIGGER set_updated_at_workspace_workflow_rules/);
    assert.match(repairSql, /ALTER TABLE public\.workspace_workflow_rules ENABLE ROW LEVEL SECURITY/);
    assert.match(repairSql, /NOTIFY pgrst, 'reload schema'/);

    for (const row of rows) {
        assert.deepEqual(Object.keys(row).sort(), [...WORKFLOW_RULE_INSERT_COLUMNS].sort());
        assert.ok(Array.isArray(row.action_json), "installed template rows must persist executable action_json");
        assert.equal(row.metadata.kill_switch, false);
    }
});

test("workflow rule schema-cache failures surface canonical repair guidance", () => {
    const message = formatWorkflowRuleSchemaError({
        code: "PGRST204",
        message: "Could not find the 'condition_json' column of 'workspace_workflow_rules' in the schema cache",
    });

    assert.equal(getMissingWorkflowRuleSchemaCacheColumn({
        code: "PGRST204",
        message: "Could not find the 'action_json' column of 'workspace_workflow_rules' in the schema cache",
    }), "action_json");
    assert.match(message, /schema is incomplete/);
    assert.match(message, /workspace_workflow_rules\.condition_json/);
    assert.match(message, /20260613111500_workflow_rules_canonical_repair\.sql/);
});

test("workflow rule write payload preserves installed template metadata while editing admin-controlled fields", () => {
    const payload = buildWorkflowRuleWritePayload({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "Edited installed rule",
        triggerKey: "booking.confirmed",
        isEnabled: true,
        requiresApproval: false,
        killSwitch: true,
        conditionJson: { field: "payload.status", op: "eq", value: "confirmed" },
        actionJson: [{ type: "create_work_item", title: "Confirm handoff", kind: "booking_handoff", priority: "normal" }],
        existingMetadata: {
            installed_template: "booking_confirmed_ops_handoff",
            installed_trigger_key: "booking.confirmed",
            managed_from: "template_installer",
            custom_note: "keep me",
        },
    });

    assert.equal(payload.workspace_id, "00000000-0000-4000-8000-000000000001");
    assert.equal(payload.name, "Edited installed rule");
    assert.equal(payload.trigger_key, "booking.confirmed");
    assert.equal(payload.is_enabled, true);
    assert.equal(payload.requires_approval, false);
    assert.deepEqual(payload.condition_json, { field: "payload.status", op: "eq", value: "confirmed" });
    assert.deepEqual(payload.action_json, [{ type: "create_work_item", title: "Confirm handoff", kind: "booking_handoff", priority: "normal" }]);
    assert.deepEqual(payload.metadata, {
        installed_template: "booking_confirmed_ops_handoff",
        installed_trigger_key: "booking.confirmed",
        managed_from: "dashboard_automations",
        custom_note: "keep me",
        kill_switch: true,
    });
});

test("workflow rule write payload does not accept client-supplied metadata for new rules", () => {
    const payload = buildWorkflowRuleWritePayload({
        workspaceId: "00000000-0000-4000-8000-000000000001",
        name: "Manual rule",
        triggerKey: "contact.submitted",
        isEnabled: false,
        requiresApproval: true,
        killSwitch: false,
        conditionJson: {},
        actionJson: [{ type: "create_work_item", title: "Review lead", kind: "lead_review", priority: "high" }],
        existingMetadata: null,
    });

    assert.deepEqual(payload.metadata, {
        kill_switch: false,
        managed_from: "dashboard_automations",
    });
});
