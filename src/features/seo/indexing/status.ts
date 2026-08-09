import type { Json } from "@/shared/lib/supabase/database.types";

export type SeoIndexingJobStatus = "queued" | "processing" | "submitted" | "indexed" | "not_indexed" | "failed" | "skipped";
export type SeoIndexingDisplayStatus = SeoIndexingJobStatus | "not_submitted";

export interface SeoIndexingJobLike {
    id: string;
    status: SeoIndexingJobStatus | string;
    attempt_count?: number | null;
    next_attempt_at?: string | null;
    last_attempt_at?: string | null;
    last_error?: string | null;
    last_inspection?: Json | null;
    updated_at?: string | null;
    created_at?: string | null;
}

export interface SeoIndexingAttemptLike {
    id: string;
    provider: string;
    status: string;
    error?: string | null;
    created_at: string;
}

export interface SeoIndexingDerivedStatus {
    status: SeoIndexingDisplayStatus;
    action: "queue" | "retry" | "none";
    isPending: boolean;
    needsAction: boolean;
}

const ACTIVE_STATUSES = new Set(["queued", "processing"]);
const RETRYABLE_STATUSES = new Set(["not_submitted", "not_indexed", "failed"]);

export function deriveSeoIndexingStatus(job: SeoIndexingJobLike | null | undefined): SeoIndexingDerivedStatus {
    const status = normalizeIndexingStatus(job?.status);
    const isPending = ACTIVE_STATUSES.has(status);
    const needsAction = RETRYABLE_STATUSES.has(status);
    const action = status === "not_submitted" ? "queue" : needsAction ? "retry" : "none";

    return {
        status,
        action,
        isPending,
        needsAction,
    };
}

export function normalizeIndexingStatus(status: unknown): SeoIndexingDisplayStatus {
    if (
        status === "queued"
        || status === "processing"
        || status === "submitted"
        || status === "indexed"
        || status === "not_indexed"
        || status === "failed"
        || status === "skipped"
    ) {
        return status;
    }
    return "not_submitted";
}

export function summarizeSeoIndexingCounts(statuses: SeoIndexingDisplayStatus[]): {
    total: number;
    indexed: number;
    pending: number;
    submitted: number;
    failed: number;
    notSubmitted: number;
    needsAction: number;
} {
    const counts = {
        total: statuses.length,
        indexed: 0,
        pending: 0,
        submitted: 0,
        failed: 0,
        notSubmitted: 0,
        needsAction: 0,
    };

    for (const status of statuses) {
        if (status === "indexed") counts.indexed += 1;
        if (status === "queued" || status === "processing") counts.pending += 1;
        if (status === "submitted" || status === "not_indexed") counts.submitted += 1;
        if (status === "failed") counts.failed += 1;
        if (status === "not_submitted") counts.notSubmitted += 1;
        if (RETRYABLE_STATUSES.has(status)) counts.needsAction += 1;
    }

    return counts;
}

export function inspectionIndicatesIndexed(response: unknown): boolean {
    const result = response && typeof response === "object" ? response as Record<string, unknown> : {};
    const inspection = result.inspectionResult && typeof result.inspectionResult === "object"
        ? result.inspectionResult as Record<string, unknown>
        : {};
    const indexStatus = inspection.indexStatusResult && typeof inspection.indexStatusResult === "object"
        ? inspection.indexStatusResult as Record<string, unknown>
        : {};
    const verdict = typeof indexStatus.verdict === "string" ? indexStatus.verdict : "";
    const coverageState = typeof indexStatus.coverageState === "string" ? indexStatus.coverageState.toLowerCase() : "";

    if (verdict === "PASS") {
        return true;
    }

    if (coverageState.includes("not indexed")) {
        return false;
    }

    return coverageState.includes("indexed");
}
