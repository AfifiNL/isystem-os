import type { Json } from "@/shared/lib/supabase/database.types";
import { Constants } from "@/shared/lib/supabase/database.types";
import type { SeoIndexingDisplayStatus } from "@/features/seo/indexing/status";

// Status enums sourced directly from the DB-generated `Constants` export so
// adding a value to a Postgres enum flows everywhere — runtime arrays for
// iteration (status badges, count queries) and TypeScript types for
// compile-time exhaustiveness — without manual cherry-picking that drifts.
export const SEO_RECOMMENDATION_STATUS_VALUES = Constants.public.Enums.seo_recommendation_status;
export const SEO_PLAN_STATUS_VALUES = Constants.public.Enums.seo_plan_status;
export const SEO_RUN_STATUS_VALUES = ["queued", "running", "completed", "failed"] as const;
export const SEO_RUN_TYPE_VALUES = ["specialist_audit", "strategist_analysis", "content_graph_refresh"] as const;
export const SEO_EXECUTION_STATUS_VALUES = Constants.public.Enums.seo_execution_status;
export const SEO_ROLLBACK_STATUS_VALUES = Constants.public.Enums.seo_rollback_status;
export const SEO_FUNNEL_STAGE_VALUES = Constants.public.Enums.seo_funnel_stage;
export const SEO_OPPORTUNITY_TYPE_VALUES = Constants.public.Enums.seo_opportunity_type;

export type SeoRecommendationStatus = (typeof SEO_RECOMMENDATION_STATUS_VALUES)[number];
export type SeoPlanStatus = (typeof SEO_PLAN_STATUS_VALUES)[number];
export type SeoRunType = (typeof SEO_RUN_TYPE_VALUES)[number];
export type SeoRunStatus = (typeof SEO_RUN_STATUS_VALUES)[number];
export type SeoFunnelStage = (typeof SEO_FUNNEL_STAGE_VALUES)[number];
export type SeoOpportunityType = (typeof SEO_OPPORTUNITY_TYPE_VALUES)[number];
export type SeoExecutionStatus = (typeof SEO_EXECUTION_STATUS_VALUES)[number];
export type SeoRollbackStatus = (typeof SEO_ROLLBACK_STATUS_VALUES)[number];

export type SeoBuilderContentFormat = "builder_markdown" | "builder_rich_text_html" | "builder_plain_text" | "unsupported";
export type SeoRendererType = "builder_rich_text_renderer" | "builder_markdown_renderer" | "builder_plain_text_literal" | "manual_review_required";
export type SeoRendererCompatibilityStatus = "safe_automatic_linking" | "manual_review_only";
export type SeoAutomationTier = "native" | "fallback_field" | "manual_review";
export type SeoTargetPageType = "contact" | "home" | "service" | "about" | "projects" | "blog" | "newsletter" | "generic";
export type SeoMutationStrategy =
    | "builder_structured_markdown_link"
    | "builder_structured_markdown_sentence_link"
    | "builder_structured_markdown_rephrase_link"
    | "builder_structured_html_text_node"
    | "builder_structured_html_sentence_link"
    | "builder_structured_html_rephrase_link"
    | "manual_review";

export type SeoMutationStep = "exact_anchor_replacement" | "contextual_sentence_insertion" | "controlled_semantic_rephrase" | "manual_review";

export interface SeoMutationCandidateDiagnostic {
    blockId: string;
    blockType: string;
    fieldPath: string;
    locale: string | null;
    contentFormat: SeoBuilderContentFormat;
    renderer: SeoRendererType;
    compatibilityStatus: SeoRendererCompatibilityStatus;
    status: "selected" | "fallback_skipped" | "rejected";
    rankingScore: number | null;
    summary: string;
    rendererCompatibility: string;
    semanticFit: "safe" | "degraded" | "rejected";
    decisionReason: string;
}

export interface SeoRiskCheckResult {
    key: string;
    label: string;
    passed: boolean;
    severity: "info" | "warning" | "error";
    message: string;
}

export interface SeoExecutionPreview {
    recommendationId: string;
    sourceContentId: string;
    targetContentId: string;
    sourceTitle: string;
    targetTitle: string;
    sourceSlug: string | null;
    targetSlug: string | null;
    anchorText: string;
    supported: boolean;
    automationTier: SeoAutomationTier;
    blockId: string | null;
    blockType: string | null;
    fieldPath: string | null;
    locale: string | null;
    contentFormat: SeoBuilderContentFormat;
    renderer: SeoRendererType;
    mutationStrategy: SeoMutationStrategy;
    mutationStep: SeoMutationStep;
    targetReason: string;
    strategyReason: string;
    locationRationale: string;
    rendererCompatibility: string;
    beforeSnippet: string;
    afterSnippet: string;
    originalValue: string;
    updatedValue: string | null;
    originalContent: string;
    updatedContent: string | null;
    manualReviewReason: string | null;
    skippedFallbacks: string[];
    candidateDiagnostics: SeoMutationCandidateDiagnostic[];
    riskChecks: SeoRiskCheckResult[];
    /**
     * Which column on content_items the apply step should write to. Defaults to
     * "visual_layout" for builder-managed pages. Set to "content_markdown" when
     * the source page is markdown-only so the apply step writes the mutated markdown
     * directly instead of an unused visual_layout snapshot.
     */
    contentField?: "visual_layout" | "content_markdown";
}

export interface SeoBuilderBlockAdapter {
    blockType: string;
    displayName: string;
    automationTier?: Exclude<SeoAutomationTier, "manual_review">;
    preferredInsertionStyle: "exact_then_sentence_then_rephrase" | "exact_then_rephrase_then_sentence" | "manual_review_only";
    prefersExactReplacement: boolean;
    prefersRephrase: boolean;
    maxMutationScope: "single_sentence" | "single_paragraph_fragment";
    fallbackAppendAllowed: boolean;
    sentencePolicy: "append_only" | "rephrase_only" | "append_then_rephrase" | "rephrase_then_append" | "manual_review_only";
    allowedOutputFormat: SeoBuilderContentFormat;
    importanceScore: number;
    conversionProximity: number;
    safeFields: string[];
}

export interface SeoBuilderMutationTarget {
    blockId: string;
    blockType: string;
    fieldPath: string;
    locale: string | null;
    contentFormat: Exclude<SeoBuilderContentFormat, "unsupported">;
    renderer: SeoRendererType;
    compatibilityStatus: SeoRendererCompatibilityStatus;
    automationTier: SeoAutomationTier;
    preferredStrategies: SeoMutationStrategy[];
    adapter: SeoBuilderBlockAdapter;
    currentValue: string;
    reason: string;
    compatibilityNote: string;
    rankingScore: number;
    rankingBreakdown: string[];
    sourceOrder: number;
}

export type SeoExecutionErrorKind =
    | "not_found"
    | "state_invalid"
    | "conflict"
    | "snapshot_corrupted"
    | "persistence_failed"
    | "forbidden"
    | "unknown";

export interface SeoExecutionActionResult {
    ok: boolean;
    message: string;
    preview?: SeoExecutionPreview;
    executionId?: string;
    recommendationStatus?: SeoRecommendationStatus;
    errorKind?: SeoExecutionErrorKind;
    /** Human-facing guidance when ok===false and the user can still take action (e.g. resolve a conflict). */
    resolution?: string;
}

export interface SeoPublishedContentItem {
    id: string;
    title: string;
    slug: string;
    type: string;
    status: string;
    locale?: string | null;
    contentMarkdown: string;
    /** Concatenated narrative text extracted from visual_layout (description/body/subtitle/missionText/visionText fields). Empty for markdown-only content. */
    visualLayoutText: string;
    excerpt: string;
    keywords: string[];
    /** Outbound link targets — both markdown-extracted slugs and builder anchor hrefs (locale-stripped). */
    links: string[];
    createdAt: string;
    updatedAt: string;
    metadata: Json | null;
    pageIntent: string | null;
    audienceType: string | null;
    conversionGoal: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
}

export interface SeoContentAnalytics {
    slug: string;
    pageViews: number;
    conversions: number;
    ctaClicks: number;
    lastSeenAt: string | null;
}

export interface SeoOverviewMetrics {
    publishedCount: number;
    orphanCount: number;
    internalLinkOpportunityCount: number;
    openLinkOpportunityCount: number;
    approvedLinkOpportunityCount: number;
    strategistOpportunityCount: number;
    savedPlanCount: number;
    averagePriorityScore: number;
    totalPageViews: number;
    totalConversions: number;
}

export interface SeoInternalLinkOpportunityRecord {
    id: string;
    workspace_id: string;
    run_id: string | null;
    /** Content language of the source/target pair (en|nl|ar). */
    locale: string;
    status: SeoRecommendationStatus;
    source_content_id: string;
    target_content_id: string;
    source_slug: string | null;
    target_slug: string | null;
    source_title: string;
    target_title: string;
    anchor_text: string;
    rationale: string | null;
    source_excerpt: string | null;
    target_excerpt: string | null;
    source_traffic: number;
    target_conversions: number;
    target_conversion_goal: string | null;
    semantic_fit_score: number;
    analytics_score: number;
    strategic_importance_score: number;
    priority_score: number;
    confidence_score: number;
    existing_link_count: number;
    is_orphan_target: boolean;
    suggestion: Json;
    metadata: Json;
    last_preview_at: string | null;
    last_preview_payload: Json;
    manual_review_reason: string | null;
    applied_at: string | null;
    applied_by_profile_id: string | null;
    failed_at: string | null;
    failed_reason: string | null;
    rolled_back_at: string | null;
    last_execution_event_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface SeoExecutionEventRecord {
    id: string;
    workspace_id: string;
    recommendation_id: string;
    source_content_id: string;
    target_content_id: string;
    execution_status: SeoExecutionStatus;
    rollback_status: SeoRollbackStatus;
    content_field_mutated: string;
    content_format: string;
    renderer: string;
    mutation_strategy: string;
    source_slug: string | null;
    target_slug: string | null;
    original_content_snapshot: string;
    updated_content_snapshot: string | null;
    preview_payload: Json;
    risk_checks: Json;
    error_message: string | null;
    applied_at: string | null;
    applied_by_profile_id: string | null;
    rollback_at: string | null;
    rolled_back_by_profile_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface SeoContentOpportunityRecord {
    id: string;
    workspace_id: string;
    run_id: string | null;
    cluster_id: string | null;
    plan_id: string | null;
    /** Content language of the opportunity (en|nl|ar). */
    locale: string;
    status: SeoRecommendationStatus;
    opportunity_type: SeoOpportunityType;
    title: string;
    topic: string;
    summary: string | null;
    rationale: string | null;
    cluster_name: string | null;
    recommended_format: string | null;
    target_intent: string | null;
    funnel_stage: SeoFunnelStage | null;
    target_conversion_goal: string | null;
    blue_ocean_score: number;
    analytics_score: number;
    strategic_importance_score: number;
    priority_score: number;
    analytics_snapshot: Json;
    inventory_snapshot: Json;
    metadata: Json;
    draft_content_item_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface SeoTopicClusterRecord {
    id: string;
    workspace_id: string;
    run_id: string | null;
    /** Content language this cluster covers (en|nl|ar). */
    locale: string;
    status: SeoPlanStatus;
    name: string;
    pillar_topic: string | null;
    summary: string | null;
    primary_intent: string | null;
    funnel_stage: SeoFunnelStage | null;
    target_conversion_goal: string | null;
    priority_score: number;
    supporting_topics: Json;
    metadata: Json;
    created_at: string;
    updated_at: string;
}

export interface SeoContentPlanRecord {
    id: string;
    workspace_id: string;
    run_id: string | null;
    cluster_id: string | null;
    /** Content language of the plan brief (en|nl|ar). */
    locale: string;
    status: SeoPlanStatus;
    title: string;
    slug_suggestion: string | null;
    primary_keyword: string | null;
    secondary_keywords: Json;
    intent_stage: string | null;
    funnel_stage: SeoFunnelStage | null;
    target_conversion_goal: string | null;
    brief_markdown: string | null;
    outline: Json;
    metadata: Json;
    priority_score: number;
    draft_content_item_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface SeoRunRecord {
    id: string;
    workspace_id: string;
    run_type: SeoRunType;
    /** Content language this run analyzed (en|nl|ar). */
    locale: string;
    status: SeoRunStatus;
    summary: Json;
    totals: Json;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
}

export interface SeoInternalLinkJobRecord {
    id: string;
    workspace_id: string;
    content_id: string;
    locale: string;
    status: string;
    summary: Json;
    cost_summary_millicents: number;
    error_message: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SeoIndexingAttemptRecord {
    id: string;
    job_id: string;
    workspace_id: string;
    provider: "sitemap" | "url_inspection" | "indexing_api" | string;
    status: "success" | "failed" | "skipped" | string;
    request_payload: Json;
    response_json: Json | null;
    error: string | null;
    created_at: string;
}

export interface SeoIndexingJobRecord {
    id: string;
    workspace_id: string;
    content_id: string | null;
    url: string;
    canonical_path: string;
    source_event: string;
    status: string;
    attempt_count: number;
    next_attempt_at: string | null;
    last_attempt_at: string | null;
    last_error: string | null;
    last_inspection: Json | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
}

export interface SeoIndexingDashboardRow {
    contentId: string;
    title: string;
    slug: string;
    type: "blog" | "page";
    locale: string | null;
    canonicalUrl: string;
    canonicalPath: string;
    displayStatus: SeoIndexingDisplayStatus;
    action: "queue" | "retry" | "none";
    isPending: boolean;
    needsAction: boolean;
    job: SeoIndexingJobRecord | null;
    attempts: SeoIndexingAttemptRecord[];
    latestAttempt: SeoIndexingAttemptRecord | null;
}

export interface SeoIndexingDashboardCounts {
    total: number;
    indexed: number;
    pending: number;
    submitted: number;
    failed: number;
    notSubmitted: number;
    needsAction: number;
}

export interface SeoOrphanContentItem {
    id: string;
    title: string;
    slug: string;
    type: string;
    incomingLinks: number;
    pageViews: number;
    conversions: number;
    conversionGoal: string | null;
}

export interface SeoListPageMeta {
    page: number;
    pageSize: number;
    total: number;
}

export interface SeoDashboardData {
    workspace: {
        id: string;
        name: string;
        workspaceTier: "basic" | "pro";
        defaultLocale: string;
        seoAutomationMode: "conservative" | "standard" | "aggressive";
        seoAutoApplyMinAgeSeconds: number;
    };
    /** Locale this dashboard view is scoped to (resolved from query.locale). */
    activeLocale: string;
    overview: SeoOverviewMetrics;
    inventory: SeoPublishedContentItem[];
    analytics: SeoContentAnalytics[];
    searchConsoleSignals?: import("@/features/seo/lib/inventory").GscPageSummary[];
    gscSyncRuns?: Record<string, unknown>[];
    gscTopQueries?: import("@/features/seo/lib/strategist-context").SeoQuerySignal[];
    gscNearPageOne?: import("@/features/seo/lib/strategist-context").SeoQuerySignal[];
    gscLowCtr?: import("@/features/seo/lib/strategist-context").SeoQuerySignal[];
    gscInternalLinkOpportunities: SeoInternalLinkOpportunityRecord[];
    orphanContent: SeoOrphanContentItem[];
    internalLinkOpportunities: SeoInternalLinkOpportunityRecord[];
    internalLinkOpportunitiesPage: SeoListPageMeta;
    internalLinkStatusCounts: Record<string, number>;
    contentOpportunities: SeoContentOpportunityRecord[];
    contentOpportunitiesPage: SeoListPageMeta;
    contentOpportunityStatusCounts: Record<string, number>;
    topicClusters: SeoTopicClusterRecord[];
    topicClustersPage: SeoListPageMeta;
    contentPlans: SeoContentPlanRecord[];
    contentPlansPage: SeoListPageMeta;
    contentPlanStatusCounts: Record<string, number>;
    executionEvents: SeoExecutionEventRecord[];
    runs: SeoRunRecord[];
    internalLinkJobs: SeoInternalLinkJobRecord[];
    indexingRows: SeoIndexingDashboardRow[];
    indexingCounts: SeoIndexingDashboardCounts;
}

export interface SeoDashboardQuery {
    /** Locale to view recommendations for. Defaults to the workspace default. */
    locale?: string;
    internalLinksPage?: number;
    internalLinksPageSize?: number;
    internalLinksStatuses?: string[];
    internalLinksSearch?: string;
    contentOppsPage?: number;
    contentOppsPageSize?: number;
    contentOppsStatuses?: string[];
    contentOppsSearch?: string;
    clustersPage?: number;
    clustersPageSize?: number;
    plansPage?: number;
    plansPageSize?: number;
    plansStatuses?: string[];
    plansSearch?: string;
}

// ─── Blog post one-click SEO enhancement ─────────────────────────────────────

export type BlogEnhancementProposalType =
    | "internal_link_insertion"
    | "external_reference_insertion"
    | "external_citation_sentence"
    | "paragraph_paraphrase"
    | "meta_title_refresh"
    | "meta_description_refresh"
    | "heading_optimization"
    | "editorial_validation_remediation";

export type BlogEnhancementCategory = "links" | "copy" | "meta";

export type BlogEnhancementRiskFlag =
    | "changes_meaning"
    | "external_link_unverified"
    | "strips_attribution"
    | "heading_level_shift"
    | "blocked_domain";

export type BlogEnhancementRunStatus =
    | "previewed"
    | "partially_applied"
    | "applied"
    | "rolled_back"
    | "expired";

/**
 * One atomic proposal within an enhancement run. Every proposal carries enough
 * information (original + proposed + offsets) to be applied or skipped
 * independently on the client; the server re-validates offsets against the
 * snapshot at apply time to detect concurrent edits.
 */
export interface BlogEnhancementProposal {
    id: string;
    type: BlogEnhancementProposalType;
    category: BlogEnhancementCategory;
    // Either a source-markdown range (links, paraphrase, heading) OR a metadata path
    // (meta). For markdown-range proposals, startOffset/endOffset refer to the
    // snapshot_before markdown; for meta proposals, both are -1 and metaPath is set.
    startOffset: number;
    endOffset: number;
    metaPath: string | null;
    original: string;
    proposed: string;
    rationale: string;
    riskFlags: BlogEnhancementRiskFlag[];
    estimatedCostMillicents: number;
}

export interface BlogEnhancementPreview {
    runId: string;
    contentId: string;
    workspaceId: string;
    sourceFingerprint: string;
    proposals: BlogEnhancementProposal[];
    totalEstimatedCostMillicents: number;
    createdAt: string;
    expiresAt: string;
}

export interface BlogEnhancementSnapshot {
    contentMarkdown: string;
    metadata: Record<string, unknown>;
    contentUpdatedAt: string | null;
    fingerprint: string;
}

export interface BlogEnhancementRunRecord {
    id: string;
    workspace_id: string;
    content_id: string;
    actor_profile_id: string | null;
    status: BlogEnhancementRunStatus;
    proposal_count: number;
    accepted_count: number;
    preview_payload: BlogEnhancementPreview;
    snapshot_before: BlogEnhancementSnapshot;
    snapshot_after: BlogEnhancementSnapshot | null;
    total_charged_millicents: number;
    expires_at: string;
    created_at: string;
    applied_at: string | null;
    rolled_back_at: string | null;
}

export interface BlogEnhancementActionResult<T = unknown> {
    data: T | null;
    error: string | null;
    /** Non-fatal feedback-loop emission outcomes. Apply/rollback succeeded, but
     *  these warnings surface when observability writes (link-graph, proposal
     *  events, learned authority) failed so operators can triage RLS/schema
     *  drift without the action itself rolling back. */
    feedbackWarnings?: string[];
}
