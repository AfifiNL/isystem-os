import test from "node:test";
import assert from "node:assert/strict";
import { LEGIBILITY_HUB_EVAL_FIXTURES } from "@/features/legibility-hub/evaluation-fixtures";
import { buildWorkspaceScopedSemanticSearchRpcArgs } from "@/features/legibility-hub/semantic-search-scope";
import { classifyLegibilityQueryIntent } from "@/features/legibility-hub/structured-query-classifier";

test("Legibility Hub semantic search always binds the authenticated active workspace", () => {
    const args = buildWorkspaceScopedSemanticSearchRpcArgs({
        workspaceId: "workspace-a",
        queryEmbedding: [0.1, 0.2],
        threshold: 2,
        limit: 10_000,
        entityTypes: ["note", " note ", "", "content_item"],
    });

    assert.deepEqual(args, {
        p_workspace_id: "workspace-a",
        p_query_embedding: [0.1, 0.2],
        p_match_threshold: 1,
        p_match_count: 100,
        p_entity_types: ["note", "content_item"],
    });
});

test("Legibility Hub semantic search rejects a missing workspace instead of widening scope", () => {
    assert.throws(
        () => buildWorkspaceScopedSemanticSearchRpcArgs({
            workspaceId: " ",
            queryEmbedding: [0.1],
        }),
        /requires an active workspace/,
    );
});

test("Legibility Hub evaluation fixtures execute without creating a cross-workspace scope", () => {
    for (const fixture of LEGIBILITY_HUB_EVAL_FIXTURES) {
        const classification = classifyLegibilityQueryIntent(fixture.query);
        assert.equal(classification.mode, fixture.expectedMode, fixture.query);
        if (fixture.expectedKey) {
            assert.equal(classification.structuredKey, fixture.expectedKey, fixture.query);
        }

        if (fixture.mustNotBypassWorkspace) {
            const args = buildWorkspaceScopedSemanticSearchRpcArgs({
                workspaceId: "workspace-a",
                queryEmbedding: [0.1],
            });
            assert.equal(args.p_workspace_id, "workspace-a", fixture.query);
            assert.equal("bypassTenantLimit" in args, false, fixture.query);
        }
    }
});
