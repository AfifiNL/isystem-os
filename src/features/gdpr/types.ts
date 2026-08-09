export interface SubProcessor {
    name: string;
    purpose: string;
    location?: string;
    url?: string;
    dpa_url?: string;
}

export interface WorkspaceGdprSettings {
    workspace_id: string;
    dpo_name: string | null;
    dpo_email: string | null;
    privacy_policy_url: string | null;
    terms_url: string | null;
    processing_legal_basis: string;
    analytics_retention_days: number;
    logs_retention_days: number;
    marketing_retention_days: number;
    sub_processors: SubProcessor[];
    data_regions: string[];
    consent_required: boolean;
    cookie_consent_mode: string;
    notes: string | null;
    updated_at: string;
    created_at: string;
}

export type GdprRequestType =
    | "export"
    | "deletion"
    | "rectification"
    | "access"
    | "portability"
    | "restriction";

export type GdprRequestStatus = "open" | "in_progress" | "completed" | "rejected";

export interface WorkspaceGdprRequest {
    id: string;
    workspace_id: string;
    request_type: GdprRequestType;
    status: GdprRequestStatus;
    subject_email: string;
    subject_name: string | null;
    requested_at: string;
    due_at: string;
    completed_at: string | null;
    completed_by_profile_id: string | null;
    notes: string | null;
    evidence: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface SubjectDataExport {
    subjectEmail: string;
    newsletterContacts: unknown[];
    outreachContacts: unknown[];
    bookingReservations: unknown[];
    portalClients: unknown[];
    analyticsEventsCount: number;
    generatedAt: string;
}
