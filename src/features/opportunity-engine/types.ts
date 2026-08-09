export type OpportunityCategory = "seo" | "content" | "conversion" | "market";

export type OpportunitySeverity = "low" | "medium" | "high";

export type OpportunityStatus =
    | "pending"
    | "approved"
    | "dismissed"
    | "implemented"
    | "superseded";

export type OpportunityScanStatus =
    | "queued"
    | "running"
    | "completed"
    | "failed";

/**
 * Deterministic output of a detector. Detectors do not touch AI and do not
 * write to the database. They return raw signals which the orchestrator then
 * persists and optionally enriches with AI narration.
 */
export interface OpportunitySignal {
    category: OpportunityCategory;
    signalKey: string;
    severity: OpportunitySeverity;
    title: string;
    summary: string;
    priorityScore: number;
    signalData: Record<string, unknown>;
}

export interface OpportunityRecord {
    id: string;
    workspaceId: string;
    scanId: string | null;
    category: OpportunityCategory;
    severity: OpportunitySeverity;
    status: OpportunityStatus;
    signalKey: string;
    title: string;
    summary: string | null;
    recommendationMarkdown: string | null;
    signalData: Record<string, unknown>;
    priorityScore: number;
    resolvedAt: string | null;
    resolvedByProfileId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface OpportunityScanRecord {
    id: string;
    workspaceId: string;
    status: OpportunityScanStatus;
    triggeredByProfileId: string | null;
    triggeredVia: string;
    signalsFound: number;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface DetectorContext {
    workspaceId: string;
    lookbackDays: number;
}

export type Detector = (context: DetectorContext) => Promise<OpportunitySignal[]>;
