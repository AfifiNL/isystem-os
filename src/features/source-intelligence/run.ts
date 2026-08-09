import { createAdminClient } from "@/shared/lib/supabase/admin";
import { canonicalizeUrl } from "@/features/market-monitor/lib/monitor";
import { shouldSkipSourceHealthBackoff, sourceHealthBackoffActive } from "@/features/source-intelligence/ingestion";
import { processNextSourceIngestionJob } from "@/features/source-intelligence/worker";
import type { SourceIngestionRunReason, SourceIngestionRunTrigger, SourceRegistryRow } from "@/features/source-intelligence/types";

type RunSourceIntelligenceInput = {
    workspaceId?: string | null;
    registryId?: string | null;
    reason?: Extract<SourceIngestionRunReason, "scheduled" | "manual" | "backfill" | "retry">;
    trigger?: SourceIngestionRunTrigger;
    drainLimit?: number;
    workerId?: string;
    startedBy?: string | null;
    requestedAt?: string;
};

export type SourceIntelligenceRunResult = {
    runId: string | null;
    trigger: SourceIngestionRunTrigger;
    reason: Extract<SourceIngestionRunReason, "scheduled" | "manual" | "backfill" | "retry">;
    requestedAt: string;
    enqueued: number;
    processed: number;
    failed: number;
    sourceFailed: number;
    workerFailed: number;
    skipped: number;
    existingQueued: number;
    existingRunning: number;
    results: unknown[];
};

type ActiveSourceIngestionJob = {
    id: string;
    registry_id: string;
    source_url: string;
    locale: string;
    status: "queued" | "running";
};

export function shouldQueueSourceRegistryForRun(
    registry: SourceRegistryRow,
    reason: RunSourceIntelligenceInput["reason"],
    options: { targetedRegistry: boolean } = { targetedRegistry: false },
): boolean {
    const runReason = reason ?? "scheduled";
    const bypassHealthBackoff = options.targetedRegistry
        || runReason === "retry"
        || runReason === "backfill"
        || (runReason !== "manual" && shouldSkipSourceHealthBackoff(registry, runReason));
    if (!bypassHealthBackoff && sourceHealthBackoffActive(registry).active) return false;
    if (!registry.last_ingested_at) return true;
    const metadata = registry.metadata && typeof registry.metadata === "object" && !Array.isArray(registry.metadata)
        ? registry.metadata as Record<string, unknown>
        : {};
    const minHours = Number(metadata.min_ingestion_interval_hours ?? 24);
    const elapsedHours = (Date.now() - new Date(registry.last_ingested_at).getTime()) / 3_600_000;
    return elapsedHours >= (Number.isFinite(minHours) ? minHours : 24);
}

export async function enqueueDueSourceIntelligenceJobs(input: RunSourceIntelligenceInput = {}) {
    const supabase = createAdminClient();
    const reason = input.reason ?? "scheduled";
    const trigger = input.trigger ?? (reason === "manual" ? "dashboard" : "api");
    const requestedAt = input.requestedAt ?? new Date().toISOString();
    let query = supabase
        .from("source_registry" as never)
        .select("*" as never)
        .eq("is_active" as never, true as never);
    if (input.workspaceId) query = query.eq("workspace_id" as never, input.workspaceId as never);
    if (input.registryId) query = query.eq("id" as never, input.registryId as never);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list source registry: ${error.message}`);
    const allRegistries = (data as SourceRegistryRow[] | null ?? []);
    const dueRegistries = allRegistries.filter((registry) => input.registryId || shouldQueueSourceRegistryForRun(registry, reason, { targetedRegistry: Boolean(input.registryId) }));

    let existingQueued = 0;
    let existingRunning = 0;
    let activeJobKeys = new Set<string>();
    const allRegistryIds = allRegistries.map((registry) => registry.id);
    if (allRegistryIds.length > 0) {
        const { data: activeJobs, error: activeJobsError } = await supabase
            .from("source_ingestion_jobs" as never)
            .select("id,registry_id,source_url,locale,status" as never)
            .in("registry_id" as never, allRegistryIds as never)
            .in("status" as never, ["queued", "running"] as never);
        if (activeJobsError) throw new Error(`Failed to inspect active source ingestion jobs: ${activeJobsError.message}`);

        const activeJobRows = (activeJobs as ActiveSourceIngestionJob[] | null) ?? [];
        activeJobKeys = new Set(
            activeJobRows.map((job) => `${job.registry_id}:${canonicalizeUrl(job.source_url).toLowerCase()}:${job.locale}`),
        );
        existingQueued = activeJobRows.filter((job) => job.status === "queued").length;
        existingRunning = activeJobRows.filter((job) => job.status === "running").length;
    }

    const workspaceId = input.workspaceId ?? allRegistries.find((registry) => registry.workspace_id)?.workspace_id ?? null;
    const summary = {
        trigger,
        reason,
        requested_at: requestedAt,
        drain: Math.max(0, Math.min(input.drainLimit ?? 0, 10)),
        limit: Math.max(0, Math.min(input.drainLimit ?? 0, 10)),
        workspace_filter: input.workspaceId ?? null,
        registry_filter: input.registryId ?? null,
        existing_queued_at_request: existingQueued,
        existing_running_at_request: existingRunning,
    };

    const candidateJobs = dueRegistries.map((registry) => ({
        workspace_id: registry.workspace_id,
        registry_id: registry.id,
        source_url: canonicalizeUrl(registry.canonical_url),
        locale: registry.locale,
        priority: registry.quality === "authoritative" ? 10 : registry.quality === "high" ? 25 : 100,
        run_after: new Date().toISOString(),
        input_hash: null,
    }));
    const jobsToInsert = candidateJobs.filter((job) => !activeJobKeys.has(`${job.registry_id}:${job.source_url.toLowerCase()}:${job.locale}`));
    const skipped = (allRegistries.length - dueRegistries.length) + (candidateJobs.length - jobsToInsert.length);

    let runId: string | null = null;
    if (allRegistries.length > 0) {
        const { data: run, error: runError } = await supabase.from("source_ingestion_runs" as never).insert({
            workspace_id: workspaceId,
            registry_id: input.registryId ?? null,
            started_by: input.startedBy ?? null,
            run_reason: reason,
            status: jobsToInsert.length > 0 ? "queued" : "completed",
            total_jobs: jobsToInsert.length,
            summary,
            completed_at: jobsToInsert.length > 0 ? null : new Date().toISOString(),
        } as never).select("id" as never).single();
        if (runError || !run) throw new Error(`Failed to create source ingestion run: ${runError?.message}`);
        runId = (run as { id: string }).id;

        if (jobsToInsert.length > 0) {
            const jobs = jobsToInsert.map((job) => ({ ...job, run_id: runId }));
            const { error: jobError } = await supabase.from("source_ingestion_jobs" as never).insert(jobs as never);
            if (jobError) throw new Error(`Failed to enqueue source ingestion jobs: ${jobError.message}`);
        }
    }

    const drainLimit = Math.max(0, Math.min(input.drainLimit ?? 0, 10));
    const workerId = input.workerId ?? `source-intelligence-route-${process.pid}-${Date.now()}`;
    const results = [];
    let processed = 0;
    let failed = 0;
    let sourceFailed = 0;
    let workerFailed = 0;
    for (let index = 0; index < drainLimit; index += 1) {
        const result = await processNextSourceIngestionJob(workerId);
        if (!result.jobId && result.message === "No queued jobs found.") break;
        results.push(result);
        if (result.success) processed += 1;
        else {
            failed += 1;
            if (result.failureKind === "source") sourceFailed += 1;
            else workerFailed += 1;
        }
    }

    if (runId) {
        await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)("refresh_source_ingestion_run_metrics", { p_run_id: runId });
    }
    return {
        runId,
        trigger,
        reason,
        requestedAt,
        enqueued: jobsToInsert.length,
        processed,
        failed,
        sourceFailed,
        workerFailed,
        skipped,
        existingQueued,
        existingRunning,
        results,
    } satisfies SourceIntelligenceRunResult;
}
