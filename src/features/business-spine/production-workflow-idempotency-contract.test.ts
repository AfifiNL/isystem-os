import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("workflow run idempotency is a PostgREST-compatible conflict target", () => {
    const migration = read("supabase/migrations/20260806160000_production_delivery_reconciliation.sql");

    assert.match(migration, /DROP INDEX IF EXISTS public\.workspace_workflow_runs_idempotency_idx/i);
    assert.match(migration, /DROP INDEX IF EXISTS public\.workspace_workflow_runs_idempotency_unique/i);
    assert.match(
        migration,
        /CREATE UNIQUE INDEX workspace_workflow_runs_idempotency_unique\s+ON public\.workspace_workflow_runs \(workspace_id, idempotency_key\);/i,
    );
    assert.doesNotMatch(migration, /WHERE idempotency_key IS NOT NULL/i);
    assert.match(migration, /NOTIFY pgrst, 'reload schema'/i);
});
