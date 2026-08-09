import assert from "node:assert/strict";
import test from "node:test";
import { deriveSeoIndexingStatus, inspectionIndicatesIndexed, summarizeSeoIndexingCounts } from "@/features/seo/indexing/status";

test("deriveSeoIndexingStatus treats missing jobs as queueable", () => {
    assert.deepEqual(deriveSeoIndexingStatus(null), {
        status: "not_submitted",
        action: "queue",
        isPending: false,
        needsAction: true,
    });
});

test("deriveSeoIndexingStatus marks queued and processing jobs as pending", () => {
    assert.equal(deriveSeoIndexingStatus({ id: "1", status: "queued" }).isPending, true);
    assert.equal(deriveSeoIndexingStatus({ id: "2", status: "processing" }).isPending, true);
    assert.equal(deriveSeoIndexingStatus({ id: "2", status: "processing" }).action, "none");
});

test("deriveSeoIndexingStatus keeps submitted and indexed non-actionable", () => {
    assert.deepEqual(deriveSeoIndexingStatus({ id: "1", status: "submitted" }), {
        status: "submitted",
        action: "none",
        isPending: false,
        needsAction: false,
    });
    assert.deepEqual(deriveSeoIndexingStatus({ id: "2", status: "indexed" }), {
        status: "indexed",
        action: "none",
        isPending: false,
        needsAction: false,
    });
});

test("deriveSeoIndexingStatus marks failed and not indexed jobs retryable", () => {
    assert.equal(deriveSeoIndexingStatus({ id: "1", status: "not_indexed" }).action, "retry");
    assert.equal(deriveSeoIndexingStatus({ id: "2", status: "failed" }).action, "retry");
});

test("summarizeSeoIndexingCounts groups dashboard totals", () => {
    assert.deepEqual(
        summarizeSeoIndexingCounts(["indexed", "queued", "processing", "submitted", "not_indexed", "failed", "not_submitted"]),
        {
            total: 7,
            indexed: 1,
            pending: 2,
            submitted: 2,
            failed: 1,
            notSubmitted: 1,
            needsAction: 3,
        },
    );
});

test("inspectionIndicatesIndexed does not treat not-indexed coverage as indexed", () => {
    assert.equal(
        inspectionIndicatesIndexed({
            inspectionResult: {
                indexStatusResult: {
                    verdict: "NEUTRAL",
                    coverageState: "Discovered - currently not indexed",
                },
            },
        }),
        false,
    );
    assert.equal(
        inspectionIndicatesIndexed({
            inspectionResult: {
                indexStatusResult: {
                    verdict: "NEUTRAL",
                    coverageState: "Crawled - currently not indexed",
                },
            },
        }),
        false,
    );
});

test("inspectionIndicatesIndexed accepts positive inspection signals", () => {
    assert.equal(
        inspectionIndicatesIndexed({
            inspectionResult: {
                indexStatusResult: {
                    verdict: "PASS",
                    coverageState: "URL is on Google",
                },
            },
        }),
        true,
    );
    assert.equal(
        inspectionIndicatesIndexed({
            inspectionResult: {
                indexStatusResult: {
                    verdict: "NEUTRAL",
                    coverageState: "Submitted and indexed",
                },
            },
        }),
        true,
    );
});
