import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const MIGRATION_PATH = "supabase/migrations/20260614010000_semantic_nodes_workspace_unique_fix.sql";
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

describe("semantic nodes workspace unique migration", () => {
    it("repairs the unique index for the application upsert conflict target", () => {
        assert.match(migrationSql, /BEGIN;[\s\S]*COMMIT;/);
        assert.match(migrationSql, /LOCK TABLE public\.workspace_semantic_nodes IN SHARE ROW EXCLUSIVE MODE;/);
        assert.match(migrationSql, /PARTITION BY workspace_id, entity_type, entity_id/);
        assert.match(migrationSql, /ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC/);
        assert.match(
            migrationSql,
            /ALTER TABLE public\.workspace_semantic_nodes\s+DROP CONSTRAINT IF EXISTS workspace_semantic_nodes_entity_unique;/,
        );
        assert.match(migrationSql, /DROP INDEX IF EXISTS public\.workspace_semantic_nodes_entity_unique;/);
        assert.match(
            migrationSql,
            /CREATE UNIQUE INDEX workspace_semantic_nodes_entity_unique\s+ON public\.workspace_semantic_nodes \(workspace_id, entity_type, entity_id\);/,
        );
    });
});
