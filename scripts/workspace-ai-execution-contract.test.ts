import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(relativePath: string): Promise<string> {
    return readFile(new URL(relativePath, ROOT), "utf8");
}

test("workspace AI executor owns the policy-critical execution sequence", async () => {
    const executor = await source("src/shared/lib/ai/workspace-execution.ts");

    const authorization = executor.indexOf("resolveWorkspaceAiAuthorization");
    const balance = executor.indexOf("assertSufficientAiBalance");
    const rateLimit = executor.indexOf("checkAiRateLimitPg");
    const workspaceConfig = executor.indexOf("runWithWorkspaceAiConfig");
    const generation = executor.indexOf("generateTextWithFallback");
    const embedding = executor.indexOf("executeWorkspaceAiEmbedding");
    const metering = executor.indexOf("meterAndCharge");

    for (const [label, position] of Object.entries({
        authorization,
        balance,
        rateLimit,
        workspaceConfig,
        generation,
        embedding,
        metering,
    })) {
        assert.notEqual(position, -1, `missing ${label} policy step`);
    }

    assert.match(executor, /runtimeFallback\.selectedModelId/);
    assert.match(executor, /buildResolvedAiRequestMetadata/);
    assert.match(executor, /status:\s*"failed"/);
    assert.match(executor, /completeAiExecutionAudit/);
    assert.match(executor, /WORKSPACE_AI_SYSTEM_SOURCE_SET\.has\(source\)/);
    assert.match(executor, /effectiveCapabilities\.includes\(requiredCapability\)/);
});

test("workspace AI embeddings use the same authorization, rate, billing, and audit policy", async () => {
    const executor = await source("src/shared/lib/ai/workspace-execution.ts");
    const legibility = await source("src/features/legibility-hub/actions.ts");

    assert.match(executor, /export async function executeWorkspaceAiEmbedding/);
    assert.match(executor, /embeddingTokenUsage:\s*result\.usage\.tokens/);
    assert.match(executor, /inputTokens:\s*result\.usage\.tokens/);
    assert.match(legibility, /executeWorkspaceAiEmbedding/);
    assert.doesNotMatch(legibility, /\bgenerateEmbedding\(/);
});

test("AI execution audit migration is tenant-readable and service-write-only", async () => {
    const migration = await source(
        "supabase/migrations/20260724103000_workspace_ai_execution_audit.sql",
    );

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.ai_execution_runs/i);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/i);
    assert.match(migration, /can_access_workspace\(workspace_id,\s*NULL\)/i);
    assert.match(migration, /REVOKE ALL ON TABLE public\.ai_execution_runs FROM PUBLIC,\s*anon,\s*authenticated/i);
    assert.match(migration, /GRANT SELECT ON TABLE public\.ai_execution_runs TO authenticated/i);
    assert.match(migration, /GRANT ALL ON TABLE public\.ai_execution_runs TO service_role/i);
});
