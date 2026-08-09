import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json, Database } from "@/shared/lib/supabase/database.types";
import {
    applySeoExecutionMutation,
    createSeoExecutionPreview,
    getSeoExecutionDependencies,
} from "@/features/seo/execution";
import type { SeoAutomationMode } from "@/features/seo/lib/automation-mode";
import type { SeoRecommendationStatus } from "@/features/seo/types";
import { runWithWorkspaceAiConfig } from "@/shared/lib/ai/provider";

type SeoSupabaseClient = SupabaseClient<Database>;
type SeoExecutionPreview = Awaited<ReturnType<typeof createSeoExecutionPreview>>;

type AutoPreviewOpportunityRow = {
    id: string;
    status: string;
    priority_score: number | null;
    created_at: string;
    last_preview_at: string | null;
    source_content_id: string;
    metadata: Json | null;
};

export interface AutoPreviewApplyResult {
    previewed: number;
    readyToApply: number;
    manualReview: number;
    applied: number;
    skipped: number;
    failed: number;
}

export interface AutoPreviewOpportunitiesForWorkspaceInput {
    workspaceId: string;
    workspaceLocale?: string | null;
    templateId?: string | null;
    opportunityIds?: readonly string[];
    supabase?: SeoSupabaseClient;
    automationMode?: SeoAutomationMode;
    autoApplyOnSuccess?: boolean;
    autoApplyMinAgeSeconds?: number;
    maxAutoApplyTotal?: number;
    maxAutoApplyPerSource?: number;
    appliedByProfileId?: string | null;
    limit: number;
    concurrency: number;
}

async function getSupabaseClient(input?: SeoSupabaseClient): Promise<SeoSupabaseClient> {
    if (input) return input;

    // Keep the Next.js cookie-backed client out of the raw TSX worker import graph.
    // Worker callers pass an admin client explicitly; server actions can still use
    // this fallback without making `scripts/seo-internal-link-worker.ts` import
    // Next's request-bound Supabase helper at module load time.
    const { createClient } = await import("@/shared/lib/supabase/server");
    return await createClient();
}

function isOrphanTargetError(error: unknown): string | null {
    if (!(error instanceof Error)) return null;
    const msg = error.message;
    if (msg.includes("Target content item not found")) return "Target content was deleted. Internal link cannot be applied.";
    if (/^Target content ".*" is .+\. Internal link would resolve to a 404\.$/.test(msg)) return msg;
    if (/^Target content ".*" has no slug\./.test(msg)) return msg;
    return null;
}

async function markOpportunityOrphanedWithClient(input: {
    supabase: SeoSupabaseClient;
    recommendationId: string;
    workspaceId: string;
    reason: string;
}) {
    await input.supabase
        .from("seo_internal_link_opportunities")
        .update({
            status: "manual_review_required",
            manual_review_reason: input.reason,
            updated_at: new Date().toISOString(),
        })
        .eq("id", input.recommendationId)
        .eq("workspace_id", input.workspaceId);
}

function isAutoApplyAllowedForMode(metadata: unknown, mode: SeoAutomationMode): boolean {
    if (mode === "conservative") return false;

    const gsc = (metadata && typeof metadata === 'object' && 'gsc' in metadata)
        ? (metadata as Record<string, unknown>).gsc as { confidence_score?: number; opportunity_type?: string; impressions?: number; position?: number } | undefined
        : undefined;

    if (!gsc) {
        // Standard first-party analytics recommendation.
        return true;
    }

    if (mode === "standard") {
        // Only auto-apply high confidence GSC opportunities (e.g. near-page-one)
        return (gsc.confidence_score ?? 0) >= 80 || gsc.opportunity_type === "near-page-one";
    }

    if (mode === "aggressive") {
        // Aggressive allows broader auto-apply, but skip deep/low-volume GSC opportunities
        return (gsc.impressions ?? 0) >= 5 && (gsc.position ?? 999) <= 20;
    }

    return true;
}

/**
 * Run preview against newly-generated or stale opportunities so blocked items
 * surface immediately and supported items advance straight to ready_to_apply.
 * The caller may pass a normal server Supabase client or a service/admin client;
 * this module never depends on interactive auth.
 */
export async function autoPreviewOpportunitiesForWorkspace(
    input: AutoPreviewOpportunitiesForWorkspaceInput,
): Promise<AutoPreviewApplyResult> {
    const supabase = await getSupabaseClient(input.supabase);
    const result: AutoPreviewApplyResult = {
        previewed: 0,
        readyToApply: 0,
        manualReview: 0,
        applied: 0,
        skipped: 0,
        failed: 0,
    };

    let opportunitiesQuery = supabase
        .from("seo_internal_link_opportunities")
        .select("id, status, priority_score, created_at, last_preview_at, source_content_id, metadata")
        .eq("workspace_id", input.workspaceId)
        .in("status", ["pending", "approved", "manual_review_required", "failed", "ready_to_apply"]);

    if (input.workspaceLocale) {
        opportunitiesQuery = opportunitiesQuery.eq("locale", input.workspaceLocale);
    }
    if (input.opportunityIds && input.opportunityIds.length > 0) {
        opportunitiesQuery = opportunitiesQuery.in("id", Array.from(new Set(input.opportunityIds)));
    }

    const { data: rows, error } = await opportunitiesQuery
        .order("priority_score", { ascending: false })
        .limit(input.limit * 2);

    if (error || !rows || rows.length === 0) {
        return result;
    }

    const typedRows = rows as AutoPreviewOpportunityRow[];

    const sourceIds = Array.from(new Set(typedRows.map((row) => row.source_content_id)));
    const sourceUpdatedAt = new Map<string, string>();
    if (sourceIds.length > 0) {
        let sourceQuery = supabase
            .from("content_items")
            .select("id, updated_at")
            .eq("workspace_id", input.workspaceId)
            .in("id", sourceIds);
        if (input.templateId) {
            sourceQuery = sourceQuery.eq("template_id", input.templateId);
        }
        const { data: sourceRows } = await sourceQuery;
        for (const sourceRow of (sourceRows ?? []) as { id: string; updated_at: string }[]) {
            sourceUpdatedAt.set(sourceRow.id, sourceRow.updated_at);
        }
    }

    const stale = typedRows.filter((row) => {
        if (input.templateId && !sourceUpdatedAt.has(row.source_content_id)) return false;
        if (input.opportunityIds && input.opportunityIds.length > 0) return true;
        if (!row.last_preview_at) return true;
        const sourceUpdated = sourceUpdatedAt.get(row.source_content_id);
        if (sourceUpdated && new Date(sourceUpdated) > new Date(row.last_preview_at)) return true;
        return false;
    }).slice(0, input.limit);

    if (stale.length === 0) return result;

    const queue = [...stale];
    const workers: Promise<void>[] = [];
    const workerCount = Math.max(1, Math.min(input.concurrency, queue.length));
    const minAgeMs = (input.autoApplyMinAgeSeconds ?? 0) * 1000;
    const maxAutoApplyTotal = Math.max(0, input.maxAutoApplyTotal ?? input.limit);
    const maxAutoApplyPerSource = Math.max(0, input.maxAutoApplyPerSource ?? input.limit);
    const appliedBySource = new Map<string, number>();

    const tryReserveAutoApplySlot = (row: AutoPreviewOpportunityRow) => {
        if (result.applied + result.failed >= maxAutoApplyTotal) return false;
        const sourceCount = appliedBySource.get(row.source_content_id) ?? 0;
        if (sourceCount >= maxAutoApplyPerSource) return false;
        appliedBySource.set(row.source_content_id, sourceCount + 1);
        return true;
    };

    const markSkippedByPolicy = async (row: AutoPreviewOpportunityRow, reason: string) => {
        const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? row.metadata as Record<string, unknown>
            : {};
        const policy = metadata.internalLinkPolicy && typeof metadata.internalLinkPolicy === "object" && !Array.isArray(metadata.internalLinkPolicy)
            ? metadata.internalLinkPolicy as Record<string, unknown>
            : {};
        await supabase
            .from("seo_internal_link_opportunities")
            .update({
                metadata: {
                    ...metadata,
                    internalLinkPolicy: {
                        ...policy,
                        autoApplyRuntimeSkipped: true,
                        autoApplyRuntimeSkipReason: reason,
                    },
                } as Json,
            })
            .eq("id", row.id)
            .eq("workspace_id", input.workspaceId);
    };

    for (let i = 0; i < workerCount; i += 1) {
        workers.push((async () => {
            while (queue.length > 0) {
                const row = queue.shift();
                if (!row) break;
                try {
                    const preview = await runWithWorkspaceAiConfig(input.workspaceId, () =>
                        createSeoExecutionPreview(input.workspaceId, row.id, {
                            workspaceLocale: input.workspaceLocale,
                            automationMode: input.automationMode,
                            supabase,
                            templateId: input.templateId,
                        })
                    );
                    const nextStatus: SeoRecommendationStatus = preview.supported ? "ready_to_apply" : "manual_review_required";
                    await supabase
                        .from("seo_internal_link_opportunities")
                        .update({
                            status: nextStatus,
                            last_preview_at: new Date().toISOString(),
                            last_preview_payload: preview as unknown as Json,
                            manual_review_reason: preview.manualReviewReason,
                            failed_reason: null,
                            failed_at: null,
                        })
                        .eq("id", row.id)
                        .eq("workspace_id", input.workspaceId);
                    result.previewed += 1;
                    if (preview.supported) result.readyToApply += 1;
                    else result.manualReview += 1;

                    if (
                        preview.supported
                        && input.autoApplyOnSuccess
                        && input.automationMode !== "conservative"
                    ) {
                        const ageMs = Date.now() - new Date(row.created_at).getTime();
                        if (ageMs < minAgeMs) {
                            result.skipped += 1;
                            continue;
                        }
                        const metadataRecord = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
                            ? row.metadata as Record<string, unknown>
                            : {};
                        const policy = metadataRecord.internalLinkPolicy && typeof metadataRecord.internalLinkPolicy === "object" && !Array.isArray(metadataRecord.internalLinkPolicy)
                            ? metadataRecord.internalLinkPolicy as Record<string, unknown>
                            : {};
                        if (policy.autoApplyEligible === false) {
                            await markSkippedByPolicy(row, "Opportunity policy metadata marked this row as recommendation-only for this run/job.");
                            result.skipped += 1;
                            continue;
                        }
                        const isAllowedByMode = isAutoApplyAllowedForMode(metadataRecord, input.automationMode ?? "standard");
                        if (!isAllowedByMode) {
                            await markSkippedByPolicy(row, `Opportunity skipped based on GSC evidence and automation mode: ${input.automationMode || 'standard'}.`);
                            result.skipped += 1;
                            continue;
                        }
                        if (!tryReserveAutoApplySlot(row)) {
                            await markSkippedByPolicy(row, "Runtime auto-apply cap reached for this run/job or source page.");
                            result.skipped += 1;
                            continue;
                        }
                        const applyResult = await runWithWorkspaceAiConfig(input.workspaceId, () =>
                            tryAutoApplyOpportunity({
                                workspaceId: input.workspaceId,
                                recommendationId: row.id,
                                appliedByProfileId: input.appliedByProfileId ?? null,
                                precomputedPreview: preview,
                                automationMode: input.automationMode,
                                supabase,
                                templateId: input.templateId,
                            })
                        );
                        if (applyResult === "applied") result.applied += 1;
                        else if (applyResult === "failed") result.failed += 1;
                        else result.skipped += 1;
                    }
                } catch (err) {
                    const orphanReason = isOrphanTargetError(err);
                    if (orphanReason) {
                        await markOpportunityOrphanedWithClient({
                            supabase,
                            recommendationId: row.id,
                            workspaceId: input.workspaceId,
                            reason: orphanReason,
                        });
                        result.manualReview += 1;
                        continue;
                    }

                    const message = err instanceof Error ? err.message : String(err);
                    console.warn("[seo:auto-preview] preview failed for", row.id, err);
                    await supabase
                        .from("seo_internal_link_opportunities")
                        .update({
                            status: "failed" satisfies SeoRecommendationStatus,
                            failed_reason: message.slice(0, 500),
                            failed_at: new Date().toISOString(),
                        })
                        .eq("id", row.id)
                        .eq("workspace_id", input.workspaceId);
                    result.failed += 1;
                }
            }
        })());
    }

    await Promise.all(workers);
    return result;
}

export async function tryAutoApplyOpportunity(input: {
    workspaceId: string;
    recommendationId: string;
    appliedByProfileId: string | null;
    precomputedPreview?: SeoExecutionPreview;
    automationMode?: SeoAutomationMode;
    supabase?: SeoSupabaseClient;
    templateId?: string | null;
}): Promise<"applied" | "skipped" | "failed"> {
    const { workspaceId, recommendationId, appliedByProfileId } = input;
    const supabase = await getSupabaseClient(input.supabase);

    const { data: claimed } = await supabase
        .from("seo_internal_link_opportunities")
        .update({ status: "applying", updated_at: new Date().toISOString() })
        .eq("id", recommendationId)
        .eq("workspace_id", workspaceId)
        .eq("status", "ready_to_apply")
        .select("id");

    if (!claimed || claimed.length === 0) return "skipped";

    try {
        const { recommendation, sourceContent } = await getSeoExecutionDependencies(workspaceId, recommendationId, {
            supabase,
            templateId: input.templateId,
        });

        const isAllowedByMode = isAutoApplyAllowedForMode(recommendation.metadata, input.automationMode ?? "standard");
        if (!isAllowedByMode) {
            await supabase
                .from("seo_internal_link_opportunities")
                .update({ status: "manual_review_required", manual_review_reason: `Skipped: GSC evidence not eligible for auto-apply in ${input.automationMode || 'standard'} mode.` })
                .eq("id", recommendationId)
                .eq("workspace_id", workspaceId);
            return "skipped";
        }
        const preview = input.precomputedPreview
            ?? await runWithWorkspaceAiConfig(workspaceId, () =>
                createSeoExecutionPreview(workspaceId, recommendationId, {
                    automationMode: input.automationMode,
                    supabase,
                    templateId: input.templateId,
                })
            );
        if (!preview.supported || !preview.updatedContent) {
            await supabase
                .from("seo_internal_link_opportunities")
                .update({ status: "manual_review_required", manual_review_reason: preview.manualReviewReason })
                .eq("id", recommendationId)
                .eq("workspace_id", workspaceId);
            return "skipped";
        }

        const applyEvent = await runWithWorkspaceAiConfig(workspaceId, () =>
            applySeoExecutionMutation({
                workspaceId,
                recommendation,
                sourceContent,
                preview,
                appliedByProfileId,
                supabase,
                templateId: input.templateId,
            })
        );

        const existingMetadata = recommendation.metadata && typeof recommendation.metadata === "object" && !Array.isArray(recommendation.metadata)
            ? (recommendation.metadata as Record<string, Json>)
            : {};
        await supabase
            .from("seo_internal_link_opportunities")
            .update({
                metadata: {
                    ...existingMetadata,
                    applied_via: "auto",
                    applied_automation_mode: input.automationMode ?? "standard",
                    applied_event_id: applyEvent?.id ?? null,
                },
            })
            .eq("id", recommendationId)
            .eq("workspace_id", workspaceId);
        return "applied";
    } catch (err) {
        const orphanReason = isOrphanTargetError(err);
        if (orphanReason) {
            await markOpportunityOrphanedWithClient({
                supabase,
                recommendationId,
                workspaceId,
                reason: orphanReason,
            });
            return "skipped";
        }

        const message = err instanceof Error ? err.message : "Auto-apply failed.";
        await supabase
            .from("seo_internal_link_opportunities")
            .update({
                status: "failed",
                failed_at: new Date().toISOString(),
                failed_reason: message,
            })
            .eq("id", recommendationId)
            .eq("workspace_id", workspaceId);
        console.warn("[seo:auto-apply] apply failed for", recommendationId, err);
        return "failed";
    }
}
