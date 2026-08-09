import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(relativePath: string): Promise<string> {
    return readFile(new URL(relativePath, ROOT), "utf8");
}

test("translation webhook only validates and durably enqueues", async () => {
    const route = await source("src/app/api/content/translate-webhook/route.ts");

    assert.match(route, /enqueueContentTranslationJob/);
    assert.match(route, /jobId/);
    assert.doesNotMatch(route, /translateAndSeedPost/);
    assert.doesNotMatch(route, /\(async\s*\(\)\s*=>/);
});

test("translation queue persists lifecycle, lease, and retry metadata", async () => {
    const migration = await source(
        "supabase/migrations/20260724120000_content_translation_jobs.sql",
    );

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.content_translation_jobs/i);
    assert.match(
        migration,
        /'queued'[\s\S]*'running'[\s\S]*'retrying'[\s\S]*'completed'[\s\S]*'failed'/i,
    );
    assert.match(migration, /attempts integer/i);
    assert.match(migration, /max_attempts integer/i);
    assert.match(migration, /run_after timestamptz/i);
    assert.match(migration, /worker_id text/i);
    assert.match(migration, /claim_next_content_translation_job/i);
    assert.match(migration, /FOR UPDATE SKIP LOCKED/i);
    assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/i);
    assert.match(migration, /GRANT SELECT ON TABLE public\.content_translation_jobs[\s\S]*TO authenticated/i);
    assert.match(migration, /GRANT ALL ON TABLE public\.content_translation_jobs[\s\S]*TO service_role/i);
});

test("translation worker claims tenant-bound jobs and records terminal or retry state", async () => {
    const jobs = await source("src/features/blog/translation-jobs.ts");

    assert.match(jobs, /claim_next_content_translation_job/);
    assert.match(jobs, /\.eq\("workspace_id",\s*job\.workspace_id\)/);
    assert.match(jobs, /\.eq\("worker_id",\s*workerId\)/);
    assert.match(jobs, /translateAndSeedPost/);
    assert.match(jobs, /replacementJobId/);
    assert.match(jobs, /status:\s*"completed"/);
    assert.match(jobs, /"retrying"/);
    assert.match(jobs, /"failed"/);
});

test("translation AI uses the centralized executor and explicit trust boundary", async () => {
    const translation = await source("src/features/blog/translation-service.ts");

    assert.match(translation, /executeWorkspaceAiObject/);
    assert.match(translation, /kind:\s*"system_workspace"/);
    assert.match(translation, /trustedContext/);
    assert.match(translation, /untrustedContext/);
    assert.match(translation, /\.eq\("workspace_id",\s*workspaceId\)/);
    assert.doesNotMatch(translation, /generateObjectWithFallback/);
});

test("workflow runtime and package scripts expose the concrete translation worker", async () => {
    const engine = await source("src/features/business-spine/workflow-engine.ts");
    const service = await source("src/features/business-spine/workflow-service.ts");
    const packageJson = JSON.parse(await source("package.json")) as {
        scripts?: Record<string, string>;
    };

    assert.match(engine, /content_translation/);
    assert.match(service, /enqueueContentTranslationJob/);
    assert.equal(
        packageJson.scripts?.["worker:content-translation"],
        "tsx --require ./scripts/register-server-only.cjs scripts/content-translation-worker.ts --daemon",
    );
});
