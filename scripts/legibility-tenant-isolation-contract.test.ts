import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const MIGRATION_PATH = "supabase/migrations/20260724100000_legibility_tenant_isolation_hardening.sql";
const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
const actionSource = readFileSync("src/features/legibility-hub/actions.ts", "utf8");
const uiSource = readFileSync("src/features/admin/ui/legibility-hub-app.tsx", "utf8");

describe("Legibility Hub tenant isolation contract", () => {
    it("fails closed on missing workspace and cannot search every workspace", () => {
        assert.match(migrationSql, /IF p_workspace_id IS NULL THEN[\s\S]*RAISE EXCEPTION 'Workspace scope is required.'/);
        assert.match(migrationSql, /WHERE wsn\.workspace_id = p_workspace_id/);
        assert.doesNotMatch(migrationSql, /p_workspace_id IS NULL OR wsn\.workspace_id = p_workspace_id/);
    });

    it("allows only service-role execution of the security-definer RPC", () => {
        assert.match(migrationSql, /auth\.role\(\) IS DISTINCT FROM 'service_role'/);
        assert.match(
            migrationSql,
            /REVOKE ALL ON FUNCTION public\.search_semantic_nodes\(uuid, public\.vector, double precision, integer, text\[\]\) FROM PUBLIC, anon, authenticated;/,
        );
        assert.match(
            migrationSql,
            /GRANT EXECUTE ON FUNCTION public\.search_semantic_nodes\(uuid, public\.vector, double precision, integer, text\[\]\) TO service_role;/,
        );
    });

    it("has no browser-selectable or action-level global tenant bypass", () => {
        assert.doesNotMatch(actionSource, /bypassTenantLimit|admin_global/);
        assert.doesNotMatch(uiSource, /bypassTenantLimit|cross-workspace semantic search|Cross-Tenant Authorized/);
        assert.match(actionSource, /createAdminClient\(\)/);
        assert.match(actionSource, /buildWorkspaceScopedSemanticSearchRpcArgs/);
    });
});
