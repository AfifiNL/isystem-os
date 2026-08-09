
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { executeWorkspaceAiObject } from "@/shared/lib/ai/workspace-execution";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import { isTrueConversionEvent } from "@/features/analytics/taxonomy";
import {
    extractKeywords,
    extractMarkdownLinks,
    extractVisualLayoutLinks,
    extractVisualLayoutText,
    resolveBuilderSignals,
} from "@/features/seo/lib/analysis";
import {
    buildInternalLinkCandidates,
    INTERNAL_LINK_POLICY_LIMITS,
} from "@/features/seo/lib/internal-link-policy";
import { asObjectRecord } from "@/features/seo/lib/workspace-access";
import { autoPreviewOpportunitiesForWorkspace } from "@/features/seo/auto-apply";
import {
    getSeoAutoApplyMinAgeSeconds,
    getSeoAutomationMode,
    shouldAutoApplyOnPreviewSuccess,
} from "@/features/seo/lib/automation-mode";
import {
    createIncomingLinkMap,
    fetchFreshSearchConsoleQuerySignals,
} from "@/features/seo/lib/inventory";
import { getPlatformCopyContext } from "@/features/seo/lib/platform-copy-context";
import { extractThemeAiSystemContext } from "@/shared/lib/workspace/theme-manifest";
import { HUMAN_VOICE_RULES, humanize } from "@/shared/lib/ai/human-voice";
import { buildLocaleSystemPrompt } from "@/shared/lib/ai/locale";
import type { SeoContentAnalytics, SeoPublishedContentItem } from "@/features/seo/types";
import type { Json } from "@/shared/lib/supabase/database.types";
import type { Locale } from "@/features/templates/types";

type ContentInventoryRow = {
    id: string;
    title: string;
    slug: string;
    type: string;
    status: string;
    locale: string | null;
    content_markdown: string | null;
    visual_layout: unknown;
    metadata: unknown;
    created_at: string;
    updated_at: string;
};

type AnalyticsEventRow = {
    page_slug: string | null;
    event_type: string;
    event_name: string;
    created_at: string;
};

const candidateSchema = z.object({
    candidates: z.array(z.object({
        sourceSlug: z.string(),
        targetSlug: z.string(),
        anchorText: z.string(),
        rationale: z.string(),
        confidence: z.number().min(0).max(100),
    })),
});

export async function processNextInternalLinkJob(workerId: string) {
    const supabase = createAdminClient();

    interface InternalLinkJobRow {
        id: string;
        workspace_id: string;
        content_id: string;
        locale: string;
        template_id: string;
    }

    // 1. Claim next queued job atomically using skip locked RPC
    const { data: job, error: claimError } = await (supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>
    ) => Promise<{ data: InternalLinkJobRow | null; error: { message: string } | null }>)(
        "claim_next_seo_internal_link_job",
        { p_worker_id: workerId }
    );

    if (claimError) {
        console.error("[seo-worker] Error claiming next job:", claimError.message);
        return { success: false, message: claimError.message };
    }

    if (!job || !job.id) {
        return { success: false, message: "No queued jobs found." };
    }

    const jobId = job.id;
    const workspaceId = job.workspace_id;
    const contentId = job.content_id;
    const locale = job.locale as Locale;
    const routeName = `seo:internal-link-worker:${contentId}`;

    console.info(`[seo-worker] Claimed job ${jobId} for content_id=${contentId} in workspace_id=${workspaceId}`);

    try {
        // 2. Resolve workspace context and configurations. The central AI
        // executor owns the balance/rate/model policy if candidates exist.
        const { data: workspace, error: wsError } = await supabase
            .from("workspaces")
            .select("*, workspace_theme_bindings(theme_version_id, is_active, theme_versions(config))")
            .eq("id", workspaceId)
            .maybeSingle();

        if (wsError || !workspace) {
            throw new Error(wsError?.message ?? `Workspace ${workspaceId} not found.`);
        }

        const bindings = workspace.workspace_theme_bindings as unknown as Array<{
            is_active: boolean;
            theme_versions: { config: Record<string, unknown> } | null;
        }> | null;
        const activeThemeVersion = bindings?.find((b) => b.is_active)?.theme_versions;
        const activeThemeConfig = activeThemeVersion?.config ?? {};
        const workspaceAiContext = extractThemeAiSystemContext(activeThemeConfig) || "Active Workspace Business Context: unavailable.";

        const platformCopyContext = getPlatformCopyContext(workspaceAiContext);

        // 4. Fetch published inventory & analytics signals (using service client)
        const [inventory, analytics, gscSummaries] = await Promise.all([
            fetchPublishedInventoryAdmin(supabase, workspaceId, locale),
            fetchAnalyticsSignalsAdmin(supabase, workspaceId),
            fetchFreshSearchConsoleQuerySignals(workspaceId, locale, 30, supabase),
        ]);

        const incomingLinks = createIncomingLinkMap(inventory);
        const sourceItem = inventory.find((item) => item.id === contentId);

        if (!sourceItem) {
            throw new Error(`Content item ${contentId} is missing from published inventory.`);
        }

        // 5. Candidate Generation. Shared with the Specialist audit so ranking,
        // relevance gates, duplicate detection, and auto-apply limits cannot drift.
        const candidates = buildInternalLinkCandidates({
            workspaceId,
            locale,
            templateId: job.template_id,
            inventory,
            analytics,
            incomingLinks,
            sourceContentId: sourceItem.id,
            includeInboundForSource: true,
            gscSummaries,
            ...INTERNAL_LINK_POLICY_LIMITS.workerJob,
        });

        let finalCostMillicents = 0;
        let upsertCount = 0;
        let generatedOpportunityIds: string[] = [];
        let autoApplySummary = {
            previewed: 0,
            readyToApply: 0,
            manualReview: 0,
            applied: 0,
            skipped: 0,
            failed: 0,
        };

        if (candidates.length > 0) {
            const generation = await executeWorkspaceAiObject({
                authorization: {
                    kind: "system_workspace",
                    workspaceId,
                    source: "seo_internal_link_worker",
                },
                route: routeName,
                operation: "internal_link_worker_refinement",
                modelAlias: "text.seo-automation",
                rateLimit: { maxPerWindow: 5 },
                schema: candidateSchema,
                metadata: {
                    jobId,
                    contentId,
                    candidateCount: candidates.length,
                    publishedInventoryCount: inventory.length,
                    gscSignalCount: gscSummaries.length,
                    gscWindowDays: 30,
                },
                prompt: {
                    id: "seo.internal-link-worker-refinement",
                    version: "2026-07-24.1",
                    system: [
                        "You are an SEO editor reviewing internal-link suggestions.",
                        buildLocaleSystemPrompt(locale),
                        "For each candidate, improve only anchorText and rationale. Never change slugs or lower confidence.",
                        "Use natural 2–5 word editorial anchors, never generic calls such as click here. The anchor must reflect topical overlap present in the supplied pages.",
                        "Write a one-sentence active-voice rationale explaining the reader or conversion benefit.",
                        "You may raise confidence by at most 15 only for a materially better natural fit.",
                        HUMAN_VOICE_RULES,
                    ].join("\n\n"),
                    task: "Return a candidates array with sourceSlug, targetSlug, improved anchorText, rationale, and confidence for every supplied candidate.",
                    trustedContext: [
                        { label: "output_locale", value: locale },
                    ],
                    untrustedContext: [
                        {
                            label: "workspace_name",
                            value: workspace.name,
                            maxLength: 500,
                        },
                        {
                            label: "workspace_voice",
                            value: workspaceAiContext,
                            maxLength: 4_000,
                        },
                        {
                            label: "platform_copy",
                            value: platformCopyContext,
                            maxLength: 6_000,
                        },
                        {
                            label: "candidates",
                            value: candidates.map((candidate) => ({
                                sourceSlug: candidate.source_slug,
                                targetSlug: candidate.target_slug,
                                sourceTitle: candidate.source_title,
                                targetTitle: candidate.target_title,
                                sourceSnippet: candidate.source_excerpt ?? "",
                                targetSnippet: candidate.target_excerpt ?? "",
                                anchorText: candidate.anchor_text,
                                rationale: candidate.rationale ?? "",
                                confidence: candidate.confidence_score,
                            })),
                            maxLength: 40_000,
                        },
                    ],
                },
            });
            finalCostMillicents = generation.workspaceAi.billing?.chargedMillicents ?? 0;

            const refined = generation.object.candidates.map((candidate) => {
                const original = candidates.find(
                    (item) => item.source_slug === candidate.sourceSlug
                        && item.target_slug === candidate.targetSlug,
                );
                const originalConfidence = original?.confidence_score ?? 0;
                return {
                    ...candidate,
                    anchorText: humanize(candidate.anchorText, { preserveNewlines: false }),
                    rationale: humanize(candidate.rationale, { preserveNewlines: false }),
                    confidence: Math.min(
                        100,
                        originalConfidence + 15,
                        Math.max(originalConfidence, candidate.confidence),
                    ),
                };
            });

            // 7. Persist suggestions into existing SEO internal-link opportunity infrastructure
            const upsertPayload = candidates.map((candidate) => {
                const refinement = refined?.find(
                    (r) => r.sourceSlug === candidate.source_slug && r.targetSlug === candidate.target_slug
                );
                if (refinement) {
                    return {
                        ...candidate,
                        anchor_text: refinement.anchorText,
                        rationale: refinement.rationale,
                        confidence_score: Math.max(candidate.confidence_score, refinement.confidence),
                    };
                }
                return candidate;
            });

            if (upsertPayload.length > 0) {
                const { error: upsertError } = await supabase
                    .from("seo_internal_link_opportunities")
                    .upsert(upsertPayload, { onConflict: "workspace_id,source_content_id,target_content_id" });
                if (upsertError) {
                    throw new Error(`Failed to upsert opportunities: ${upsertError.message}`);
                }
                upsertCount = upsertPayload.length;

                const payloadPairs = new Set(upsertPayload.map((row) => `${row.source_content_id}:${row.target_content_id}`));
                const { data: upsertedRows, error: upsertedRowsError } = await supabase
                    .from("seo_internal_link_opportunities")
                    .select("id,source_content_id,target_content_id")
                    .eq("workspace_id", workspaceId)
                    .eq("locale", locale)
                    .or(`source_content_id.eq.${contentId},target_content_id.eq.${contentId}`)
                    .in("source_content_id", upsertPayload.map((row) => row.source_content_id))
                    .in("target_content_id", upsertPayload.map((row) => row.target_content_id));
                if (upsertedRowsError) {
                    console.warn("[seo-worker] Failed to reselect upserted opportunity ids:", upsertedRowsError.message);
                }
                generatedOpportunityIds = (upsertedRows ?? [])
                    .filter((row) => payloadPairs.has(`${row.source_content_id}:${row.target_content_id}`))
                    .map((row) => row.id);
            }
        }

        if (upsertCount > 0) {
            const workspaceMetadata = workspace.metadata && typeof workspace.metadata === "object" && !Array.isArray(workspace.metadata)
                ? workspace.metadata as Record<string, unknown>
                : {};
            const automationMode = getSeoAutomationMode(workspaceMetadata);
            autoApplySummary = await autoPreviewOpportunitiesForWorkspace({
                supabase,
                workspaceId,
                workspaceLocale: locale,
                templateId: job.template_id,
                opportunityIds: generatedOpportunityIds.length > 0 ? generatedOpportunityIds : undefined,
                automationMode,
                autoApplyOnSuccess: shouldAutoApplyOnPreviewSuccess(automationMode),
                autoApplyMinAgeSeconds: getSeoAutoApplyMinAgeSeconds(workspaceMetadata),
                maxAutoApplyTotal: INTERNAL_LINK_POLICY_LIMITS.workerJob.maxAutoApplyTotal,
                maxAutoApplyPerSource: INTERNAL_LINK_POLICY_LIMITS.workerJob.maxAutoApplyPerSource,
                appliedByProfileId: null,
                limit: generatedOpportunityIds.length > 0 ? Math.max(generatedOpportunityIds.length, 10) : 25,
                concurrency: 3,
            });
        }

        // Get model config snapshot used
        const { data: updatedWorkspace } = await supabase
            .from("workspaces")
            .select("ai_model_configs")
            .eq("id", workspaceId)
            .maybeSingle();

        // 8. Update job to completed
        const { error: completeError } = await supabase
            .from("seo_internal_link_jobs")
            .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                cost_summary_millicents: finalCostMillicents,
                model_config_snapshot: updatedWorkspace?.ai_model_configs ?? {},
                summary: {
                    generated: candidates.length,
                    upserted: upsertCount,
                    previewed: autoApplySummary.previewed,
                    ready_to_apply: autoApplySummary.readyToApply,
                    manual_review_required: autoApplySummary.manualReview,
                    applied: autoApplySummary.applied,
                    failed: autoApplySummary.failed,
                    skipped: autoApplySummary.skipped,
                    cost_millicents: finalCostMillicents,
                    opportunity_ids: generatedOpportunityIds,
                    message: `Generated ${candidates.length}, upserted ${upsertCount}, previewed ${autoApplySummary.previewed}, applied ${autoApplySummary.applied}.`,
                },
                error_message: null,
            })
            .eq("id", jobId);

        if (completeError) {
            console.error(`[seo-worker] Failed to mark job ${jobId} as completed:`, completeError.message);
        }

        return { success: true, jobId, workspaceId };

    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[seo-worker] Job ${jobId} failed:`, errMsg);

        // Update job to failed
        const { error: failUpdateError } = await supabase
            .from("seo_internal_link_jobs")
            .update({
                status: "failed",
                error_message: errMsg,
            })
            .eq("id", jobId);

        if (failUpdateError) {
            console.error(`[seo-worker] Failed to mark job ${jobId} as failed:`, failUpdateError.message);
        }

        return { success: false, jobId, workspaceId, message: errMsg };
    }
}

async function fetchPublishedInventoryAdmin(supabase: SupabaseClient<Database>, workspaceId: string, locale: Locale): Promise<SeoPublishedContentItem[]> {
    const [blogResult, pageResult] = await Promise.all([
        supabase
            .from("content_items")
                    .select("id,title,slug,type,status,locale,content_markdown,visual_layout,metadata,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "published")
            .eq("type", "blog")
            .eq("locale", locale)
            .order("updated_at", { ascending: false }),
        supabase
            .from("content_items")
                    .select("id,title,slug,type,status,locale,content_markdown,visual_layout,metadata,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "published")
            .eq("type", "page")
            .order("updated_at", { ascending: false }),
    ]);

    const error = blogResult.error ?? pageResult.error;
    const data = [...(blogResult.data ?? []), ...(pageResult.data ?? [])];

    if (error) {
        throw new Error(error.message ?? "Failed to fetch content inventory.");
    }

    return ((data ?? []) as ContentInventoryRow[]).map((row) => {
        const metadata = (row.metadata ?? null) as Json;
        const meta = asObjectRecord(metadata);
        const seo = asObjectRecord(meta.seo);
        const builderSignals = resolveBuilderSignals(metadata);
        const excerpt = typeof meta.excerpt === "string" ? meta.excerpt : "";
        const seoTitle = typeof seo.title === "string" ? seo.title : builderSignals.seoTitle;
        const seoDescription = typeof seo.description === "string" ? seo.description : builderSignals.seoDescription;
        const contentMarkdown = typeof row.content_markdown === "string" ? row.content_markdown : "";
        const visualLayout = (row.visual_layout ?? null) as Json;
        const visualLayoutText = extractVisualLayoutText(visualLayout, locale);
        const links = Array.from(new Set([
            ...extractMarkdownLinks(contentMarkdown),
            ...extractVisualLayoutLinks(visualLayout, locale),
        ]));

        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            type: row.type,
            status: row.status,
            locale: row.locale,
            contentMarkdown,
            visualLayoutText,
            excerpt,
            keywords: extractKeywords(metadata),
            links,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata,
            pageIntent: builderSignals.pageIntent,
            audienceType: builderSignals.audienceType,
            conversionGoal: builderSignals.conversionGoal,
            seoTitle,
            seoDescription,
        } satisfies SeoPublishedContentItem;
    });
}

async function fetchAnalyticsSignalsAdmin(supabase: SupabaseClient<Database>, workspaceId: string, days = 90): Promise<SeoContentAnalytics[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from("analytics_events")
        .select("page_slug,event_type,event_name,created_at")
        .eq("workspace_id", workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);

    if (error) {
        throw new Error(error.message ?? "Failed to fetch analytics signals.");
    }

    const map = new Map<string, SeoContentAnalytics>();
    for (const row of (data ?? []) as AnalyticsEventRow[]) {
        const slug = typeof row.page_slug === "string" ? row.page_slug : null;
        if (!slug) continue;
        const current = map.get(slug) ?? { slug, pageViews: 0, conversions: 0, ctaClicks: 0, lastSeenAt: null };
        if (row.event_type === "page_view") current.pageViews += 1;
        if (row.event_type === "cta_click") current.ctaClicks += 1;
        if (isTrueConversionEvent(row.event_type, row.event_name)) current.conversions += 1;
        current.lastSeenAt = current.lastSeenAt && current.lastSeenAt > row.created_at ? current.lastSeenAt : row.created_at;
        map.set(slug, current);
    }

    return Array.from(map.values()).sort((a, b) => b.pageViews - a.pageViews);
}
