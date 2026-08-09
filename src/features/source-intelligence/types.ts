import type { Json } from "@/shared/lib/supabase/database.types";

export type SourceQuality = "unverified" | "low" | "medium" | "high" | "authoritative";
export type SourceTrustTier = "unknown" | "community" | "vendor" | "industry" | "regulatory" | "internal";
export type SourceEvidenceType = "citation" | "supporting" | "contradicting" | "benchmark" | "definition" | "case_study" | "statistic";
export type SourceIngestionJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "superseded";
export type SourceIngestionRunReason = "scheduled" | "manual" | "webhook" | "backfill" | "retry";
export type SourceIngestionRunTrigger = "cron" | "dashboard" | "api" | "worker";

export type SourceRegistryRow = {
    id: string;
    workspace_id: string | null;
    name: string;
    canonical_url: string;
    source_type: "website" | "rss" | "pdf" | "dataset" | "manual" | "internal" | "api";
    quality: SourceQuality;
    trust_tier: SourceTrustTier;
    locale: "en" | "nl" | "ar";
    topic_tags: string[];
    is_active: boolean;
    is_public_safe: boolean;
    crawl_frequency: string;
    last_ingested_at: string | null;
    source_health_status?: string | null;
    last_fetch_status?: number | null;
    last_fetch_error_classification?: string | null;
    last_fetch_checked_at?: string | null;
    disabled_reason?: string | null;
    fallback_url?: string | null;
    fetch_strategy?: string | null;
    metadata: Json;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

export type SourceDocumentRow = {
    id: string;
    workspace_id: string | null;
    registry_id: string;
    canonical_url: string;
    title: string;
    description: string | null;
    author: string | null;
    publisher: string | null;
    locale: "en" | "nl" | "ar";
    quality: SourceQuality;
    trust_tier: SourceTrustTier;
    topic_tags: string[];
    published_at: string | null;
    retrieved_at: string;
    content_hash: string | null;
    raw_text: string | null;
    summary: string | null;
    is_public_safe: boolean;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type SourceIngestionJobRow = {
    id: string;
    workspace_id: string | null;
    registry_id: string;
    run_id: string | null;
    source_url: string;
    locale: "en" | "nl" | "ar";
    status: SourceIngestionJobStatus;
    priority: number;
    attempts: number;
    max_attempts: number;
    run_after: string;
    locked_at: string | null;
    worker_id: string | null;
    document_id: string | null;
    input_hash: string | null;
    result_summary: Json;
    error_message: string | null;
    run_reason?: SourceIngestionRunReason | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type SourceIngestionRunRow = {
    id: string;
    workspace_id: string | null;
    registry_id: string | null;
    started_by: string | null;
    status: SourceIngestionJobStatus;
    run_reason: SourceIngestionRunReason;
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    superseded_jobs: number;
    summary: Json;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type ContentEvidenceLinkRow = {
    id: string;
    workspace_id: string;
    template_id: string;
    content_id: string;
    source_document_id: string | null;
    source_claim_id: string | null;
    evidence_type: SourceEvidenceType;
    anchor_text: string | null;
    citation_url: string | null;
    citation_label: string | null;
    confidence: number;
    is_public_safe: boolean;
    metadata: Json;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

export type SourceWorkerResult = {
    success: boolean;
    jobId?: string;
    workspaceId?: string | null;
    failureKind?: "source" | "worker";
    message: string;
};

export type SourceEvidencePackClaim = {
    id: string;
    claim_text: string;
    normalized_claim: string | null;
    evidence_type: SourceEvidenceType;
    confidence: number;
    quality: SourceQuality;
    locale: "en" | "nl" | "ar";
    topic_tags: string[];
    published_at: string | null;
    metadata: Json;
    source: {
        document_id: string;
        registry_id: string;
        title: string;
        canonical_url: string;
        publisher: string | null;
        trust_tier: SourceTrustTier;
        quality: SourceQuality;
        published_at: string | null;
    };
    score: number;
};

export type SourceEvidencePack = {
    topic: string;
    checked_at: string;
    retrieval_mode: "source_intelligence" | "none";
    stale: boolean;
    claims: SourceEvidencePackClaim[];
    documents: Array<{
        id: string;
        title: string;
        canonical_url: string;
        publisher: string | null;
        quality: SourceQuality;
        trust_tier: SourceTrustTier;
        published_at: string | null;
        score: number;
    }>;
};
