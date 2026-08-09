import "server-only";

import { GoogleAuth, OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/shared/lib/supabase/database.types";
import { createClient } from "@/shared/lib/supabase/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { buildCanonicalPublicContentUrl, cleanIndexingUrl } from "@/features/seo/indexing/url-normalization";
import { inspectionIndicatesIndexed } from "@/features/seo/indexing/status";
import { buildIndexingProcessingOutcome, buildIndexingRequeueState } from "@/features/seo/indexing/outcome";
import { resolveIndexingSiteUrl } from "@/features/seo/indexing/site-url";

type IndexingSourceEvent = "blog_published" | "blog_regenerated" | "manual" | "repair_retry";
type IndexingProvider = "sitemap" | "url_inspection" | "indexing_api";
type AttemptStatus = "success" | "failed" | "skipped";

export interface EnqueueBlogIndexingJobInput {
    workspaceId: string;
    contentId: string;
    slug: string;
    locale?: string | null;
    sourceEvent: Extract<IndexingSourceEvent, "blog_published" | "blog_regenerated">;
    supabase?: SupabaseClient;
}

export interface EnqueueContentIndexingJobInput {
    workspaceId: string;
    contentId: string;
    type: "blog" | "page";
    slug: string;
    locale?: string | null;
    sourceEvent: IndexingSourceEvent;
    supabase?: SupabaseClient;
}

export interface IndexingDrainResult {
    success: boolean;
    message: string;
    jobId?: string;
    status?: string;
}

export function getIndexingSiteUrl() {
    return resolveIndexingSiteUrl();
}

function getGscSiteUrl() {
    return process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || `${getIndexingSiteUrl()}/`;
}

function retryDelayHours(attemptCount: number) {
    if (attemptCount <= 0) return 1;
    if (attemptCount === 1) return 6;
    if (attemptCount === 2) return 24;
    return 72;
}

function addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function asJson(value: unknown): Json {
    return value as Json;
}

function hasIndexingWriteEnabled() {
    return process.env.GOOGLE_INDEXING_ENABLED === "true";
}

function allowNonEligibleBlogIndexingApi() {
    return process.env.GOOGLE_INDEXING_ALLOW_NON_ELIGIBLE_BLOGS === "true";
}

export async function enqueueBlogIndexingJob(input: EnqueueBlogIndexingJobInput): Promise<{ data: { id: string } | null; error: string | null }> {
    return enqueueContentIndexingJob({
        ...input,
        type: "blog",
    });
}

export async function enqueueContentIndexingJob(input: EnqueueContentIndexingJobInput): Promise<{ data: { id: string } | null; error: string | null }> {
    if (!input.slug) {
        return { data: null, error: "Cannot enqueue indexing job without a slug." };
    }

    const supabase = input.supabase ?? await createClient();
    const canonical = buildCanonicalPublicContentUrl({
        siteUrl: getIndexingSiteUrl(),
        type: input.type,
        slug: input.slug,
        locale: input.locale,
    });
    const cleaned = cleanIndexingUrl(canonical.url);
    if (!cleaned) {
        return { data: null, error: `Invalid canonical URL: ${canonical.url}` };
    }

    const openStatuses = ["queued", "processing", "submitted", "not_indexed", "failed"];
    // Tables are added by this branch's migration; cast until database.types.ts
    // is regenerated against the promoted schema.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsTable = supabase.from("seo_indexing_jobs" as never) as any;
    const { data: existing, error: existingError } = await jobsTable
        .select("id")
        .eq("workspace_id", input.workspaceId)
        .eq("url", cleaned.url)
        .in("status", openStatuses)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingError) {
        return { data: null, error: existingError.message ?? "Failed to check existing indexing job." };
    }

    if (existing?.id) {
        const now = new Date().toISOString();
        const { error: updateError } = await jobsTable
            .update({
                content_id: input.contentId,
                source_event: input.sourceEvent,
                ...buildIndexingRequeueState(now),
                updated_at: now,
                metadata: {
                    note: "Requeued for canonical URL refresh. Submission does not guarantee indexing.",
                    locale: input.locale ?? "en",
                    contentType: input.type,
                },
            })
            .eq("id", existing.id);
        return updateError ? { data: null, error: updateError.message ?? "Failed to requeue indexing job." } : { data: { id: existing.id }, error: null };
    }

    const { data, error } = await jobsTable
        .insert({
            workspace_id: input.workspaceId,
            content_id: input.contentId,
            url: cleaned.url,
            canonical_path: cleaned.canonicalPath,
            source_event: input.sourceEvent,
            status: "queued",
            metadata: {
                note: "Queued for sitemap submission, URL inspection, and optional Indexing API notification. Submission does not guarantee indexing.",
                locale: input.locale ?? "en",
                contentType: input.type,
            },
        })
        .select("id")
        .single();

    if (error) {
        return { data: null, error: error.message ?? "Failed to enqueue indexing job." };
    }

    return { data, error: null };
}

function createSearchConsoleOAuthClient() {
    const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Search Console OAuth credentials.");
    }
    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials({ refresh_token: refreshToken });
    return client;
}

async function submitSitemap(client: OAuth2Client, siteUrl: string, sitemapUrl: string) {
    return client.request({
        url: `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
        method: "PUT",
    });
}

async function inspectUrl(client: OAuth2Client, siteUrl: string, url: string) {
    return client.request({
        url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
        method: "POST",
        data: {
            inspectionUrl: url,
            siteUrl,
            languageCode: "en-US",
        },
    });
}

async function notifyIndexingApi(url: string) {
    if (!hasIndexingWriteEnabled()) {
        return { skipped: true, reason: "GOOGLE_INDEXING_ENABLED is not true." };
    }
    if (!allowNonEligibleBlogIndexingApi()) {
        return { skipped: true, reason: "GOOGLE_INDEXING_ALLOW_NON_ELIGIBLE_BLOGS is not true. Google documents this API for JobPosting and livestream pages." };
    }

    const rawJson = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON;
    if (!rawJson) {
        throw new Error("GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON is required for Indexing API notifications.");
    }

    const credentials = JSON.parse(rawJson) as Record<string, unknown>;
    const auth = new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/indexing"],
    });
    const client = await auth.getClient();
    const response = await client.request({
        url: "https://indexing.googleapis.com/v3/urlNotifications:publish",
        method: "POST",
        data: {
            url,
            type: "URL_UPDATED",
        },
    });
    return { skipped: false, response: response.data };
}

async function recordAttempt(supabase: SupabaseClient, input: {
    jobId: string;
    workspaceId: string;
    provider: IndexingProvider;
    status: AttemptStatus;
    requestPayload?: Record<string, unknown>;
    responseJson?: unknown;
    error?: string | null;
}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attemptsTable = supabase.from("seo_indexing_attempts" as never) as any;
    const { error } = await attemptsTable.insert({
        job_id: input.jobId,
        workspace_id: input.workspaceId,
        provider: input.provider,
        status: input.status,
        request_payload: asJson(input.requestPayload ?? {}),
        response_json: input.responseJson === undefined ? null : asJson(input.responseJson),
        error: input.error ?? null,
    });
    if (error) {
        console.warn("[indexing] Failed to record attempt:", error.message);
    }
}

async function updateJob(supabase: SupabaseClient, jobId: string, payload: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsTable = supabase.from("seo_indexing_jobs" as never) as any;
    const { error } = await jobsTable.update({ ...payload, updated_at: new Date().toISOString() }).eq("id", jobId);
    if (error) throw new Error(error.message ?? "Failed to update indexing job.");
}

export async function processNextIndexingJob(): Promise<IndexingDrainResult> {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsTable = supabase.from("seo_indexing_jobs" as never) as any;
    const { data, error } = await jobsTable
        .select("*")
        .in("status", ["queued", "submitted", "not_indexed", "failed"])
        .lte("next_attempt_at", now)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) {
        return { success: false, message: error.message ?? "Failed to load indexing job." };
    }
    if (!data) {
        return { success: true, message: "No queued indexing jobs found." };
    }

    const job = data;
    await updateJob(supabase, job.id, { status: "processing", last_attempt_at: now });

    const siteUrl = getGscSiteUrl();
    const sitemapUrl = `${getIndexingSiteUrl()}/sitemap.xml`;
    let lastInspection: unknown = null;
    const errors: string[] = [];

    try {
        const gscClient = createSearchConsoleOAuthClient();

        try {
            await submitSitemap(gscClient, siteUrl, sitemapUrl);
            await recordAttempt(supabase, {
                jobId: job.id,
                workspaceId: job.workspace_id,
                provider: "sitemap",
                status: "success",
                requestPayload: { siteUrl, sitemapUrl },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`sitemap: ${message}`);
            await recordAttempt(supabase, {
                jobId: job.id,
                workspaceId: job.workspace_id,
                provider: "sitemap",
                status: "failed",
                requestPayload: { siteUrl, sitemapUrl },
                error: message,
            });
        }

        try {
            const notification = await notifyIndexingApi(job.url);
            await recordAttempt(supabase, {
                jobId: job.id,
                workspaceId: job.workspace_id,
                provider: "indexing_api",
                status: notification.skipped ? "skipped" : "success",
                requestPayload: { url: job.url, type: "URL_UPDATED" },
                responseJson: notification,
                error: notification.skipped ? notification.reason : null,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`indexing_api: ${message}`);
            await recordAttempt(supabase, {
                jobId: job.id,
                workspaceId: job.workspace_id,
                provider: "indexing_api",
                status: "failed",
                requestPayload: { url: job.url, type: "URL_UPDATED" },
                error: message,
            });
        }

        try {
            const inspection = await inspectUrl(gscClient, siteUrl, job.url);
            lastInspection = inspection.data;
            await recordAttempt(supabase, {
                jobId: job.id,
                workspaceId: job.workspace_id,
                provider: "url_inspection",
                status: "success",
                requestPayload: { siteUrl, inspectionUrl: job.url },
                responseJson: inspection.data,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`url_inspection: ${message}`);
            await recordAttempt(supabase, {
                jobId: job.id,
                workspaceId: job.workspace_id,
                provider: "url_inspection",
                status: "failed",
                requestPayload: { siteUrl, inspectionUrl: job.url },
                error: message,
            });
        }

        const nextAttemptCount = job.attempt_count + 1;
        const indexed = inspectionIndicatesIndexed(lastInspection);
        const outcome = buildIndexingProcessingOutcome({
            indexed,
            hasInspection: lastInspection !== null,
            errors,
            attemptCount: nextAttemptCount,
        });

        await updateJob(supabase, job.id, {
            status: outcome.status,
            attempt_count: nextAttemptCount,
            last_error: errors[0] ?? null,
            last_inspection: lastInspection === null ? null : asJson(lastInspection),
            next_attempt_at: outcome.status === "indexed" || outcome.terminalFailure ? null : addHours(new Date(), retryDelayHours(nextAttemptCount)),
            metadata: {
                ...(job.metadata ?? {}),
                last_note: outcome.message,
                last_errors: errors,
            },
        });

        return {
            success: outcome.success,
            message: outcome.message,
            jobId: job.id,
            status: outcome.status,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Indexing job failed.";
        const nextAttemptCount = job.attempt_count + 1;
        await updateJob(supabase, job.id, {
            status: nextAttemptCount >= 4 ? "failed" : "failed",
            attempt_count: nextAttemptCount,
            last_error: message,
            next_attempt_at: nextAttemptCount >= 4 ? null : addHours(new Date(), retryDelayHours(nextAttemptCount)),
        });
        return { success: false, message, jobId: job.id, status: "failed" };
    }
}
