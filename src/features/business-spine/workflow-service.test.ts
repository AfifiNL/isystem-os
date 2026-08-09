import test from "node:test";
import assert from "node:assert/strict";
import {
    buildWorkflowAwaitingApprovalSummary,
    deriveWorkflowRunPosture,
    isWorkflowRunAwaitingApproval,
} from "@/features/business-spine/workflow-posture";
import { buildWorkflowRuleHealthCards } from "@/features/business-spine/workflow-health";

test("workflow run posture treats completed approval handoff as awaiting approval", () => {
    const resultSummary = buildWorkflowAwaitingApprovalSummary({
        ruleId: "rule-1",
        ruleName: "Approve booking automation",
        blockedActions: ["create_work_item", "send_templated_email"],
        actionResults: [{ action: "request_approval", workItemId: "work-item-1" }],
    });

    assert.equal(resultSummary.awaitingApproval, true);
    assert.equal(resultSummary.approvalStatus, "awaiting_approval");
    assert.equal(isWorkflowRunAwaitingApproval({ status: "completed", result_summary: resultSummary }), true);
    assert.equal(deriveWorkflowRunPosture({ status: "completed", result_summary: resultSummary }), "awaiting_approval");
});

test("workflow run posture clears after approval resume completes configured actions", () => {
    const resumedSummary = {
        requiresApproval: true,
        awaitingApproval: false,
        approvalStatus: "approved_resumed",
        actionResults: [{ action: "create_work_item", workItemId: "work-item-2" }],
    };

    assert.equal(isWorkflowRunAwaitingApproval({ status: "completed", result_summary: resumedSummary }), false);
    assert.equal(deriveWorkflowRunPosture({ status: "completed", result_summary: resumedSummary }), "completed");
});

test("builds per-rule workflow health cards from workspace-scoped summary rows", () => {
    const cards = buildWorkflowRuleHealthCards({
        rules: [{
            id: "rule-1",
            name: "Booking handoff",
            trigger_key: "booking.confirmed",
            is_enabled: true,
            requires_approval: true,
            updated_at: "2026-06-12T10:00:00.000Z",
        }],
        events: [{
            id: "event-1",
            event_key: "booking.confirmed",
            source_module: "booking",
            created_at: "2026-06-12T10:05:00.000Z",
        }],
        runs: [{
            id: "run-1",
            rule_id: "rule-1",
            status: "completed",
            attempts: 1,
            max_attempts: 3,
            result_summary: buildWorkflowAwaitingApprovalSummary({
                ruleId: "rule-1",
                ruleName: "Booking handoff",
                blockedActions: ["create_work_item"],
                actionResults: [],
            }),
            error_message: null,
            created_at: "2026-06-12T10:06:00.000Z",
            updated_at: "2026-06-12T10:07:00.000Z",
        }],
        idempotencySkipCounts: new Map([["rule-1", 2]]),
        now: new Date("2026-06-12T10:37:00.000Z"),
    });

    assert.equal(cards.length, 1);
    assert.equal(cards[0].ruleId, "rule-1");
    assert.equal(cards[0].lastMatchedEvent?.id, "event-1");
    assert.equal(cards[0].lastRun?.posture, "awaiting_approval");
    assert.equal(cards[0].lastError, null);
    assert.equal(cards[0].approvalAgeMinutes, 30);
    assert.equal(cards[0].idempotencySkipCount, 2);
});

test("health cards surface last failed run errors", () => {
    const cards = buildWorkflowRuleHealthCards({
        rules: [{
            id: "rule-2",
            name: "Integration watch",
            trigger_key: "integration.failing",
            is_enabled: true,
            requires_approval: false,
            updated_at: "2026-06-12T10:00:00.000Z",
        }],
        events: [],
        runs: [{
            id: "run-2",
            rule_id: "rule-2",
            status: "failed",
            attempts: 3,
            max_attempts: 3,
            result_summary: {},
            error_message: "Worker unavailable",
            created_at: "2026-06-12T10:06:00.000Z",
            updated_at: "2026-06-12T10:07:00.000Z",
        }],
        idempotencySkipCounts: new Map(),
        now: new Date("2026-06-12T10:37:00.000Z"),
    });

    assert.equal(cards[0].lastError, "Worker unavailable");
    assert.equal(cards[0].lastRun?.posture, "failed");
    assert.equal(cards[0].approvalAgeMinutes, null);
});
