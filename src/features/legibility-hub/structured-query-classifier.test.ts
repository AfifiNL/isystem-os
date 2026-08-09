import assert from "node:assert/strict";
import test from "node:test";
import { classifyLegibilityQueryIntent } from "./structured-query-classifier";

test("routes Business Spine operational questions to deterministic structured cards", () => {
    const cases = [
        ["How many customers are active?", "customer_lifecycle_counts"],
        ["Which work items are open?", "open_work_item_list"],
        ["Which work items are blocked?", "blocked_work_item_list"],
        ["Which integrations are failing?", "failing_integration_list"],
        ["Show recent workflow failures", "recent_failed_workflow_run_list"],
    ] as const;

    for (const [query, key] of cases) {
        const classification = classifyLegibilityQueryIntent(query);
        assert.equal(classification.mode, "structured", query);
        assert.equal(classification.structuredKey, key, query);
        assert.ok(classification.confidence >= 0.75, query);
    }
});

test("keeps contextual Business Spine questions in hybrid mode", () => {
    const classification = classifyLegibilityQueryIntent("Summarize why integrations are failing");

    assert.equal(classification.mode, "hybrid");
    assert.equal(classification.structuredKey, "failing_integration_list");
});
