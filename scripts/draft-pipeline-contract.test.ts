import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(relativePath: string): Promise<string> {
    return readFile(new URL(relativePath, ROOT), "utf8");
}

test("generate-draft is a strict, persisted, typed phase workflow", async () => {
    const route = await source("src/app/api/generate-draft/route.ts");

    assert.match(route, /parseDraftGenerationRequest/);
    assert.doesNotMatch(route, /await req\.json\(\) as DraftBrief/);
    for (const phase of [
        "brief_validation",
        "evidence_retrieval",
        "blueprint",
        "format_generation",
        "editorial_validation",
        "persistence",
    ]) {
        assert.match(route, new RegExp(`"${phase}"`), `missing ${phase} phase`);
    }
    assert.match(route, /completeDraftGenerationRun/);
    assert.match(route, /failDraftGenerationRun/);
    assert.match(route, /derived_outputs/);
    assert.match(route, /effectiveCapabilities\.includes\("content\.write"\)/);
});

test("blog generation prefers structured relational systems diagrams without an extra generation phase", async () => {
    const route = await source("src/app/api/generate-draft/route.ts");

    assert.match(route, /diagram_type": "relational\|flowchart\|timeline\|funnel\|framework\|comparison_matrix"/);
    assert.match(route, /"system_archetype":/);
    assert.match(route, /"feedback_type":/);
    assert.match(route, /"polarity": "positive\|negative\|neutral"/);
    assert.match(route, /"delay": "boolean optional"/);
    assert.match(route, /Prefer relational diagrams/);
    assert.match(route, /Promise\.all\(\[\s*shouldGenerateCharts[\s\S]*shouldGenerateDiagrams/);
});

test("draft generation run migration is tenant scoped and records resumable phase state", async () => {
    const migration = await source(
        "supabase/migrations/20260724110000_content_generation_pipeline_runs.sql",
    );

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.content_generation_runs/i);
    assert.match(migration, /phase_state\s+JSONB/i);
    assert.match(migration, /current_phase/i);
    assert.match(migration, /content_item_id/i);
    assert.match(migration, /can_access_workspace\(workspace_id,\s*'content\.read'\)/i);
    assert.match(migration, /can_access_workspace\(workspace_id,\s*'content\.write'\)/i);
});
