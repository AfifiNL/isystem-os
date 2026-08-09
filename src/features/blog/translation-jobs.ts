import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Database, Json } from "@/shared/lib/supabase/database.types";
import { translateAndSeedPost } from "./translation-service";
import {
    contentTranslationRetryDelayMs,
    shouldRetryContentTranslation,
} from "./translation-job-policy";

export type ContentTranslationLocale = "nl" | "ar";
type ContentTranslationJobRow =
    Database["public"]["Tables"]["content_translation_jobs"]["Row"];
type AdminClient = ReturnType<typeof createAdminClient>;

export interface EnqueueContentTranslationJobInput {
    workspaceId: string;
    contentId: string;
    sourceVersion: string;
    targetLocales?: ContentTranslationLocale[];
    maxAttempts?: number;
}

export interface EnqueueContentTranslationJobResult {
    jobId: string;
    status: string;
    deduplicated: boolean;
}

export interface ContentTranslationWorkerResult {
    success: boolean;
    jobId?: string;
    workspaceId?: string;
    terminal?: boolean;
    message: string;
}

function normalizedTargetLocales(
    locales: readonly unknown[] | undefined,
): ContentTranslationLocale[] {
    const defaults: ContentTranslationLocale[] = ["nl", "ar"];
    const candidates = locales ?? defaults;
    if (candidates.some((locale) => locale !== "nl" && locale !== "ar")) {
        throw new Error("Content translation target locales must be nl and/or ar.");
    }
    const normalized = Array.from(
        new Set(candidates as readonly ContentTranslationLocale[]),
    );
    if (normalized.length === 0) {
        throw new Error("At least one target translation locale is required.");
    }
    return normalized;
}

function idempotencyKey(input: EnqueueContentTranslationJobInput): string {
    return `content-translation:${input.contentId}:${input.sourceVersion}`;
}

function asRecord(value: Json): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export async function enqueueContentTranslationJob(
    input: EnqueueContentTranslationJobInput,
    supabase: AdminClient = createAdminClient(),
): Promise<EnqueueContentTranslationJobResult> {
    const key = idempotencyKey(input);
    const { data, error } = await supabase
        .from("content_translation_jobs")
        .insert({
            workspace_id: input.workspaceId,
            source_content_id: input.contentId,
            source_version: input.sourceVersion,
            source_locale: "en",
            target_locales: normalizedTargetLocales(input.targetLocales),
            status: "queued",
            max_attempts: Math.max(1, Math.min(input.maxAttempts ?? 3, 10)),
            idempotency_key: key,
        })
        .select("id,status")
        .maybeSingle();

    if (data?.id) {
        return { jobId: data.id, status: data.status, deduplicated: false };
    }

    if (error?.code !== "23505") {
        throw new Error(`Failed to enqueue content translation: ${error?.message ?? "unknown error"}`);
    }

    const { data: existing, error: existingError } = await supabase
        .from("content_translation_jobs")
        .select("id,status")
        .eq("workspace_id", input.workspaceId)
        .eq("idempotency_key", key)
        .maybeSingle();

    if (existingError || !existing) {
        throw new Error(
            `Translation job already exists but could not be loaded: ${existingError?.message ?? "unknown error"}`,
        );
    }

    return {
        jobId: existing.id,
        status: existing.status,
        deduplicated: true,
    };
}

async function updateClaimedJob(
    supabase: AdminClient,
    job: ContentTranslationJobRow,
    update: Database["public"]["Tables"]["content_translation_jobs"]["Update"],
): Promise<void> {
    const workerId = job.worker_id;
    if (!workerId) {
        throw new Error(`Translation job ${job.id} has no worker lease owner.`);
    }

    const { data, error } = await supabase
        .from("content_translation_jobs")
        .update(update)
        .eq("id", job.id)
        .eq("workspace_id", job.workspace_id)
        .eq("status", "running")
        .eq("worker_id", workerId)
        .select("id")
        .maybeSingle();

    if (error || !data) {
        throw new Error(
            `Failed to update translation job ${job.id}; its worker lease may have been reclaimed: ${error?.message ?? "lease no longer owned"}`,
        );
    }
}

export async function processNextContentTranslationJob(
    workerId: string,
): Promise<ContentTranslationWorkerResult> {
    const supabase = createAdminClient();
    const { data: job, error: claimError } = await supabase.rpc(
        "claim_next_content_translation_job",
        { p_worker_id: workerId },
    );

    if (claimError) {
        return { success: false, terminal: true, message: claimError.message };
    }
    if (!job?.id) {
        return { success: false, message: "No queued translation jobs found." };
    }

    try {
        const { data: post, error: postError } = await supabase
            .from("content_items")
            .select(
                "id,title,slug,type,status,locale,content_markdown,metadata,author_id,template_id,workspace_id,visual_layout,updated_at",
            )
            .eq("id", job.source_content_id)
            .eq("workspace_id", job.workspace_id)
            .maybeSingle();

        if (postError || !post) {
            throw new Error(postError?.message ?? "Source content item no longer exists.");
        }

        if (post.type !== "blog" || post.status !== "published" || post.locale !== "en") {
            const resultSummary = {
                skipped: true,
                reason: "Source is no longer a published English blog post.",
                sourceVersion: job.source_version,
            };
            await updateClaimedJob(supabase, job, {
                status: "completed",
                completed_at: new Date().toISOString(),
                locked_at: null,
                worker_id: null,
                last_error: null,
                result_summary: resultSummary,
            });
            return {
                success: true,
                terminal: true,
                jobId: job.id,
                workspaceId: job.workspace_id,
                message: "Translation job skipped because the source is no longer eligible.",
            };
        }

        if (post.updated_at !== job.source_version) {
            const replacement = await enqueueContentTranslationJob({
                workspaceId: job.workspace_id,
                contentId: job.source_content_id,
                sourceVersion: post.updated_at,
                targetLocales: normalizedTargetLocales(job.target_locales),
                maxAttempts: job.max_attempts,
            }, supabase);
            await updateClaimedJob(supabase, job, {
                status: "completed",
                completed_at: new Date().toISOString(),
                locked_at: null,
                worker_id: null,
                last_error: null,
                result_summary: {
                    superseded: true,
                    sourceVersion: job.source_version,
                    currentSourceVersion: post.updated_at,
                    replacementJobId: replacement.jobId,
                },
            });
            return {
                success: true,
                terminal: true,
                jobId: job.id,
                workspaceId: job.workspace_id,
                message: `Translation job superseded by source revision ${post.updated_at}.`,
            };
        }

        const result = await translateAndSeedPost(
            post,
            normalizedTargetLocales(job.target_locales),
        );
        await updateClaimedJob(supabase, job, {
            status: "completed",
            completed_at: new Date().toISOString(),
            locked_at: null,
            worker_id: null,
            last_error: null,
            result_summary: {
                ...result,
                sourceVersion: job.source_version,
                completedAt: new Date().toISOString(),
            },
        });

        return {
            success: true,
            terminal: true,
            jobId: job.id,
            workspaceId: job.workspace_id,
            message: "Content translation completed.",
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const shouldRetry = shouldRetryContentTranslation({
            attempts: job.attempts,
            maxAttempts: job.max_attempts,
        });
        const retryDelayMs = shouldRetry
            ? contentTranslationRetryDelayMs(job.attempts)
            : null;
        const now = new Date();
        const previousSummary = asRecord(job.result_summary);

        await updateClaimedJob(supabase, job, {
            status: shouldRetry ? "retrying" : "failed",
            run_after: shouldRetry
                ? new Date(now.getTime() + (retryDelayMs ?? 0)).toISOString()
                : job.run_after,
            completed_at: shouldRetry ? null : now.toISOString(),
            locked_at: null,
            worker_id: null,
            last_error: message.slice(0, 2_000),
            result_summary: {
                ...previousSummary,
                lastFailure: {
                    attempt: job.attempts,
                    failedAt: now.toISOString(),
                    message: message.slice(0, 2_000),
                },
                retry: shouldRetry
                    ? {
                        scheduled: true,
                        delayMs: retryDelayMs,
                        runAfter: new Date(now.getTime() + (retryDelayMs ?? 0)).toISOString(),
                    }
                    : {
                        scheduled: false,
                        exhausted: true,
                    },
            },
        });

        return {
            success: false,
            terminal: !shouldRetry,
            jobId: job.id,
            workspaceId: job.workspace_id,
            message,
        };
    }
}
