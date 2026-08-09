import { BUSINESS_SPINE_WORKFLOW_EVENTS } from "@/features/business-spine/workflow-events";
import type { Json } from "@/shared/lib/supabase/database.types";

export const WORKFLOW_RULE_INSERT_COLUMNS = [
    "workspace_id",
    "name",
    "trigger_key",
    "is_enabled",
    "requires_approval",
    "condition_json",
    "action_json",
    "metadata",
] as const;

export const WORKFLOW_RULE_CANONICAL_COLUMNS = [
    "id",
    "workspace_id",
    "name",
    "trigger_key",
    "is_enabled",
    "requires_approval",
    "condition_json",
    "action_json",
    "created_by",
    "metadata",
    "created_at",
    "updated_at",
] as const;

const WORKFLOW_RULE_CANONICAL_COLUMN_SET = new Set<string>(WORKFLOW_RULE_CANONICAL_COLUMNS);
const WORKFLOW_RULE_REPAIR_MIGRATION = "20260613111500_workflow_rules_canonical_repair.sql";

type WorkflowRuleMetadata = Record<string, unknown>;

export type WorkflowRuleWritePayload = {
    workspace_id: string;
    name: string;
    trigger_key: string;
    is_enabled: boolean;
    requires_approval: boolean;
    condition_json: Json;
    action_json: Json;
    metadata: Json;
};

function metadataRecord(value: unknown): WorkflowRuleMetadata {
    return value && typeof value === "object" && !Array.isArray(value) ? value as WorkflowRuleMetadata : {};
}

export function buildWorkflowRuleMetadata(input: {
    existingMetadata?: unknown;
    killSwitch: boolean;
}): Json {
    return {
        ...metadataRecord(input.existingMetadata),
        kill_switch: input.killSwitch,
        managed_from: "dashboard_automations",
    } as Json;
}

export function buildWorkflowRuleWritePayload(input: {
    workspaceId: string;
    name: string;
    triggerKey: string;
    isEnabled: boolean;
    requiresApproval: boolean;
    conditionJson: unknown;
    actionJson: unknown;
    killSwitch: boolean;
    existingMetadata?: unknown;
}): WorkflowRuleWritePayload {
    return {
        workspace_id: input.workspaceId,
        name: input.name,
        trigger_key: input.triggerKey,
        is_enabled: input.isEnabled,
        requires_approval: input.requiresApproval,
        condition_json: input.conditionJson as Json,
        action_json: input.actionJson as Json,
        metadata: buildWorkflowRuleMetadata({
            existingMetadata: input.existingMetadata,
            killSwitch: input.killSwitch,
        }),
    };
}

export function getMissingWorkflowRuleSchemaCacheColumn(error: { code?: string; message?: string } | null | undefined) {
    const message = error?.message ?? "";
    if (error?.code !== "PGRST204" || !/workspace_workflow_rules/i.test(message) || !/schema cache/i.test(message)) {
        return null;
    }

    const missingColumn = message.match(/'([^']+)'\s+column/i)?.[1];
    if (!missingColumn || !WORKFLOW_RULE_CANONICAL_COLUMN_SET.has(missingColumn)) return null;
    return missingColumn;
}

export function isMissingWorkflowRuleSchemaCacheError(error: { code?: string; message?: string } | null | undefined) {
    return getMissingWorkflowRuleSchemaCacheColumn(error) !== null;
}

export function isMissingWorkflowActionJsonSchemaCacheError(error: { code?: string; message?: string } | null | undefined) {
    return getMissingWorkflowRuleSchemaCacheColumn(error) === "action_json";
}

export function formatWorkflowRuleSchemaError(error: { code?: string; message?: string } | null | undefined) {
    const missingColumn = getMissingWorkflowRuleSchemaCacheColumn(error);
    if (!missingColumn) return error?.message ?? "Workflow rule write failed.";
    return `Workflow rules schema is incomplete: PostgREST cannot find workspace_workflow_rules.${missingColumn} in the schema cache. Apply migration ${WORKFLOW_RULE_REPAIR_MIGRATION} (or reload the PostgREST schema cache if it is already applied), then retry.`;
}

type WorkflowTemplateSeed = {
    id: string;
    name: string;
    triggerKey: string;
    conditionJson: Record<string, never>;
    actionJson: [{
        type: "create_work_item";
        title: string;
        kind: string;
        priority: "low" | "normal" | "high" | "urgent";
        description: string;
        metadata: { template: string };
    }];
};

export const WORKFLOW_TEMPLATE_EXCLUSIONS: Array<{ triggerKey: string; reason: string }> = [
    {
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_COMPLETED,
        reason: "Completion already creates a mandatory idempotent human-review commercial follow-up item in the booking recorder.",
    },
];

function workItemTemplate(input: {
    id: string;
    name: string;
    triggerKey: string;
    title: string;
    kind: string;
    priority: "low" | "normal" | "high" | "urgent";
    description: string;
}): WorkflowTemplateSeed {
    return {
        id: input.id,
        name: input.name,
        triggerKey: input.triggerKey,
        conditionJson: {},
        actionJson: [{
            type: "create_work_item",
            title: input.title,
            kind: input.kind,
            priority: input.priority,
            description: input.description,
            metadata: { template: input.id },
        }],
    };
}

export const WORKFLOW_TEMPLATES = [
    workItemTemplate({
        id: "booking_pending_review",
        name: "Booking pending review creates high-priority work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_PENDING_REVIEW,
        title: "Review pending booking",
        kind: "booking_review",
        priority: "high",
        description: "A booking entered pending review and needs operator confirmation.",
    }),
    workItemTemplate({
        id: "legal_signed_follow_up",
        name: "Legal agreement signed creates follow-up",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_SIGNED,
        title: "Follow up after signed agreement",
        kind: "legal_follow_up",
        priority: "normal",
        description: "Agreement was signed. Confirm delivery handoff, SLA posture, or invoice next step.",
    }),
    workItemTemplate({
        id: "gsc_near_page_one",
        name: "GSC near-page-one creates content refresh",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.GSC_OPPORTUNITY_DETECTED,
        title: "Refresh near-page-one content",
        kind: "content_refresh",
        priority: "high",
        description: "Search Console found a near-page-one opportunity that should become growth work.",
    }),
    workItemTemplate({
        id: "integration_failing",
        name: "Integration failing creates ops work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.INTEGRATION_FAILING,
        title: "Investigate failing integration",
        kind: "ops_integration_failure",
        priority: "urgent",
        description: "A tracked provider, worker, or cron surface is failing.",
    }),
    workItemTemplate({
        id: "contact_submitted_follow_up",
        name: "Contact submitted creates inbound lead review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CONTACT_SUBMITTED,
        title: "Review new contact submission",
        kind: "inbound_lead_review",
        priority: "high",
        description: "A new contact form submission arrived. Review intent, owner, and next response before taking action.",
    }),
    workItemTemplate({
        id: "newsletter_new_subscriber_review",
        name: "Newsletter subscriber creates growth review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_SUBSCRIBED,
        title: "Review new newsletter subscriber",
        kind: "newsletter_growth_review",
        priority: "normal",
        description: "A newsletter contact subscribed. Review attribution and whether the subscriber should enter a growth follow-up path.",
    }),
    workItemTemplate({
        id: "newsletter_confirmed_attribution_review",
        name: "Newsletter confirmation creates attribution review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CONFIRMED,
        title: "Review confirmed newsletter contact",
        kind: "newsletter_attribution_review",
        priority: "low",
        description: "A newsletter contact confirmed opt-in. Review attribution and consent posture before moving them into any manual follow-up path.",
    }),
    workItemTemplate({
        id: "newsletter_campaign_created_review",
        name: "Newsletter campaign creation creates checklist review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CAMPAIGN_CREATED,
        title: "Review created newsletter campaign",
        kind: "newsletter_campaign_checklist",
        priority: "normal",
        description: "A newsletter campaign was created. Review audience, consent posture, and copy readiness before dispatch.",
    }),
    workItemTemplate({
        id: "newsletter_campaign_sent_monitor",
        name: "Newsletter campaign sent creates monitoring review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CAMPAIGN_SENT,
        title: "Monitor sent newsletter campaign",
        kind: "newsletter_campaign_monitoring",
        priority: "normal",
        description: "A newsletter campaign was sent. Monitor provider evidence, replies, bounces, and compliance signals.",
    }),
    workItemTemplate({
        id: "newsletter_bounce_cleanup",
        name: "Newsletter bounce creates deliverability cleanup",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_BOUNCED,
        title: "Review bounced newsletter contact",
        kind: "newsletter_deliverability",
        priority: "high",
        description: "A newsletter message bounced. Review the contact record and deliverability posture before cleanup.",
    }),
    workItemTemplate({
        id: "newsletter_complaint_review",
        name: "Newsletter complaint creates compliance review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_COMPLAINED,
        title: "Review newsletter complaint",
        kind: "newsletter_compliance",
        priority: "urgent",
        description: "A newsletter recipient complained. Review suppression, consent evidence, and compliance follow-up.",
    }),
    workItemTemplate({
        id: "outreach_prospect_approved_review",
        name: "Approved outreach prospect creates sequence review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_PROSPECT_APPROVED,
        title: "Review approved outreach prospect",
        kind: "outreach_prospect_review",
        priority: "normal",
        description: "An outreach prospect was approved. Review source evidence and messaging readiness before contact.",
    }),
    workItemTemplate({
        id: "outreach_contacted_monitor",
        name: "Outreach contact creates monitoring work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_CONTACTED,
        title: "Monitor contacted outreach prospect",
        kind: "outreach_monitoring",
        priority: "low",
        description: "An outreach prospect was contacted. Monitor response posture and suppression requirements before any next step.",
    }),
    workItemTemplate({
        id: "outreach_reply_follow_up",
        name: "Outreach reply creates follow-up",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_REPLIED,
        title: "Follow up on outreach reply",
        kind: "outreach_reply",
        priority: "high",
        description: "An outreach prospect replied. Review the thread and decide the next human follow-up.",
    }),
    workItemTemplate({
        id: "outreach_suppressed_compliance_review",
        name: "Outreach suppression creates compliance review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_SUPPRESSED,
        title: "Review suppressed outreach prospect",
        kind: "outreach_compliance",
        priority: "normal",
        description: "An outreach prospect was suppressed. Review suppression reason and ensure future outreach remains blocked.",
    }),
    workItemTemplate({
        id: "outreach_converted_handoff",
        name: "Outreach conversion creates delivery handoff",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_CONVERTED,
        title: "Convert outreach win into delivery handoff",
        kind: "customer_handoff",
        priority: "high",
        description: "An outreach prospect converted. Confirm customer context, commercial next step, and delivery handoff.",
    }),
    workItemTemplate({
        id: "payment_failed_recovery",
        name: "Payment failure creates recovery review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_FAILED,
        title: "Review failed payment",
        kind: "payment_recovery",
        priority: "urgent",
        description: "A payment failed. Review provider evidence, booking impact, and recovery communication before action.",
    }),
    workItemTemplate({
        id: "payment_approved_capture_review",
        name: "Payment approval creates capture readiness review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_APPROVED,
        title: "Review approved payment",
        kind: "payment_capture_readiness",
        priority: "normal",
        description: "A payment was approved by the provider. Review capture readiness, booking context, and provider evidence.",
    }),
    workItemTemplate({
        id: "payment_captured_fulfillment",
        name: "Payment captured creates fulfillment handoff",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_CAPTURED,
        title: "Confirm paid booking or fulfillment handoff",
        kind: "payment_fulfillment",
        priority: "normal",
        description: "A payment was captured. Confirm the paid booking, invoice, or fulfillment handoff is aligned.",
    }),
    workItemTemplate({
        id: "payment_captured_after_terminal_reconciliation",
        name: "Late payment capture creates reconciliation review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_CAPTURED_AFTER_TERMINAL,
        title: "Reconcile late payment capture",
        kind: "payment_reconciliation",
        priority: "urgent",
        description: "A provider capture arrived after the booking payment became terminal. Verify provider evidence and the customer/booking outcome.",
    }),
    workItemTemplate({
        id: "payment_refunded_reconciliation",
        name: "Payment refund creates reconciliation review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_REFUNDED,
        title: "Review refunded payment",
        kind: "payment_reconciliation",
        priority: "high",
        description: "A payment was refunded. Review customer impact, booking state, and accounting reconciliation before closing the loop.",
    }),
    workItemTemplate({
        id: "legal_sent_monitor",
        name: "Agreement sent creates signing monitor",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_SENT,
        title: "Monitor sent agreement",
        kind: "legal_signing_monitor",
        priority: "normal",
        description: "A legal agreement was sent. Monitor signing posture and confirm the correct recipient and agreement context.",
    }),
    workItemTemplate({
        id: "legal_viewed_follow_up",
        name: "Agreement viewed creates follow-up review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_VIEWED,
        title: "Review viewed agreement",
        kind: "legal_follow_up",
        priority: "normal",
        description: "A legal agreement was viewed. Review whether a human follow-up is needed before signing or expiry.",
    }),
    workItemTemplate({
        id: "legal_voided_review",
        name: "Voided agreement creates legal exception review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_VOIDED,
        title: "Review voided agreement",
        kind: "legal_exception",
        priority: "high",
        description: "A legal agreement was voided. Review customer impact, replacement needs, and audit context.",
    }),
    workItemTemplate({
        id: "source_ingestion_failed_review",
        name: "Source ingestion failure creates exception review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.SOURCE_INTELLIGENCE_INGESTION_FAILED,
        title: "Review failed source ingestion",
        kind: "source_intelligence_exception",
        priority: "high",
        description: "A source intelligence ingestion failed. Review source health and decide whether to retry, pause, or replace it.",
    }),
    workItemTemplate({
        id: "source_stale_refresh_review",
        name: "Stale source creates refresh review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.SOURCE_INTELLIGENCE_SOURCE_STALE,
        title: "Review stale source",
        kind: "source_intelligence_refresh",
        priority: "normal",
        description: "A source intelligence source became stale. Review freshness expectations and refresh strategy.",
    }),
    workItemTemplate({
        id: "booking_confirmed_ops_handoff",
        name: "Booking confirmation creates operations handoff",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_CONFIRMED,
        title: "Confirm booking delivery handoff",
        kind: "booking_handoff",
        priority: "normal",
        description: "A booking was confirmed. Verify delivery handoff, calendar posture, and customer expectations.",
    }),
    workItemTemplate({
        id: "booking_cancelled_follow_up",
        name: "Booking cancellation creates exception follow-up",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_CANCELLED,
        title: "Review cancelled booking",
        kind: "booking_exception",
        priority: "normal",
        description: "A booking was cancelled. Review cancellation reason, refund posture, and whether follow-up is needed.",
    }),
    workItemTemplate({
        id: "sla_flagged_response",
        name: "SLA flag creates urgent response review",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.SLA_FLAGGED,
        title: "Review flagged SLA issue",
        kind: "sla_response",
        priority: "urgent",
        description: "A portal client flagged an SLA issue. Review severity, owner, and response plan before execution.",
    }),
    workItemTemplate({
        id: "integration_degraded_watch",
        name: "Integration degradation creates watch item",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.INTEGRATION_DEGRADED,
        title: "Monitor degraded integration",
        kind: "ops_integration_degraded",
        priority: "high",
        description: "A tracked integration is degraded. Monitor evidence and decide whether to escalate before it fails.",
    }),
    workItemTemplate({
        id: "external_publishing_ready_review",
        name: "External publishing ready creates review work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_READY_FOR_REVIEW,
        title: "Review external publishing package",
        kind: "external_publishing_review",
        priority: "normal",
        description: "An external publishing package is ready. Review usefulness, evidence, link safety, and destination rules before export.",
    }),
    workItemTemplate({
        id: "external_publishing_exported_manual_post",
        name: "External publishing export creates manual posting work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED,
        title: "Manually publish exported package",
        kind: "external_publishing_manual_post",
        priority: "normal",
        description: "A bundle was exported. A human should publish manually, avoid automation, and record the final public URL.",
    }),
    workItemTemplate({
        id: "external_publishing_published_monitor",
        name: "Manual external publication creates monitoring work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL,
        title: "Monitor manual external publication",
        kind: "external_publishing_monitoring",
        priority: "low",
        description: "A manual external publication URL was recorded. Monitor UTM/referrer attribution and decide if any human follow-up is needed.",
    }),
    workItemTemplate({
        id: "external_publishing_stale_no_traffic_follow_up",
        name: "Stale external publication creates no-traffic follow-up",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC,
        title: "Review no-traffic external publication",
        kind: "external_publishing_no_traffic",
        priority: "normal",
        description: "A manual publication has no attributable traffic. Review placement quality and decide whether to update, leave alone, or retire the tactic.",
    }),
    workItemTemplate({
        id: "creative_studio_strategy_ready_review",
        name: "Creative strategy ready creates review work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_STRATEGY_READY,
        title: "Review creative strategy manifest",
        kind: "creative_strategy_review",
        priority: "normal",
        description: "A creative strategy manifest was generated. Operator must review safety and rights before approving a render job.",
    }),
    workItemTemplate({
        id: "creative_studio_render_failed_ops",
        name: "Creative render failure creates ops work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_RENDER_FAILED,
        title: "Review failed creative render",
        kind: "creative_render_exception",
        priority: "high",
        description: "A creative render job failed. Review provider errors, cost impact, and retry feasibility.",
    }),
    workItemTemplate({
        id: "creative_studio_asset_needs_review",
        name: "Creative asset ready creates review work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_NEEDS_REVIEW,
        title: "Review generated creative asset",
        kind: "creative_asset_review",
        priority: "normal",
        description: "A creative render completed. Operator must review visual quality, brand safety, and approve the asset for use.",
    }),
    workItemTemplate({
        id: "creative_studio_asset_approved_handoff",
        name: "Creative asset approval creates handoff work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_APPROVED,
        title: "Create handoff for approved creative asset",
        kind: "creative_asset_handoff",
        priority: "normal",
        description: "A creative asset was approved. Decide whether to attach it to content, export it, or use it in a campaign.",
    }),
    workItemTemplate({
        id: "creative_studio_asset_exported_monitor",
        name: "Creative asset export creates monitoring work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_EXPORTED,
        title: "Monitor exported creative asset",
        kind: "creative_asset_monitoring",
        priority: "low",
        description: "An asset was exported or attached to a channel. Monitor channel performance for attribution.",
    }),
    workItemTemplate({
        id: "creative_studio_manual_publish_monitor",
        name: "Manual creative publish creates monitoring work",
        triggerKey: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_MANUAL_PUBLISH_RECORDED,
        title: "Monitor manual creative publication",
        kind: "creative_manual_publish_monitoring",
        priority: "low",
        description: "A manual public placement URL was recorded for a creative asset. Monitor referrer traffic and engagement.",
    }),
] as const;

export function buildWorkflowTemplateRuleRows(workspaceId: string) {
    return WORKFLOW_TEMPLATES.map((template) => ({
        workspace_id: workspaceId,
        name: template.name,
        trigger_key: template.triggerKey,
        is_enabled: false,
        requires_approval: true,
        condition_json: template.conditionJson as Json,
        action_json: template.actionJson as unknown as Json,
        metadata: {
            installed_template: template.id,
            installed_trigger_key: template.triggerKey,
            kill_switch: false,
            managed_from: "dashboard_automations",
        },
    }));
}
