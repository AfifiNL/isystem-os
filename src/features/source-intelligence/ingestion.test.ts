import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifySourceFetchFailure, shouldSkipSourceHealthBackoff, sourceHealthBackoffActive } from "@/features/source-intelligence/ingestion";
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

describe("Source Intelligence fetch classification", () => {
    it("classifies permanent HTTP failures without treating them as network errors", () => {
        assert.equal(classifySourceFetchFailure({ status: 401 }), "unauthorized");
        assert.equal(classifySourceFetchFailure({ status: 403 }), "blocked");
        assert.equal(classifySourceFetchFailure({ status: 404 }), "missing");
        assert.equal(classifySourceFetchFailure({ status: 410 }), "missing");
    });

    it("classifies transient and content-type failures", () => {
        assert.equal(classifySourceFetchFailure({ status: 429 }), "rate_limited");
        assert.equal(classifySourceFetchFailure({ errorName: "AbortError", message: "This operation was aborted" }), "timeout");
        assert.equal(classifySourceFetchFailure({ message: "fetch failed: getaddrinfo ENOTFOUND example.invalid" }), "network");
        assert.equal(classifySourceFetchFailure({ status: 200, contentType: "application/pdf" }), "non_text");
    });
});

describe("Source Intelligence health backoff", () => {
    it("detects active source-health backoff windows", () => {
        const registry = registryWithHealth({ status: "blocked", next_retry_after: "2026-06-08T00:00:00.000Z" });
        assert.deepEqual(sourceHealthBackoffActive(registry, new Date("2026-06-07T00:00:00.000Z")), {
            active: true,
            reason: "blocked",
            nextRetryAfter: "2026-06-08T00:00:00.000Z",
        });
    });

    it("ignores healthy or expired backoff metadata", () => {
        assert.equal(sourceHealthBackoffActive(registryWithHealth({ status: "healthy" }), new Date("2026-06-07T00:00:00.000Z")).active, false);
        assert.equal(sourceHealthBackoffActive(registryWithHealth({ status: "rate_limited", next_retry_after: "2026-06-06T00:00:00.000Z" }), new Date("2026-06-07T00:00:00.000Z")).active, false);
    });

    it("lets operator-initiated runs bypass scheduled health backoff", () => {
        const registry = registryWithHealth({ status: "missing", next_retry_after: "2026-06-10T00:00:00.000Z" });
        assert.equal(shouldSkipSourceHealthBackoff(registry, "scheduled"), false);
        assert.equal(shouldSkipSourceHealthBackoff(registry, "manual"), true);
        assert.equal(shouldSkipSourceHealthBackoff(registry, "retry"), true);
        assert.equal(shouldSkipSourceHealthBackoff(registry, "backfill"), true);
    });
});
