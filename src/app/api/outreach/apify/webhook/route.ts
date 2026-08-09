import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { getApifyConfig } from "@/features/outreach/discovery/apify-client";
import { getLinkedinActorId } from "@/features/outreach/apify/linkedin";
import type { OutreachDiscoveryJobRow } from "@/features/outreach/types";

function configuredSecret() {
    return process.env.APIFY_WEBHOOK_SECRET?.trim() ?? "";
}

function authorize(req: NextRequest) {
    const secret = configuredSecret();
    const header = req.headers.get("authorization");
    if (!secret || !header?.startsWith("Bearer ")) return false;
    const candidate = Buffer.from(header.slice("Bearer ".length).trim());
    const expected = Buffer.from(secret);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

function runInfo(payload: Record<string, unknown>) {
    const resource = asRecord(payload.resource);
    const eventData = asRecord(payload.eventData);
    const data = asRecord(payload.data);
    const run = Object.keys(resource).length > 0 ? resource : Object.keys(data).length > 0 ? data : eventData;
    return {
        eventType: stringValue(payload.eventType, payload.event_type, eventData.eventType),
        runId: stringValue(run.id, payload.resourceId, eventData.actorRunId, payload.actorRunId),
        status: stringValue(run.status, eventData.status, payload.status),
        datasetId: stringValue(run.defaultDatasetId, eventData.defaultDatasetId, payload.defaultDatasetId),
        actorId: stringValue(run.actorId, run.actId, eventData.actorId, payload.actorId),
    };
}

export async function POST(req: NextRequest) {
    if (!configuredSecret()) {
        return NextResponse.json({ ok: false, error: "Apify webhook endpoint is not configured." }, { status: 503 });
    }
    if (!authorize(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ ok: false, error: "Missing jobId." }, { status: 400 });

    const payload = await req.json().catch(() => ({})) as Record<string, unknown>;
    const info = runInfo(payload);
    const supabase = createAdminClient();
    const { data: job, error: jobError } = await supabase
        .from("outreach_discovery_jobs" as never)
        .select("*" as never)
        .eq("id" as never, jobId as never)
        .maybeSingle();
    if (jobError || !job) {
        return NextResponse.json({ ok: false, error: jobError?.message ?? "Discovery job not found." }, { status: 404 });
    }

    const discoveryJob = job as unknown as OutreachDiscoveryJobRow;
    const input = asRecord(discoveryJob.input);
    const provider = stringValue(input.provider);
    const failed = info.eventType?.includes("FAILED")
        || info.eventType?.includes("TIMED")
        || info.eventType?.includes("ABORTED")
        || ["FAILED", "TIMED-OUT", "ABORTED"].includes(info.status ?? "");

    if (failed) {
        const message = `Apify actor run ${info.status ?? "failed"}${info.runId ? ` (${info.runId})` : ""}.`;
        await supabase.from("outreach_discovery_jobs" as never).update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: message,
            result_summary: { provider: "apify", ...info },
        } as never).eq("id" as never, discoveryJob.id as never);
        if (info.runId) {
            await supabase.from("outreach_source_runs" as never).update({
                status: "failed",
                error_message: message,
                dataset_id: info.datasetId ?? null,
            } as never).eq("run_id" as never, info.runId as never);
        }
        await supabase.from("outreach_audit_events" as never).insert({
            workspace_id: discoveryJob.workspace_id,
            campaign_id: discoveryJob.campaign_id,
            event_type: "apify_run_failed",
            event_summary: message,
            metadata: { provider: "apify", webhook_payload: payload, ...info },
        } as never);
        return NextResponse.json({ ok: true, failed: true });
    }

    if (!info.datasetId) {
        return NextResponse.json({ ok: false, error: "Webhook did not include a default dataset ID." }, { status: 202 });
    }

    if (info.runId) {
        await supabase.from("outreach_source_runs" as never).update({
            status: "completed",
            dataset_id: info.datasetId,
        } as never).eq("run_id" as never, info.runId as never);
    }

    const config = getApifyConfig();
    let importInput;
    if (provider === "apify_website_crawler") {
        importInput = {
            provider: "apify_dataset",
            import_kind: "website_crawler",
            actor_id: info.actorId ?? config.websiteCrawlerActorId,
            run_id: info.runId,
            dataset_id: info.datasetId,
            account_id: input.account_id,
            url: input.url,
            generated_from_job_id: discoveryJob.id,
        };
    } else if (provider === "apify_reddit") {
        importInput = {
            provider: "apify_dataset",
            import_kind: "reddit_question",
            actor_id: info.actorId ?? config.redditActorId,
            run_id: info.runId,
            dataset_id: info.datasetId,
            query: input.query,
            generated_from_job_id: discoveryJob.id,
        };
    } else if (provider === "apify_linkedin_profile") {
        importInput = {
            provider: "apify_dataset",
            import_kind: "linkedin_profile",
            actor_id: info.actorId ?? getLinkedinActorId("linkedin_profile"),
            run_id: info.runId,
            dataset_id: info.datasetId,
            account_id: input.account_id,
            contact_id: input.contact_id,
            profile_url: input.profile_url,
            generated_from_job_id: discoveryJob.id,
        };
    } else if (provider === "apify_linkedin_company") {
        importInput = {
            provider: "apify_dataset",
            import_kind: "linkedin_company",
            actor_id: info.actorId ?? getLinkedinActorId("linkedin_company"),
            run_id: info.runId,
            dataset_id: info.datasetId,
            account_id: input.account_id,
            company_url: input.company_url,
            generated_from_job_id: discoveryJob.id,
        };
    } else if (provider === "apify_linkedin_employees") {
        importInput = {
            provider: "apify_dataset",
            import_kind: "linkedin_employees",
            actor_id: info.actorId ?? getLinkedinActorId("linkedin_employees"),
            run_id: info.runId,
            dataset_id: info.datasetId,
            account_id: input.account_id,
            company_url: input.company_url,
            generated_from_job_id: discoveryJob.id,
        };
    } else if (provider === "apify_linkedin_posts") {
        importInput = {
            provider: "apify_dataset",
            import_kind: "linkedin_posts",
            actor_id: info.actorId ?? getLinkedinActorId("linkedin_posts"),
            run_id: info.runId,
            dataset_id: info.datasetId,
            account_id: input.account_id,
            company_url: input.company_url,
            profile_url: input.profile_url,
            generated_from_job_id: discoveryJob.id,
        };
    } else {
        importInput = {
            provider: "apify_dataset",
            import_kind: "google_maps",
            actor_id: info.actorId ?? config.googleMapsActorId,
            run_id: info.runId,
            dataset_id: info.datasetId,
            query: input.query,
            offset: 0,
            generated_from_job_id: discoveryJob.id,
        };
    }

    const { data: existingImport } = await supabase
        .from("outreach_discovery_jobs" as never)
        .select("id" as never)
        .eq("campaign_id" as never, discoveryJob.campaign_id as never)
        .in("status" as never, ["queued", "running", "completed"] as never)
        .contains("input" as never, {
            provider: "apify_dataset",
            import_kind: importInput.import_kind,
            dataset_id: importInput.dataset_id,
        } as never)
        .limit(1);
    if (Array.isArray(existingImport) && existingImport.length > 0) {
        return NextResponse.json({ ok: true, importQueued: false, duplicate: true });
    }

    const { error: insertError } = await supabase.from("outreach_discovery_jobs" as never).insert({
        workspace_id: discoveryJob.workspace_id,
        campaign_id: discoveryJob.campaign_id,
        source_id: discoveryJob.source_id,
        job_type: "import",
        priority: provider === "apify_website_crawler" ? 136 : 125,
        input: importInput,
        result_summary: { provider: "apify", webhook: info },
    } as never);
    if (insertError) {
        return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    await supabase.from("outreach_audit_events" as never).insert({
        workspace_id: discoveryJob.workspace_id,
        campaign_id: discoveryJob.campaign_id,
        event_type: "apify_import_queued",
        event_summary: `Queued Apify dataset import for ${provider === "apify_website_crawler" ? "website enrichment" : provider === "apify_reddit" ? "Reddit discovery" : provider?.startsWith("apify_linkedin_") ? "LinkedIn enrichment" : "Google Maps discovery"}.`,
        metadata: { provider: "apify", ...info },
    } as never);

    return NextResponse.json({ ok: true, importQueued: true });
}
