import { z } from "zod";

export type WorkflowEventContext = {
    eventKey: string;
    sourceModule: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    payload: Record<string, unknown>;
};

export type WorkflowConditionResult = {
    matched: boolean;
    reason?: string;
};

export type WorkflowRulePreviewInput = {
    triggerKey: string;
    conditionJson: unknown;
    actionJson: unknown;
    samplePayload?: Record<string, unknown>;
    sampleSourceModule?: string;
};

export type WorkflowRulePreviewResult = {
    ok: boolean;
    errors: string[];
    warnings: string[];
    condition: {
        matched: boolean;
        reason: string | null;
        sampleContext: WorkflowEventContext;
    };
    actions: {
        normalized: WorkflowAction[];
        errors: string[];
    };
};

export type WorkflowWorkerRuntimeRegistryEntry = {
    key: WorkerKey;
    actionType: "enqueue_worker_job";
    runtimeBound: true;
    starterTemplateEligible: boolean;
    typedRuntimeBindingSchema: z.ZodTypeAny;
    retryPolicy: {
        maxRetries: number;
        backoffStrategy: "exponential" | "linear" | "fixed";
        baseDelayMs: number;
    };
    auditTrail: {
        table: string;
        eventKeyPrefix: string;
    };
};

export const WORKFLOW_ACTION_SUPPORT = {
    concreteActions: [
        "create_work_item",
        "request_approval",
        "assign_owner",
        "write_timeline_event",
    ],
    workerJobs: [
        { key: "source_ingestion", support: "Concrete when registryId and sourceUrl are present; otherwise metadata-only." },
        { key: "seo_internal_link", support: "Concrete when templateId, contentId, and contentHash are present; otherwise metadata-only." },
        { key: "outreach_dispatch", support: "Concrete when campaignId and messageId are present; otherwise metadata-only." },
        { key: "content_translation", support: "Concrete when contentId is present; enqueues the durable content translation worker." },
    ],
    emailTemplates: [
        { key: "workflow_approval_request", support: "Implemented for approval notifications when sender and recipient env vars are configured." },
        { key: "booking_confirmation", support: "Allowlisted but metadata-only from workflow rules." },
        { key: "booking_review_request", support: "Allowlisted but metadata-only from workflow rules." },
        { key: "newsletter_welcome", support: "Allowlisted but metadata-only from workflow rules." },
        { key: "legal_signature_request", support: "Allowlisted but metadata-only from workflow rules." },
    ],
} as const;

export type WorkflowAction =
    | {
        type: "create_work_item";
        title: string;
        kind: string;
        description?: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        customerId?: string | null;
        assignedToProfileId?: string | null;
        dueAt?: string | null;
        sourceEntityType?: string | null;
        sourceEntityId?: string | null;
        metadata?: Record<string, unknown>;
    }
    | {
        type: "assign_owner";
        workItemId: string;
        ownerProfileId: string;
    }
    | {
        type: "write_timeline_event";
        customerId?: string | null;
        eventType: string;
        summary: string;
        body?: string | null;
        visibility: "internal" | "portal" | "public";
        metadata?: Record<string, unknown>;
    }
    | {
        type: "request_approval";
        title: string;
        description?: string | null;
        targetType: "work_item" | "status";
        targetStatus?: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        assignedToProfileId?: string | null;
        metadata?: Record<string, unknown>;
    }
    | {
        type: "enqueue_worker_job";
        workerKey: "source_ingestion" | "seo_internal_link" | "outreach_dispatch" | "content_translation";
        registryId?: string | null;
        sourceUrl?: string | null;
        runId?: string | null;
        inputHash?: string | null;
        templateId?: string | null;
        contentId?: string | null;
        locale?: "en" | "nl" | "ar";
        targetLocales?: Array<"nl" | "ar">;
        contentHash?: string | null;
        campaignId?: string | null;
        messageId?: string | null;
        runAfter?: string | null;
        priority: number;
        metadata?: Record<string, unknown>;
    }
    | {
        type: "send_templated_email";
        templateKey: "booking_confirmation" | "booking_review_request" | "newsletter_welcome" | "legal_signature_request" | "workflow_approval_request";
        to?: string | null;
        customerId?: string | null;
        metadata?: Record<string, unknown>;
    };

type WorkerKey = Extract<WorkflowAction, { type: "enqueue_worker_job" }>["workerKey"];
type EmailTemplateKey = Extract<WorkflowAction, { type: "send_templated_email" }>["templateKey"];

export type WorkflowActionNormalizationResult = {
    ok: boolean;
    actions: WorkflowAction[];
    errors: string[];
};

type ConditionEvalState = {
    nodes: number;
};

const MAX_CONDITION_DEPTH = 6;
const MAX_CONDITION_NODES = 50;
const MAX_ACTIONS = 10;
const SAFE_FIELD_SEGMENT = /^[A-Za-z0-9_]+$/;
const BLOCKED_FIELD_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const VISIBILITIES = new Set(["internal", "portal", "public"]);
const LOCALES = new Set(["en", "nl", "ar"]);
const WORKER_KEYS = new Set([
    "source_ingestion",
    "seo_internal_link",
    "outreach_dispatch",
    "content_translation",
]);
const EMAIL_TEMPLATE_KEYS = new Set([
    "booking_confirmation",
    "booking_review_request",
    "newsletter_welcome",
    "legal_signature_request",
    "workflow_approval_request",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH64_RE = /^[a-f0-9]{64}$/i;

export const sourceIngestionBindingSchema = z.object({
    registryId: z.string().uuid().optional().nullable(),
    sourceUrl: z.string().url().optional().nullable(),
    contentHash: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const seoInternalLinkBindingSchema = z.object({
    templateId: z.string().uuid().optional().nullable(),
    contentId: z.string().uuid().optional().nullable(),
    contentHash: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const outreachDispatchBindingSchema = z.object({
    campaignId: z.string().uuid().optional().nullable(),
    messageId: z.string().uuid().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const contentTranslationBindingSchema = z.object({
    contentId: z.string().uuid(),
    targetLocales: z.array(z.enum(["nl", "ar"])).min(1).max(2).optional(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const WORKFLOW_WORKER_RUNTIME_REGISTRY: WorkflowWorkerRuntimeRegistryEntry[] = [
    {
        key: "source_ingestion",
        actionType: "enqueue_worker_job",
        runtimeBound: true,
        starterTemplateEligible: false,
        typedRuntimeBindingSchema: sourceIngestionBindingSchema,
        retryPolicy: {
            maxRetries: 3,
            backoffStrategy: "exponential",
            baseDelayMs: 60000,
        },
        auditTrail: {
            table: "workspace_workflow_events",
            eventKeyPrefix: "workflow.worker.source_ingestion",
        },
    },
    {
        key: "seo_internal_link",
        actionType: "enqueue_worker_job",
        runtimeBound: true,
        starterTemplateEligible: false,
        typedRuntimeBindingSchema: seoInternalLinkBindingSchema,
        retryPolicy: {
            maxRetries: 2,
            backoffStrategy: "exponential",
            baseDelayMs: 30000,
        },
        auditTrail: {
            table: "workspace_workflow_events",
            eventKeyPrefix: "workflow.worker.seo_internal_link",
        },
    },
    {
        key: "outreach_dispatch",
        actionType: "enqueue_worker_job",
        runtimeBound: true,
        starterTemplateEligible: false,
        typedRuntimeBindingSchema: outreachDispatchBindingSchema,
        retryPolicy: {
            maxRetries: 5,
            backoffStrategy: "exponential",
            baseDelayMs: 120000,
        },
        auditTrail: {
            table: "workspace_workflow_events",
            eventKeyPrefix: "workflow.worker.outreach_dispatch",
        },
    },
    {
        key: "content_translation",
        actionType: "enqueue_worker_job",
        runtimeBound: true,
        starterTemplateEligible: false,
        typedRuntimeBindingSchema: contentTranslationBindingSchema,
        retryPolicy: {
            maxRetries: 3,
            backoffStrategy: "exponential",
            baseDelayMs: 60000,
        },
        auditTrail: {
            table: "content_translation_jobs",
            eventKeyPrefix: "workflow.worker.content_translation",
        },
    }
];

export function getWorkflowWorkerRuntimeRegistry(): WorkflowWorkerRuntimeRegistryEntry[] {
    return WORKFLOW_WORKER_RUNTIME_REGISTRY;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
    return typeof value === "string" ? value.trim() : null;
}

function asOptionalString(value: unknown): string | null {
    if (typeof value === "undefined" || value === null) return null;
    return asString(value);
}

function asUuid(value: unknown): string | null {
    const text = asString(value);
    return text && UUID_RE.test(text) ? text : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return isRecord(value) ? value : undefined;
}

function getPathValue(context: WorkflowEventContext, path: string): { ok: true; value: unknown } | { ok: false; reason: string } {
    const segments = path.split(".");
    if (!segments.length || segments.some((segment) => !SAFE_FIELD_SEGMENT.test(segment) || BLOCKED_FIELD_SEGMENTS.has(segment))) {
        return { ok: false, reason: "Unsafe condition field path." };
    }

    let current: unknown = context;
    for (const segment of segments) {
        if (!isRecord(current) || !(segment in current)) {
            return { ok: true, value: undefined };
        }
        current = current[segment];
    }
    return { ok: true, value: current };
}

function primitiveEqual(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (typeof left === "number" && typeof right === "string" && right.trim() !== "") return left === Number(right);
    if (typeof left === "string" && typeof right === "number" && left.trim() !== "") return Number(left) === right;
    return false;
}

function compareNumbers(left: unknown, right: unknown, op: "gt" | "gte" | "lt" | "lte"): boolean {
    const leftNumber = typeof left === "number" ? left : typeof left === "string" && left.trim() !== "" ? Number(left) : NaN;
    const rightNumber = typeof right === "number" ? right : typeof right === "string" && right.trim() !== "" ? Number(right) : NaN;
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
    if (op === "gt") return leftNumber > rightNumber;
    if (op === "gte") return leftNumber >= rightNumber;
    if (op === "lt") return leftNumber < rightNumber;
    return leftNumber <= rightNumber;
}

function evaluateLeaf(condition: Record<string, unknown>, context: WorkflowEventContext): WorkflowConditionResult {
    const field = asString(condition.field);
    const op = asString(condition.op);
    if (!field || !op) return { matched: false, reason: "Leaf condition requires field and op." };

    const resolved = getPathValue(context, field);
    if (!resolved.ok) return { matched: false, reason: resolved.reason };

    const actual = resolved.value;
    const expected = condition.value;
    switch (op) {
        case "eq":
            return { matched: primitiveEqual(actual, expected) };
        case "neq":
            return { matched: !primitiveEqual(actual, expected) };
        case "in":
            return { matched: Array.isArray(expected) && expected.some((item) => primitiveEqual(actual, item)) };
        case "not_in":
            return { matched: Array.isArray(expected) && !expected.some((item) => primitiveEqual(actual, item)) };
        case "exists":
            return { matched: typeof actual !== "undefined" && actual !== null && actual !== "" };
        case "missing":
            return { matched: typeof actual === "undefined" || actual === null || actual === "" };
        case "contains":
            if (Array.isArray(actual)) return { matched: actual.some((item) => primitiveEqual(item, expected)) };
            if (typeof actual === "string" && typeof expected === "string") return { matched: actual.includes(expected) };
            return { matched: false };
        case "gt":
        case "gte":
        case "lt":
        case "lte":
            return { matched: compareNumbers(actual, expected, op) };
        default:
            return { matched: false, reason: `Unsupported condition op: ${op}` };
    }
}

function evaluateConditionNode(condition: unknown, context: WorkflowEventContext, depth: number, state: ConditionEvalState): WorkflowConditionResult {
    state.nodes += 1;
    if (state.nodes > MAX_CONDITION_NODES) return { matched: false, reason: "Condition is too large." };
    if (depth > MAX_CONDITION_DEPTH) return { matched: false, reason: "Condition is too deeply nested." };
    if (!isRecord(condition)) return { matched: false, reason: "Condition must be an object." };
    if (Object.keys(condition).length === 0) return { matched: true };

    if (Array.isArray(condition.all)) {
        for (const child of condition.all) {
            const result = evaluateConditionNode(child, context, depth + 1, state);
            if (!result.matched) return result.reason ? result : { matched: false };
        }
        return { matched: true };
    }

    if (Array.isArray(condition.any)) {
        let lastReason: string | undefined;
        for (const child of condition.any) {
            const result = evaluateConditionNode(child, context, depth + 1, state);
            if (result.matched) return { matched: true };
            lastReason = result.reason ?? lastReason;
        }
        return { matched: false, reason: lastReason };
    }

    if ("not" in condition) {
        const result = evaluateConditionNode(condition.not, context, depth + 1, state);
        return { matched: !result.matched, reason: result.matched ? "Negated condition matched." : undefined };
    }

    return evaluateLeaf(condition, context);
}

export function evaluateWorkflowCondition(condition: unknown, context: WorkflowEventContext): WorkflowConditionResult {
    return evaluateConditionNode(condition, context, 0, { nodes: 0 });
}

type WorkflowPriority = Extract<WorkflowAction, { type: "create_work_item" | "request_approval" }>["priority"];

function normalizePriority(value: unknown): WorkflowPriority {
    const priority = asString(value) ?? "normal";
    return PRIORITIES.has(priority) ? priority as WorkflowPriority : "normal";
}

function normalizeVisibility(value: unknown): "internal" | "portal" | "public" {
    const visibility = asString(value) ?? "internal";
    return VISIBILITIES.has(visibility) ? visibility as "internal" | "portal" | "public" : "internal";
}

function normalizeLocale(value: unknown): "en" | "nl" | "ar" | undefined {
    const locale = asString(value);
    return locale && LOCALES.has(locale) ? locale as "en" | "nl" | "ar" : undefined;
}

function normalizeTargetLocales(value: unknown): Array<"nl" | "ar"> | undefined {
    if (!Array.isArray(value)) return undefined;
    const locales = Array.from(new Set(
        value.filter((item): item is "nl" | "ar" => item === "nl" || item === "ar"),
    ));
    return locales.length > 0 ? locales : undefined;
}

function normalizeNumber(value: unknown, fallback: number): number {
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(0, Math.min(1000, Math.floor(numberValue)));
}

function normalizeAction(input: unknown): { action?: WorkflowAction; error?: string } {
    if (!isRecord(input)) return { error: "Action must be an object." };
    const type = asString(input.type);
    if (!type) return { error: "Action type is required." };

    if (type === "create_work_item") {
        const title = asString(input.title);
        const kind = asString(input.kind);
        if (!title || !kind) return { error: "create_work_item requires title and kind." };
        return {
            action: {
                type,
                title: title.slice(0, 180),
                kind: kind.slice(0, 80),
                description: asOptionalString(input.description),
                priority: normalizePriority(input.priority),
                customerId: asUuid(input.customerId),
                assignedToProfileId: asUuid(input.assignedToProfileId),
                dueAt: asOptionalString(input.dueAt),
                sourceEntityType: asOptionalString(input.sourceEntityType),
                sourceEntityId: asUuid(input.sourceEntityId),
                metadata: asRecord(input.metadata),
            },
        };
    }

    if (type === "assign_owner") {
        const workItemId = asUuid(input.workItemId);
        const ownerProfileId = asUuid(input.ownerProfileId);
        if (!workItemId || !ownerProfileId) return { error: "assign_owner requires workItemId and ownerProfileId UUIDs." };
        return { action: { type, workItemId, ownerProfileId } };
    }

    if (type === "write_timeline_event") {
        const eventType = asString(input.eventType);
        const summary = asString(input.summary);
        if (!eventType || !summary) return { error: "write_timeline_event requires eventType and summary." };
        return {
            action: {
                type,
                customerId: asUuid(input.customerId),
                eventType: eventType.slice(0, 100),
                summary: summary.slice(0, 240),
                body: asOptionalString(input.body),
                visibility: normalizeVisibility(input.visibility),
                metadata: asRecord(input.metadata),
            },
        };
    }

    if (type === "request_approval") {
        const targetType = asString(input.targetType) === "status" ? "status" : "work_item";
        return {
            action: {
                type,
                title: (asString(input.title) ?? "Review workflow automation").slice(0, 180),
                description: asOptionalString(input.description),
                targetType,
                targetStatus: asOptionalString(input.targetStatus),
                priority: normalizePriority(input.priority),
                assignedToProfileId: asUuid(input.assignedToProfileId),
                metadata: asRecord(input.metadata),
            },
        };
    }

    if (type === "enqueue_worker_job") {
        const workerKey = asString(input.workerKey);
        if (!workerKey || !WORKER_KEYS.has(workerKey)) return { error: "enqueue_worker_job requires an allowlisted workerKey." };
        const contentHash = asString(input.contentHash);
        const inputHash = asString(input.inputHash);
        return {
            action: {
                type,
                workerKey: workerKey as WorkerKey,
                registryId: asUuid(input.registryId),
                sourceUrl: asOptionalString(input.sourceUrl),
                runId: asUuid(input.runId),
                inputHash: inputHash && HASH64_RE.test(inputHash) ? inputHash : null,
                templateId: asOptionalString(input.templateId),
                contentId: asUuid(input.contentId),
                locale: normalizeLocale(input.locale),
                targetLocales: normalizeTargetLocales(input.targetLocales),
                contentHash: contentHash && HASH64_RE.test(contentHash) ? contentHash : null,
                campaignId: asUuid(input.campaignId),
                messageId: asUuid(input.messageId),
                runAfter: asOptionalString(input.runAfter),
                priority: normalizeNumber(input.priority, 100),
                metadata: asRecord(input.metadata),
            },
        };
    }

    if (type === "send_templated_email") {
        const templateKey = asString(input.templateKey);
        if (!templateKey || !EMAIL_TEMPLATE_KEYS.has(templateKey)) return { error: "send_templated_email requires an allowlisted templateKey." };
        return {
            action: {
                type,
                templateKey: templateKey as EmailTemplateKey,
                to: asOptionalString(input.to),
                customerId: asUuid(input.customerId),
                metadata: asRecord(input.metadata),
            },
        };
    }

    return { error: `Unsupported action type: ${type}` };
}

export function normalizeWorkflowActions(actionJson: unknown): WorkflowActionNormalizationResult {
    const inputActions = Array.isArray(actionJson) ? actionJson : [actionJson];
    if (inputActions.length > MAX_ACTIONS) {
        return { ok: false, actions: [], errors: [`A workflow rule can run at most ${MAX_ACTIONS} actions.`] };
    }

    const actions: WorkflowAction[] = [];
    const errors: string[] = [];
    for (const input of inputActions) {
        const normalized = normalizeAction(input);
        if (normalized.action) actions.push(normalized.action);
        if (normalized.error) errors.push(normalized.error);
    }

    return {
        ok: errors.length === 0 && actions.length > 0,
        actions: errors.length === 0 ? actions : [],
        errors,
    };
}

export function validateWorkflowRulePreview(input: WorkflowRulePreviewInput): WorkflowRulePreviewResult {
    const sampleContext: WorkflowEventContext = {
        eventKey: input.triggerKey,
        sourceModule: input.sampleSourceModule ?? "validation.preview",
        payload: input.samplePayload ?? {},
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    const condition = evaluateWorkflowCondition(input.conditionJson, sampleContext);
    if (condition.reason) {
        errors.push(condition.reason);
    } else if (!condition.matched) {
        warnings.push("Condition is valid but did not match the sample preview context.");
    }

    const actions = normalizeWorkflowActions(input.actionJson);
    if (!actions.ok) errors.push(...actions.errors);
    if (actions.actions.some((action) => action.type === "enqueue_worker_job")) {
        warnings.push("Worker jobs are runtime-bound advanced actions and are excluded from starter templates until binding schema, retry policy, and audit trail are typed.");
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        condition: {
            matched: condition.matched,
            reason: condition.reason ?? null,
            sampleContext,
        },
        actions: {
            normalized: actions.actions,
            errors: actions.errors,
        },
    };
}
