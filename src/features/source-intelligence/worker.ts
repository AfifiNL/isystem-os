import { createAdminClient } from "@/shared/lib/supabase/admin";
import { ingestSourceJob, serializeSourceFetchFailure } from "@/features/source-intelligence/ingestion";
import type { SourceIngestionJobRow, SourceIngestionRunReason, SourceWorkerResult } from "@/features/source-intelligence/types";
import type { Json } from "@/shared/lib/supabase/database.types";
import { recordSourceIntelligenceBusinessEvent } from "@/features/business-spine/recorders";
import type { BusinessIntegrationStatus } from "@/features/business-spine/health";

type RpcError = { message: string } | null;

async function sourceIngestionRunReason(supabase: ReturnType<typeof createAdminClient>, runId: string | null): Promise<SourceIngestionRunReason> {
    if (!runId) return "scheduled";

    const { data, error } = await supabase
        .from("source_ingestion_runs" as never)
        .select("run_reason" as never)
        .eq("id" as never, runId as never)
        .maybeSingle();

    if (error) {
        console.warn(`[source-intelligence-worker] Could not read run reason for run ${runId}: ${error.message}`);
        return "scheduled";
    }

    const reason = (data as { run_reason?: SourceIngestionRunReason } | null)?.run_reason;
    return reason ?? "scheduled";
}

export async function processNextSourceIngestionJob(workerId: string): Promise<SourceWorkerResult> {
    const supabase = createAdminClient();

    const { data: job, error: claimError } = await (supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
    ) => Promise<{ data: SourceIngestionJobRow | null; error: RpcError }>)(
        "claim_next_source_ingestion_job",
        { p_worker_id: workerId },
    );

    if (claimError) {
        console.error("[source-intelligence-worker] Error claiming next job:", claimError.message);
        return { success: false, message: claimError.message };
    }

    if (!job?.id) {
        return { success: false, message: "No queued jobs found." };
    }

    try {
        console.info(
            `[source-intelligence-worker] Claimed job ${job.id} for registry_id=${job.registry_id} url=${job.source_url}`,
        );

        const runReason = await sourceIngestionRunReason(supabase, job.run_id);
        const result = await ingestSourceJob(supabase, { ...job, run_reason: runReason });

        const { error: updateError } = await supabase
            .from("source_ingestion_jobs" as never)
            .update({
                status: "completed",
                error_message: null,
                completed_at: new Date().toISOString(),
                document_id: result.documentId,
                result_summary: result.summary,
            } as never)
            .eq("id" as never, job.id as never);

        if (updateError) {
            throw new Error(updateError.message);
        }

        if (job.run_id) {
            await (supabase.rpc as unknown as (
                name: string,
                args: Record<string, unknown>,
            ) => Promise<{ data: unknown; error: RpcError }>)("refresh_source_ingestion_run_metrics", { p_run_id: job.run_id });
        }

        return {
            success: true,
            jobId: job.id,
            workspaceId: job.workspace_id,
            message: "Source ingestion completed.",
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const fetchFailure = serializeSourceFetchFailure(error);
        const previousSummary = job.result_summary && typeof job.result_summary === "object" && !Array.isArray(job.result_summary)
            ? job.result_summary as Record<string, unknown>
            : {};
        const resultSummary = {
            ...previousSummary,
            failed_at: new Date().toISOString(),
            failure: fetchFailure
                ? {
                    type: "source_fetch_failure",
                    ...fetchFailure,
                }
                : {
                    type: "ingestion_failure",
                    classification: "unknown",
                    message,
                },
        } satisfies Record<string, unknown>;
        console.error(`[source-intelligence-worker] Job ${job.id} failed:`, message);

        await supabase
            .from("source_ingestion_jobs" as never)
            .update({
                status: "failed",
                error_message: message,
                result_summary: resultSummary as Json,
                completed_at: new Date().toISOString(),
            } as never)
            .eq("id" as never, job.id as never);

        if (job.run_id) {
            await (supabase.rpc as unknown as (
                name: string,
                args: Record<string, unknown>,
            ) => Promise<{ data: unknown; error: RpcError }>)("refresh_source_ingestion_run_metrics", { p_run_id: job.run_id });
        }

        if (job.workspace_id) {
            await recordSourceIntelligenceBusinessEvent({
                supabase,
                workspaceId: job.workspace_id,
                eventType: "ingestion_failed",
                sourceId: job.registry_id,
                title: job.source_url,
                message,
                payload: { jobId: job.id, failure: resultSummary.failure },
            });
        }

        return { success: false, jobId: job.id, workspaceId: job.workspace_id, failureKind: fetchFailure ? "source" : "worker", message };
    }
}

export function sourceWorkerIntegrationStatusForResult(result: SourceWorkerResult): BusinessIntegrationStatus {
    if (result.success) return "healthy";
    if (result.jobId && result.failureKind === "source") return "healthy";
    return "degraded";
}
