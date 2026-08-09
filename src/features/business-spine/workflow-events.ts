export const WORKFLOW_EVENT_CATEGORIES = [
    "contact",
    "newsletter",
    "outreach",
    "payment",
    "legal",
    "gsc",
    "source-intelligence",
    "booking",
    "sla",
    "integration-health",
    "external-publishing",
    "creative-studio",
] as const;

export type WorkflowEventCategory = typeof WORKFLOW_EVENT_CATEGORIES[number];

export const BUSINESS_SPINE_WORKFLOW_EVENTS = {
    CONTACT_SUBMITTED: "contact.submitted",
    NEWSLETTER_SUBSCRIBED: "newsletter.subscribed",
    NEWSLETTER_CONFIRMED: "newsletter.confirmed",
    NEWSLETTER_CAMPAIGN_CREATED: "newsletter.campaign.created",
    NEWSLETTER_CAMPAIGN_SENT: "newsletter.campaign.sent",
    NEWSLETTER_BOUNCED: "newsletter.bounced",
    NEWSLETTER_COMPLAINED: "newsletter.complained",
    OUTREACH_PROSPECT_APPROVED: "outreach.prospect.approved",
    OUTREACH_CONTACTED: "outreach.contacted",
    OUTREACH_REPLIED: "outreach.replied",
    OUTREACH_SUPPRESSED: "outreach.suppressed",
    OUTREACH_CONVERTED: "outreach.converted",
    PAYMENT_APPROVED: "payment.approved",
    PAYMENT_CAPTURED: "payment.captured",
    PAYMENT_CAPTURED_AFTER_TERMINAL: "payment.captured_after_terminal",
    PAYMENT_REFUNDED: "payment.refunded",
    PAYMENT_FAILED: "payment.failed",
    LEGAL_AGREEMENT_SENT: "legal.agreement.sent",
    LEGAL_AGREEMENT_VIEWED: "legal.agreement.viewed",
    LEGAL_AGREEMENT_SIGNED: "legal.agreement.signed",
    LEGAL_AGREEMENT_VOIDED: "legal.agreement.voided",
    GSC_OPPORTUNITY_DETECTED: "gsc.opportunity.detected",
    SOURCE_INTELLIGENCE_INGESTION_FAILED: "source-intelligence.ingestion.failed",
    SOURCE_INTELLIGENCE_SOURCE_STALE: "source-intelligence.source.stale",
    BOOKING_PENDING_REVIEW: "booking.pending_review",
    BOOKING_CONFIRMED: "booking.confirmed",
    BOOKING_CANCELLED: "booking.cancelled",
    BOOKING_COMPLETED: "booking.completed",
    SLA_FLAGGED: "sla.flagged",
    INTEGRATION_DEGRADED: "integration.degraded",
    INTEGRATION_FAILING: "integration.failing",
    EXTERNAL_PUBLISHING_READY_FOR_REVIEW: "external-publishing.ready_for_review",
    EXTERNAL_PUBLISHING_EXPORTED: "external-publishing.exported",
    EXTERNAL_PUBLISHING_PUBLISHED_MANUAL: "external-publishing.published_manual",
    EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC: "external-publishing.stale_no_traffic",
    CREATIVE_STUDIO_STRATEGY_READY: "creative-studio.strategy_ready",
    CREATIVE_STUDIO_RENDER_FAILED: "creative-studio.render_failed",
    CREATIVE_STUDIO_ASSET_NEEDS_REVIEW: "creative-studio.asset_needs_review",
    CREATIVE_STUDIO_ASSET_APPROVED: "creative-studio.asset_approved",
    CREATIVE_STUDIO_ASSET_EXPORTED: "creative-studio.asset_exported",
    CREATIVE_STUDIO_MANUAL_PUBLISH_RECORDED: "creative-studio.manual_publish_recorded",
} as const;

export type WorkflowEventKey = typeof BUSINESS_SPINE_WORKFLOW_EVENTS[keyof typeof BUSINESS_SPINE_WORKFLOW_EVENTS];

type SourceModuleName =
    | "contact"
    | "newsletter"
    | "outreach"
    | "payments"
    | "legal"
    | "gsc"
    | "source-intelligence"
    | "booking"
    | "sla"
    | "integration-health"
    | "external-publishing"
    | "creative-studio";

type DirectRecorderSideEffect =
    | "mandatory_customer_timeline"
    | "mandatory_work_item"
    | "mandatory_integration_evidence"
    | "optional_workflow_outcome";

export type WorkflowEventDefinition = {
    key: WorkflowEventKey;
    category: WorkflowEventCategory;
    sourceModule: SourceModuleName;
    description: string;
    idempotencyFields: readonly string[];
    directRecorderSideEffects: readonly DirectRecorderSideEffect[];
};

export const BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG = [
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CONTACT_SUBMITTED,
        category: "contact",
        sourceModule: "contact",
        description: "A public contact form was submitted.",
        idempotencyFields: ["contactId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_SUBSCRIBED,
        category: "newsletter",
        sourceModule: "newsletter",
        description: "A newsletter contact subscribed.",
        idempotencyFields: ["providerEventId", "contactId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CONFIRMED,
        category: "newsletter",
        sourceModule: "newsletter",
        description: "A newsletter contact confirmed opt-in.",
        idempotencyFields: ["providerEventId", "contactId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CAMPAIGN_CREATED,
        category: "newsletter",
        sourceModule: "newsletter",
        description: "A newsletter campaign was created.",
        idempotencyFields: ["campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CAMPAIGN_SENT,
        category: "newsletter",
        sourceModule: "newsletter",
        description: "A newsletter campaign was sent.",
        idempotencyFields: ["providerEventId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_BOUNCED,
        category: "newsletter",
        sourceModule: "newsletter",
        description: "A newsletter message bounced.",
        idempotencyFields: ["providerEventId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_COMPLAINED,
        category: "newsletter",
        sourceModule: "newsletter",
        description: "A newsletter recipient complained.",
        idempotencyFields: ["providerEventId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_PROSPECT_APPROVED,
        category: "outreach",
        sourceModule: "outreach",
        description: "An outreach prospect was approved.",
        idempotencyFields: ["messageId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_CONTACTED,
        category: "outreach",
        sourceModule: "outreach",
        description: "An outreach contact was messaged.",
        idempotencyFields: ["messageId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_REPLIED,
        category: "outreach",
        sourceModule: "outreach",
        description: "An outreach prospect replied.",
        idempotencyFields: ["messageId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_SUPPRESSED,
        category: "outreach",
        sourceModule: "outreach",
        description: "An outreach prospect was suppressed.",
        idempotencyFields: ["messageId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_CONVERTED,
        category: "outreach",
        sourceModule: "outreach",
        description: "An outreach prospect converted.",
        idempotencyFields: ["messageId", "contactId", "campaignId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_APPROVED,
        category: "payment",
        sourceModule: "payments",
        description: "A payment was approved by the provider.",
        idempotencyFields: ["paymentId", "providerEventId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_CAPTURED,
        category: "payment",
        sourceModule: "payments",
        description: "A payment was captured.",
        idempotencyFields: ["paymentId", "providerEventId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_CAPTURED_AFTER_TERMINAL,
        category: "payment",
        sourceModule: "payments",
        description: "A payment capture arrived after the booking payment became terminal and needs reconciliation.",
        idempotencyFields: ["paymentId", "providerEventId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_REFUNDED,
        category: "payment",
        sourceModule: "payments",
        description: "A payment was refunded.",
        idempotencyFields: ["paymentId", "providerEventId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_FAILED,
        category: "payment",
        sourceModule: "payments",
        description: "A payment failed.",
        idempotencyFields: ["paymentId", "providerEventId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_SENT,
        category: "legal",
        sourceModule: "legal",
        description: "A legal agreement was sent.",
        idempotencyFields: ["agreementId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_VIEWED,
        category: "legal",
        sourceModule: "legal",
        description: "A legal agreement was viewed.",
        idempotencyFields: ["agreementId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_SIGNED,
        category: "legal",
        sourceModule: "legal",
        description: "A legal agreement was signed.",
        idempotencyFields: ["agreementId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_VOIDED,
        category: "legal",
        sourceModule: "legal",
        description: "A legal agreement was voided.",
        idempotencyFields: ["agreementId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.GSC_OPPORTUNITY_DETECTED,
        category: "gsc",
        sourceModule: "gsc",
        description: "Google Search Console found a content opportunity.",
        idempotencyFields: ["opportunityId"],
        directRecorderSideEffects: ["mandatory_work_item", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.SOURCE_INTELLIGENCE_INGESTION_FAILED,
        category: "source-intelligence",
        sourceModule: "source-intelligence",
        description: "A source intelligence ingestion failed.",
        idempotencyFields: ["sourceId"],
        directRecorderSideEffects: ["mandatory_work_item", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.SOURCE_INTELLIGENCE_SOURCE_STALE,
        category: "source-intelligence",
        sourceModule: "source-intelligence",
        description: "A source intelligence source became stale.",
        idempotencyFields: ["sourceId"],
        directRecorderSideEffects: ["mandatory_work_item", "mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_PENDING_REVIEW,
        category: "booking",
        sourceModule: "booking",
        description: "A booking needs operator review.",
        idempotencyFields: ["reservationId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_CONFIRMED,
        category: "booking",
        sourceModule: "booking",
        description: "A booking was confirmed.",
        idempotencyFields: ["reservationId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_CANCELLED,
        category: "booking",
        sourceModule: "booking",
        description: "A booking was cancelled.",
        idempotencyFields: ["reservationId"],
        directRecorderSideEffects: ["mandatory_customer_timeline"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_COMPLETED,
        category: "booking",
        sourceModule: "booking",
        description: "A booking session was completed and needs a governed commercial follow-up decision.",
        idempotencyFields: ["reservationId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.SLA_FLAGGED,
        category: "sla",
        sourceModule: "sla",
        description: "A portal client flagged an SLA issue.",
        idempotencyFields: ["scheduleId"],
        directRecorderSideEffects: ["mandatory_customer_timeline", "mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.INTEGRATION_DEGRADED,
        category: "integration-health",
        sourceModule: "integration-health",
        description: "A tracked integration is degraded.",
        idempotencyFields: ["provider", "integrationKey"],
        directRecorderSideEffects: ["mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.INTEGRATION_FAILING,
        category: "integration-health",
        sourceModule: "integration-health",
        description: "A tracked integration is failing.",
        idempotencyFields: ["provider", "integrationKey"],
        directRecorderSideEffects: ["mandatory_integration_evidence"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_READY_FOR_REVIEW,
        category: "external-publishing",
        sourceModule: "external-publishing",
        description: "An external publishing package is ready for human review.",
        idempotencyFields: ["packageId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED,
        category: "external-publishing",
        sourceModule: "external-publishing",
        description: "An external publishing package bundle was exported for manual posting.",
        idempotencyFields: ["packageId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL,
        category: "external-publishing",
        sourceModule: "external-publishing",
        description: "A human recorded a manual external publication URL.",
        idempotencyFields: ["packageId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC,
        category: "external-publishing",
        sourceModule: "external-publishing",
        description: "A manually published external package has no attributable traffic after the follow-up window.",
        idempotencyFields: ["packageId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_STRATEGY_READY,
        category: "creative-studio",
        sourceModule: "creative-studio",
        description: "A creative strategy manifest is ready for review.",
        idempotencyFields: ["promptId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_RENDER_FAILED,
        category: "creative-studio",
        sourceModule: "creative-studio",
        description: "A creative render job failed.",
        idempotencyFields: ["jobId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_NEEDS_REVIEW,
        category: "creative-studio",
        sourceModule: "creative-studio",
        description: "A creative asset is ready for human review.",
        idempotencyFields: ["assetId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_APPROVED,
        category: "creative-studio",
        sourceModule: "creative-studio",
        description: "A creative asset was approved.",
        idempotencyFields: ["assetId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_EXPORTED,
        category: "creative-studio",
        sourceModule: "creative-studio",
        description: "A creative asset was exported or attached.",
        idempotencyFields: ["assetId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
    {
        key: BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_MANUAL_PUBLISH_RECORDED,
        category: "creative-studio",
        sourceModule: "creative-studio",
        description: "A manual public placement URL was recorded for an asset.",
        idempotencyFields: ["assetId"],
        directRecorderSideEffects: ["mandatory_work_item"],
    },
] as const satisfies readonly WorkflowEventDefinition[];

export const BUSINESS_SPINE_WORKFLOW_EVENT_KEYS = BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG.map((event) => event.key) as readonly WorkflowEventKey[];

const EVENT_DEFINITION_BY_KEY = new Map<WorkflowEventKey, WorkflowEventDefinition>(
    BUSINESS_SPINE_WORKFLOW_EVENT_CATALOG.map((event) => [event.key, event]),
);

const RECORDER_SIGNAL_TO_WORKFLOW_EVENT = new Map<string, WorkflowEventKey>([
    ["contact:contact.submitted", BUSINESS_SPINE_WORKFLOW_EVENTS.CONTACT_SUBMITTED],
    ["newsletter:newsletter.subscribed", BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_SUBSCRIBED],
    ["newsletter:newsletter.confirmed", BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CONFIRMED],
    ["newsletter:newsletter.campaign_created", BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CAMPAIGN_CREATED],
    ["newsletter:newsletter.campaign_sent", BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_CAMPAIGN_SENT],
    ["newsletter:newsletter.bounced", BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_BOUNCED],
    ["newsletter:newsletter.complained", BUSINESS_SPINE_WORKFLOW_EVENTS.NEWSLETTER_COMPLAINED],
    ["outreach:outreach.prospect_approved", BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_PROSPECT_APPROVED],
    ["outreach:outreach.contacted", BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_CONTACTED],
    ["outreach:outreach.replied", BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_REPLIED],
    ["outreach:outreach.suppressed", BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_SUPPRESSED],
    ["outreach:outreach.converted", BUSINESS_SPINE_WORKFLOW_EVENTS.OUTREACH_CONVERTED],
    ["payments:payment.approved", BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_APPROVED],
    ["payments:payment.captured", BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_CAPTURED],
    ["payments:payment.captured_after_terminal", BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_CAPTURED_AFTER_TERMINAL],
    ["payments:payment.refunded", BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_REFUNDED],
    ["payments:payment.failed", BUSINESS_SPINE_WORKFLOW_EVENTS.PAYMENT_FAILED],
    ["legal:legal.agreement_sent", BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_SENT],
    ["legal:legal.agreement_viewed", BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_VIEWED],
    ["legal:legal.agreement_signed", BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_SIGNED],
    ["legal:legal.agreement_voided", BUSINESS_SPINE_WORKFLOW_EVENTS.LEGAL_AGREEMENT_VOIDED],
    ["gsc:gsc.opportunity_detected", BUSINESS_SPINE_WORKFLOW_EVENTS.GSC_OPPORTUNITY_DETECTED],
    ["source-intelligence:source.ingestion_failed", BUSINESS_SPINE_WORKFLOW_EVENTS.SOURCE_INTELLIGENCE_INGESTION_FAILED],
    ["source-intelligence:source.source_stale", BUSINESS_SPINE_WORKFLOW_EVENTS.SOURCE_INTELLIGENCE_SOURCE_STALE],
    ["booking:booking.pending_review", BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_PENDING_REVIEW],
    ["booking:booking.confirmed", BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_CONFIRMED],
    ["booking:booking.cancelled", BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_CANCELLED],
    ["booking:booking.completed", BUSINESS_SPINE_WORKFLOW_EVENTS.BOOKING_COMPLETED],
    ["sla:sla.flagged", BUSINESS_SPINE_WORKFLOW_EVENTS.SLA_FLAGGED],
    ["integration-health:integration.degraded", BUSINESS_SPINE_WORKFLOW_EVENTS.INTEGRATION_DEGRADED],
    ["integration-health:integration.failing", BUSINESS_SPINE_WORKFLOW_EVENTS.INTEGRATION_FAILING],
    ["external-publishing:external_publishing.ready_for_review", BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_READY_FOR_REVIEW],
    ["external-publishing:external_publishing.exported", BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_EXPORTED],
    ["external-publishing:external_publishing.published_manual", BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_PUBLISHED_MANUAL],
    ["external-publishing:external_publishing.stale_no_traffic", BUSINESS_SPINE_WORKFLOW_EVENTS.EXTERNAL_PUBLISHING_STALE_NO_TRAFFIC],
    ["creative-studio:creative_studio.strategy_ready", BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_STRATEGY_READY],
    ["creative-studio:creative_studio.render_failed", BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_RENDER_FAILED],
    ["creative-studio:creative_studio.asset_needs_review", BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_NEEDS_REVIEW],
    ["creative-studio:creative_studio.asset_approved", BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_APPROVED],
    ["creative-studio:creative_studio.asset_exported", BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_ASSET_EXPORTED],
    ["creative-studio:creative_studio.manual_publish_recorded", BUSINESS_SPINE_WORKFLOW_EVENTS.CREATIVE_STUDIO_MANUAL_PUBLISH_RECORDED],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePayloadValue(value: unknown): unknown {
    if (value === undefined || typeof value === "function" || typeof value === "symbol") return undefined;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(sanitizePayloadValue).filter((item) => item !== undefined);
    if (!isRecord(value)) return String(value);

    return Object.fromEntries(
        Object.entries(value)
            .map(([key, nested]) => [key, sanitizePayloadValue(nested)] as const)
            .filter(([, nested]) => nested !== undefined),
    );
}

function sanitizeKeyPart(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    return text.replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || null;
}

export function getWorkflowEventDefinition(eventKey: string): WorkflowEventDefinition | null {
    return EVENT_DEFINITION_BY_KEY.get(eventKey as WorkflowEventKey) ?? null;
}

export function buildWorkflowEventPayload(eventKey: WorkflowEventKey, payload: Record<string, unknown> = {}): Record<string, unknown> {
    if (!getWorkflowEventDefinition(eventKey)) {
        throw new Error(`Unknown Business Spine workflow event: ${eventKey}`);
    }
    const sanitized = sanitizePayloadValue(payload);
    return isRecord(sanitized) ? sanitized : {};
}

export function buildWorkflowIdempotencyKey(eventKey: WorkflowEventKey, values: Record<string, unknown> = {}): string {
    const definition = getWorkflowEventDefinition(eventKey);
    if (!definition) {
        throw new Error(`Unknown Business Spine workflow event: ${eventKey}`);
    }

    const parts = definition.idempotencyFields
        .map((field) => sanitizeKeyPart(values[field]))
        .filter((part): part is string => Boolean(part));

    return ["workflow", eventKey, ...(parts.length ? parts : ["unknown"])].join(":");
}

export function mapRecorderSignalToWorkflowEvent(sourceModule: string, recorderEventKey: string): WorkflowEventKey | null {
    return RECORDER_SIGNAL_TO_WORKFLOW_EVENT.get(`${sourceModule}:${recorderEventKey}`) ?? null;
}

type WorkflowDispatchOverride = NonNullable<Parameters<typeof dispatchBusinessSpineWorkflowEvent>[0]["dispatch"]>;

export async function dispatchRecorderWorkflowEvent(input: {
    workspaceId: string;
    sourceModule: string;
    recorderEventKey: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    payload?: Record<string, unknown>;
    idempotencyValues?: Record<string, unknown>;
    runImmediately?: boolean;
    dispatch?: WorkflowDispatchOverride;
}): Promise<WorkflowDispatchTelemetry | null> {
    const eventKey = mapRecorderSignalToWorkflowEvent(input.sourceModule, input.recorderEventKey);
    if (!eventKey) return null;

    return dispatchBusinessSpineWorkflowEvent({
        workspaceId: input.workspaceId,
        eventKey,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        payload: input.payload,
        idempotencyValues: input.idempotencyValues,
        runImmediately: input.runImmediately,
        dispatch: input.dispatch,
    });
}

export type WorkflowDispatchTelemetry = {
    ok: boolean;
    eventKey: WorkflowEventKey;
    idempotencyKey: string;
    sourceModule: SourceModuleName;
    eventId: string | null;
    matchedRules: number;
    enqueuedRuns: number;
    failedRules: number;
    skippedRules: number;
    durationMs: number;
    error?: string;
};

export async function dispatchBusinessSpineWorkflowEvent(input: {
    workspaceId: string;
    eventKey: WorkflowEventKey;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
    idempotencyValues?: Record<string, unknown>;
    runImmediately?: boolean;
    dispatch?: (event: {
        workspaceId: string;
        eventKey: string;
        sourceModule: string;
        sourceEntityType?: string | null;
        sourceEntityId?: string | null;
        payload?: Record<string, unknown>;
        idempotencyKey: string;
        runImmediately?: boolean;
    }) => Promise<{
        eventId: string | null;
        matchedRules: number;
        enqueuedRuns: number;
        failedRules: number;
        skippedRules: number;
    }>;
}): Promise<WorkflowDispatchTelemetry> {
    const startedAt = Date.now();
    const definition = EVENT_DEFINITION_BY_KEY.get(input.eventKey);
    if (!definition) {
        return {
            ok: false,
            eventKey: input.eventKey,
            idempotencyKey: input.idempotencyKey ?? "",
            sourceModule: "integration-health",
            eventId: null,
            matchedRules: 0,
            enqueuedRuns: 0,
            failedRules: 0,
            skippedRules: 0,
            durationMs: Date.now() - startedAt,
            error: `Unknown Business Spine workflow event: ${input.eventKey}`,
        };
    }

    const payload = buildWorkflowEventPayload(input.eventKey, input.payload ?? {});
    const idempotencyKey = input.idempotencyKey
        ?? buildWorkflowIdempotencyKey(input.eventKey, {
            ...payload,
            ...input.idempotencyValues,
            sourceEntityId: input.sourceEntityId ?? undefined,
        });

    try {
        const dispatch = input.dispatch ?? (await import("@/features/business-spine/workflow-service")).dispatchWorkflowEvent;
        const result = await dispatch({
            workspaceId: input.workspaceId,
            eventKey: input.eventKey,
            sourceModule: definition.sourceModule,
            sourceEntityType: input.sourceEntityType,
            sourceEntityId: input.sourceEntityId,
            payload,
            idempotencyKey,
            runImmediately: input.runImmediately,
        });

        return {
            ok: true,
            eventKey: input.eventKey,
            idempotencyKey,
            sourceModule: definition.sourceModule,
            eventId: result.eventId,
            matchedRules: result.matchedRules,
            enqueuedRuns: result.enqueuedRuns,
            failedRules: result.failedRules,
            skippedRules: result.skippedRules,
            durationMs: Date.now() - startedAt,
        };
    } catch (error) {
        return {
            ok: false,
            eventKey: input.eventKey,
            idempotencyKey,
            sourceModule: definition.sourceModule,
            eventId: null,
            matchedRules: 0,
            enqueuedRuns: 0,
            failedRules: 0,
            skippedRules: 0,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "Workflow dispatch failed.",
        };
    }
}
