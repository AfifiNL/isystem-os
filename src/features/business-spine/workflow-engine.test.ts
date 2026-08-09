import test from "node:test";
import assert from "node:assert/strict";
import {
    WORKFLOW_ACTION_SUPPORT,
    evaluateWorkflowCondition,
    getWorkflowWorkerRuntimeRegistry,
    normalizeWorkflowActions,
    validateWorkflowRulePreview,
} from "@/features/business-spine/workflow-engine";
import { WORKFLOW_TEMPLATES } from "@/features/business-spine/workflow-templates";

test("matches bounded all/any/not workflow conditions against event payload", () => {
    const event = {
        eventKey: "booking.confirmed",
        sourceModule: "booking",
        payload: {
            status: "confirmed",
            totalCents: 15900,
            tags: ["consultation", "priority"],
            customer: {
                locale: "nl",
            },
        },
    };

    assert.equal(evaluateWorkflowCondition({
        all: [
            { field: "eventKey", op: "eq", value: "booking.confirmed" },
            { field: "payload.status", op: "eq", value: "confirmed" },
            { field: "payload.totalCents", op: "gte", value: 10000 },
            { field: "payload.tags", op: "contains", value: "priority" },
            { any: [
                { field: "payload.customer.locale", op: "eq", value: "en" },
                { field: "payload.customer.locale", op: "eq", value: "nl" },
            ] },
            { not: { field: "payload.status", op: "eq", value: "cancelled" } },
        ],
    }, event).matched, true);
});

test("fails closed on unsupported or overlarge workflow conditions", () => {
    const event = { eventKey: "booking.confirmed", sourceModule: "booking", payload: { status: "confirmed" } };

    assert.equal(evaluateWorkflowCondition({ field: "payload.status", op: "regex", value: "confirm" }, event).matched, false);
    assert.equal(evaluateWorkflowCondition({ field: "__proto__.polluted", op: "exists" }, event).matched, false);
    assert.equal(evaluateWorkflowCondition({
        all: Array.from({ length: 51 }, () => ({ field: "eventKey", op: "eq", value: "booking.confirmed" })),
    }, event).matched, false);
});

test("normalizes only allowlisted workflow actions", () => {
    const normalized = normalizeWorkflowActions([
        {
            type: "create_work_item",
            title: "Review booking",
            kind: "booking_review",
            priority: "high",
        },
        {
            type: "enqueue_worker_job",
            workerKey: "source_ingestion",
            registryId: "00000000-0000-0000-0000-000000000001",
            sourceUrl: "https://example.com/source",
        },
        {
            type: "send_templated_email",
            templateKey: "booking_confirmation",
            to: "customer@example.com",
        },
    ]);

    assert.equal(normalized.ok, true);
    assert.equal(normalized.actions.length, 3);
    assert.deepEqual(normalized.actions.map((action) => action.type), [
        "create_work_item",
        "enqueue_worker_job",
        "send_templated_email",
    ]);
});

test("rejects arbitrary workflow actions and malformed descriptors", () => {
    assert.equal(normalizeWorkflowActions({ type: "run_javascript", code: "process.exit(1)" }).ok, false);
    assert.equal(normalizeWorkflowActions({ type: "create_work_item", title: "", kind: "task" }).ok, false);
    assert.equal(normalizeWorkflowActions(Array.from({ length: 11 }, () => ({ type: "write_timeline_event", eventType: "x", summary: "y" }))).ok, false);
});

test("validates workflow rule previews with normalized actions and condition diagnostics", () => {
    const preview = validateWorkflowRulePreview({
        triggerKey: "booking.confirmed",
        conditionJson: { field: "payload.totalCents", op: "gte", value: 10000 },
        actionJson: { type: "create_work_item", title: "Review booking", kind: "booking_review", priority: "high" },
        samplePayload: { totalCents: 12500 },
    });

    assert.equal(preview.ok, true);
    assert.equal(preview.condition.matched, true);
    assert.equal(preview.actions.normalized.length, 1);
    assert.deepEqual(preview.errors, []);
});

test("workflow preview fails closed for unsupported conditions and invalid action JSON", () => {
    const unsupportedCondition = validateWorkflowRulePreview({
        triggerKey: "booking.confirmed",
        conditionJson: { field: "payload.status", op: "regex", value: "confirmed" },
        actionJson: { type: "create_work_item", title: "Review booking", kind: "booking_review" },
    });

    assert.equal(unsupportedCondition.ok, false);
    assert.ok(unsupportedCondition.errors.some((error) => error.includes("Unsupported condition op")));

    const invalidAction = validateWorkflowRulePreview({
        triggerKey: "booking.confirmed",
        conditionJson: {},
        actionJson: { type: "run_javascript", code: "process.exit(1)" },
    });

    assert.equal(invalidAction.ok, false);
    assert.ok(invalidAction.errors.some((error) => error.includes("Unsupported action type")));
});

test("starter workflow templates never enqueue runtime-bound worker jobs", () => {
    for (const template of WORKFLOW_TEMPLATES) {
        const actions: ReadonlyArray<{ type: string }> = template.actionJson;
        assert.equal(
            actions.some((action) => action.type === "enqueue_worker_job"),
            false,
            `${template.id} must not include enqueue_worker_job`,
        );
    }
});

test("starter workflow templates never send direct templated email", () => {
    for (const template of WORKFLOW_TEMPLATES) {
        const actions: ReadonlyArray<{ type: string }> = template.actionJson;
        assert.equal(
            actions.some((action) => action.type === "send_templated_email"),
            false,
            `${template.id} must not include send_templated_email`,
        );
    }
});

test("worker runtime registry correctly binds zod schemas, retry policies, and audit trails", () => {
    const registry = getWorkflowWorkerRuntimeRegistry();

    assert.equal(registry.length, 4);
    assert.ok(registry.every((worker) => worker.actionType === "enqueue_worker_job"));
    assert.ok(registry.every((worker) => worker.starterTemplateEligible === false));
    assert.ok(registry.every((worker) => worker.runtimeBound === true));
    assert.ok(registry.every((worker) => typeof worker.typedRuntimeBindingSchema.safeParse === "function"));
    assert.ok(registry.every((worker) => typeof worker.retryPolicy.maxRetries === "number"));
    assert.ok(registry.every((worker) => typeof worker.auditTrail.table === "string"));
    assert.ok(registry.some((worker) => worker.key === "content_translation"));
});

test("action support copy documents partially supported workflow execution surfaces", () => {
    assert.ok(WORKFLOW_ACTION_SUPPORT.concreteActions.includes("create_work_item"));
    assert.ok(WORKFLOW_ACTION_SUPPORT.workerJobs.some((worker) => worker.key === "source_ingestion" && worker.support.includes("metadata-only")));
    assert.ok(WORKFLOW_ACTION_SUPPORT.emailTemplates.some((template) => template.key === "workflow_approval_request" && template.support.includes("Implemented")));
    assert.ok(WORKFLOW_ACTION_SUPPORT.emailTemplates.some((template) => template.key === "booking_confirmation" && template.support.includes("metadata-only")));
});
