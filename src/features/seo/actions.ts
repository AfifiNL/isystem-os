"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { Json } from "@/shared/lib/supabase/database.types";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import { extractThemeAiSystemContext } from "@/shared/lib/workspace/theme-manifest";
import { processNextInternalLinkJob } from "@/features/seo/worker";
import {
    normalizeAnalyticsMap,
    safeAverage,
} from "@/features/seo/lib/analysis";
import {
    buildCanonicalPublicContentUrl,
} from "@/features/seo/indexing/url-normalization";
import {
    deriveSeoIndexingStatus,
    summarizeSeoIndexingCounts,
} from "@/features/seo/indexing/status";
import {
    buildInternalLinkCandidates,
    INTERNAL_LINK_POLICY_LIMITS,
} from "@/features/seo/lib/internal-link-policy";
import {
    applySeoExecutionMutation,
    createSeoExecutionPreview,
    getSeoExecutionDependencies,
    persistSeoExecutionEvent,
    rollbackSeoExecutionMutation,
} from "@/features/seo/execution";
import { autoPreviewOpportunitiesForWorkspace } from "@/features/seo/auto-apply";
import {
    getSeoAutoApplyMinAgeSeconds,
    getSeoAutomationMode,
    shouldAutoApplyOnPreviewSuccess,
} from "@/features/seo/lib/automation-mode";
import { getPlatformCopyContext } from "@/features/seo/lib/platform-copy-context";
import {
    getErrorMessage,
    getSeoWorkspaceContext,
    requireSeoExecutionAccess,
} from "@/features/seo/lib/workspace-access";
import {
    createIncomingLinkMap,
    fetchAnalyticsSignals,
    fetchFreshSearchConsoleQuerySignals,
    fetchPublishedInventory,
} from "@/features/seo/lib/inventory";
import {
    buildStrategistInventoryContext,
    findMatchingSearchConsoleSignal,
    summarizeSearchConsolePages,
} from "@/features/seo/lib/strategist-context";
import { completeRun, createRun } from "@/features/seo/lib/runs";
import { enqueueInternalLinkJobForPublishedContent } from "@/features/seo/internal-link-jobs";
import {
    enqueueContentIndexingJob,
    getIndexingSiteUrl,
} from "@/features/seo/indexing/service";
import {
    buildFallbackStrategicOutput,
    maybeGenerateStrategicAiOutput,
    maybeRefineInternalLinksWithAi,
} from "@/features/seo/lib/ai-generators";
import type {
    BlogEnhancementActionResult,
    BlogEnhancementPreview,
    BlogEnhancementProposal,
    BlogEnhancementRunRecord,
    BlogEnhancementRunStatus,
    BlogEnhancementSnapshot,
    SeoContentOpportunityRecord,
    SeoContentPlanRecord,
    SeoDashboardData,
    SeoExecutionActionResult,
    SeoExecutionEventRecord,
    SeoIndexingAttemptRecord,
    SeoIndexingDashboardCounts,
    SeoIndexingDashboardRow,
    SeoIndexingJobRecord,
    SeoInternalLinkJobRecord,
    SeoInternalLinkOpportunityRecord,
    SeoPublishedContentItem,
    SeoOrphanContentItem,
    SeoRecommendationStatus,
    SeoRunRecord,
    SeoTopicClusterRecord,
} from "@/features/seo/types";
import {
    SEO_PLAN_STATUS_VALUES,
    SEO_RECOMMENDATION_STATUS_VALUES,
} from "@/features/seo/types";
import {
    assertSufficientAiBalance,
    checkAiRateLimitPg,
    InsufficientAiBalanceError,
} from "@/shared/lib/ai/metering";
import { BLOG_ENHANCEMENT_CONFIG, planBlogPostSeoEnhancement } from "@/features/seo/lib/blog-enhancement";
import { remediateBlogEditorialValidation } from "@/features/seo/lib/blog-enhancement-remediation";
import { emitEnhancementFeedback } from "@/features/seo/lib/feedback-loop";
import { applySplices, collectMarkdownProtectedRanges, fingerprintMarkdown, rangeOverlapsProtectedRange } from "@/features/seo/lib/markdown-offsets";
import { resolveGenerationLocale } from "@/shared/lib/ai/locale";
import { runWithWorkspaceAiConfig } from "@/shared/lib/ai/provider";

export async function runSeoSpecialistAudit(localeInput?: string | null) {
    const context = await assertWorkspaceAiEnabled();
    const workspaceId = context.activeWorkspace.id;
    // Rate-limit before any AI work so a manager rapidly clicking the audit
    // button can't burn through metered credit. Mirrors the blog-enhancement
    // path; window matches the route's typical 60s rebuild cycle.
    const rate = await checkAiRateLimitPg(workspaceId, "seo_specialist_audit", { maxPerWindow: 3 });
    if (!rate.allowed) {
        throw new Error(`Audit is rate limited; retry in ${rate.retryAfterSeconds}s.`);
    }
    await assertSufficientAiBalance(workspaceId);
    const locale = resolveGenerationLocale({
        requested: localeInput,
        workspaceDefault: context.activeWorkspace.default_locale,
    });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const meterCtx = { workspaceId, profileId: user?.id ?? null };
    const runId = await createRun(workspaceId, "specialist_audit", locale);

    try {
        const gscConfigured = Boolean(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL);
        const workspaceAiContext = extractThemeAiSystemContext(context.activeThemeVersion?.config ?? {});
        const [inventory, analytics, platformCopyContext, gscSummaries] = await Promise.all([
            fetchPublishedInventory(workspaceId, locale),
            fetchAnalyticsSignals(workspaceId),
            getPlatformCopyContext(workspaceAiContext),
            fetchFreshSearchConsoleQuerySignals(workspaceId, locale),
        ]);
        const incomingLinks = createIncomingLinkMap(inventory);
        const candidates = buildInternalLinkCandidates({
            workspaceId,
            runId,
            locale,
            templateId: context.activeWorkspace.legacy_template_id,
            inventory,
            analytics,
            incomingLinks,
            gscSummaries,
            ...INTERNAL_LINK_POLICY_LIMITS.specialistAudit,
        });

        const aiRefinements = await runWithWorkspaceAiConfig(workspaceId, () =>
            maybeRefineInternalLinksWithAi({
                workspaceName: context.activeWorkspace.name,
                workspaceAiContext,
                platformCopyContext,
                locale,
                meterCtx,
                candidates: candidates.slice(0, 30).map((candidate) => ({
                    sourceSlug: candidate.source_slug ?? "",
                    targetSlug: candidate.target_slug ?? "",
                    sourceTitle: candidate.source_title,
                    targetTitle: candidate.target_title,
                    sourceSnippet: candidate.source_excerpt ?? "",
                    targetSnippet: candidate.target_excerpt ?? "",
                    anchorText: candidate.anchor_text,
                    rationale: candidate.rationale ?? "",
                    computedConfidence: candidate.confidence_score,
                })),
            })
        );

        if (aiRefinements?.length) {
            const { sanitizeText } = await import("@/features/seo/lib/sanitize");
            const refinementMap = new Map(aiRefinements.map((entry) => [`${entry.sourceSlug}::${entry.targetSlug}`, entry]));
            for (const candidate of candidates) {
                const refinement = refinementMap.get(`${candidate.source_slug}::${candidate.target_slug}`);
                if (refinement) {
                    const anchor = sanitizeText(refinement.anchorText, { maxLength: 120 });
                    const rationale = sanitizeText(refinement.rationale, { maxLength: 600 });
                    if (anchor.length >= 2) {
                        candidate.anchor_text = anchor;
                    }
                    if (rationale.length > 0) {
                        candidate.rationale = rationale;
                    }
                    if (Number.isFinite(refinement.confidence)) {
                        candidate.confidence_score = Math.max(0, Math.min(100, refinement.confidence));
                    }
                }
            }
        }

        const upsertPayload = candidates.map((candidate) => ({
            ...candidate,
            approved_at: null,
            dismissed_at: null,
        }));

        let autoPreviewedCount = 0;
        let autoReadyCount = 0;
        if (upsertPayload.length > 0) {
            const { error } = await supabase
                .from("seo_internal_link_opportunities")
                .upsert(upsertPayload, { onConflict: "workspace_id,source_content_id,target_content_id" });
            if (error) {
                throw new Error(error.message ?? "Failed to persist internal link opportunities.");
            }

            // Phase 2 + 3: auto-preview the highest-priority opportunities, and when
            // workspace mode is "standard" or "aggressive", auto-apply the supported ones.
            const automationMode = getSeoAutomationMode(context.activeWorkspace.metadata);
            const autoApplyMinAgeSeconds = getSeoAutoApplyMinAgeSeconds(context.activeWorkspace.metadata);
            const result = await autoPreviewOpportunitiesForWorkspace({
                workspaceId,
                templateId: context.activeWorkspace.legacy_template_id,
                // The run's locale, not the workspace default. A Dutch-default
                // workspace can run an EN audit; mutations must hit EN field
                // paths, not NL.
                workspaceLocale: locale,
                automationMode,
                autoApplyOnSuccess: shouldAutoApplyOnPreviewSuccess(automationMode),
                autoApplyMinAgeSeconds,
                maxAutoApplyTotal: INTERNAL_LINK_POLICY_LIMITS.specialistAudit.maxAutoApplyTotal,
                maxAutoApplyPerSource: INTERNAL_LINK_POLICY_LIMITS.specialistAudit.maxAutoApplyPerSource,
                appliedByProfileId: user?.id ?? null,
                limit: INTERNAL_LINK_POLICY_LIMITS.specialistAudit.maxAutoApplyTotal,
                concurrency: 3,
            });
            autoPreviewedCount = result.previewed;
            autoReadyCount = result.readyToApply;
        }

        await completeRun(runId, {
            headline: `Generated ${candidates.length} internal-link opportunities from ${inventory.length} published items and ${gscSummaries.length} fresh Search Console signals (auto-previewed ${autoPreviewedCount}, ${autoReadyCount} ready to apply).`,
            outcome: candidates.length === 0 ? "no_output" : "ok",
        }, {
            publishedCount: inventory.length,
            orphanCount: inventory.filter((item: { id: string }) => (incomingLinks.get(item.id) ?? 0) === 0).length,
            opportunityCount: candidates.length,
            autoPreviewedCount,
            autoReadyCount,
            gscSignalCount: gscSummaries.length,
            gscWindowDays: 30,
            gscConfigured,
        });

        revalidatePath("/dashboard/seo");
        return { success: true, runId, count: candidates.length };
    } catch (error) {
        const message = error instanceof Error ? error.message : "SEO specialist audit failed.";
        await completeRun(runId, {}, {}, message);
        throw error;
    }
}

export interface RunSeoStrategistAnalysisResult {
    success: true;
    runId: string;
    source: "ai" | "fallback";
    inventoryCount: number;
    analyticsCount: number;
    gscSignalCount: number;
    gscConfigured: boolean;
    proposedClusters: number;
    proposedPlans: number;
    proposedOpportunities: number;
    insertedClusters: number;
    insertedPlans: number;
    insertedOpportunities: number;
    skippedClusterErrors: number;
    skippedPlanErrors: number;
    skippedOpportunityErrors: number;
    firstError: string | null;
}

// Postgres enum `seo_funnel_stage` only accepts these literals. The AI is
// instructed to use them lowercase, but humanize() can capitalize the first
// letter, and JSON quoting can drift, so we coerce defensively before insert.
function coerceFunnelStage(value: unknown): "top" | "middle" | "bottom" {
    const v = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (v === "top" || v === "middle" || v === "bottom") return v;
    return "middle";
}

export async function runSeoStrategistAnalysis(localeInput?: string | null): Promise<RunSeoStrategistAnalysisResult> {
    const context = await assertWorkspaceAiEnabled();
    const workspaceId = context.activeWorkspace.id;
    // Same rationale as runSeoSpecialistAudit — gate before any AI cost.
    const rate = await checkAiRateLimitPg(workspaceId, "seo_strategist_analysis", { maxPerWindow: 3 });
    if (!rate.allowed) {
        throw new Error(`Strategist analysis is rate limited; retry in ${rate.retryAfterSeconds}s.`);
    }
    await assertSufficientAiBalance(workspaceId);
    const locale = resolveGenerationLocale({
        requested: localeInput,
        workspaceDefault: context.activeWorkspace.default_locale,
    });
    const { data: { user } } = await (await createClient()).auth.getUser();
    const meterCtx = { workspaceId, profileId: user?.id ?? null };
    const runId = await createRun(workspaceId, "strategist_analysis", locale);

    try {
        const supabase = await createClient();
        const gscConfigured = Boolean(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL);
        const workspaceAiContext = extractThemeAiSystemContext(context.activeThemeVersion?.config ?? {});
        const [inventory, analytics, platformCopyContext, gscSummaries] = await Promise.all([
            fetchPublishedInventory(workspaceId, locale),
            fetchAnalyticsSignals(workspaceId),
            getPlatformCopyContext(workspaceAiContext),
            fetchFreshSearchConsoleQuerySignals(workspaceId, locale),
        ]);
        const inventoryContext = buildStrategistInventoryContext(inventory, analytics);
        const latestGscDate = gscSummaries.reduce<string | null>(
            (latest, signal) => !latest || signal.max_date > latest ? signal.max_date : latest,
            null,
        );
        const buildEvidence = (value: string) => {
            const signal = findMatchingSearchConsoleSignal(value, gscSummaries);
            return {
                gscWindowDays: 30,
                gscSignalCount: gscSummaries.length,
                gscFreshThrough: latestGscDate,
                publishedInventoryCount: inventory.length,
                detailedInventoryCount: inventoryContext.detailedCount,
                ...(signal ? {
                    gsc: {
                        provenance: "gsc_raw_30d_locale_aggregate",
                        page_slug: signal.page_slug,
                        query: signal.query,
                        impressions: signal.total_impressions,
                        clicks: signal.total_clicks,
                        ctr: signal.avg_ctr,
                        position: signal.avg_position,
                        min_date: signal.min_date,
                        max_date: signal.max_date,
                    },
                } : {}),
            };
        };
        const aiContext = extractThemeAiSystemContext(context.activeThemeVersion?.config ?? {});
        const aiOutput = await runWithWorkspaceAiConfig(workspaceId, () =>
            maybeGenerateStrategicAiOutput({
                workspaceName: context.activeWorkspace.name,
                aiContext,
                platformCopyContext,
                inventory,
                analytics,
                locale,
                meterCtx,
                gscSummaries,
            })
        );
        const output = aiOutput ?? buildFallbackStrategicOutput(inventory, analytics, gscSummaries);

        // Single diagnostic line that disambiguates "empty AI/fallback output" from
        // "RLS-rejected inserts" without needing to open the database.
        console.log("[seo:strategist] proposed output", {
            workspaceId,
            runId,
            source: aiOutput ? "ai" : "fallback",
            inventoryCount: inventory.length,
            analyticsCount: analytics.length,
            gscSignalCount: gscSummaries.length,
            gscConfigured,
            clusters: output.clusters.length,
            plans: output.plans.length,
            opportunities: output.opportunities.length,
        });

        let firstError: string | null = null;
        const captureError = (where: string, error: { message?: string | null } | null) => {
            if (!error) return;
            console.error(`[seo:strategist] ${where} failed`, { runId, workspaceId, error });
            if (!firstError) firstError = error.message ?? `${where} failed`;
        };

        const insertedClusters: SeoTopicClusterRecord[] = [];
        let skippedClusterErrors = 0;
        for (const cluster of output.clusters.slice(0, 8)) {
            const { data, error } = await supabase.from("seo_topic_clusters").insert({
                workspace_id: workspaceId,
                run_id: runId,
                locale,
                status: "draft",
                name: cluster.name,
                pillar_topic: cluster.pillarTopic,
                summary: cluster.summary,
                primary_intent: cluster.primaryIntent,
                funnel_stage: coerceFunnelStage(cluster.funnelStage),
                target_conversion_goal: cluster.targetConversionGoal ?? null,
                priority_score: cluster.priorityScore,
                supporting_topics: cluster.supportingTopics,
                metadata: {
                    source: aiOutput ? "ai" : "fallback",
                    evidence: buildEvidence(`${cluster.pillarTopic} ${cluster.primaryIntent}`),
                },
            }).select("*").single();
            if (!error && data) {
                insertedClusters.push(data as SeoTopicClusterRecord);
            } else {
                skippedClusterErrors += 1;
                captureError("cluster insert", error);
            }
        }

        const clusterByName = new Map(insertedClusters.map((cluster) => [cluster.name.toLowerCase(), cluster]));
        const insertedPlans: SeoContentPlanRecord[] = [];
        let skippedPlanErrors = 0;
        for (const plan of output.plans.slice(0, 12)) {
            const cluster = plan.clusterName ? clusterByName.get(plan.clusterName.toLowerCase()) : null;
            const { data, error } = await supabase.from("seo_content_plans").insert({
                workspace_id: workspaceId,
                run_id: runId,
                cluster_id: cluster?.id ?? null,
                locale,
                status: "draft",
                title: plan.title,
                slug_suggestion: plan.slugSuggestion,
                primary_keyword: plan.primaryKeyword,
                secondary_keywords: plan.secondaryKeywords,
                intent_stage: plan.intentStage,
                funnel_stage: coerceFunnelStage(plan.funnelStage),
                target_conversion_goal: plan.targetConversionGoal ?? null,
                brief_markdown: plan.briefMarkdown,
                outline: plan.outline,
                priority_score: plan.priorityScore,
                metadata: {
                    source: aiOutput ? "ai" : "fallback",
                    evidence: buildEvidence(`${plan.primaryKeyword} ${plan.title}`),
                },
            }).select("*").single();
            if (!error && data) {
                insertedPlans.push(data as SeoContentPlanRecord);
            } else {
                skippedPlanErrors += 1;
                captureError("plan insert", error);
            }
        }

        const planByClusterName = new Map<string, SeoContentPlanRecord>();
        for (const plan of insertedPlans) {
            const cluster = insertedClusters.find((entry) => entry.id === plan.cluster_id);
            if (cluster) {
                planByClusterName.set(cluster.name.toLowerCase(), plan);
            }
        }

        let insertedOpportunities = 0;
        let skippedOpportunityErrors = 0;
        for (const opportunity of output.opportunities.slice(0, 12)) {
            const cluster = clusterByName.get(opportunity.clusterName.toLowerCase()) ?? null;
            const plan = planByClusterName.get(opportunity.clusterName.toLowerCase()) ?? null;
            const { data, error } = await supabase.from("seo_content_opportunities").insert({
                workspace_id: workspaceId,
                run_id: runId,
                cluster_id: cluster?.id ?? null,
                plan_id: plan?.id ?? null,
                locale,
                status: "pending",
                opportunity_type: opportunity.targetConversionGoal ? "conversion_support" : "blue_ocean",
                title: opportunity.title,
                topic: opportunity.topic,
                summary: opportunity.summary,
                rationale: opportunity.rationale,
                cluster_name: opportunity.clusterName,
                recommended_format: opportunity.recommendedFormat,
                target_intent: opportunity.targetIntent,
                funnel_stage: coerceFunnelStage(opportunity.funnelStage),
                target_conversion_goal: opportunity.targetConversionGoal ?? null,
                blue_ocean_score: opportunity.blueOceanScore,
                analytics_score: opportunity.analyticsScore,
                strategic_importance_score: opportunity.strategicImportanceScore,
                priority_score: opportunity.priorityScore,
                analytics_snapshot: {
                    topPages: analytics.slice(0, 5),
                    gscSignalCount: gscSummaries.length,
                    gscFreshThrough: latestGscDate,
                },
                inventory_snapshot: {
                    publishedCount: inventory.length,
                    countsByType: inventoryContext.countsByType,
                    detailedCoverageCount: inventoryContext.detailedCount,
                },
                metadata: {
                    source: aiOutput ? "ai" : "fallback",
                    evidence: buildEvidence(`${opportunity.topic} ${opportunity.title}`),
                },
            }).select("id").single();
            if (!error && data) {
                insertedOpportunities += 1;
            } else {
                skippedOpportunityErrors += 1;
                captureError("opportunity insert", error);
            }
        }

        const totalInserted = insertedClusters.length + insertedPlans.length + insertedOpportunities;
        await completeRun(runId, {
            headline: `Generated ${insertedClusters.length} clusters, ${insertedPlans.length} plans, and ${insertedOpportunities} opportunities from ${inventory.length} published items and ${gscSummaries.length} fresh Search Console signals.`,
            outcome: totalInserted === 0 ? "no_output" : "ok",
        }, {
            source: aiOutput ? "ai" : "fallback",
            inventoryCount: inventory.length,
            gscSignalCount: gscSummaries.length,
            gscWindowDays: 30,
            gscFreshThrough: latestGscDate,
            gscConfigured,
            proposed: {
                clusters: output.clusters.length,
                plans: output.plans.length,
                opportunities: output.opportunities.length,
            },
            inserted: {
                clusters: insertedClusters.length,
                plans: insertedPlans.length,
                opportunities: insertedOpportunities,
            },
            skipped: {
                clusters: skippedClusterErrors,
                plans: skippedPlanErrors,
                opportunities: skippedOpportunityErrors,
            },
            firstError,
        });

        console.log("[seo:strategist] insert summary", {
            workspaceId,
            runId,
            insertedClusters: insertedClusters.length,
            insertedPlans: insertedPlans.length,
            insertedOpportunities,
            skippedClusterErrors,
            skippedPlanErrors,
            skippedOpportunityErrors,
            firstError,
        });

        revalidatePath("/dashboard/seo");
        return {
            success: true,
            runId,
            source: aiOutput ? "ai" : "fallback",
            inventoryCount: inventory.length,
            analyticsCount: analytics.length,
            gscSignalCount: gscSummaries.length,
            gscConfigured,
            proposedClusters: output.clusters.length,
            proposedPlans: output.plans.length,
            proposedOpportunities: output.opportunities.length,
            insertedClusters: insertedClusters.length,
            insertedPlans: insertedPlans.length,
            insertedOpportunities,
            skippedClusterErrors,
            skippedPlanErrors,
            skippedOpportunityErrors,
            firstError,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "SEO strategist analysis failed.";
        await completeRun(runId, {}, {}, message);
        throw error;
    }
}

// Both internal-link-opportunity and content-opportunity tables share the
// same Postgres enum (`seo_recommendation_status`), so the iteration set is
// identical. Sourcing from the canonical array means new enum values surface
// in every count-by-status badge automatically.
const SEO_LINK_STATUS_VALUES: readonly SeoRecommendationStatus[] = SEO_RECOMMENDATION_STATUS_VALUES;
const SEO_CONTENT_OPP_STATUS_VALUES: readonly SeoRecommendationStatus[] = SEO_RECOMMENDATION_STATUS_VALUES;

function clampPage(n: number | undefined): number {
    return Math.max(1, n ?? 1);
}
function clampPageSize(n: number | undefined, fallback = 25): number {
    return Math.min(100, Math.max(5, n ?? fallback));
}

function indexingLocaleForItem(item: Pick<SeoPublishedContentItem, "type" | "locale">, activeLocale: string): string {
    return item.type === "page" ? activeLocale : item.locale ?? activeLocale;
}

function indexingTypeForItem(type: string): "blog" | "page" | null {
    return type === "blog" || type === "page" ? type : null;
}

async function loadSeoIndexingDashboardRows(input: {
    workspaceId: string;
    locale: string;
    inventory: SeoPublishedContentItem[];
    // database.types.ts has not been regenerated for seo_indexing_* yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any;
}): Promise<{ rows: SeoIndexingDashboardRow[]; counts: SeoIndexingDashboardCounts }> {
    const siteUrl = getIndexingSiteUrl();
    const contentItems = input.inventory
        .map((item) => {
            const type = indexingTypeForItem(item.type);
            if (!type || !item.slug) return null;
            const canonical = buildCanonicalPublicContentUrl({
                siteUrl,
                type,
                slug: item.slug,
                locale: indexingLocaleForItem(item, input.locale),
            });
            return { item, type, canonical };
        })
        .filter((entry): entry is { item: SeoPublishedContentItem; type: "blog" | "page"; canonical: { url: string; canonicalPath: string } } => entry !== null);

    if (contentItems.length === 0) {
        return { rows: [], counts: summarizeSeoIndexingCounts([]) };
    }

    const contentIds = contentItems.map(({ item }) => item.id);
    const canonicalUrls = contentItems.map(({ canonical }) => canonical.url);
    const canonicalPaths = contentItems.map(({ canonical }) => canonical.canonicalPath);

    const jobsTable = input.supabase.from("seo_indexing_jobs" as never);
    const byContentRes = await jobsTable
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .in("content_id", contentIds)
        .order("updated_at", { ascending: false })
        .limit(1000);

    if (byContentRes.error) {
        throw new Error(byContentRes.error.message ?? "Failed to fetch indexing jobs.");
    }

    const byUrlRes = await input.supabase
        .from("seo_indexing_jobs" as never)
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .in("url", canonicalUrls)
        .order("updated_at", { ascending: false })
        .limit(1000);

    if (byUrlRes.error) {
        throw new Error(byUrlRes.error.message ?? "Failed to fetch indexing jobs by URL.");
    }

    const byPathRes = await input.supabase
        .from("seo_indexing_jobs" as never)
        .select("*")
        .eq("workspace_id", input.workspaceId)
        .in("canonical_path", canonicalPaths)
        .order("updated_at", { ascending: false })
        .limit(1000);

    if (byPathRes.error) {
        throw new Error(byPathRes.error.message ?? "Failed to fetch indexing jobs by path.");
    }

    const jobs = [...(byContentRes.data ?? []), ...(byUrlRes.data ?? []), ...(byPathRes.data ?? [])] as SeoIndexingJobRecord[];
    const latestByContentId = new Map<string, SeoIndexingJobRecord>();
    const latestByUrl = new Map<string, SeoIndexingJobRecord>();
    const latestByPath = new Map<string, SeoIndexingJobRecord>();
    for (const job of jobs) {
        if (job.content_id && !latestByContentId.has(job.content_id)) latestByContentId.set(job.content_id, job);
        if (job.url && !latestByUrl.has(job.url)) latestByUrl.set(job.url, job);
        if (job.canonical_path && !latestByPath.has(job.canonical_path)) latestByPath.set(job.canonical_path, job);
    }

    const jobIds = Array.from(new Set(jobs.map((job) => job.id)));
    let attempts: SeoIndexingAttemptRecord[] = [];
    if (jobIds.length > 0) {
        const attemptsRes = await input.supabase
            .from("seo_indexing_attempts" as never)
            .select("*")
            .eq("workspace_id", input.workspaceId)
            .in("job_id", jobIds)
            .order("created_at", { ascending: false })
            .limit(2000);

        if (attemptsRes.error) {
            throw new Error(attemptsRes.error.message ?? "Failed to fetch indexing attempts.");
        }
        attempts = (attemptsRes.data ?? []) as SeoIndexingAttemptRecord[];
    }

    const attemptsByJobId = new Map<string, SeoIndexingAttemptRecord[]>();
    for (const attempt of attempts) {
        const current = attemptsByJobId.get(attempt.job_id) ?? [];
        current.push(attempt);
        attemptsByJobId.set(attempt.job_id, current);
    }

    const rows = contentItems.map(({ item, type, canonical }) => {
        const job = latestByContentId.get(item.id) ?? latestByUrl.get(canonical.url) ?? latestByPath.get(canonical.canonicalPath) ?? null;
        const derived = deriveSeoIndexingStatus(job);
        const itemAttempts = job ? attemptsByJobId.get(job.id) ?? [] : [];

        return {
            contentId: item.id,
            title: item.title,
            slug: item.slug,
            type,
            locale: indexingLocaleForItem(item, input.locale),
            canonicalUrl: canonical.url,
            canonicalPath: canonical.canonicalPath,
            displayStatus: derived.status,
            action: derived.action,
            isPending: derived.isPending,
            needsAction: derived.needsAction,
            job,
            attempts: itemAttempts,
            latestAttempt: itemAttempts[0] ?? null,
        } satisfies SeoIndexingDashboardRow;
    });

    return {
        rows,
        counts: summarizeSeoIndexingCounts(rows.map((row) => row.displayStatus)),
    };
}

export async function getSeoDashboardData(
    query: import("@/features/seo/types").SeoDashboardQuery = {},
): Promise<SeoDashboardData> {
    const context = await getSeoWorkspaceContext();
    const workspaceId = context.activeWorkspace.id;
    const seoAutomationMode = getSeoAutomationMode(context.activeWorkspace.metadata);
    const seoAutoApplyMinAgeSeconds = getSeoAutoApplyMinAgeSeconds(context.activeWorkspace.metadata);
    const locale = resolveGenerationLocale({
        requested: query.locale,
        workspaceDefault: context.activeWorkspace.default_locale,
    });

    const supabase = await createClient();

    const [
        inventory,
        analytics,
        freshGscQuerySignals,
        gscSyncRuns,
        gscInternalLinkRes
    ] = await Promise.all([
        fetchPublishedInventory(workspaceId, locale),
        fetchAnalyticsSignals(workspaceId),
        fetchFreshSearchConsoleQuerySignals(workspaceId, locale),
        supabase.from('gsc_sync_runs').select('*').eq('workspace_id', workspaceId).order('started_at', { ascending: false }).limit(5),
        supabase
            .from("seo_internal_link_opportunities")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .not("metadata->gsc", "is", null)
            .order("updated_at", { ascending: false })
            .limit(50),
    ]);
    const searchConsoleSignals = summarizeSearchConsolePages(freshGscQuerySignals);
    const gscTopQueries = freshGscQuerySignals.slice(0, 10);
    const gscNearPageOne = freshGscQuerySignals
        .filter((signal) => signal.avg_position >= 4 && signal.avg_position <= 12 && signal.total_impressions >= 20)
        .slice(0, 10);
    const gscLowCtr = freshGscQuerySignals
        .filter((signal) => signal.total_impressions >= 20 && signal.avg_ctr <= 0.02)
        .slice(0, 10);
    const incoming = createIncomingLinkMap(inventory);
    const indexingDashboard = await loadSeoIndexingDashboardRows({
        workspaceId,
        locale,
        inventory,
        supabase,
    });

    const linksPage = clampPage(query.internalLinksPage);
    const linksSize = clampPageSize(query.internalLinksPageSize, 25);
    const contentOppsPage = clampPage(query.contentOppsPage);
    const contentOppsSize = clampPageSize(query.contentOppsPageSize, 25);
    const clustersPage = clampPage(query.clustersPage);
    const clustersSize = clampPageSize(query.clustersPageSize, 20);
    const plansPage = clampPage(query.plansPage);
    const plansSize = clampPageSize(query.plansPageSize, 25);

    const applyTextFilter = <T extends { or?: (clause: string) => T }>(
        builder: T,
        term: string | undefined,
        columns: string[],
    ): T => {
        if (!term || !term.trim() || !builder.or) return builder;
        const safe = term.trim().replace(/[%_]/g, "\\$&");
        const clause = columns.map((c) => `${c}.ilike.%${safe}%`).join(",");
        return builder.or(clause) as T;
    };

    let linkBuilder = (supabase.from("seo_internal_link_opportunities") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("locale", locale);
    if (query.internalLinksStatuses && query.internalLinksStatuses.length > 0) {
        linkBuilder = linkBuilder.in("status", query.internalLinksStatuses);
    }
    linkBuilder = applyTextFilter(linkBuilder, query.internalLinksSearch, [
        "source_title",
        "target_title",
        "anchor_text",
        "rationale",
    ]);

    let contentOppBuilder = (supabase.from("seo_content_opportunities") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("locale", locale);
    if (query.contentOppsStatuses && query.contentOppsStatuses.length > 0) {
        contentOppBuilder = contentOppBuilder.in("status", query.contentOppsStatuses);
    }
    contentOppBuilder = applyTextFilter(contentOppBuilder, query.contentOppsSearch, [
        "title",
        "summary",
        "rationale",
        "cluster_name",
    ]);

    const clusterBuilder = (supabase.from("seo_topic_clusters") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("locale", locale);

    let planBuilder = (supabase.from("seo_content_plans") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("*", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("locale", locale);
    if (query.plansStatuses && query.plansStatuses.length > 0) {
        planBuilder = planBuilder.in("status", query.plansStatuses);
    }
    planBuilder = applyTextFilter(planBuilder, query.plansSearch, [
        "title",
        "primary_keyword",
        "slug_suggestion",
        "brief_markdown",
    ]);

    // Status counts are scoped to the active locale so the dashboard
    // overview badges match the lists below them. A workspace running
    // both EN and NL strategy passes will see different totals depending
    // on which locale is active.
    const countLinkStatus = async (status: string) => {
        const res = await (supabase.from("seo_internal_link_opportunities") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                eq: (c: string, v: string) => any;
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const countContentOppStatus = async (status: string) => {
        const res = await (supabase.from("seo_content_opportunities") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                eq: (c: string, v: string) => any;
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const countPlanStatus = async (status: string) => {
        const res = await (supabase.from("seo_content_plans") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                eq: (c: string, v: string) => any;
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const [
        linkRes,
        opportunityRes,
        clusterRes,
        planRes,
        runRes,
        jobRes,
        executionRes,
        linkApprovedRes,
        planSavedRes,
        linkStatusCountEntries,
        contentOppStatusCountEntries,
        planStatusCountEntries,
    ] = await Promise.all([
        linkBuilder
            .order("priority_score", { ascending: false })
            .range((linksPage - 1) * linksSize, linksPage * linksSize - 1),
        contentOppBuilder
            .order("priority_score", { ascending: false })
            .range((contentOppsPage - 1) * contentOppsSize, contentOppsPage * contentOppsSize - 1),
        clusterBuilder
            .order("priority_score", { ascending: false })
            .range((clustersPage - 1) * clustersSize, clustersPage * clustersSize - 1),
        planBuilder
            .order("priority_score", { ascending: false })
            .range((plansPage - 1) * plansSize, plansPage * plansSize - 1),
        supabase
            .from("seo_recommendation_runs")
            .select("id,workspace_id,run_type,status,summary,totals,error_message,created_at,completed_at,locale")
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .order("created_at", { ascending: false })
            .limit(12),
        supabase
            .from("seo_internal_link_jobs")
            .select("id,workspace_id,content_id,locale,status,summary,cost_summary_millicents,error_message,completed_at,created_at,updated_at")
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .order("created_at", { ascending: false })
            .limit(12),
        supabase
            .from("seo_execution_events")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(250),
        supabase
            .from("seo_internal_link_opportunities")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .eq("status", "approved"),
        supabase
            .from("seo_content_plans")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("locale", locale)
            .in("status", ["saved", "approved", "in_progress"]),
        Promise.all(SEO_LINK_STATUS_VALUES.map(countLinkStatus)),
        Promise.all(SEO_CONTENT_OPP_STATUS_VALUES.map(countContentOppStatus)),
        Promise.all(SEO_PLAN_STATUS_VALUES.map(countPlanStatus)),
    ]);

    const internalLinkOpportunities = (linkRes.data ?? []) as SeoInternalLinkOpportunityRecord[];
    const contentOpportunities = (opportunityRes.data ?? []) as SeoContentOpportunityRecord[];
    const topicClusters = (clusterRes.data ?? []) as SeoTopicClusterRecord[];
    const contentPlans = (planRes.data ?? []) as SeoContentPlanRecord[];
    const executionEvents = (executionRes.data ?? []) as SeoExecutionEventRecord[];
    const runs = (runRes.data ?? []) as SeoRunRecord[];
    const internalLinkJobs = (jobRes.data ?? []) as SeoInternalLinkJobRecord[];
    const analyticsMap = normalizeAnalyticsMap(analytics);

    const internalLinkStatusCounts: Record<string, number> = {};
    for (const row of linkStatusCountEntries) internalLinkStatusCounts[row.status] = row.count;
    const contentOpportunityStatusCounts: Record<string, number> = {};
    for (const row of contentOppStatusCountEntries) contentOpportunityStatusCounts[row.status] = row.count;
    const contentPlanStatusCounts: Record<string, number> = {};
    for (const row of planStatusCountEntries) contentPlanStatusCounts[row.status] = row.count;

    const internalLinkTotal = linkRes.count ?? internalLinkOpportunities.length;
    const contentOppTotal = opportunityRes.count ?? contentOpportunities.length;
    const clustersTotal = clusterRes.count ?? topicClusters.length;
    const plansTotal = planRes.count ?? contentPlans.length;

    const orphanContent: SeoOrphanContentItem[] = inventory
        .filter((item) => (incoming.get(item.id) ?? 0) === 0)
        .map((item) => ({
            id: item.id,
            title: item.title,
            slug: item.slug,
            type: item.type,
            incomingLinks: incoming.get(item.id) ?? 0,
            pageViews: analyticsMap.get(item.slug)?.pageViews ?? 0,
            conversions: analyticsMap.get(item.slug)?.conversions ?? 0,
            conversionGoal: item.conversionGoal,
        }))
        .sort((a, b) => (b.pageViews + b.conversions * 10) - (a.pageViews + a.conversions * 10));

    return {
        workspace: {
            id: workspaceId,
            name: context.activeWorkspace.name,
            workspaceTier: context.activeWorkspace.workspace_tier,
            defaultLocale: context.activeWorkspace.default_locale,
            seoAutomationMode,
            seoAutoApplyMinAgeSeconds,
        },
        activeLocale: locale,
        overview: {
            publishedCount: inventory.length,
            orphanCount: orphanContent.length,
            internalLinkOpportunityCount: internalLinkTotal,
            openLinkOpportunityCount:
                (internalLinkStatusCounts["pending"] ?? 0) +
                (internalLinkStatusCounts["approved"] ?? 0) +
                (internalLinkStatusCounts["ready_to_apply"] ?? 0),
            approvedLinkOpportunityCount: linkApprovedRes.count ?? internalLinkOpportunities.filter((item) => item.status === "approved").length,
            strategistOpportunityCount: contentOppTotal,
            savedPlanCount: planSavedRes.count ?? contentPlans.filter((item) => item.status === "saved" || item.status === "approved" || item.status === "in_progress").length,
            averagePriorityScore: safeAverage([
                ...internalLinkOpportunities.map((item) => Number(item.priority_score)),
                ...contentOpportunities.map((item) => Number(item.priority_score)),
            ]),
            totalPageViews: analytics.reduce((sum, row) => sum + row.pageViews, 0),
            totalConversions: analytics.reduce((sum, row) => sum + row.conversions, 0),
        },
        inventory,
        analytics,
        searchConsoleSignals,
        gscSyncRuns: gscSyncRuns.data ?? [],
        gscTopQueries,
        gscNearPageOne,
        gscLowCtr,
        gscInternalLinkOpportunities: (gscInternalLinkRes.data ?? []) as SeoInternalLinkOpportunityRecord[],
        orphanContent,
        internalLinkOpportunities,
        internalLinkOpportunitiesPage: { page: linksPage, pageSize: linksSize, total: internalLinkTotal },
        internalLinkStatusCounts,
        contentOpportunities,
        contentOpportunitiesPage: { page: contentOppsPage, pageSize: contentOppsSize, total: contentOppTotal },
        contentOpportunityStatusCounts,
        topicClusters,
        topicClustersPage: { page: clustersPage, pageSize: clustersSize, total: clustersTotal },
        contentPlans,
        contentPlansPage: { page: plansPage, pageSize: plansSize, total: plansTotal },
        contentPlanStatusCounts,
        executionEvents,
        runs,
        internalLinkJobs,
        indexingRows: indexingDashboard.rows,
        indexingCounts: indexingDashboard.counts,
    };
}

export async function getSeoPendingSummary(localeInput?: string | null): Promise<{ internalLinks: number; contentOpportunities: number; error: string | null }> {
    try {
        const context = await getSeoWorkspaceContext();
        const supabase = await createClient();
        const workspaceId = context.activeWorkspace.id;
        // The SEO dashboard is locale-scoped (en/nl/ar); the badge that
        // surfaces these counts must match what the operator actually sees
        // there. Without this filter the badge aggregates across locales,
        // making it disagree with the in-page lists.
        const locale = resolveGenerationLocale({
            requested: localeInput,
            workspaceDefault: context.activeWorkspace.default_locale,
        });

        const [linksResult, contentResult] = await Promise.all([
            supabase
                .from("seo_internal_link_opportunities")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .eq("locale", locale)
                .eq("status", "pending"),
            supabase
                .from("seo_content_opportunities")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .eq("locale", locale)
                .eq("status", "pending"),
        ]);

        if (linksResult.error || contentResult.error) {
            const message = linksResult.error?.message ?? contentResult.error?.message ?? "Unknown Supabase error.";
            console.error("[seo] getSeoPendingSummary query failed:", message);
            return { internalLinks: 0, contentOpportunities: 0, error: message };
        }

        return {
            internalLinks: linksResult.count ?? 0,
            contentOpportunities: contentResult.count ?? 0,
            error: null,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        console.error("[seo] getSeoPendingSummary threw:", error);
        return { internalLinks: 0, contentOpportunities: 0, error: message };
    }
}

async function setInternalLinkOpportunityStatus(id: string, status: string) {
    // Status mutations are write operations regardless of target value.
    // The previous read-tier branch let read-only members flip rows to
    // pending/applying/failed without write capability.
    const { context, supabase } = await requireSeoExecutionAccess("write");
    const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    };
    if (status === "approved") updates.approved_at = new Date().toISOString();
    if (status === "dismissed") updates.dismissed_at = new Date().toISOString();
    if (status === "pending") {
        updates.manual_review_reason = null;
        updates.failed_reason = null;
    }
    const { error } = await supabase.from("seo_internal_link_opportunities").update(updates).eq("id", id).eq("workspace_id", context.activeWorkspace.id);
    if (error) throw new Error(error.message ?? "Failed to update internal link opportunity status.");
    revalidatePath("/dashboard/seo");

    return { ok: true as const, status };
}

export async function setContentOpportunityStatus(id: string, status: string): Promise<{ draftId: string | null }> {
    // Mutating an opportunity's status writes to seo_content_opportunities;
    // it must be gated on `content.write`, matching the link-opportunity
    // path and preventing read-only members from advancing rows.
    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    // Just update the status. The placeholder draft is no longer auto-created on approve;
    // /api/generate-draft creates the content_item when the operator clicks Generate
    // on the prefilled draft generator screen, and back-links it via opportunity_id.
    const { data: existing, error: fetchError } = await supabase
        .from("seo_content_opportunities")
        .select("id,draft_content_item_id")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .single();
    if (fetchError || !existing) {
        throw new Error(fetchError?.message ?? "Opportunity not found for this workspace.");
    }

    const { error } = await supabase
        .from("seo_content_opportunities")
        .update({ status })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message ?? "Failed to update content opportunity status.");

    revalidatePath("/dashboard/seo");
    return { draftId: existing.draft_content_item_id ?? null };
}

async function setContentPlanStatus(id: string, status: string): Promise<{ draftId: string | null }> {
    // Plan-status mutations write to seo_content_plans — gate on content.write.
    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: existing, error: fetchError } = await supabase
        .from("seo_content_plans")
        .select("id,draft_content_item_id")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .single();
    if (fetchError || !existing) {
        throw new Error(fetchError?.message ?? "Plan not found for this workspace.");
    }

    const { error } = await supabase
        .from("seo_content_plans")
        .update({ status })
        .eq("id", id)
        .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message ?? "Failed to update content plan status.");

    revalidatePath("/dashboard/seo");
    return { draftId: existing.draft_content_item_id ?? null };
}

async function spawnSeoContentPlansFromCluster(clusterId: string): Promise<{ created: number; planIds: string[] }> {
    // Spawning plans inserts into seo_content_plans — gate on content.write.
    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: cluster, error: clusterError } = await supabase
        .from("seo_topic_clusters")
        .select("id,workspace_id,name,pillar_topic,summary,primary_intent,funnel_stage,target_conversion_goal,priority_score,supporting_topics,locale")
        .eq("id", clusterId)
        .eq("workspace_id", workspaceId)
        .single();
    if (clusterError || !cluster) {
        throw new Error(clusterError?.message ?? "Cluster not found for this workspace.");
    }

    const rawTopics = Array.isArray(cluster.supporting_topics) ? cluster.supporting_topics : [];
    const supportingTopics = rawTopics
        .map((entry) => {
            if (typeof entry === "string") return { title: entry, keyword: entry };
            if (entry && typeof entry === "object") {
                const record = entry as { title?: unknown; topic?: unknown; keyword?: unknown; intent?: unknown };
                const title = typeof record.title === "string"
                    ? record.title
                    : typeof record.topic === "string"
                        ? record.topic
                        : null;
                const keyword = typeof record.keyword === "string"
                    ? record.keyword
                    : title;
                if (title) return { title, keyword: keyword ?? title };
            }
            return null;
        })
        .filter((item): item is { title: string; keyword: string } => Boolean(item));

    if (supportingTopics.length === 0) {
        return { created: 0, planIds: [] };
    }

    const existingRows = await supabase
        .from("seo_content_plans")
        .select("title")
        .eq("workspace_id", workspaceId)
        .eq("cluster_id", clusterId);
    const existingTitles = new Set((existingRows.data ?? []).map((row) => row.title.trim().toLowerCase()));

    const newRows = supportingTopics
        .filter((topic) => !existingTitles.has(topic.title.trim().toLowerCase()))
        .map((topic) => ({
            workspace_id: workspaceId,
            cluster_id: clusterId,
            // Spawned plans inherit the cluster's locale. Cluster-language and
            // plan-language must match: the cluster name + supporting topics
            // are written in this language, and the plan brief that grows
            // from them needs to stay in the same language.
            locale: cluster.locale,
            status: "draft" as const,
            title: topic.title,
            slug_suggestion: topic.title
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .slice(0, 80),
            primary_keyword: topic.keyword,
            secondary_keywords: [],
            intent_stage: cluster.primary_intent ?? null,
            funnel_stage: cluster.funnel_stage ?? null,
            target_conversion_goal: cluster.target_conversion_goal ?? null,
            brief_markdown: `Part of the "${cluster.name}" cluster. Supports the pillar topic: ${cluster.pillar_topic ?? "—"}.\n\n${cluster.summary ?? ""}`.trim(),
            outline: [],
            priority_score: cluster.priority_score ?? 0,
            metadata: { source: "cluster_spawn", clusterId, clusterName: cluster.name },
        }));

    if (newRows.length === 0) {
        return { created: 0, planIds: [] };
    }

    const { data: inserted, error: insertError } = await supabase
        .from("seo_content_plans")
        .insert(newRows)
        .select("id");
    if (insertError) {
        throw new Error(insertError.message ?? "Failed to spawn plans from cluster.");
    }

    revalidatePath("/dashboard/seo");
    return { created: inserted?.length ?? 0, planIds: (inserted ?? []).map((row) => row.id) };
}

export async function runSeoSpecialistAuditAction(locale?: string | null) {
    await runSeoSpecialistAudit(locale);
    // The locale lives in the URL ahead of this redirect (set by the picker
    // navigation in SeoAiActionBar). Carry it through here so the post-run
    // landing page renders the same locale view the user just ran against.
    const params = new URLSearchParams({ tab: "specialist" });
    if (locale) params.set("locale", locale);
    redirect(`/dashboard/seo?${params.toString()}`);
}

export async function enqueueAllPublishedContentJobsAction(localeInput?: string | null): Promise<{ enqueuedCount: number }> {
    const context = await assertWorkspaceAiEnabled();
    const workspaceId = context.activeWorkspace.id;
    const locale = resolveGenerationLocale({
        requested: localeInput,
        workspaceDefault: context.activeWorkspace.default_locale,
    });

    const supabase = await createClient();
    const { data: posts, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "published")
        .eq("type", "blog")
        .eq("locale", locale);

    if (error) {
        throw new Error(error.message ?? "Failed to fetch published blog posts.");
    }

    if (!posts || posts.length === 0) {
        return { enqueuedCount: 0 };
    }

    let enqueuedCount = 0;
    for (const post of posts) {
        const result = await enqueueInternalLinkJobForPublishedContent({
            workspaceId: post.workspace_id,
            templateId: post.template_id,
            contentId: post.id,
            locale: post.locale,
            title: post.title,
            slug: post.slug,
            contentMarkdown: post.content_markdown,
            visualLayout: post.visual_layout as Json,
            metadata: post.metadata as Json,
            forceRequeue: true,
        });
        if (result.status === "queued" || result.status === "reactivated") {
            enqueuedCount++;
        }
    }

    revalidatePath("/dashboard/seo");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/inbox");

    if (enqueuedCount > 0) {
        after(async () => {
            const workerId = `next-bg-${Date.now()}`;
            console.log(`[seo-bg-worker] Starting background job drainer: ${workerId}`);
            let consecutiveFailures = 0;
            while (true) {
                try {
                    const result = await processNextInternalLinkJob(workerId);
                    if (!result.success) {
                        if (result.message === "No queued jobs found.") break;
                        consecutiveFailures++;
                        console.warn(`[seo-bg-worker] Job skipped/failed: ${result.message}`);
                        if (consecutiveFailures > 5) {
                            console.error(`[seo-bg-worker] Too many consecutive failures. Exiting drainer.`);
                            break;
                        }
                    } else {
                        consecutiveFailures = 0; // Reset on success
                        console.log(`[seo-bg-worker] Successfully processed job: ${result.jobId}`);
                    }
                } catch (err) {
                    console.error("[seo-bg-worker] Drainer loop crashed:", err);
                    break;
                }
            }
            console.log(`[seo-bg-worker] Finished draining jobs.`);
        });
    }

    return { enqueuedCount };
}

function formString(formData: FormData, key: string): string | null {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function queueSeoIndexingJobAction(formData: FormData): Promise<void> {
    const context = await assertWorkspaceAiEnabled();
    const workspaceId = context.activeWorkspace.id;
    const requestedLocale = resolveGenerationLocale({
        requested: formString(formData, "locale"),
        workspaceDefault: context.activeWorkspace.default_locale,
    });
    const contentId = formString(formData, "contentId");
    if (!contentId) {
        throw new Error("Content ID is required.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("content_items")
        .select("id,workspace_id,type,status,slug,locale")
        .eq("workspace_id", workspaceId)
        .eq("id", contentId)
        .eq("status", "published")
        .in("type", ["blog", "page"])
        .maybeSingle();

    if (error) {
        throw new Error(error.message ?? "Failed to load published content for indexing.");
    }
    if (!data) {
        throw new Error("Published page or blog post was not found in this workspace.");
    }

    const type = indexingTypeForItem(data.type);
    if (!type) {
        throw new Error("Only published pages and blog posts can be queued for indexing.");
    }

    const result = await enqueueContentIndexingJob({
        workspaceId,
        contentId: data.id,
        type,
        slug: data.slug,
        locale: type === "page" ? requestedLocale : data.locale ?? requestedLocale,
        sourceEvent: "manual",
        supabase,
    });

    if (result.error) {
        throw new Error(result.error);
    }

    revalidatePath("/dashboard/seo");
}

export async function queueAllSeoIndexingJobsAction(formData: FormData): Promise<void> {
    const context = await assertWorkspaceAiEnabled();
    const workspaceId = context.activeWorkspace.id;
    const locale = resolveGenerationLocale({
        requested: formString(formData, "locale"),
        workspaceDefault: context.activeWorkspace.default_locale,
    });
    const supabase = await createClient();
    const inventory = await fetchPublishedInventory(workspaceId, locale);
    const dashboard = await loadSeoIndexingDashboardRows({
        workspaceId,
        locale,
        inventory,
        supabase,
    });

    let queuedCount = 0;
    const failures: string[] = [];
    for (const row of dashboard.rows.filter((item) => item.needsAction)) {
        const result = await enqueueContentIndexingJob({
            workspaceId,
            contentId: row.contentId,
            type: row.type,
            slug: row.slug,
            locale: row.locale ?? locale,
            sourceEvent: "manual",
            supabase,
        });

        if (result.error) {
            failures.push(`${row.canonicalPath}: ${result.error}`);
        } else {
            queuedCount += 1;
        }
    }

    if (failures.length > 0) {
        console.warn("[seo:indexing] Some indexing jobs were not queued:", failures);
        if (queuedCount === 0) {
            throw new Error(failures[0] ?? "No indexing jobs were queued.");
        }
    }

    revalidatePath("/dashboard/seo");
}

export async function runSeoStrategistAnalysisAction(locale?: string | null) {
    let result: RunSeoStrategistAnalysisResult | null = null;
    let runError: string | null = null;
    try {
        result = await runSeoStrategistAnalysis(locale);
    } catch (err) {
        runError = err instanceof Error ? err.message : "SEO strategist analysis failed.";
    }
    const params = new URLSearchParams({ tab: "strategist" });
    if (locale) params.set("locale", locale);
    if (runError) {
        params.set("strategistRun", "error");
        params.set("strategistError", runError.slice(0, 200));
    } else if (result) {
        const total = result.insertedClusters + result.insertedPlans + result.insertedOpportunities;
        params.set("strategistRun", total > 0 ? "ok" : "empty");
        params.set("strategistSource", result.source);
        params.set("strategistInventory", String(result.inventoryCount));
        params.set("strategistGsc", String(result.gscSignalCount));
        params.set("strategistGscConfigured", result.gscConfigured ? "1" : "0");
        params.set("strategistInserted", `${result.insertedClusters}/${result.insertedPlans}/${result.insertedOpportunities}`);
        params.set("strategistProposed", `${result.proposedClusters}/${result.proposedPlans}/${result.proposedOpportunities}`);
        if (result.firstError) {
            params.set("strategistError", result.firstError.slice(0, 200));
        }
    }
    redirect(`/dashboard/seo?${params.toString()}`);
}

export async function updateSeoInternalLinkOpportunityStatus(id: string, status: string) {
    return setInternalLinkOpportunityStatus(id, status);
}

// Detects "target was unpublished / deleted / missing slug" errors raised by
// getSeoExecutionDependencies and converts them into a stable
// manual_review_required state on the opportunity so it stops being a
// dead-end apply attempt.
function isOrphanTargetError(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    const msg = error.message;
    if (msg.includes("Target content item not found")) return "Target content was deleted. Internal link cannot be applied.";
    if (/^Target content ".*" is .+\. Internal link would resolve to a 404\.$/.test(msg)) return msg;
    if (/^Target content ".*" has no slug\./.test(msg)) return msg;
    return null;
}

async function markOpportunityOrphaned(recommendationId: string, workspaceId: string, reason: string) {
    const supabase = await createClient();
    await supabase
        .from("seo_internal_link_opportunities")
        .update({
            status: "manual_review_required",
            manual_review_reason: reason,
            updated_at: new Date().toISOString(),
        })
        .eq("id", recommendationId)
        .eq("workspace_id", workspaceId);
    revalidatePath("/dashboard/seo");
    revalidatePath("/dashboard/opportunities");
}

export async function generateSeoExecutionPreview(recommendationId: string): Promise<SeoExecutionActionResult> {
    const { context, supabase } = await requireSeoExecutionAccess("read");
    const workspaceId = context.activeWorkspace.id;

    let recommendation;
    try {
        ({ recommendation } = await getSeoExecutionDependencies(workspaceId, recommendationId));
    } catch (err) {
        const orphanReason = isOrphanTargetError(err);
        if (orphanReason) {
            await markOpportunityOrphaned(recommendationId, workspaceId, orphanReason);
            return { ok: false, message: orphanReason, recommendationStatus: "manual_review_required" };
        }
        throw err;
    }

    if (!["approved", "ready_to_apply", "manual_review_required", "failed"].includes(recommendation.status)) {
        throw new Error("Approve the recommendation before generating an execution preview.");
    }

    let preview;
    try {
        preview = await runWithWorkspaceAiConfig(workspaceId, () =>
            createSeoExecutionPreview(workspaceId, recommendationId, {
                // Inherit the recommendation's locale, not the workspace default.
                // The mutation engine uses this to pick the LocaleField sub-key
                // inside visual_layout JSONB — wrong locale → wrong field path.
                workspaceLocale: recommendation.locale,
                automationMode: getSeoAutomationMode(context.activeWorkspace.metadata),
            })
        );
    } catch (err) {
        const orphanReason = isOrphanTargetError(err);
        if (orphanReason) {
            await markOpportunityOrphaned(recommendationId, workspaceId, orphanReason);
            return { ok: false, message: orphanReason, recommendationStatus: "manual_review_required" };
        }
        throw err;
    }
    const nextStatus = preview.supported ? "ready_to_apply" : "manual_review_required";

    const { error } = await supabase
        .from("seo_internal_link_opportunities")
        .update({
            status: nextStatus,
            last_preview_at: new Date().toISOString(),
            last_preview_payload: preview as unknown as Json,
            manual_review_reason: preview.manualReviewReason,
            failed_reason: null,
            failed_at: null,
        })
        .eq("id", recommendationId)
        .eq("workspace_id", workspaceId);

    if (error) {
        throw new Error(error.message ?? "Failed to persist SEO execution preview.");
    }

    await persistSeoExecutionEvent({
        workspaceId,
        recommendation,
        preview,
        executionStatus: preview.supported ? "previewed" : "manual_review_required",
    });

    revalidatePath("/dashboard/seo");

    return {
        ok: true,
        message: preview.supported
            ? `Execution preview generated for block ${preview.blockId ?? "unknown"} at ${preview.fieldPath ?? "unknown field"}.`
            : "Automatic execution was blocked. The mutation engine could not produce a safe edit for any candidate field on this page. Review the block-level diagnostics in the recommendation card for the specific reason.",
        preview,
        recommendationStatus: nextStatus,
    };
}

export async function applySeoInternalLinkRecommendation(recommendationId: string): Promise<SeoExecutionActionResult> {
    const { context, userId, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    let recommendation;
    let sourceContent;
    try {
        ({ recommendation, sourceContent } = await getSeoExecutionDependencies(workspaceId, recommendationId));
    } catch (err) {
        const orphanReason = isOrphanTargetError(err);
        if (orphanReason) {
            await markOpportunityOrphaned(recommendationId, workspaceId, orphanReason);
            return { ok: false, message: orphanReason, recommendationStatus: "manual_review_required" };
        }
        throw err;
    }

    if (!["approved", "ready_to_apply", "manual_review_required", "failed"].includes(recommendation.status)) {
        throw new Error("Only approved recommendations can be applied.");
    }

    // Atomic compare-and-swap guard against concurrent apply. If another
    // caller has already flipped this row to "applying" / "applied" we get
    // zero rows back and abort before mutating the source content.
    const previousStatus = recommendation.status;
    const { data: claimed, error: claimError } = await supabase
        .from("seo_internal_link_opportunities")
        .update({ status: "applying", updated_at: new Date().toISOString() })
        .eq("id", recommendationId)
        .eq("workspace_id", workspaceId)
        .in("status", ["approved", "ready_to_apply", "manual_review_required", "failed"])
        .select("id");

    if (claimError) {
        throw new Error(claimError.message ?? "Failed to claim recommendation for apply.");
    }

    if (!claimed || claimed.length === 0) {
        return {
            ok: false,
            message: "This recommendation is already being applied by another session.",
            recommendationStatus: "applying",
        };
    }

    const releaseClaim = async (nextStatus: string) => {
        await supabase
            .from("seo_internal_link_opportunities")
            .update({ status: nextStatus, updated_at: new Date().toISOString() })
            .eq("id", recommendationId)
            .eq("workspace_id", workspaceId)
            .eq("status", "applying");
    };

    let preview;
    try {
        preview = await runWithWorkspaceAiConfig(workspaceId, () =>
            createSeoExecutionPreview(workspaceId, recommendationId, {
                // Same as the preview path: locale comes from the recommendation,
                // not the workspace default — the row's source/target are bound
                // to a single content language and the mutation must follow it.
                workspaceLocale: recommendation.locale,
                automationMode: getSeoAutomationMode(context.activeWorkspace.metadata),
            })
        );
    } catch (err) {
        const orphanReason = isOrphanTargetError(err);
        if (orphanReason) {
            await markOpportunityOrphaned(recommendationId, workspaceId, orphanReason);
            return { ok: false, message: orphanReason, recommendationStatus: "manual_review_required" };
        }
        await releaseClaim(previousStatus);
        throw err;
    }

    if (!preview.supported || !preview.updatedContent) {
        await supabase
            .from("seo_internal_link_opportunities")
            .update({
                status: "manual_review_required",
                last_preview_at: new Date().toISOString(),
                last_preview_payload: preview as unknown as Json,
                manual_review_reason: preview.manualReviewReason,
            })
            .eq("id", recommendationId)
            .eq("workspace_id", workspaceId);

        return {
            ok: false,
            message: preview.manualReviewReason ?? "Automatic execution was blocked. The mutation engine could not produce a safe edit for any candidate field on this page. Review the block-level diagnostics in the recommendation card for the specific reason.",
            preview,
            recommendationStatus: "manual_review_required",
        };
    }

    try {
        const event = await runWithWorkspaceAiConfig(workspaceId, () =>
            applySeoExecutionMutation({
                workspaceId,
                recommendation,
                sourceContent,
                preview,
                appliedByProfileId: userId,
            })
        );

        return {
            ok: true,
            message: `Internal link recommendation applied safely to ${preview.blockId ?? "the selected block"} at ${preview.fieldPath ?? "the approved field"}.`,
            preview,
            executionId: event.id,
            recommendationStatus: "applied",
        };
    } catch (error) {
        const message = getErrorMessage(error, "Failed to apply internal link recommendation.");
        const { SeoExecutionError } = await import("@/features/seo/execution");
        const errorKind = error instanceof SeoExecutionError ? error.kind : "unknown";
        const resolution = error instanceof SeoExecutionError ? error.resolution : undefined;
        await supabase
            .from("seo_internal_link_opportunities")
            .update({
                status: "failed",
                failed_at: new Date().toISOString(),
                failed_reason: message,
                last_preview_at: new Date().toISOString(),
                last_preview_payload: preview as unknown as Json,
            })
            .eq("id", recommendationId)
            .eq("workspace_id", workspaceId);

        revalidatePath("/dashboard/seo");

        return {
            ok: false,
            message,
            preview,
            recommendationStatus: "failed",
            errorKind,
            resolution,
        };
    }
}

export async function rollbackSeoInternalLinkExecution(executionId: string): Promise<SeoExecutionActionResult> {
    const { context, userId } = await requireSeoExecutionAccess("write");
    try {
        await rollbackSeoExecutionMutation({
            workspaceId: context.activeWorkspace.id,
            executionId,
            rolledBackByProfileId: userId,
        });
    } catch (error) {
        const { SeoExecutionError } = await import("@/features/seo/execution");
        revalidatePath("/dashboard/seo");
        if (error instanceof SeoExecutionError) {
            return {
                ok: false,
                message: error.message,
                executionId,
                errorKind: error.kind,
                resolution: error.resolution,
                recommendationStatus: error.kind === "conflict" ? "manual_review_required" : undefined,
            };
        }
        return {
            ok: false,
            message: getErrorMessage(error, "Failed to roll back SEO execution."),
            executionId,
            errorKind: "unknown",
        };
    }

    revalidatePath("/dashboard/seo");

    return {
        ok: true,
        message: "The SEO execution event was rolled back and the original content snapshot was restored.",
        executionId,
        recommendationStatus: "rolled_back",
    };
}

export async function updateSeoInternalLinkOpportunityStatusAction(formData: FormData) {
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "pending");
    await updateSeoInternalLinkOpportunityStatus(id, status);
    redirect(`/dashboard/seo?tab=${encodeURIComponent(String(formData.get("tab") ?? "specialist"))}`);
}

export async function updateSeoContentOpportunityStatusAction(formData: FormData) {
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "pending");
    const tab = String(formData.get("tab") ?? "strategist");
    await setContentOpportunityStatus(id, status);
    if (status === "approved") {
        // Send the operator to the draft generation form with inputs prefilled from
        // the opportunity (title, keywords, format, etc.). The placeholder draft is
        // not created until the operator clicks Generate; at that point the API
        // creates the content_item and back-links it to the opportunity.
        redirect(`/dashboard/generate?opportunityId=${encodeURIComponent(id)}`);
    }
    redirect(`/dashboard/seo?tab=${encodeURIComponent(tab)}`);
}

export async function updateSeoContentPlanStatusAction(formData: FormData) {
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "saved");
    const tab = String(formData.get("tab") ?? "plans");
    await setContentPlanStatus(id, status);
    if (status === "in_progress") {
        redirect(`/dashboard/generate?planId=${encodeURIComponent(id)}`);
    }
    redirect(`/dashboard/seo?tab=${encodeURIComponent(tab)}`);
}

export async function spawnSeoPlansFromClusterAction(formData: FormData) {
    const clusterId = String(formData.get("clusterId") ?? "");
    if (!clusterId) {
        redirect(`/dashboard/seo?tab=strategist`);
    }
    await spawnSeoContentPlansFromCluster(clusterId);
    redirect(`/dashboard/seo?tab=plans`);
}

/**
 * Delete a single internal-link opportunity. Refuses to delete rows in
 * "applied" state because that would orphan the associated execution event
 * and strip the rollback affordance. The caller should roll back first.
 */
export async function deleteSeoInternalLinkOpportunity(id: string): Promise<{ ok: boolean; error: string | null }> {
    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: existing, error: fetchError } = await supabase
        .from("seo_internal_link_opportunities")
        .select("id, status")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (fetchError) return { ok: false, error: fetchError.message ?? "Failed to load opportunity." };
    if (!existing) return { ok: false, error: "Opportunity not found." };

    if (existing.status === "applied") {
        return { ok: false, error: "Roll back this recommendation before deleting. Deleting an applied link orphans its execution event and removes the rollback path." };
    }
    if (existing.status === "applying") {
        return { ok: false, error: "This recommendation is currently being applied; try again when it completes." };
    }

    const { data: deletedRows, error } = await supabase
        .from("seo_internal_link_opportunities")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select("id");
    if (error) return { ok: false, error: error.message ?? "Failed to delete opportunity." };
    if (!deletedRows || deletedRows.length === 0) {
        return {
            ok: false,
            error: "Delete was blocked by row-level security. Ask an admin to run the seo_tables_delete_policy migration.",
        };
    }

    revalidatePath("/dashboard/seo");
    revalidatePath("/dashboard/opportunities");
    return { ok: true, error: null };
}

export async function clearSeoInternalLinkOpportunitiesByStatus(status: "dismissed" | "failed" | "rolled_back" | "manual_review_required"): Promise<{ ok: boolean; deleted: number; error: string | null }> {
    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data, error } = await supabase
        .from("seo_internal_link_opportunities")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("status", status)
        .select("id");
    if (error) return { ok: false, deleted: 0, error: error.message ?? "Failed to clear opportunities." };

    revalidatePath("/dashboard/seo");
    revalidatePath("/dashboard/opportunities");
    return { ok: true, deleted: data?.length ?? 0, error: null };
}

/**
 * Bulk-delete SEO internal-link opportunities by id. Mirrors the safety rules
 * of the single-row delete: skips rows in `applied` or `applying` state so a
 * live rollback path isn't orphaned. Returns counts for each bucket so the UI
 * can explain what happened.
 */
export async function bulkDeleteSeoInternalLinkOpportunities(
    ids: readonly string[],
): Promise<{ ok: boolean; deleted: number; skipped: number; skippedReason: string | null; error: string | null }> {
    const cleaned = Array.from(new Set((ids ?? []).filter((id) => typeof id === "string" && id.length > 0)));
    if (cleaned.length === 0) {
        return { ok: true, deleted: 0, skipped: 0, skippedReason: null, error: null };
    }

    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: rows, error: fetchError } = await supabase
        .from("seo_internal_link_opportunities")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .in("id", cleaned);
    if (fetchError) {
        return { ok: false, deleted: 0, skipped: 0, skippedReason: null, error: fetchError.message ?? "Failed to load opportunities." };
    }

    const deletable = (rows ?? []).filter((r) => r.status !== "applied" && r.status !== "applying").map((r) => r.id);
    const skipped = (rows ?? []).length - deletable.length;
    const skippedReason = skipped > 0
        ? "Some rows were skipped because they are currently applied or applying. Roll them back first."
        : null;

    if (deletable.length === 0) {
        return { ok: true, deleted: 0, skipped, skippedReason, error: null };
    }

    const { data: deletedRows, error: deleteError } = await supabase
        .from("seo_internal_link_opportunities")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", deletable)
        .select("id");
    if (deleteError) {
        return { ok: false, deleted: 0, skipped, skippedReason, error: deleteError.message ?? "Failed to delete opportunities." };
    }

    const deleted = deletedRows?.length ?? 0;
    // RLS denial on DELETE returns 0 rows without raising an error. Surface a
    // specific message so operators know the missing DELETE policy has not
    // been applied yet to this environment.
    if (deleted === 0 && deletable.length > 0) {
        return {
            ok: false,
            deleted: 0,
            skipped,
            skippedReason,
            error:
                "Delete was blocked by row-level security. Ask an admin to run the seo_tables_delete_policy migration.",
        };
    }

    revalidatePath("/dashboard/seo");
    revalidatePath("/dashboard/opportunities");
    return { ok: true, deleted, skipped, skippedReason, error: null };
}

interface BulkDeleteResult {
    ok: boolean;
    deleted: number;
    skipped: number;
    skippedReason: string | null;
    error: string | null;
}

const RLS_DELETE_BLOCKED_MESSAGE =
    "Delete was blocked by row-level security. Ask an admin to run the seo_tables_delete_policy migration.";

/**
 * Bulk-delete strategist content opportunities. Skips any row that has already
 * spawned a draft (`draft_content_item_id IS NOT NULL`) so the underlying
 * draft remains traceable; the operator can dismiss those instead.
 */
export async function bulkDeleteSeoContentOpportunities(
    ids: readonly string[],
): Promise<BulkDeleteResult> {
    const cleaned = Array.from(new Set((ids ?? []).filter((id) => typeof id === "string" && id.length > 0)));
    if (cleaned.length === 0) {
        return { ok: true, deleted: 0, skipped: 0, skippedReason: null, error: null };
    }

    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: rows, error: fetchError } = await supabase
        .from("seo_content_opportunities")
        .select("id, draft_content_item_id")
        .eq("workspace_id", workspaceId)
        .in("id", cleaned);
    if (fetchError) {
        return { ok: false, deleted: 0, skipped: 0, skippedReason: null, error: fetchError.message ?? "Failed to load opportunities." };
    }

    const deletable = (rows ?? []).filter((r) => !r.draft_content_item_id).map((r) => r.id);
    const skipped = (rows ?? []).length - deletable.length;
    const skippedReason = skipped > 0
        ? "Some rows were skipped because a draft has already been generated from them. Open the draft to remove it first."
        : null;

    if (deletable.length === 0) {
        return { ok: true, deleted: 0, skipped, skippedReason, error: null };
    }

    const { data: deletedRows, error: deleteError } = await supabase
        .from("seo_content_opportunities")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", deletable)
        .select("id");
    if (deleteError) {
        return { ok: false, deleted: 0, skipped, skippedReason, error: deleteError.message ?? "Failed to delete opportunities." };
    }

    const deleted = deletedRows?.length ?? 0;
    if (deleted === 0 && deletable.length > 0) {
        return { ok: false, deleted: 0, skipped, skippedReason, error: RLS_DELETE_BLOCKED_MESSAGE };
    }

    revalidatePath("/dashboard/seo");
    return { ok: true, deleted, skipped, skippedReason, error: null };
}

/**
 * Bulk-delete strategist topic clusters. No row-level skip rule — the FK on
 * dependent plans/opportunities is `ON DELETE SET NULL`, so deletion silently
 * detaches them. The UI confirm string warns the operator about this.
 */
export async function bulkDeleteSeoTopicClusters(
    ids: readonly string[],
): Promise<BulkDeleteResult> {
    const cleaned = Array.from(new Set((ids ?? []).filter((id) => typeof id === "string" && id.length > 0)));
    if (cleaned.length === 0) {
        return { ok: true, deleted: 0, skipped: 0, skippedReason: null, error: null };
    }

    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: deletedRows, error: deleteError } = await supabase
        .from("seo_topic_clusters")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", cleaned)
        .select("id");
    if (deleteError) {
        return { ok: false, deleted: 0, skipped: 0, skippedReason: null, error: deleteError.message ?? "Failed to delete topic clusters." };
    }

    const deleted = deletedRows?.length ?? 0;
    if (deleted === 0 && cleaned.length > 0) {
        return { ok: false, deleted: 0, skipped: 0, skippedReason: null, error: RLS_DELETE_BLOCKED_MESSAGE };
    }

    revalidatePath("/dashboard/seo");
    return { ok: true, deleted, skipped: 0, skippedReason: null, error: null };
}

/**
 * Bulk-delete strategist content plans. Skips plans that have downstream work
 * attached: an associated draft, or a status indicating active/completed work.
 */
export async function bulkDeleteSeoContentPlans(
    ids: readonly string[],
): Promise<BulkDeleteResult> {
    const cleaned = Array.from(new Set((ids ?? []).filter((id) => typeof id === "string" && id.length > 0)));
    if (cleaned.length === 0) {
        return { ok: true, deleted: 0, skipped: 0, skippedReason: null, error: null };
    }

    const { context, supabase } = await requireSeoExecutionAccess("write");
    const workspaceId = context.activeWorkspace.id;

    const { data: rows, error: fetchError } = await supabase
        .from("seo_content_plans")
        .select("id, status, draft_content_item_id")
        .eq("workspace_id", workspaceId)
        .in("id", cleaned);
    if (fetchError) {
        return { ok: false, deleted: 0, skipped: 0, skippedReason: null, error: fetchError.message ?? "Failed to load plans." };
    }

    const deletable = (rows ?? [])
        .filter((r) => !r.draft_content_item_id && r.status !== "in_progress" && r.status !== "done")
        .map((r) => r.id);
    const skipped = (rows ?? []).length - deletable.length;
    const skippedReason = skipped > 0
        ? "Some plans were skipped because a draft has been generated or the work item is in progress / done."
        : null;

    if (deletable.length === 0) {
        return { ok: true, deleted: 0, skipped, skippedReason, error: null };
    }

    const { data: deletedRows, error: deleteError } = await supabase
        .from("seo_content_plans")
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", deletable)
        .select("id");
    if (deleteError) {
        return { ok: false, deleted: 0, skipped, skippedReason, error: deleteError.message ?? "Failed to delete plans." };
    }

    const deleted = deletedRows?.length ?? 0;
    if (deleted === 0 && deletable.length > 0) {
        return { ok: false, deleted: 0, skipped, skippedReason, error: RLS_DELETE_BLOCKED_MESSAGE };
    }

    revalidatePath("/dashboard/seo");
    return { ok: true, deleted, skipped, skippedReason, error: null };
}

export async function deleteSeoInternalLinkOpportunityAction(formData: FormData) {
    const id = String(formData.get("id") ?? "");
    const tab = String(formData.get("tab") ?? "specialist");
    await deleteSeoInternalLinkOpportunity(id);
    redirect(`/dashboard/seo?tab=${encodeURIComponent(tab)}`);
}

export async function clearSeoInternalLinkOpportunitiesByStatusAction(formData: FormData) {
    const status = String(formData.get("status") ?? "dismissed") as "dismissed" | "failed" | "rolled_back" | "manual_review_required";
    const tab = String(formData.get("tab") ?? "specialist");
    const allowed = new Set(["dismissed", "failed", "rolled_back", "manual_review_required"]);
    if (!allowed.has(status)) {
        redirect(`/dashboard/seo?tab=${encodeURIComponent(tab)}`);
    }
    await clearSeoInternalLinkOpportunitiesByStatus(status);
    redirect(`/dashboard/seo?tab=${encodeURIComponent(tab)}`);
}

// ─── Blog post one-click SEO enhancement ─────────────────────────────────────

interface BlogContentItemRow {
    id: string;
    workspace_id: string;
    title: string;
    slug: string;
    type: string;
    content_markdown: string | null;
    metadata: Json | null;
    updated_at: string | null;
    locale: string | null;
}

async function loadBlogContentItem(supabase: Awaited<ReturnType<typeof createClient>>, contentId: string, workspaceId: string): Promise<BlogContentItemRow> {
    const { data, error } = await supabase
        .from("content_items")
        .select("id,workspace_id,title,slug,type,content_markdown,metadata,updated_at,locale")
        .eq("id", contentId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (error) throw new Error(error.message ?? "Failed to load blog content item.");
    if (!data) throw new Error("Blog content item not found in this workspace.");
    if (data.type !== "blog") {
        throw new Error(`SEO enhancement is only supported for blog posts (this item is type "${data.type}").`);
    }
    return data as BlogContentItemRow;
}

function buildSnapshot(row: BlogContentItemRow): BlogEnhancementSnapshot {
    const markdown = typeof row.content_markdown === "string" ? row.content_markdown : "";
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    return {
        contentMarkdown: markdown,
        metadata,
        contentUpdatedAt: row.updated_at,
        fingerprint: fingerprintMarkdown(markdown),
    };
}

export async function previewBlogPostSeoEnhancement(
    contentId: string,
): Promise<BlogEnhancementActionResult<BlogEnhancementPreview>> {
    try {
        const { context, supabase, userId } = await requireSeoExecutionAccess("write");
        const workspaceId = context.activeWorkspace.id;

        const rate = await checkAiRateLimitPg(workspaceId, BLOG_ENHANCEMENT_CONFIG.PREVIEW_ROUTE, {
            maxPerWindow: BLOG_ENHANCEMENT_CONFIG.RATE_LIMIT_PER_MINUTE,
            windowSeconds: 60,
        });
        if (!rate.allowed) {
            return { data: null, error: `Too many preview requests. Retry in ${rate.retryAfterSeconds}s.` };
        }

        await assertSufficientAiBalance(workspaceId);

        const row = await loadBlogContentItem(supabase, contentId, workspaceId);
        const snapshot = buildSnapshot(row);
        // Locale comes from the post itself, not the workspace default —
        // a Dutch-default workspace might still hold an EN blog post that
        // needs EN-localized SEO enhancements.
        const postLocale = resolveGenerationLocale({
            requested: row.locale,
            workspaceDefault: context.activeWorkspace.default_locale,
        });
        const inventory = await fetchPublishedInventory(workspaceId, postLocale);
        const workspaceAiContext = extractThemeAiSystemContext(context.activeThemeVersion?.config ?? {}) ?? "";

        const preview = await runWithWorkspaceAiConfig(workspaceId, () =>
            planBlogPostSeoEnhancement({
                workspaceId,
                contentId: row.id,
                profileId: userId,
                title: row.title,
                slug: row.slug,
                contentMarkdown: snapshot.contentMarkdown,
                metadata: snapshot.metadata,
                inventory,
                workspaceAiContext,
                workspaceLocale: postLocale,
            })
        );

        const insertPayload = {
            id: preview.runId,
            workspace_id: workspaceId,
            content_id: contentId,
            actor_profile_id: userId,
            status: "previewed" as BlogEnhancementRunStatus,
            proposal_count: preview.proposals.length,
            accepted_count: 0,
            preview_payload: preview as unknown as Json,
            snapshot_before: snapshot as unknown as Json,
            expires_at: preview.expiresAt,
            total_charged_millicents: preview.totalEstimatedCostMillicents,
        };

        const { error: insertError } = await supabase
            .from("blog_seo_enhancement_runs")
            .insert(insertPayload);
        if (insertError) {
            return { data: null, error: insertError.message ?? "Failed to persist enhancement run." };
        }

        return { data: preview, error: null };
    } catch (err) {
        if (err instanceof InsufficientAiBalanceError) {
            return { data: null, error: err.message };
        }
        return { data: null, error: getErrorMessage(err, "Failed to prepare SEO enhancement preview.") };
    }
}

export async function applyBlogPostSeoEnhancement(input: {
    runId: string;
    acceptedProposalIds: string[];
}): Promise<BlogEnhancementActionResult<{ runId: string; appliedCount: number }>> {
    try {
        const { context, supabase, userId } = await requireSeoExecutionAccess("write");
        const workspaceId = context.activeWorkspace.id;
        const acceptedSet = new Set(input.acceptedProposalIds);

        const { data: runRow, error: runError } = await supabase
            .from("blog_seo_enhancement_runs")
            .select("*")
            .eq("id", input.runId)
            .eq("workspace_id", workspaceId)
            .maybeSingle();
        if (runError) return { data: null, error: runError.message ?? "Failed to load enhancement run." };
        if (!runRow) return { data: null, error: "Enhancement run not found." };

        const run = runRow as unknown as BlogEnhancementRunRecord;
        if (run.status !== "previewed") {
            return { data: null, error: `Run is in "${run.status}" state and cannot be applied.` };
        }
        if (new Date(run.expires_at).getTime() < Date.now()) {
            await supabase.from("blog_seo_enhancement_runs").update({ status: "expired" }).eq("id", run.id);
            return { data: null, error: "Preview expired. Please re-run the enhancement." };
        }

        // Optimistic lock: content must match the fingerprint captured at preview
        const row = await loadBlogContentItem(supabase, run.content_id, workspaceId);
        const currentSnapshot = buildSnapshot(row);
        if (currentSnapshot.fingerprint !== run.snapshot_before.fingerprint) {
            return {
                data: null,
                error: "Content changed since preview was generated. Please re-run the enhancement.",
            };
        }

        const accepted = run.preview_payload.proposals.filter((p) => acceptedSet.has(p.id));
        if (accepted.length === 0) {
            return { data: null, error: "No proposals accepted — nothing to apply." };
        }

        // Partition into markdown splices vs. meta patches. Sanitize every
        // proposed fragment before it touches persisted content.
        const { sanitizeText, sanitizeMultilineText } = await import("@/features/seo/lib/sanitize");
        const remediationAccepted = accepted.some((p) => p.type === "editorial_validation_remediation");
        const regularAccepted = accepted.filter((p) => p.type !== "editorial_validation_remediation");

        const markdownSplices = regularAccepted
            .filter((p): p is BlogEnhancementProposal & { metaPath: null } => p.metaPath === null)
            .map((p) => ({
                startOffset: p.startOffset,
                endOffset: p.endOffset,
                replacement: sanitizeMultilineText(p.proposed, { maxLength: 4000 }),
            }));

        const protectedRanges = collectMarkdownProtectedRanges(currentSnapshot.contentMarkdown);
        const unsafeSplice = markdownSplices.find((splice) => rangeOverlapsProtectedRange(splice.startOffset, splice.endOffset, protectedRanges));
        if (unsafeSplice) {
            return {
                data: null,
                error: "Accepted SEO changes overlap a protected visual/chart placeholder. Please re-run the enhancement preview so placeholder-safe proposals are generated.",
            };
        }

        const metaPatches = regularAccepted
            .filter((p) => p.metaPath !== null)
            .map((p) => ({ ...p, proposed: sanitizeText(p.proposed, { maxLength: 400 }) }));

        let nextMarkdown = currentSnapshot.contentMarkdown;
        if (markdownSplices.length > 0) {
            try {
                nextMarkdown = applySplices(currentSnapshot.contentMarkdown, markdownSplices);
            } catch (err) {
                return { data: null, error: `Markdown splice failed: ${getErrorMessage(err, "overlap or invalid range")}` };
            }
        }

        let nextMetadata: Record<string, unknown> = { ...currentSnapshot.metadata };
        for (const patch of metaPatches) {
            if (!patch.metaPath) continue;
            nextMetadata = setAtPath(nextMetadata, patch.metaPath, patch.proposed);
        }

        if (remediationAccepted) {
            const remediation = remediateBlogEditorialValidation({
                title: row.title,
                contentMarkdown: nextMarkdown,
                metadata: nextMetadata,
                locale: row.locale,
            });
            nextMetadata = remediation.metadata;
        }

        const { error: updateError } = await supabase
            .from("content_items")
            .update({
                content_markdown: nextMarkdown,
                metadata: nextMetadata as unknown as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", run.content_id)
            .eq("workspace_id", workspaceId);
        if (updateError) return { data: null, error: updateError.message ?? "Failed to write enhanced content." };

        const snapshotAfter: BlogEnhancementSnapshot = {
            contentMarkdown: nextMarkdown,
            metadata: nextMetadata,
            contentUpdatedAt: new Date().toISOString(),
            fingerprint: fingerprintMarkdown(nextMarkdown),
        };

        const status: BlogEnhancementRunStatus = accepted.length === run.preview_payload.proposals.length
            ? "applied"
            : "partially_applied";

        const { error: runUpdateError } = await supabase
            .from("blog_seo_enhancement_runs")
            .update({
                status,
                accepted_count: accepted.length,
                snapshot_after: snapshotAfter as unknown as Json,
                applied_at: new Date().toISOString(),
                actor_profile_id: userId,
            })
            .eq("id", run.id)
            .eq("workspace_id", workspaceId);
        if (runUpdateError) return { data: null, error: runUpdateError.message ?? "Failed to mark run as applied." };

        // Loop B emission — persist per-proposal decisions into the three
        // feedback tables so later systems (opportunity engine, market
        // monitor, cluster ranking) can consume this workspace's own
        // editorial history. Best-effort at the action level: failures do not
        // roll back the markdown write, but we return the warnings to the UI
        // so operators can triage RLS/schema drift.
        const rejected = run.preview_payload.proposals.filter((p) => !acceptedSet.has(p.id));
        const feedbackWarnings: string[] = [];
        try {
            const emission = await emitEnhancementFeedback(supabase, {
                workspaceId,
                runId: run.id,
                contentId: run.content_id,
                acceptedProposals: accepted,
                rejectedProposals: rejected,
            });
            console.info(
                `[seo-enhance] feedback emission runId=${run.id} linkGraph=${emission.linkGraph} proposalEvents=${emission.proposalEvents} learnedAuthority=${emission.learnedAuthority}${emission.errors.length ? ` errors=${emission.errors.join("|")}` : ""}`,
            );
            if (emission.linkGraph === "failed") feedbackWarnings.push("Link-graph write failed (inventory_link_graph).");
            if (emission.proposalEvents === "failed") feedbackWarnings.push("Proposal-event write failed (blog_enhancement_proposal_events).");
            if (emission.learnedAuthority === "failed") feedbackWarnings.push("Learned-authority write failed (workspace_learned_authority_domains).");
            if (emission.errors.length > 0) {
                feedbackWarnings.push(...emission.errors.map((e) => `Feedback loop: ${e}`));
            }
        } catch (err) {
            const msg = getErrorMessage(err, "feedback-loop emission threw");
            console.warn("[seo-enhance] feedback-loop emission threw:", err);
            feedbackWarnings.push(`Feedback loop exception: ${msg}`);
        }

        revalidatePath(`/dashboard/content/${run.content_id}`);
        if (row.slug) revalidatePath(`/blog/${row.slug}`);

        return {
            data: { runId: run.id, appliedCount: accepted.length },
            error: null,
            feedbackWarnings: feedbackWarnings.length > 0 ? feedbackWarnings : undefined,
        };
    } catch (err) {
        return { data: null, error: getErrorMessage(err, "Failed to apply SEO enhancement.") };
    }
}

export async function rollbackBlogPostSeoEnhancement(
    runId: string,
): Promise<BlogEnhancementActionResult<{ runId: string }>> {
    try {
        const { context, supabase } = await requireSeoExecutionAccess("write");
        const workspaceId = context.activeWorkspace.id;

        const { data: runRow, error: runError } = await supabase
            .from("blog_seo_enhancement_runs")
            .select("*")
            .eq("id", runId)
            .eq("workspace_id", workspaceId)
            .maybeSingle();
        if (runError) return { data: null, error: runError.message ?? "Failed to load enhancement run." };
        if (!runRow) return { data: null, error: "Enhancement run not found." };

        const run = runRow as unknown as BlogEnhancementRunRecord;
        if (run.status !== "applied" && run.status !== "partially_applied") {
            return { data: null, error: `Run is in "${run.status}" state and cannot be rolled back.` };
        }

        const { error: updateError } = await supabase
            .from("content_items")
            .update({
                content_markdown: run.snapshot_before.contentMarkdown,
                metadata: run.snapshot_before.metadata as unknown as Json,
                updated_at: new Date().toISOString(),
            })
            .eq("id", run.content_id)
            .eq("workspace_id", workspaceId);
        if (updateError) return { data: null, error: updateError.message ?? "Failed to restore content snapshot." };

        const { error: runUpdateError } = await supabase
            .from("blog_seo_enhancement_runs")
            .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
            .eq("id", runId)
            .eq("workspace_id", workspaceId);
        if (runUpdateError) return { data: null, error: runUpdateError.message ?? "Failed to mark run as rolled back." };

        const { data: contentRow } = await supabase
            .from("content_items")
            .select("slug")
            .eq("id", run.content_id)
            .maybeSingle();

        revalidatePath(`/dashboard/content/${run.content_id}`);
        if (contentRow?.slug) {
            revalidatePath(`/blog/${contentRow.slug}`);
        }

        return { data: { runId }, error: null };
    } catch (err) {
        return { data: null, error: getErrorMessage(err, "Failed to roll back SEO enhancement.") };
    }
}

export async function listBlogPostSeoEnhancementRuns(
    contentId: string,
): Promise<BlogEnhancementActionResult<BlogEnhancementRunRecord[]>> {
    try {
        const { context, supabase } = await requireSeoExecutionAccess("read");
        const workspaceId = context.activeWorkspace.id;
        const { data, error } = await supabase
            .from("blog_seo_enhancement_runs")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("content_id", contentId)
            .order("created_at", { ascending: false })
            .limit(10);
        if (error) return { data: null, error: error.message ?? "Failed to list enhancement runs." };
        return { data: (data ?? []) as unknown as BlogEnhancementRunRecord[], error: null };
    } catch (err) {
        return { data: null, error: getErrorMessage(err, "Failed to list SEO enhancement runs.") };
    }
}

function setAtPath(obj: Record<string, unknown>, dottedPath: string, value: unknown): Record<string, unknown> {
    const segments = dottedPath.replace(/^metadata\./, "").split(".");
    const next: Record<string, unknown> = { ...obj };
    let cursor: Record<string, unknown> = next;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i];
        const existing = cursor[key];
        const nested = existing && typeof existing === "object" && !Array.isArray(existing)
            ? { ...(existing as Record<string, unknown>) }
            : {};
        cursor[key] = nested;
        cursor = nested;
    }
    cursor[segments[segments.length - 1]] = value;
    return next;
}
