import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldQueueSourceRegistryForRun } from "@/features/source-intelligence/run";
import { sourceWorkerIntegrationStatusForResult } from "@/features/source-intelligence/worker";
import type { SourceRegistryRow } from "@/features/source-intelligence/types";
import type { Json } from "@/shared/lib/supabase/database.types";

function registryWithHealth(sourceHealth: Record<string, unknown>): SourceRegistryRow {
    return {
        id: "00000000-0000-0000-0000-000000000001",
        workspace_id: "00000000-0000-0000-0000-000000000002",
        name: "Test source",
        canonical_url: "https://example.com/source",
        source_type: "website",
        quality: "high",
        trust_tier: "industry",
        locale: "en",
        topic_tags: [],
        is_active: true,
        is_public_safe: true,
        crawl_frequency: "7 days",
        last_ingested_at: null,
        metadata: { source_health: sourceHealth as Json } as Json,
        created_by: null,
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
    };
}

describe("Source Intelligence queue selection", () => {
    it("keeps broad manual refresh from retrying sources in health backoff", () => {
        const registry = registryWithHealth({ status: "degraded", next_retry_after: "2999-01-01T00:00:00.000Z" });

        assert.equal(shouldQueueSourceRegistryForRun(registry, "manual", { targetedRegistry: false }), false);
    });

    it("allows targeted source refresh to bypass source-health backoff", () => {
        const registry = registryWithHealth({ status: "degraded", next_retry_after: "2999-01-01T00:00:00.000Z" });

        assert.equal(shouldQueueSourceRegistryForRun(registry, "manual", { targetedRegistry: true }), true);
    });
});

describe("Source Intelligence worker health", () => {
    it("treats handled per-source failures as a healthy worker signal", () => {
        assert.equal(sourceWorkerIntegrationStatusForResult({
            success: false,
            jobId: "job-1",
            workspaceId: "workspace-1",
            failureKind: "source",
            message: "This operation was aborted",
        }), "healthy");
    });

    it("degrades worker health for infrastructure failures with or without a claimed job", () => {
        assert.equal(sourceWorkerIntegrationStatusForResult({
            success: false,
            jobId: "job-1",
            workspaceId: "workspace-1",
            failureKind: "worker",
            message: "Failed to update source health metadata",
        }), "degraded");
        assert.equal(sourceWorkerIntegrationStatusForResult({
            success: false,
            message: "Failed to claim next source job",
        }), "degraded");
    });
});
