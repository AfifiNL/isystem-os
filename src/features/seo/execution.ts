import type { Json } from "@/shared/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type {
    SeoExecutionErrorKind,
    SeoExecutionEventRecord,
    SeoExecutionPreview,
    SeoInternalLinkOpportunityRecord,
} from "@/features/seo/types";
import { createClient } from "@/shared/lib/supabase/server";
import { buildMarkdownDirectPreview, buildSeoExecutionPreview } from "@/features/seo/content-preview";
import type { SeoAutomationMode } from "@/features/seo/lib/automation-mode";
import { resolveBuilderSignals } from "@/features/seo/lib/analysis";
import { revalidateSeoPaths } from "@/features/seo/rollback";

type SeoSupabaseClient = SupabaseClient<Database>;

export class SeoExecutionError extends Error {
    constructor(
        public readonly kind: SeoExecutionErrorKind,
        message: string,
        public readonly resolution?: string,
    ) {
        super(message);
        this.name = "SeoExecutionError";
    }
}

type SeoExecutionSourceContent = {
    id: string;
    workspace_id: string | null;
    template_id: string | null;
    title: string;
    slug: string;
    type: string;
    locale: string;
    status: string | null;
    content_markdown: string | null;
    metadata: Json | null;
    visual_layout: Json | null;
    updated_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

export async function getSeoExecutionDependencies(
    workspaceId: string,
    recommendationId: string,
    options?: { supabase?: SeoSupabaseClient; templateId?: string | null },
) {
    const supabase = options?.supabase ?? await createClient();
    const { data: recommendation, error } = await supabase
        .from("seo_internal_link_opportunities")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", recommendationId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message ?? "Failed to load SEO recommendation.");
    }

    if (!recommendation) {
        throw new Error("SEO recommendation not found.");
    }

    const typedRecommendation = recommendation as SeoInternalLinkOpportunityRecord;

    let sourceQuery = supabase
        .from("content_items")
        .select("id,workspace_id,template_id,title,slug,type,locale,status,content_markdown,metadata,visual_layout,updated_at")
        .eq("id", typedRecommendation.source_content_id)
        .eq("workspace_id", workspaceId);
    if (options?.templateId) {
        sourceQuery = sourceQuery.eq("template_id", options.templateId);
    }
    const { data: sourceContent, error: sourceError } = await sourceQuery.maybeSingle();

    if (sourceError) {
        throw new Error(sourceError.message ?? "Failed to load source content for execution preview.");
    }

    if (!sourceContent) {
        throw new Error("Source content item not found.");
    }

    let targetQuery = supabase
        .from("content_items")
        .select("id,title,slug,type,status,template_id")
        .eq("id", typedRecommendation.target_content_id)
        .eq("workspace_id", workspaceId);
    if (options?.templateId) {
        targetQuery = targetQuery.eq("template_id", options.templateId);
    }
    const { data: targetContent, error: targetError } = await targetQuery.maybeSingle();

    if (targetError) {
        throw new Error(targetError.message ?? "Failed to load target content for execution preview.");
    }

    if (!targetContent) {
        throw new Error("Target content item not found.");
    }

    if (targetContent.status && targetContent.status !== "published") {
        throw new Error(`Target content "${targetContent.title}" is ${targetContent.status}. Internal link would resolve to a 404.`);
    }

    if (!targetContent.slug || !targetContent.slug.trim()) {
        throw new Error(`Target content "${targetContent.title}" has no slug. Internal link cannot be generated.`);
    }

    return {
        supabase,
        recommendation: typedRecommendation,
        sourceContent: sourceContent as SeoExecutionSourceContent,
        targetContent: targetContent as { id: string; title: string; slug: string | null; type: string | null; status: string | null },
    };
}

function hasMeaningfulVisualLayout(layout: Json | null): boolean {
    if (!layout) return false;
    if (Array.isArray(layout)) return layout.length > 0;
    if (typeof layout !== "object") return false;

    const record = layout as Record<string, unknown>;

    // Puck's real shape is `{ content: [...blocks], root: { props }, zones: { [zone]: [...blocks] } }`.
    // Any non-empty block array at any of these positions counts as a live builder layout.
    if (Array.isArray(record.content) && record.content.length > 0) return true;

    const root = record.root;
    if (root && typeof root === "object") {
        const rootRecord = root as Record<string, unknown>;
        if (Array.isArray(rootRecord.content) && rootRecord.content.length > 0) return true;
    }

    const zones = record.zones;
    if (zones && typeof zones === "object") {
        for (const zone of Object.values(zones as Record<string, unknown>)) {
            if (Array.isArray(zone) && zone.length > 0) return true;
        }
    }

    return false;
}

function resolveTargetHrefSlug(target: { slug: string | null; type: string | null }): string | null {
    if (!target.slug) return null;
    const cleanSlug = target.slug.replace(/^\/+/, "");
    if (cleanSlug === "home") {
        return "";
    }
    if (target.type === "blog") {
        return `blog/${cleanSlug}`;
    }
    return cleanSlug;
}

function resolvePageKind(metadata: Json | null): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
        return null;
    }

    const pageKind = (metadata as Record<string, unknown>).page_kind;
    return typeof pageKind === "string" && pageKind.trim() ? pageKind.trim() : null;
}

export async function createSeoExecutionPreview(
    workspaceId: string,
    recommendationId: string,
    options?: { workspaceLocale?: string | null; automationMode?: SeoAutomationMode; supabase?: SeoSupabaseClient; templateId?: string | null },
) {
    const { recommendation, sourceContent, targetContent } = await getSeoExecutionDependencies(workspaceId, recommendationId, {
        supabase: options?.supabase,
        templateId: options?.templateId,
    });

    const routedSlug = resolveTargetHrefSlug(targetContent);

    // Markdown-only fork: pages that render from content_markdown without a builder
    // visual_layout get a markdown-direct preview so the engine can still auto-link
    // them. The apply step writes back to content_markdown instead of visual_layout.
    const markdown = (sourceContent.content_markdown ?? "").trim();
    if (markdown.length > 0 && !hasMeaningfulVisualLayout(sourceContent.visual_layout)) {
        const builderSignals = resolveBuilderSignals(sourceContent.metadata ?? null);
        return await buildMarkdownDirectPreview({
            recommendationId: recommendation.id,
            sourceContentId: sourceContent.id,
            sourceTitle: recommendation.source_title,
            sourceSlug: sourceContent.slug,
            contentMarkdown: markdown,
            target: { id: targetContent.id, title: targetContent.title, slug: routedSlug },
            targetTitle: recommendation.target_title,
            anchorText: recommendation.anchor_text,
            workspaceLocale: options?.workspaceLocale ?? null,
            pageIntent: builderSignals.pageIntent,
            conversionGoal: builderSignals.conversionGoal,
        });
    }

    const preview = await buildSeoExecutionPreview({
        recommendationId: recommendation.id,
        source: sourceContent,
        target: { id: targetContent.id, title: targetContent.title, slug: routedSlug },
        sourceTitle: recommendation.source_title,
        targetTitle: recommendation.target_title,
        anchorText: recommendation.anchor_text,
        workspaceLocale: options?.workspaceLocale ?? null,
        automationMode: options?.automationMode,
    });

    return preview;
}

export async function persistSeoExecutionEvent(input: {
    workspaceId: string;
    recommendation: SeoInternalLinkOpportunityRecord;
    preview: SeoExecutionPreview;
    executionStatus: SeoExecutionEventRecord["execution_status"];
    appliedByProfileId?: string | null;
    errorMessage?: string | null;
    supabase?: SeoSupabaseClient;
}) {
    const supabase = input.supabase ?? await createClient();
    const payload = {
        workspace_id: input.workspaceId,
        recommendation_id: input.recommendation.id,
        source_content_id: input.recommendation.source_content_id,
        target_content_id: input.recommendation.target_content_id,
        execution_status: input.executionStatus,
        content_field_mutated: input.preview.fieldPath ?? "visual_layout",
        content_format: input.preview.contentFormat,
        renderer: input.preview.renderer,
        mutation_strategy: input.preview.mutationStrategy,
        source_slug: input.preview.sourceSlug,
        target_slug: input.preview.targetSlug,
        block_id: input.preview.blockId,
        field_path: input.preview.fieldPath,
        locale: input.preview.locale,
        original_content_snapshot: input.preview.originalContent,
        updated_content_snapshot: input.preview.updatedContent,
        original_field_value: input.preview.originalValue,
        updated_field_value: input.preview.updatedValue,
        preview_payload: {
            ...(input.preview as unknown as Record<string, unknown>),
            gsc: (input.recommendation.metadata && typeof input.recommendation.metadata === 'object' && 'gsc' in input.recommendation.metadata)
                ? (input.recommendation.metadata as Record<string, unknown>).gsc
                : null
        } as unknown as Json,
        risk_checks: input.preview.riskChecks as unknown as Json,
        error_message: input.errorMessage ?? null,
        applied_at: input.executionStatus === "applied" ? new Date().toISOString() : null,
        applied_by_profile_id: input.executionStatus === "applied" ? input.appliedByProfileId ?? null : null,
    };

    const { data, error } = await supabase
        .from("seo_execution_events")
        .insert(payload)
        .select("*")
        .single();

    if (error || !data) {
        throw new SeoExecutionError(
            "persistence_failed",
            error?.message ?? "Failed to persist SEO execution event.",
            "The content mutation succeeded but the audit event was not recorded. Rollback will not be possible until the event is written; investigate RLS on seo_execution_events.",
        );
    }

    return data as SeoExecutionEventRecord;
}

export async function applySeoExecutionMutation(input: {
    workspaceId: string;
    recommendation: SeoInternalLinkOpportunityRecord;
    sourceContent: SeoExecutionSourceContent;
    preview: SeoExecutionPreview;
    appliedByProfileId: string | null;
    supabase?: SeoSupabaseClient;
    templateId?: string | null;
}) {
    const supabase = input.supabase ?? await createClient();
    const updatedContent = input.preview.updatedContent;

    if (!updatedContent) {
        throw new SeoExecutionError(
            "state_invalid",
            "Execution preview did not produce a mutated content snapshot.",
        );
    }

    // Two-phase commit: persist the audit event with `previewed` status BEFORE
    // mutating content_items. If the runtime dies between steps, the snapshot
    // and original-value are preserved on the event row, so rollback / forensic
    // investigation remain possible. The previous order (mutate then persist)
    // had a partial-failure window where content was already changed but no
    // audit row existed — rollback was impossible.
    const preflightEvent = await persistSeoExecutionEvent({
        workspaceId: input.workspaceId,
        recommendation: input.recommendation,
        preview: input.preview,
        executionStatus: "previewed",
        appliedByProfileId: input.appliedByProfileId,
        supabase,
    });

    const promoteEvent = async (status: SeoExecutionEventRecord["execution_status"], errorMessage?: string) => {
        const updates: Record<string, unknown> = { execution_status: status };
        if (status === "applied") {
            updates.applied_at = new Date().toISOString();
            updates.applied_by_profile_id = input.appliedByProfileId ?? null;
        } else if (errorMessage) {
            updates.error_message = errorMessage;
        }
        await supabase
            .from("seo_execution_events")
            .update(updates)
            .eq("id", preflightEvent.id)
            .eq("workspace_id", input.workspaceId);
    };

    try {
        // Markdown-direct path: preview targeted content_markdown directly. Persist the
        // mutated markdown body (already plain text, not JSON) without parsing.
        if (input.preview.contentField === "content_markdown") {
            let updateQuery = supabase
                .from("content_items")
                .update({
                    content_markdown: updatedContent,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", input.sourceContent.id)
                .eq("workspace_id", input.workspaceId)
                .eq("updated_at", input.sourceContent.updated_at);
            const templateId = input.templateId ?? input.sourceContent.template_id;
            if (templateId) {
                updateQuery = updateQuery.eq("template_id", templateId);
            }
            if (input.sourceContent.locale) {
                updateQuery = updateQuery.eq("locale", input.sourceContent.locale);
            }
            const { data: updatedRow, error: updateError } = await updateQuery.select("id").maybeSingle();

            if (updateError || !updatedRow) {
                const message = updateError?.message ?? "Source content changed after preview; markdown mutation was not applied.";
                await promoteEvent("failed", message);
                throw new SeoExecutionError(
                    updateError ? "persistence_failed" : "conflict",
                    updateError?.message ?? "SEO markdown mutation was blocked because the source content changed after preview.",
                    updateError ? undefined : "Refresh the recommendation preview and apply again so newer editorial changes are preserved.",
                );
            }
        } else {
            let nextVisualLayout: Json;
            try {
                nextVisualLayout = JSON.parse(updatedContent) as Json;
            } catch {
                await promoteEvent("failed", "Updated-content snapshot is not valid JSON.");
                throw new SeoExecutionError(
                    "snapshot_corrupted",
                    "Updated-content snapshot is not valid JSON.",
                    "Regenerate the preview and try again.",
                );
            }

            const { deepSanitizeJsonText } = await import("@/features/seo/lib/sanitize");
            nextVisualLayout = deepSanitizeJsonText(nextVisualLayout) as Json;

            let updateQuery = supabase
                .from("content_items")
                .update({
                    visual_layout: nextVisualLayout,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", input.sourceContent.id)
                .eq("workspace_id", input.workspaceId)
                .eq("updated_at", input.sourceContent.updated_at);
            const templateId = input.templateId ?? input.sourceContent.template_id;
            if (templateId) {
                updateQuery = updateQuery.eq("template_id", templateId);
            }
            if (input.sourceContent.locale) {
                updateQuery = updateQuery.eq("locale", input.sourceContent.locale);
            }
            const { data: updatedRow, error: updateError } = await updateQuery.select("id").maybeSingle();

            if (updateError || !updatedRow) {
                const message = updateError?.message ?? "Source content changed after preview; visual layout mutation was not applied.";
                await promoteEvent("failed", message);
                throw new SeoExecutionError(
                    updateError ? "persistence_failed" : "conflict",
                    updateError?.message ?? "SEO visual-layout mutation was blocked because the source content changed after preview.",
                    updateError ? undefined : "Refresh the recommendation preview and apply again so newer editorial changes are preserved.",
                );
            }
        }
    } catch (err) {
        // Catches non-Supabase errors (e.g. sanitize crash) so the event row
        // is still promoted to `failed` rather than left in `previewed` limbo.
        if (!(err instanceof SeoExecutionError)) {
            const message = err instanceof Error ? err.message : "Unknown apply error.";
            await promoteEvent("failed", message);
        }
        throw err;
    }

    await promoteEvent("applied");
    const { data: refreshed } = await supabase
        .from("seo_execution_events")
        .select("*")
        .eq("id", preflightEvent.id)
        .eq("workspace_id", input.workspaceId)
        .single();
    const executionEvent = (refreshed ?? preflightEvent) as SeoExecutionEventRecord;

    const recommendationUpdates: Database["public"]["Tables"]["seo_internal_link_opportunities"]["Update"] = {
        status: "applied",
        last_preview_at: new Date().toISOString(),
        last_preview_payload: input.preview as unknown as Json,
        last_execution_event_id: executionEvent.id,
        manual_review_reason: null,
        failed_reason: null,
        failed_at: null,
        applied_at: executionEvent.applied_at,
        applied_by_profile_id: input.appliedByProfileId,
    };

    const { error: recommendationError } = await supabase
        .from("seo_internal_link_opportunities")
        .update(recommendationUpdates)
        .eq("id", input.recommendation.id)
        .eq("workspace_id", input.workspaceId);

    if (recommendationError) {
        throw new Error(recommendationError.message ?? "Failed to update recommendation execution state.");
    }

    await revalidateSeoPaths({
        slug: input.sourceContent.slug,
        type: input.sourceContent.type,
        id: input.sourceContent.id,
        pageKind: resolvePageKind(input.sourceContent.metadata),
    });

    return executionEvent;
}

export async function rollbackSeoExecutionMutation(input: {
    workspaceId: string;
    executionId: string;
    rolledBackByProfileId: string | null;
}) {
    const supabase = await createClient();
    const { data: eventRow, error: eventError } = await supabase
        .from("seo_execution_events")
        .select("*")
        .eq("id", input.executionId)
        .eq("workspace_id", input.workspaceId)
        .maybeSingle();

    if (eventError) {
        throw new SeoExecutionError(
            "persistence_failed",
            eventError.message ?? "Failed to load SEO execution event.",
        );
    }

    if (!eventRow) {
        throw new SeoExecutionError("not_found", "SEO execution event not found.");
    }

    const event = eventRow as SeoExecutionEventRecord;
    if (event.execution_status !== "applied") {
        throw new SeoExecutionError(
            "state_invalid",
            "Only applied SEO execution events can be rolled back.",
            "This event is already rolled back or was never successfully applied.",
        );
    }

    const isMarkdownEvent = event.content_field_mutated === "content_markdown";
    const { data: sourceContent, error: sourceError } = await supabase
        .from("content_items")
        .select("id,workspace_id,title,slug,type,visual_layout,content_markdown,metadata")
        .eq("id", event.source_content_id)
        .eq("workspace_id", input.workspaceId)
        .maybeSingle();

    if (sourceError) {
        throw new SeoExecutionError(
            "persistence_failed",
            sourceError.message ?? "Failed to load source content for rollback.",
        );
    }

    if (!sourceContent) {
        throw new SeoExecutionError(
            "not_found",
            "Source content item for rollback was not found.",
            "The underlying page may have been deleted. Delete this execution event if it is no longer needed.",
        );
    }

    const currentSnapshotForCompare = isMarkdownEvent
        ? (sourceContent.content_markdown ?? "")
        : JSON.stringify(sourceContent.visual_layout ?? null);
    if (currentSnapshotForCompare !== (event.updated_content_snapshot ?? "")) {
        await supabase
            .from("seo_execution_events")
            .update({
                rollback_status: "conflict",
                error_message: "Current source content no longer matches the applied snapshot. Manual rollback is required.",
            })
            .eq("id", event.id)
            .eq("workspace_id", input.workspaceId);

        await supabase
            .from("seo_internal_link_opportunities")
            .update({
                status: "manual_review_required",
                manual_review_reason: "Rollback was blocked because the source content changed after the link was applied.",
            })
            .eq("id", event.recommendation_id)
            .eq("workspace_id", input.workspaceId);

        throw new SeoExecutionError(
            "conflict",
            "Rollback blocked because the source content changed after the link was applied.",
            "Edit the page manually to remove the link, or delete this execution event and run a fresh audit.",
        );
    }

    const restoreUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (isMarkdownEvent) {
        restoreUpdate.content_markdown = event.original_content_snapshot ?? "";
    } else {
        try {
            restoreUpdate.visual_layout = JSON.parse(event.original_content_snapshot) as Json;
        } catch {
            throw new SeoExecutionError(
                "snapshot_corrupted",
                "Stored original-content snapshot could not be parsed.",
                "The original content cannot be restored automatically. Edit the page manually and delete this execution event.",
            );
        }
    }

    const { error: contentError } = await supabase
        .from("content_items")
        .update(restoreUpdate)
        .eq("id", event.source_content_id)
        .eq("workspace_id", input.workspaceId);

    if (contentError) {
        throw new SeoExecutionError(
            "persistence_failed",
            contentError.message ?? "Failed to restore original content during rollback.",
        );
    }

    const rollbackAt = new Date().toISOString();

    const { error: eventUpdateError } = await supabase
        .from("seo_execution_events")
        .update({
            execution_status: "rolled_back",
            rollback_status: "rolled_back",
            rollback_at: rollbackAt,
            rolled_back_by_profile_id: input.rolledBackByProfileId,
        })
        .eq("id", event.id)
        .eq("workspace_id", input.workspaceId);

    if (eventUpdateError) {
        throw new SeoExecutionError(
            "persistence_failed",
            eventUpdateError.message ?? "Failed to update rollback audit event.",
        );
    }

    const { error: recommendationError } = await supabase
        .from("seo_internal_link_opportunities")
        .update({
            status: "rolled_back",
            rolled_back_at: rollbackAt,
            last_execution_event_id: event.id,
        })
        .eq("id", event.recommendation_id)
        .eq("workspace_id", input.workspaceId);

    if (recommendationError) {
        throw new SeoExecutionError(
            "persistence_failed",
            recommendationError.message ?? "Failed to update recommendation rollback state.",
        );
    }

    await revalidateSeoPaths({
        slug: sourceContent.slug,
        type: sourceContent.type,
        id: sourceContent.id,
        pageKind: resolvePageKind(sourceContent.metadata ?? null),
    });

    return {
        eventId: event.id,
        recommendationId: event.recommendation_id,
    };
}

export function getManualReviewReason(previewPayload: Json | null, fallback: string | null) {
    const payload = asRecord(previewPayload);
    return typeof payload.manualReviewReason === "string" ? payload.manualReviewReason : fallback;
}
