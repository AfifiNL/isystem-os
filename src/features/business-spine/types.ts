export type BusinessLifecycleStatus =
    | "prospect"
    | "lead"
    | "qualified"
    | "customer"
    | "active"
    | "paused"
    | "churned";

export type BusinessWorkItemStatus = "open" | "in_progress" | "blocked" | "done" | "dismissed";
export type BusinessWorkItemPriority = "low" | "normal" | "high" | "urgent";

export interface BusinessCustomer {
    id: string;
    workspaceId: string;
    displayName: string;
    legalName: string | null;
    lifecycleStatus: BusinessLifecycleStatus;
    primaryEmail: string | null;
    primaryPhone: string | null;
    ownerProfileId: string | null;
    portalClientId: string | null;
    sourceModule: string | null;
    updatedAt: string;
}

export interface BusinessWorkItem {
    id: string;
    workspaceId: string;
    customerId: string | null;
    title: string;
    description: string | null;
    kind: string;
    status: BusinessWorkItemStatus;
    priority: BusinessWorkItemPriority;
    assignedToProfileId: string | null;
    dueAt: string | null;
    sourceModule: string | null;
    sourceEntityType: string | null;
    sourceEntityId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface BusinessWorkflowRule {
    id: string;
    workspaceId: string;
    name: string;
    triggerKey: string;
    isEnabled: boolean;
    requiresApproval: boolean;
    updatedAt: string;
    conditionJson?: unknown;
    actionJson?: unknown;
    metadata?: unknown;
}

export interface BusinessTimelineEvent {
    id: string;
    customerId: string;
    eventType: string;
    summary: string;
    body: string | null;
    actorType: string;
    sourceModule: string;
    sourceTable: string | null;
    sourceId: string | null;
    occurredAt: string;
}

export interface BusinessCommercialLink {
    id: string;
    customerId: string | null;
    linkType: string;
    linkedRecordType: string;
    linkedRecordId: string | null;
    linkedRecordRef: string | null;
    createdAt: string;
}

export interface BusinessAccountCommercialSummary {
    totalCommercialLinks: number;
    linkCountsByType: Record<string, number>;
    invoiceLinkCount: number;
    paymentLinkCount: number;
    invoiceStatusCounts: Record<string, number>;
    paymentEventCounts: Record<string, number>;
    lastCommercialActivityAt: string | null;
}

export interface BusinessCustomerDetail {
    customer: BusinessCustomer;
    timeline: BusinessTimelineEvent[];
    openWorkItems: BusinessWorkItem[];
    commercialLinks: BusinessCommercialLink[];
    commercialSummary: BusinessAccountCommercialSummary;
    portalClient: {
        id: string;
        email: string | null;
        fullName: string | null;
    } | null;
}

export interface BusinessAssigneeOption {
    profileId: string;
    email: string;
    role: string;
}

export interface BusinessIntegrationHealth {
    id: string;
    workspaceId: string;
    provider: string;
    integrationKey: string;
    status: "unknown" | "healthy" | "degraded" | "failing" | "disabled";
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
    lastErrorMessage: string | null;
    updatedAt: string;
}

export interface BusinessHealthSummary {
    customers: {
        total: number;
        active: number;
        leads: number;
    };
    work: {
        open: number;
        urgent: number;
        overdue: number;
    };
    integrations: {
        failing: number;
        degraded: number;
    };
    automation: {
        enabledRules: number;
        failedRuns: number;
    };
}
