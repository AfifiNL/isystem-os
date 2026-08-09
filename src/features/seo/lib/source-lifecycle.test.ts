import assert from "node:assert/strict";
import { test } from "node:test";
import { extractSeoSourceReference } from "@/features/seo/lib/source-lifecycle";

test("SEO source lifecycle reads strategist context persisted by draft generation", () => {
    assert.deepEqual(extractSeoSourceReference({
        generation_inputs: {
            source_context: { kind: "plan", id: "plan-1", metadata: { evidence: { gscSignalCount: 8 } } },
        },
    }), { kind: "plan", id: "plan-1" });

    assert.deepEqual(extractSeoSourceReference({
        generation_inputs: { source_context: { kind: "opportunity", id: "opp-1" } },
    }), { kind: "opportunity", id: "opp-1" });
});

test("SEO source lifecycle supports legacy bridge metadata", () => {
    assert.deepEqual(extractSeoSourceReference({ seo: { planId: "plan-legacy" } }), { kind: "plan", id: "plan-legacy" });
    assert.equal(extractSeoSourceReference({ seo: {} }), null);
});
