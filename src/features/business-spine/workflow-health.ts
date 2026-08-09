import { deriveWorkflowRunPosture } from "@/features/business-spine/workflow-posture";

export type WorkflowRuleHealthCardRuleRow = {
    id: string;
    name: string;
    trigger_key: string;
    is_enabled: boolean;
    requires_approval: boolean;
    updated_at: string;
};

export type WorkflowRuleHealthCardEventRow = {
    id: string;
    event_key: string;
    source_module: string;
    created_at: string;
};

export type WorkflowRuleHealthCardRunRow = {
    id: string;
    rule_id: string | null;
    status: string;
    attempts: number;
    max_attempts: number;
    result_summary: unknown;
    error_message: string | null;
    created_at: string;
    updated_at: string;
};

export type WorkflowRuleHealthCard = {
    ruleId: string;
    name: string;
    triggerKey: string;
    isEnabled: boolean;
    requiresApproval: boolean;
    updatedAt: string;
    lastMatchedEvent: {
        id: string;
        eventKey: string;
        sourceModule: string;
        createdAt: string;
    } | null;
    lastRun: {
        id: string;
        status: string;
        posture: string;
        attempts: number;
        maxAttempts: number;
        updatedAt: string;
    } | null;
    lastError: string | null;
    approvalAgeMinutes: number | null;
    idempotencySkipCount: number;
};

function minutesBetween(startIso: string, end: Date) {
    const start = Date.parse(startIso);
    if (!Number.isFinite(start)) return null;
    return Math.max(0, Math.floor((end.getTime() - start) / 60000));
}

export function buildWorkflowRuleHealthCards(input: {
    rules: WorkflowRuleHealthCardRuleRow[];
    events: WorkflowRuleHealthCardEventRow[];
    runs: WorkflowRuleHealthCardRunRow[];
    idempotencySkipCounts?: Map<string, number>;
    now?: Date;
}): WorkflowRuleHealthCard[] {
    const now = input.now ?? new Date();
    return input.rules.map((rule) => {
        const lastMatchedEvent = input.events
            .filter((event) => event.event_key === rule.trigger_key)
            .sort((left, right) => right.created_at.localeCompare(left.created_at))[0] ?? null;
        const lastRun = input.runs
            .filter((run) => run.rule_id === rule.id)
            .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ?? null;
        const lastErrorRun = input.runs
            .filter((run) => run.rule_id === rule.id && run.error_message)
            .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ?? null;
        const posture = lastRun ? deriveWorkflowRunPosture({ status: lastRun.status, result_summary: lastRun.result_summary }) : null;

        return {
            ruleId: rule.id,
            name: rule.name,
            triggerKey: rule.trigger_key,
            isEnabled: rule.is_enabled,
            requiresApproval: rule.requires_approval,
            updatedAt: rule.updated_at,
            lastMatchedEvent: lastMatchedEvent ? {
                id: lastMatchedEvent.id,
                eventKey: lastMatchedEvent.event_key,
                sourceModule: lastMatchedEvent.source_module,
                createdAt: lastMatchedEvent.created_at,
            } : null,
            lastRun: lastRun ? {
                id: lastRun.id,
                status: lastRun.status,
                posture: posture ?? lastRun.status,
                attempts: lastRun.attempts,
                maxAttempts: lastRun.max_attempts,
                updatedAt: lastRun.updated_at,
            } : null,
            lastError: lastErrorRun?.error_message ?? null,
            approvalAgeMinutes: posture === "awaiting_approval" && lastRun ? minutesBetween(lastRun.updated_at, now) : null,
            idempotencySkipCount: input.idempotencySkipCounts?.get(rule.id) ?? 0,
        };
    });
}
