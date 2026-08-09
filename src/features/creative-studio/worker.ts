import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import type {
    CreativeRenderDownloadResult,
    CreativeRenderProvider,
    CreativeRenderProviderId,
    CreativeRenderStatus,
    CreativeRenderStatusResult,
} from "./providers/types";

type JsonRecord = Record<string, unknown>;

export interface CreativeRenderWorkerJob {
    id: string;
    workspace_id: string;
    template_id: string | null;
    project_id: string;
    brief_id: string | null;
    prompt_id: string | null;
    provider: CreativeRenderProviderId;
    provider_mode?: string;
    manual_provider?: string | null;
    provider_model: string;
    job_kind: string;
    status: CreativeRenderStatus;
    attempts: number;
    max_attempts: number;
    idempotency_key: string;
    provider_job_id: string | null;
    provider_request: JsonRecord;
    provider_response: JsonRecord;
    duration_seconds: number | null;
    result_asset_id: string | null;
    result_summary: JsonRecord;
    error_code: string | null;
    error_message: string | null;
    submitted_at: string | null;
    completed_at: string | null;
}

export interface CreativeRenderWorkerStore {
    claimNextJob(workerId: string): Promise<CreativeRenderWorkerJob | null>;
    markSubmitted(jobId: string, patch: Partial<CreativeRenderWorkerJob>): Promise<void>;
    findAssetByJobId(jobId: string): Promise<{ id: string } | null>;
    createAsset(input: Record<string, unknown>, bytes?: Uint8Array): Promise<{ id: string }>;
    completeJob(jobId: string, patch: Partial<CreativeRenderWorkerJob>): Promise<void>;
    recordReviewEvent(input: Record<string, unknown>): Promise<void>;
    failJob(jobId: string, patch: Partial<CreativeRenderWorkerJob>): Promise<void>;
}

export interface CreativeRenderWorkerResult {
    success: boolean;
    jobId: string | null;
    workspaceId: string | null;
    message: string;
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nextRetryAt(attempts: number): string {
    const delayMs = Math.min(15 * 60_000, Math.max(30_000, (2 ** Math.max(0, attempts - 1)) * 30_000));
    return new Date(Date.now() + delayMs).toISOString();
}

function errorCode(error: unknown): string {
    return stringValue((error as { code?: unknown })?.code, "worker_error");
}

function isRetryable(error: unknown): boolean {
    return (error as { retryable?: unknown })?.retryable === true;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function extensionForMime(mimeType: string): string {
    if (mimeType === "video/mp4") return "mp4";
    if (mimeType === "image/png") return "png";
    if (mimeType === "image/jpeg") return "jpg";
    if (mimeType === "application/json") return "json";
    return "bin";
}

export class SupabaseCreativeRenderWorkerStore implements CreativeRenderWorkerStore {
    private readonly supabase = createAdminClient();

    async claimNextJob(workerId: string): Promise<CreativeRenderWorkerJob | null> {
        const { data, error } = await this.supabase.rpc("claim_next_creative_render_job" as never, { p_worker_id: workerId } as never);
        if (error) throw error;
        return data ? data as unknown as CreativeRenderWorkerJob : null;
    }

    async markSubmitted(jobId: string, patch: Partial<CreativeRenderWorkerJob>): Promise<void> {
        const { error } = await this.supabase.from("creative_render_jobs" as never).update(patch as never).eq("id" as never, jobId as never);
        if (error) throw error;
    }

    async findAssetByJobId(jobId: string): Promise<{ id: string } | null> {
        const { data, error } = await this.supabase
            .from("creative_assets" as never)
            .select("id" as never)
            .eq("provider_job_id" as never, jobId as never)
            .maybeSingle();
        if (error) throw error;
        return data as { id: string } | null;
    }

    async createAsset(input: Record<string, unknown>, bytes?: Uint8Array): Promise<{ id: string }> {
        if (bytes) {
            const { error: uploadError } = await this.supabase.storage
                .from(String(input.storage_bucket))
                .upload(String(input.storage_path), bytes, { contentType: String(input.mime_type), upsert: false });
            if (uploadError && !uploadError.message.toLowerCase().includes("already exists")) throw uploadError;
        }

        const { data, error } = await this.supabase
            .from("creative_assets" as never)
            .insert(input as never)
            .select("id" as never)
            .single();
        if (error) throw error;
        return data as unknown as { id: string };
    }

    async completeJob(jobId: string, patch: Partial<CreativeRenderWorkerJob>): Promise<void> {
        const { error } = await this.supabase.from("creative_render_jobs" as never).update(patch as never).eq("id" as never, jobId as never);
        if (error) throw error;
    }

    async recordReviewEvent(input: Record<string, unknown>): Promise<void> {
        const { error } = await this.supabase.from("creative_review_events" as never).insert(input as never);
        if (error) throw error;
    }

    async failJob(jobId: string, patch: Partial<CreativeRenderWorkerJob>): Promise<void> {
        const { error } = await this.supabase.from("creative_render_jobs" as never).update(patch as never).eq("id" as never, jobId as never);
        if (error) throw error;
    }
}

async function getDefaultCreativeRenderProvider(provider: CreativeRenderProviderId): Promise<CreativeRenderProvider> {
    if (provider === "fake") {
        const { createFakeCreativeRenderProvider } = await import("./providers/fake");
        return createFakeCreativeRenderProvider();
    }

    const { createHiggsfieldCreativeRenderProvider } = await import("./providers/higgsfield");
    return createHiggsfieldCreativeRenderProvider();
}

export async function completeCreativeRenderJob(input: {
    job: CreativeRenderWorkerJob;
    store: CreativeRenderWorkerStore;
    statusResult: CreativeRenderStatusResult;
    downloadResult: CreativeRenderDownloadResult;
}): Promise<CreativeRenderWorkerResult> {
    const existing = await input.store.findAssetByJobId(input.job.id);
    const assetId = existing?.id ?? randomUUID();
    const asset = existing ?? await input.store.createAsset({
        id: assetId,
        workspace_id: input.job.workspace_id,
        template_id: input.job.template_id,
        project_id: input.job.project_id,
        brief_id: input.job.brief_id,
        prompt_id: input.job.prompt_id,
        provider_job_id: input.job.id,
        asset_type: input.job.job_kind === "image" ? "thumbnail" : "rendered_video",
        status: "needs_review",
        storage_bucket: "creative-renders",
        storage_path: `workspaces/${input.job.workspace_id}/projects/${input.job.project_id}/jobs/${input.job.id}/${assetId}.${extensionForMime(input.downloadResult.mimeType)}`,
        mime_type: input.downloadResult.mimeType,
        duration_seconds: input.job.duration_seconds,
        checksum: input.downloadResult.checksumSha256 ?? null,
        rights_status: "needs_review",
        safety_status: "needs_review",
        metadata: {
            provider: input.statusResult.provider,
            provider_job_id: input.statusResult.providerJobId,
            fake_storage: input.statusResult.provider === "fake",
            file_name: input.downloadResult.fileName,
            result_urls: input.statusResult.resultUrls ?? [],
            download_metadata: input.downloadResult.metadata ?? null,
        },
    }, input.downloadResult.bytes);

    const completedAt = new Date().toISOString();
    await input.store.completeJob(input.job.id, {
        status: "completed",
        result_asset_id: asset.id,
        completed_at: completedAt,
        result_summary: {
            ...input.job.result_summary,
            completed_at: completedAt,
            asset_id: asset.id,
            idempotent_asset_reuse: Boolean(existing),
        },
        provider_response: { ...input.job.provider_response, status: input.statusResult },
        error_code: null,
        error_message: null,
    });

    await input.store.recordReviewEvent({
        workspace_id: input.job.workspace_id,
        template_id: input.job.template_id,
        project_id: input.job.project_id,
        asset_id: asset.id,
        job_id: input.job.id,
        event_type: "provider_submitted",
        notes: "Creative render worker completed provider output and created a private asset needing review.",
        payload: { provider: input.statusResult.provider, provider_job_id: input.statusResult.providerJobId },
    });

    return { success: true, jobId: input.job.id, workspaceId: input.job.workspace_id, message: "Creative render job completed." };
}

export async function processClaimedCreativeRenderJob(input: {
    job: CreativeRenderWorkerJob;
    store: CreativeRenderWorkerStore;
    provider?: CreativeRenderProvider;
    workerId: string;
}): Promise<CreativeRenderWorkerResult> {
    const { job, store } = input;
    const provider = input.provider ?? await getDefaultCreativeRenderProvider(job.provider);

    try {
        let providerJobId = job.provider_job_id;
        let workingJob = job;
        if (!providerJobId) {
            const request = asRecord(job.provider_request);
            const submit = await provider.submit({
                workspaceId: job.workspace_id,
                templateId: job.template_id,
                projectId: job.project_id,
                briefId: job.brief_id,
                promptId: job.prompt_id,
                jobId: job.id,
                idempotencyKey: job.idempotency_key,
                jobKind: job.job_kind as never,
                providerModel: job.provider_model,
                prompt: stringValue(request.prompt, stringValue(request.providerPrompt, "Creative Studio approved render.")),
                negativePrompt: stringValue(request.negativePrompt) || null,
                aspectRatio: stringValue(request.aspectRatio) || null,
                durationSeconds: numberValue(request.durationSeconds) ?? job.duration_seconds,
                seed: numberValue(request.seed),
                providerOptions: asRecord(request.providerOptions),
            });
            providerJobId = submit.providerJobId;
            workingJob = {
                ...job,
                provider_job_id: providerJobId,
                status: "provider_processing",
                submitted_at: submit.submittedAt,
                provider_response: { ...job.provider_response, submit },
            };
            await store.markSubmitted(job.id, {
                provider_job_id: providerJobId,
                status: "provider_processing",
                submitted_at: submit.submittedAt,
                estimated_cost_millicents: submit.estimatedCostMillicents ?? undefined,
                provider_response: workingJob.provider_response,
            } as Partial<CreativeRenderWorkerJob>);
        }

        const statusResult = await provider.getStatus({
            workspaceId: job.workspace_id,
            templateId: job.template_id,
            projectId: job.project_id,
            briefId: job.brief_id,
            promptId: job.prompt_id,
            jobId: job.id,
            providerJobId,
        });

        if (statusResult.status === "completed") {
            const downloadResult = await provider.downloadResult({
                workspaceId: job.workspace_id,
                templateId: job.template_id,
                projectId: job.project_id,
                briefId: job.brief_id,
                promptId: job.prompt_id,
                jobId: job.id,
                providerJobId,
                resultUrl: statusResult.resultUrls?.[0],
            });
            return completeCreativeRenderJob({ job: workingJob, store, statusResult, downloadResult });
        }

        if (statusResult.status === "failed") {
            throw Object.assign(new Error(statusResult.errorMessage ?? "Provider render failed."), {
                code: statusResult.errorCode ?? "provider_failed",
                retryable: true,
            });
        }

        await store.markSubmitted(job.id, {
            status: statusResult.status,
            provider_response: { ...workingJob.provider_response, status: statusResult },
        });
        return { success: true, jobId: job.id, workspaceId: job.workspace_id, message: `Creative render job is ${statusResult.status}.` };
    } catch (error) {
        const terminal = !isRetryable(error) || job.attempts >= job.max_attempts;
        await store.failJob(job.id, {
            status: terminal ? "failed" : "queued",
            run_after: terminal ? undefined : nextRetryAt(job.attempts),
            locked_at: null,
            locked_by: null,
            error_code: errorCode(error),
            error_message: errorMessage(error),
            result_summary: { ...job.result_summary, last_worker_id: input.workerId, terminal_failure: terminal },
        } as Partial<CreativeRenderWorkerJob>);
        return { success: false, jobId: job.id, workspaceId: job.workspace_id, message: errorMessage(error) };
    }
}

export async function processNextCreativeRenderJob(workerId: string, store: CreativeRenderWorkerStore = new SupabaseCreativeRenderWorkerStore()): Promise<CreativeRenderWorkerResult> {
    const job = await store.claimNextJob(workerId);
    if (!job) return { success: false, jobId: null, workspaceId: null, message: "No queued creative render jobs found." };
    return processClaimedCreativeRenderJob({ job, store, workerId });
}

export async function drainCreativeRenderJobs(input: { workerId: string; limit: number; store?: CreativeRenderWorkerStore }): Promise<CreativeRenderWorkerResult[]> {
    const store = input.store ?? new SupabaseCreativeRenderWorkerStore();
    const results: CreativeRenderWorkerResult[] = [];
    for (let index = 0; index < input.limit; index += 1) {
        const result = await processNextCreativeRenderJob(input.workerId, store);
        results.push(result);
        if (!result.jobId) break;
    }
    return results;
}
