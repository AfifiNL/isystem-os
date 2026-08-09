import type { FrequencyKind } from "@/features/portal/lib/sla-overdue";

export type LegibilityQueryMode = "structured" | "semantic" | "hybrid" | "unsupported";

export type StructuredHubQueryKey =
    | "client_count"
    | "client_list"
    | "customer_lifecycle_counts"
    | "project_count"
    | "sla_task_count"
    | "overdue_sla_task_count"
    | "unresolved_sla_flags_count"
    | "open_work_item_list"
    | "blocked_work_item_list"
    | "failing_integration_list"
    | "recent_failed_workflow_run_list"
    | "unprocessed_voice_memo_count"
    | "recent_voice_memo_count"
    | "content_item_count"
    | "published_content_count"
    | "booking_reservation_count"
    | "open_opportunity_count"
    | "quote_status_counts"
    | "invoice_status_counts"
    | "recent_customer_lifecycle_events";

export type StructuredHubScope = "active_workspace";

export interface StructuredHubQueryResult {
    key: StructuredHubQueryKey;
    source: "structured_query";
    label: string;
    answer: string;
    value?: number | string | null;
    rows?: Array<Record<string, unknown>>;
    rowCount?: number;
    scope: StructuredHubScope;
    provenance: {
        tables: string[];
        filters: Record<string, unknown>;
        executedAt: string;
        businessDefinition: string;
        limitations?: string[];
    };
}

export interface UnsupportedStructuredMetricResult {
    mode: "unsupported";
    answer: string;
    suggestions: Array<{
        label: string;
        query: string;
        key: StructuredHubQueryKey;
    }>;
    reason: string;
}

export interface LegibilityHubTrace {
    mode: LegibilityQueryMode;
    structuredKey?: StructuredHubQueryKey;
    confidence: number;
    reason: string;
    durationMs?: number;
    rowCount?: number;
    nodeCount?: number;
    usedGemini: boolean;
    errorCode?: string;
}

export interface StructuredHubDateWindow {
    label: string;
    from: string;
    to: string;
    timezone: string;
}

export interface ClassifiedLegibilityQuery {
    mode: LegibilityQueryMode;
    structuredKey?: StructuredHubQueryKey;
    confidence: number;
    reason: string;
    alternatives?: Array<{ key: StructuredHubQueryKey; confidence: number; reason: string }>;
    needsClarification?: boolean;
}

export interface StructuredHubQueryRunnerParams {
    key: StructuredHubQueryKey;
    workspaceId: string;
    scope: StructuredHubScope;
    queryText?: string;
    dateWindow?: StructuredHubDateWindow | null;
    limit?: number;
}

export interface StructuredHubQueryCard {
    key: StructuredHubQueryKey;
    label: string;
    description: string;
    businessDefinition: string;
    tables: string[];
    supportedScopes: StructuredHubScope[];
    defaultLimit?: number;
    maxLimit?: number;
    run: (params: StructuredHubQueryRunnerParams) => Promise<StructuredHubQueryResult>;
}

export interface StructuredHubSlaTaskRow {
    id: string;
    task_name?: string | null;
    frequency_kind: FrequencyKind;
    frequency_value_days: number | null;
    grace_period_days: number;
    last_completed_at: string | null;
    status: "compliant" | "completed" | "pending" | "issue";
    workspace_client_projects?:
        | { workspace_id: string; id?: string; name?: string | null; client_id?: string | null }
        | Array<{ workspace_id: string; id?: string; name?: string | null; client_id?: string | null }>
        | null;
}
