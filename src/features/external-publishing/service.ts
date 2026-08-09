import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import { BUSINESS_SPINE_WORKFLOW_EVENTS, dispatchBusinessSpineWorkflowEvent } from "@/features/business-spine/workflow-events";
import { externalPublicationCampaignDraftSchema, externalPublicationPackageDraftSchema } from "./schema";
import type { ExternalPublicationAssetRow, ExternalPublicationPackageRow, ExternalPublicationPlatformProfileRow, ExternalPublicationStatus } from "./types";
import { appendExternalPublishingUtm, slugifyAttributionPart } from "./lib/attribution";
import { generateStructuredExternalPackage } from "./lib/package-generator";
import { mineExternalPublishingOpportunities, type ExternalPublishingOpportunity } from "./lib/opportunity-miner";
import { buildExternalPublicationBundleMarkdown, externalPublicationBundleFilename } from "./lib/export-bundle";
import { summarizeExternalPublishingAttribution, type ExternalPublishingAttributionSummary, type ExternalPublishingAnalyticsEvent } from "./lib/performance-attribution";
import { buildExternalPublishingWorkflowEventInput, externalPublishingWorkflowPayload } from "./lib/workflow-integration";
import { parseExternalPublishingManualPublicationUrl } from "./lib/manual-publication-url";
import { getCanonicalExternalPublishingEvidence } from "./lib/source-evidence";
import { externalPublicationAssetManifestInputSchema, externalPublicationPlatformProfileInputSchema } from "./schema";
import { getProfiledExternalPublishingPlatformAdapter, normalizeExternalPublicationPlatformProfile, serializePlatformProfileForDatabase } from "./lib/platform-profiles";
import { buildExternalPublicationAssetManifestFromVisualPlan, serializeAssetManifestForDatabase } from "./lib/asset-manifests";
import { buildExternalPublishingConversionFeedback } from "./lib/conversion-feedback";
import { buildExternalPublishingGrowthLoopReport, type ExternalPublishingGrowthLoopRow } from "./lib/growth-loop-report";
import { AiExternalPublishingGenerator } from "./lib/ai-generator";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
const STALE_NO_TRAFFIC_FOLLOW_UP_DAYS = 7;

function inputRecord(input: unknown): Record<string, unknown> {
    return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

export interface ExternalPublishingWorkspaceScope {
    workspaceId: string;
    templateId?: string | null;
    userId?: string | null;
    locale?: "en" | "nl" | "ar";
}

export interface ExternalPublishingDashboardData {
    campaigns: unknown[];
    packages: ExternalPublicationPackageRow[];
    platformProfiles: ExternalPublicationPlatformProfileRow[];
    assetsByPackageId: Record<string, ExternalPublicationAssetRow[]>;
    activeResearchJobs: unknown[];
    recentEvents: unknown[];
    performanceByPackageId: Record<string, ExternalPublishingAttributionSummary>;
    growthLoop: ExternalPublishingGrowthLoopRow[];
    analytics: {
        packageCount: number;
        generatedCount: number;
        exportedCount: number;
        publishedManualCount: number;
    };
}

export interface ExternalPublicationBundleExport {
    packageId: string;
    filename: string;
    contentType: "text/markdown; charset=utf-8";
    markdown: string;
    assetId: string | null;
}

type AnalyticsAttributionSync = {
    syncedPackages: number;
    opportunitiesUpserted: number;
    eventsInserted: number;
};

async function bestEffortExternalPublishingWorkflow(input: Parameters<typeof dispatchBusinessSpineWorkflowEvent>[0]) {
    const telemetry = await dispatchBusinessSpineWorkflowEvent(input);
    if (!telemetry.ok) {
        console.warn("[external-publishing] workflow dispatch failed", {
            eventKey: telemetry.eventKey,
            idempotencyKey: telemetry.idempotencyKey,
            error: telemetry.error,
        });
    }
}

function isStaleNoTrafficCandidate(row: ExternalPublicationPackageRow, summary: ExternalPublishingAttributionSummary, now = new Date()) {
    if (row.status !== "published_manual" || !row.manual_published_at || !summary.staleNoTraffic) return false;
    const publishedAt = new Date(row.manual_published_at);
    if (Number.isNaN(publishedAt.getTime())) return false;
    const ageMs = now.getTime() - publishedAt.getTime();
    return ageMs >= STALE_NO_TRAFFIC_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;
}

export async function loadExternalPublishingDashboardData(scope: ExternalPublishingWorkspaceScope): Promise<ExternalPublishingDashboardData> {
    const supabase = await createClient();
    const [campaigns, packages, profiles, assets, jobs, events, analyticsEvents] = await Promise.all([
        supabase.from("external_publication_campaigns").select("*").eq("workspace_id", scope.workspaceId).order("created_at", { ascending: false }).limit(100),
        supabase.from("external_publication_packages").select("*").eq("workspace_id", scope.workspaceId).order("updated_at", { ascending: false }).limit(200),
        supabase.from("external_publication_platform_profiles").select("*").eq("workspace_id", scope.workspaceId),
        supabase.from("external_publication_assets").select("*").eq("workspace_id", scope.workspaceId).order("created_at", { ascending: false }).limit(400),
        supabase.from("external_publication_research_jobs").select("id,package_id,campaign_id,provider,job_type,status,run_after,created_at,error_message").eq("workspace_id", scope.workspaceId).in("status", ["queued", "running"]).limit(50),
        supabase.from("external_publication_events").select("*").eq("workspace_id", scope.workspaceId).order("occurred_at", { ascending: false }).limit(40),
        supabase.from("analytics_events").select("event_type,event_name,created_at,utm_source,utm_medium,utm_campaign,referrer,metadata").eq("workspace_id", scope.workspaceId).order("created_at", { ascending: false }).limit(1000),
    ]);
    if (campaigns.error) throw new Error(campaigns.error.message);
    if (packages.error) throw new Error(packages.error.message);
    if (profiles.error) throw new Error(profiles.error.message);
    if (assets.error) throw new Error(assets.error.message);
    if (jobs.error) throw new Error(jobs.error.message);
    if (events.error) throw new Error(events.error.message);
    if (analyticsEvents.error) throw new Error(analyticsEvents.error.message);
    const packageRows = packages.data ?? [];
    const analyticsRows = (analyticsEvents.data ?? []) as ExternalPublishingAnalyticsEvent[];
    const assetsByPackageId = (assets.data ?? []).reduce<Record<string, ExternalPublicationAssetRow[]>>((acc, asset) => {
        const list = acc[asset.package_id] ?? [];
        list.push(asset);
        acc[asset.package_id] = list;
        return acc;
    }, {});
    const performanceByPackageId = Object.fromEntries(packageRows.map((row) => [row.id, summarizeExternalPublishingAttribution({
        packageId: row.id,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        utmContent: row.utm_content,
        manualPublishedUrl: row.manual_published_url,
        events: analyticsRows,
    })]));
    for (const row of packageRows) {
        const summary = performanceByPackageId[row.id];
        if (!summary || !isStaleNoTrafficCandidate(row, summary)) continue;
        const event = buildExternalPublishingWorkflowEventInput({
            workspaceId: scope.workspaceId,
            packageId: row.id,
            eventKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC,
            payload: externalPublishingWorkflowPayload(row, {
                staleNoTraffic: true,
                followUpWindowDays: STALE_NO_TRAFFIC_FOLLOW_UP_DAYS,
                manualPublishedAt: row.manual_published_at,
            }),
        });
        await bestEffortExternalPublishingWorkflow(event);
    }
    return {
        campaigns: campaigns.data ?? [],
        packages: packageRows,
        platformProfiles: profiles.data ?? [],
        assetsByPackageId,
        activeResearchJobs: jobs.data ?? [],
        recentEvents: events.data ?? [],
        performanceByPackageId,
        growthLoop: buildExternalPublishingGrowthLoopReport({
            packages: packageRows,
            performanceByPackageId,
            recentEvents: (events.data ?? []) as never,
        }),
        analytics: {
            packageCount: packageRows.length,
            generatedCount: packageRows.filter((row) => row.status === "generated").length,
            exportedCount: packageRows.filter((row) => row.status === "exported").length,
            publishedManualCount: packageRows.filter((row) => row.status === "published_manual").length,
        },
    };
}

export async function mineExternalPublishingOpportunitiesForWorkspace(scope: ExternalPublishingWorkspaceScope): Promise<ExternalPublishingOpportunity[]> {
    const supabase = await createClient();
    return mineExternalPublishingOpportunities(supabase, {
        workspaceId: scope.workspaceId,
        templateId: scope.templateId,
        locale: scope.locale ?? "en",
        limit: 40,
    });
}

export async function createExternalPublishingCampaign(scope: ExternalPublishingWorkspaceScope, input: unknown) {
    const parsed = externalPublicationCampaignDraftSchema.parse({ ...inputRecord(input), workspaceId: scope.workspaceId, templateId: scope.templateId });
    const supabase = await createClient();
    const { data, error } = await supabase.from("external_publication_campaigns").insert({
        workspace_id: scope.workspaceId,
        template_id: parsed.templateId ?? scope.templateId ?? null,
        name: parsed.name,
        goal: parsed.goal,
        target_persona: parsed.targetPersona ?? null,
        target_geographies: parsed.targetGeographies,
        utm_campaign: slugifyAttributionPart(parsed.utmCampaign, "campaign"),
        created_by_profile_id: scope.userId ?? null,
        metadata: parsed.metadata as Json,
    }).select("*").single();
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/external-publishing");
    return data;
}

export async function createExternalPublishingPackageDraft(scope: ExternalPublishingWorkspaceScope, input: unknown) {
    const parsed = externalPublicationPackageDraftSchema.parse({ ...inputRecord(input), workspaceId: scope.workspaceId, templateId: scope.templateId });
    const supabase = await createClient();
    const targetUrl = appendExternalPublishingUtm(parsed.targetUrl, {
        platform: parsed.platform,
        campaign: parsed.utmCampaign,
        content: parsed.utmContent,
    });
    const { data, error } = await supabase.from("external_publication_packages").insert({
        workspace_id: scope.workspaceId,
        template_id: parsed.templateId ?? scope.templateId ?? null,
        campaign_id: parsed.campaignId ?? null,
        platform: parsed.platform,
        source_type: parsed.sourceType,
        source_content_id: parsed.sourceContentId ?? null,
        source_seo_plan_id: parsed.sourceSeoPlanId ?? null,
        source_seo_opportunity_id: parsed.sourceSeoOpportunityId ?? null,
        locale: parsed.locale,
        topic: parsed.topic,
        primary_query: parsed.primaryQuery ?? null,
        target_url: targetUrl,
        target_slug: parsed.targetSlug ?? null,
        utm_source: parsed.utmSource,
        utm_medium: parsed.utmMedium,
        utm_campaign: parsed.utmCampaign,
        utm_content: parsed.utmContent,
        metadata: parsed.metadata as Json,
    }).select("*").single();
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/external-publishing");
    return data;
}

async function loadPackageForWorkspace(supabase: SupabaseServerClient, scope: ExternalPublishingWorkspaceScope, packageId: string): Promise<ExternalPublicationPackageRow> {
    const { data, error } = await supabase.from("external_publication_packages").select("*").eq("id", packageId).eq("workspace_id", scope.workspaceId).single();
    if (error) throw new Error(error.message);
    return data;
}

export async function generateAndStoreExternalPublishingPackage(scope: ExternalPublishingWorkspaceScope, packageId: string) {
    const supabase = await createClient();
    const row = await loadPackageForWorkspace(supabase, scope, packageId);
    const [{ data: profile }, canonicalEvidence] = await Promise.all([
        supabase.from("external_publication_platform_profiles").select("*").eq("workspace_id", scope.workspaceId).eq("platform", row.platform).maybeSingle(),
        getCanonicalExternalPublishingEvidence(row),
    ]);
    const opportunity: ExternalPublishingOpportunity = {
        id: `package:${row.id}`,
        workspaceId: row.workspace_id,
        templateId: row.template_id,
        locale: row.locale as "en" | "nl" | "ar",
        sourceType: row.source_type,
        sourceContentId: row.source_content_id,
        sourceSeoPlanId: row.source_seo_plan_id,
        sourceSeoOpportunityId: row.source_seo_opportunity_id,
        topic: row.topic,
        primaryQuery: row.primary_query,
        title: row.topic,
        targetUrl: row.target_url,
        targetSlug: row.target_slug,
        score: 70,
        scoreReasons: ["stored draft package"],
        provenance: { packageId: row.id, gscSnapshot: row.gsc_snapshot, metadata: row.metadata },
    };
    const aiGenerator = new AiExternalPublishingGenerator({
        workspaceId: scope.workspaceId,
        profileId: scope.userId ?? null,
    });
    const generated = await generateStructuredExternalPackage({
        workspaceId: scope.workspaceId,
        templateId: row.template_id,
        platform: row.platform,
        platformAdapter: getProfiledExternalPublishingPlatformAdapter(row.platform, profile ?? null),
        campaignSlug: row.utm_campaign,
        packageSlug: row.utm_content,
        opportunity,
        evidence: canonicalEvidence,
    }, aiGenerator);
    const { data, error } = await supabase.from("external_publication_packages").update({
        status: generated.validation.valid ? "generated" : "needs_review",
        title_options: generated.titleOptions as Json,
        body_markdown: generated.bodyMarkdown,
        body_plaintext: generated.bodyPlaintext,
        body_platform_specific: generated.bodyPlatformSpecific,
        copy_blocks: generated.copyBlocks as Json,
        link_plan: generated.linkPlan as Json,
        visual_plan: generated.visualPlan as Json,
        evidence_pack: generated.evidencePack as Json,
        validation_result: generated.validation as unknown as Json,
        quality_score: generated.qualityScore,
        usefulness_score: generated.usefulnessScore,
        backlink_safety_score: generated.backlinkSafetyScore,
        compliance_warnings: generated.complianceWarnings as Json,
        generated_by_profile_id: scope.userId ?? null,
    }).eq("id", packageId).eq("workspace_id", scope.workspaceId).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("external_publication_events").insert({
        workspace_id: scope.workspaceId,
        package_id: packageId,
        event_type: "generated",
        actor_profile_id: scope.userId ?? null,
        payload: { validation: generated.validation } as unknown as Json,
    });
    if (data.status === "generated" || data.status === "needs_review") {
        const event = buildExternalPublishingWorkflowEventInput({
            workspaceId: scope.workspaceId,
            packageId,
            eventKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_READY_FOR_REVIEW,
            payload: externalPublishingWorkflowPayload(data),
        });
        await bestEffortExternalPublishingWorkflow(event);
    }
    revalidatePath("/dashboard/external-publishing");
    return data;
}

export async function upsertExternalPublishingPlatformProfile(scope: ExternalPublishingWorkspaceScope, input: unknown) {
    const parsed = externalPublicationPlatformProfileInputSchema.parse(input);
    const normalized = normalizeExternalPublicationPlatformProfile(parsed);
    const supabase = await createClient();
    const { data, error } = await supabase.from("external_publication_platform_profiles").upsert({
        workspace_id: scope.workspaceId,
        platform: normalized.platform,
        ...serializePlatformProfileForDatabase(normalized),
    }, { onConflict: "workspace_id,platform" }).select("*").single();
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/external-publishing");
    return data;
}

export async function createExternalPublishingAssetManifest(scope: ExternalPublishingWorkspaceScope, packageId: string, input: unknown = {}) {
    const parsed = externalPublicationAssetManifestInputSchema.parse(input);
    const supabase = await createClient();
    const row = await loadPackageForWorkspace(supabase, scope, packageId);
    const manifest = buildExternalPublicationAssetManifestFromVisualPlan(row, parsed);
    const { data, error } = await supabase.from("external_publication_assets").insert({
        workspace_id: scope.workspaceId,
        package_id: packageId,
        storage_bucket: null,
        storage_path: null,
        public_url: null,
        ...serializeAssetManifestForDatabase(manifest),
    }).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("external_publication_events").insert({
        workspace_id: scope.workspaceId,
        package_id: packageId,
        event_type: "validated",
        actor_profile_id: scope.userId ?? null,
        payload: { assetManifestId: data.id, assetType: data.asset_type, manifestOnly: true } as Json,
    });
    revalidatePath("/dashboard/external-publishing");
    return data;
}

export async function syncExternalPublishingConversionFeedback(scope: ExternalPublishingWorkspaceScope): Promise<AnalyticsAttributionSync> {
    const dashboard = await loadExternalPublishingDashboardData(scope);
    const supabase = await createClient();
    let opportunitiesUpserted = 0;
    let eventsInserted = 0;
    const syncedAt = new Date().toISOString();

    for (const pkg of dashboard.packages) {
        const summary = dashboard.performanceByPackageId[pkg.id];
        if (!summary) continue;
        const feedback = buildExternalPublishingConversionFeedback(pkg, summary, syncedAt);
        if (!feedback.opportunity || !feedback.eventPayload) continue;
        const { data: upserted, error } = await supabase.from("workspace_opportunities").upsert(feedback.opportunity, {
            onConflict: "workspace_id,category,signal_key",
            ignoreDuplicates: false,
        }).select("id");
        if (error) throw new Error(error.message);
        opportunitiesUpserted += upserted?.length ?? 0;
        const { error: eventError } = await supabase.from("external_publication_events").insert({
            workspace_id: scope.workspaceId,
            package_id: pkg.id,
            event_type: "analytics_attributed",
            actor_profile_id: scope.userId ?? null,
            payload: feedback.eventPayload as unknown as Json,
        });
        if (eventError) throw new Error(eventError.message);
        eventsInserted += 1;
    }

    revalidatePath("/dashboard/external-publishing");
    return { syncedPackages: dashboard.packages.length, opportunitiesUpserted, eventsInserted };
}

export async function transitionExternalPublishingPackageStatus(scope: ExternalPublishingWorkspaceScope, packageId: string, status: ExternalPublicationStatus) {
    const supabase = await createClient();
    if (status === "published_manual") {
        throw new Error("Use the manual publication URL flow to mark a package as published.");
    }
    const patch: Record<string, unknown> = { status };
    if (status === "approved") {
        patch.approved_at = new Date().toISOString();
        patch.approved_by_profile_id = scope.userId ?? null;
    }
    if (status === "exported") patch.exported_at = new Date().toISOString();
    const { data, error } = await supabase.from("external_publication_packages").update(patch).eq("id", packageId).eq("workspace_id", scope.workspaceId).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("external_publication_events").insert({
        workspace_id: scope.workspaceId,
        package_id: packageId,
        event_type: status === "exported" ? "exported" : status === "approved" ? "approved" : "validated",
        actor_profile_id: scope.userId ?? null,
        payload: { status } as Json,
    });
    if (status === "exported") {
        const event = buildExternalPublishingWorkflowEventInput({
            workspaceId: scope.workspaceId,
            packageId,
            eventKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED,
            payload: externalPublishingWorkflowPayload(data),
        });
        await bestEffortExternalPublishingWorkflow(event);
    }
    revalidatePath("/dashboard/external-publishing");
    return data;
}

export async function recordExternalPublishingManualPublication(scope: ExternalPublishingWorkspaceScope, packageId: string, url: string) {
    const parsedUrl = parseExternalPublishingManualPublicationUrl(url);
    const supabase = await createClient();
    const { data, error } = await supabase.from("external_publication_packages").update({
        status: "published_manual",
        manual_published_url: parsedUrl,
        manual_published_at: new Date().toISOString(),
    }).eq("id", packageId).eq("workspace_id", scope.workspaceId).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("external_publication_events").insert({
        workspace_id: scope.workspaceId,
        package_id: packageId,
        event_type: "published_manual",
        actor_profile_id: scope.userId ?? null,
        payload: { manualPublishedUrl: parsedUrl } as Json,
    });
    const event = buildExternalPublishingWorkflowEventInput({
        workspaceId: scope.workspaceId,
        packageId,
        eventKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL,
        payload: externalPublishingWorkflowPayload(data, { manualPublishedUrl: parsedUrl }),
    });
    await bestEffortExternalPublishingWorkflow(event);
    revalidatePath("/dashboard/external-publishing");
    return data;
}

export async function exportExternalPublicationBundle(scope: ExternalPublishingWorkspaceScope, packageId: string): Promise<ExternalPublicationBundleExport> {
    const supabase = await createClient();
    const row = await loadPackageForWorkspace(supabase, scope, packageId);
    const { data: assets, error: assetsError } = await supabase
        .from("external_publication_assets")
        .select("*")
        .eq("workspace_id", scope.workspaceId)
        .eq("package_id", packageId)
        .order("created_at", { ascending: false });
    if (assetsError) throw new Error(assetsError.message);

    const bundleMarkdown = buildExternalPublicationBundleMarkdown(row, (assets ?? []).filter((asset) => asset.asset_type !== "download_bundle") as ExternalPublicationAssetRow[]);
    const filename = externalPublicationBundleFilename(row);
    const exportedAt = new Date().toISOString();
    const { data: asset, error: assetError } = await supabase
        .from("external_publication_assets")
        .insert({
            workspace_id: scope.workspaceId,
            package_id: packageId,
            asset_type: "download_bundle",
            title: filename,
            description: "Markdown bundle for manual external publication export.",
            markdown_embed: bundleMarkdown,
            metadata: {
                exported_at: exportedAt,
                exported_by_profile_id: scope.userId ?? null,
                manual_only: true,
                content_type: "text/markdown; charset=utf-8",
                filename,
                includes: ["markdown", "title_options", "platform_copy", "no_link_version", "visual_plan", "evidence_pack", "link_utm_plan", "compliance_notes", "manual_checklist", "asset_references"],
            } as Json,
        })
        .select("id")
        .single();
    if (assetError) throw new Error(assetError.message);

    const { error: updateError } = await supabase
        .from("external_publication_packages")
        .update({ status: "exported", exported_at: exportedAt })
        .eq("id", packageId)
        .eq("workspace_id", scope.workspaceId);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("external_publication_events").insert({
        workspace_id: scope.workspaceId,
        package_id: packageId,
        event_type: "exported",
        actor_profile_id: scope.userId ?? null,
        payload: { bundleAssetId: asset?.id ?? null, filename, manualOnly: true } as Json,
    });

    const event = buildExternalPublishingWorkflowEventInput({
        workspaceId: scope.workspaceId,
        packageId,
        eventKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED,
        payload: externalPublishingWorkflowPayload({ ...row, status: "exported", exported_at: exportedAt }, { bundleAssetId: asset?.id ?? null, filename }),
    });
    await bestEffortExternalPublishingWorkflow(event);

    revalidatePath("/dashboard/external-publishing");
    return { packageId, filename, contentType: "text/markdown; charset=utf-8", markdown: bundleMarkdown, assetId: asset?.id ?? null };
}
