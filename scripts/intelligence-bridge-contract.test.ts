import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

async function source(relativePath: string): Promise<string> {
    return readFile(new URL(relativePath, ROOT), "utf8");
}

test("Opportunity scans include normalized Market Monitor signals", async () => {
    const scan = await source("src/features/opportunity-engine/lib/run-scan.ts");
    const detector = await source(
        "src/features/opportunity-engine/detectors/market-monitor-detector.ts",
    );

    assert.match(scan, /detectMarketMonitorSignals/);
    assert.match(scan, /\{\s*key:\s*"market-monitor",\s*run:\s*detectMarketMonitorSignals\s*\}/);
    assert.match(detector, /\.eq\("workspace_id",\s*workspaceId\)/);
    assert.match(detector, /\.eq\("archived",\s*false\)/);
    assert.match(detector, /marketMonitorResultId/);
    assert.match(detector, /sourceUrl/);
});

test("approved market opportunities flow into External Publishing mining", async () => {
    const miner = await source(
        "src/features/external-publishing/lib/opportunity-miner.ts",
    );

    assert.match(miner, /\.from\("workspace_opportunities"\)/);
    assert.match(miner, /\.eq\("category",\s*"market"/);
    assert.match(miner, /\.eq\("status",\s*"approved"/);
    assert.match(miner, /sourceType:\s*"market_signal"/);
    assert.match(miner, /source:\s*"workspace_opportunities"/);
});

test("database category and review UI support market opportunities", async () => {
    const migration = await source(
        "supabase/migrations/20260724113000_market_monitor_opportunity_bridge.sql",
    );
    const ui = await source(
        "src/features/opportunity-engine/ui/opportunity-list.tsx",
    );

    assert.match(migration, /ADD VALUE IF NOT EXISTS 'market'/i);
    assert.match(ui, /market:\s*\{\s*label:\s*"Market"/);
    assert.match(ui, /"seo",\s*"content",\s*"conversion",\s*"market"/);
});
