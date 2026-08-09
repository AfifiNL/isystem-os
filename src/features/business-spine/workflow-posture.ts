export const WORKFLOW_APPROVAL_AWAITING_STATUS = "awaiting_approval" as const;
export const WORKFLOW_APPROVAL_RESUMED_STATUS = "approved_resumed" as const;

type WorkflowRunPostureInput = {
    status: string;
    result_summary?: unknown;
};

type AwaitingApprovalSummaryInput = {
    ruleId: string;
    ruleName: string;
    blockedActions: string[];
    actionResults: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildWorkflowAwaitingApprovalSummary(input: AwaitingApprovalSummaryInput) {
    return {
        requiresApproval: true,
        awaitingApproval: true,
        approvalStatus: WORKFLOW_APPROVAL_AWAITING_STATUS,
        approval: {
            status: WORKFLOW_APPROVAL_AWAITING_STATUS,
            ruleId: input.ruleId,
            ruleName: input.ruleName,
            blockedActions: input.blockedActions,
            requestedAt: new Date().toISOString(),
        },
        actionResults: input.actionResults,
    };
}

export function buildWorkflowResumedApprovalSummary(actionResults: unknown[]) {
    return {
        requiresApproval: true,
        awaitingApproval: false,
        approvalStatus: WORKFLOW_APPROVAL_RESUMED_STATUS,
        approval: {
            status: WORKFLOW_APPROVAL_RESUMED_STATUS,
            resumedAt: new Date().toISOString(),
        },
        actionResults,
    };
}

export function isWorkflowRunAwaitingApproval(run: WorkflowRunPostureInput) {
    const summary = run.result_summary;
    if (!isRecord(summary)) return false;
    const approval = isRecord(summary.approval) ? summary.approval : null;
    return run.status === "completed"
        && summary.requiresApproval === true
        && summary.awaitingApproval === true
        && (summary.approvalStatus === WORKFLOW_APPROVAL_AWAITING_STATUS || approval?.status === WORKFLOW_APPROVAL_AWAITING_STATUS);
}

export function deriveWorkflowRunPosture(run: WorkflowRunPostureInput) {
    return isWorkflowRunAwaitingApproval(run) ? WORKFLOW_APPROVAL_AWAITING_STATUS : run.status;
}
