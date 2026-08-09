import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(relativePath: string): Promise<string> {
    return readFile(new URL(relativePath, ROOT), "utf8");
}

const GOVERNED_AI_CALLERS = [
    "src/app/api/generate-node/route.ts",
    "src/app/api/enhance-narrative/route.ts",
    "src/app/api/legal/btw-summary/route.ts",
    "src/app/api/legal/generate-agreement/route.ts",
    "src/features/opportunity-engine/lib/narrate.ts",
    "src/features/creative-studio/strategy.ts",
    "src/features/seo/worker.ts",
    "src/features/blog/translation-service.ts",
] as const;

test("policy-critical AI callers cannot bypass the workspace executor", async () => {
    for (const path of GOVERNED_AI_CALLERS) {
        const contents = await source(path);
        assert.match(contents, /executeWorkspaceAi(?:Text|Object)/, `${path} lacks executor`);
        assert.match(contents, /trustedContext/, `${path} lacks trusted context`);
        assert.match(contents, /untrustedContext/, `${path} lacks untrusted context`);
        assert.doesNotMatch(
            contents,
            /generate(?:Text|Object)WithFallback/,
            `${path} bypasses governed generation`,
        );
        assert.doesNotMatch(
            contents,
            /meterAndCharge/,
            `${path} duplicates executor billing`,
        );
    }
});

test("executor bills the resolved runtime model and returns the persisted billing result", async () => {
    const executor = await source("src/shared/lib/ai/workspace-execution.ts");

    assert.match(
        executor,
        /model:\s*result\.runtimeFallback\.selectedModelId/,
    );
    assert.match(executor, /const billing = await meterAndCharge/);
    assert.match(executor, /workspaceAi:\s*\{[\s\S]*billing/);
    assert.match(executor, /runtimeFallback:\s*result\.runtimeFallback/);
});

test("AI audit persistence stores prompt identity and labels, not customer prompt values", async () => {
    const executor = await source("src/shared/lib/ai/workspace-execution.ts");
    const start = executor.slice(
        executor.indexOf("async function startAiExecutionAudit"),
        executor.indexOf("async function completeAiExecutionAudit"),
    );

    assert.match(start, /prompt_id:\s*details\.prompt\.metadata\.id/);
    assert.match(start, /prompt_version:\s*details\.prompt\.metadata\.version/);
    assert.match(start, /prompt_hash:\s*details\.prompt\.metadata\.hash/);
    assert.match(start, /trustedLabels/);
    assert.match(start, /untrustedLabels/);
    assert.ok(
        start.indexOf("...details.input.metadata")
        < start.indexOf("prompt: {"),
        "reserved prompt metadata must override caller metadata",
    );
    assert.doesNotMatch(start, /details\.prompt\.prompt/);
    assert.doesNotMatch(start, /details\.prompt\.system/);
    assert.match(executor, /getAiProviderErrorTelemetry/);
    assert.doesNotMatch(executor, /aiError:\s*providerError\.toJSON\(\)/);
    assert.doesNotMatch(
        executor,
        /errorMessage:\s*providerError\.message/,
        "raw provider messages must not enter shared AI audit rows",
    );
});

test("repository verification runs the aggregate AI contract suite", async () => {
    const packageJson = JSON.parse(await source("package.json")) as {
        scripts?: Record<string, string>;
    };

    assert.match(packageJson.scripts?.["test:ai-contracts"] ?? "", /node --import tsx --test/);
    assert.match(packageJson.scripts?.verify ?? "", /npm run test:ai-contracts/);
    assert.match(packageJson.scripts?.verify ?? "", /npm run lint/);
    assert.match(packageJson.scripts?.verify ?? "", /npm run build/);
});
