import type { Json } from "@/shared/lib/supabase/database.types";

export interface NormalizedInternalLinkJobSummary {
    generated: number;
    upserted: number;
    previewed: number;
    readyToApply: number;
    manualReview: number;
    applied: number;
    failed: number;
    skipped: number;
    costMillicents: number;
    message: string | null;
    hasOutcomeCounts: boolean;
}

export interface InternalLinkAutomationAggregate extends NormalizedInternalLinkJobSummary {
    jobCount: number;
    latestCompletedAt: string | null;
    latestJobId: string | null;
}

function asRecord(value: Json | unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function readNumber(record: Record<string, unknown>, keys: string[]): number {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
        if (typeof value === "string" && value.trim().length > 0) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
        }
    }
    return 0;
}

export function normalizeInternalLinkJobSummary(summary: Json | unknown): NormalizedInternalLinkJobSummary {
    const record = asRecord(summary);
    const normalized = {
        generated: readNumber(record, ["generated"]),
        upserted: readNumber(record, ["upserted"]),
        previewed: readNumber(record, ["previewed"]),
        readyToApply: readNumber(record, ["ready_to_apply", "readyToApply"]),
        manualReview: readNumber(record, ["manual_review_required", "manualReview"]),
        applied: readNumber(record, ["applied"]),
        failed: readNumber(record, ["failed"]),
        skipped: readNumber(record, ["skipped"]),
        costMillicents: readNumber(record, ["cost_millicents", "costMillicents"]),
        message: typeof record.message === "string" && record.message.trim().length > 0 ? record.message.trim() : null,
        hasOutcomeCounts: false,
    };

    normalized.hasOutcomeCounts = [
        normalized.previewed,
        normalized.readyToApply,
        normalized.manualReview,
        normalized.applied,
        normalized.failed,
        normalized.skipped,
    ].some((value) => value > 0);

    return normalized;
}

export function aggregateInternalLinkJobSummaries(
    jobs: Array<{ id: string; summary: Json | unknown; completed_at?: string | null }>,
): InternalLinkAutomationAggregate {
    const aggregate: InternalLinkAutomationAggregate = {
        generated: 0,
        upserted: 0,
        previewed: 0,
        readyToApply: 0,
        manualReview: 0,
        applied: 0,
        failed: 0,
        skipped: 0,
        costMillicents: 0,
        message: null,
        hasOutcomeCounts: false,
        jobCount: 0,
        latestCompletedAt: null,
        latestJobId: null,
    };

    for (const job of jobs) {
        const summary = normalizeInternalLinkJobSummary(job.summary);
        if (!summary.hasOutcomeCounts) continue;
        aggregate.generated += summary.generated;
        aggregate.upserted += summary.upserted;
        aggregate.previewed += summary.previewed;
        aggregate.readyToApply += summary.readyToApply;
        aggregate.manualReview += summary.manualReview;
        aggregate.applied += summary.applied;
        aggregate.failed += summary.failed;
        aggregate.skipped += summary.skipped;
        aggregate.costMillicents += summary.costMillicents;
        aggregate.jobCount += 1;
        if (job.completed_at && (!aggregate.latestCompletedAt || job.completed_at > aggregate.latestCompletedAt)) {
            aggregate.latestCompletedAt = job.completed_at;
            aggregate.latestJobId = job.id;
        }
    }

    aggregate.hasOutcomeCounts = aggregate.jobCount > 0;
    return aggregate;
}

export function formatInternalLinkAutomationOutcome(summary: Pick<NormalizedInternalLinkJobSummary, "applied" | "manualReview" | "readyToApply" | "previewed" | "failed" | "skipped" | "generated">): string {
    const parts: string[] = [];
    if (summary.applied > 0) parts.push(`${summary.applied} link${summary.applied === 1 ? "" : "s"} applied`);
    if (summary.manualReview > 0) parts.push(`${summary.manualReview} sent to review`);
    if (summary.readyToApply > 0) parts.push(`${summary.readyToApply} ready to apply`);
    if (summary.previewed > 0 && parts.length === 0) parts.push(`${summary.previewed} previewed`);
    if (summary.failed > 0) parts.push(`${summary.failed} failed`);
    if (summary.skipped > 0 && parts.length === 0) parts.push(`${summary.skipped} skipped`);
    if (parts.length === 0 && summary.generated > 0) parts.push(`${summary.generated} generated`);
    return parts.length > 0 ? parts.join(", ") : "No safe changes were needed";
}
