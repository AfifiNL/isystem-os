import type { Json } from "@/shared/lib/supabase/database.types";

export type OutreachCampaignStatus = "draft" | "discovering" | "reviewing" | "strategy" | "scheduled" | "active" | "paused" | "completed" | "archived";
export type OutreachReviewStatus = "pending" | "approved" | "rejected" | "needs_changes";
export type OutreachJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "superseded";
export type OutreachSourceType = "tavily_query" | "website" | "uploaded_csv" | "directory" | "market_monitor" | "manual" | "scrapling" | "apify_google_maps" | "apify_website_crawler";
export type OutreachAccountStage = "discovered" | "enriched" | "qualified" | "selected" | "contacted" | "replied" | "converted" | "closed";
export type OutreachLawfulBasis = "explicit_consent" | "existing_customer" | "legitimate_interest_assessment" | "manual_warranty" | "blocked" | "unknown";
export type OutreachMessageStatus = "draft" | "approved" | "scheduled" | "sending" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "complained" | "failed" | "stopped" | "unsubscribed";
export type OutreachEventType = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained" | "failed" | "received" | "replied" | "unsubscribed" | "interested" | "not_relevant" | "booked" | "manual_stop" | "campaign_paused";

export type OutreachWorkspaceSettingsRow = {
    workspace_id: string;
    from_name: string | null;
    from_email: string | null;
    reply_to_email: string | null;
    company_address: string | null;
    daily_workspace_cap: number;
    daily_sender_cap: number;
    daily_domain_cap: number;
    require_human_approval: boolean;
    warmup_enabled: boolean;
    allowed_lawful_bases: OutreachLawfulBasis[];
    default_country: string;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type OutreachCampaignRow = {
    id: string;
    workspace_id: string;
    template_id: string | null;
    name: string;
    brief: string;
    icp_description: string;
    target_sectors: string[];
    target_geographies: string[];
    source_types: OutreachSourceType[];
    exclusions: string[];
    status: OutreachCampaignStatus;
    review_status: OutreachReviewStatus;
    owner_profile_id: string | null;
    approved_by_profile_id: string | null;
    approved_at: string | null;
    paused_reason: string | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type OutreachDiscoveryJobRow = {
    id: string;
    workspace_id: string;
    campaign_id: string;
    source_id: string | null;
    job_type: "generate_queries" | "search" | "extract" | "score" | "import";
    status: OutreachJobStatus;
    priority: number;
    attempts: number;
    max_attempts: number;
    run_after: string;
    locked_at: string | null;
    worker_id: string | null;
    input: Json;
    result_summary: Json;
    error_message: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type OutreachDispatchJobRow = {
    id: string;
    workspace_id: string;
    campaign_id: string;
    message_id: string;
    status: OutreachJobStatus;
    priority: number;
    attempts: number;
    max_attempts: number;
    run_after: string;
    locked_at: string | null;
    worker_id: string | null;
    idempotency_key: string;
    result_summary: Json;
    error_message: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type OutreachContactRow = {
    id: string;
    workspace_id: string;
    account_id: string;
    campaign_id: string | null;
    email: string | null;
    email_hash: string | null;
    full_name: string | null;
    role_title: string | null;
    contact_type: "role_mailbox" | "generic_business" | "named_business" | "personal" | "unknown";
    source_url: string | null;
    discovered_at: string;
    lawful_basis: OutreachLawfulBasis;
    lawful_basis_note: string | null;
    lawful_basis_approved_by: string | null;
    lawful_basis_approved_at: string | null;
    review_status: OutreachReviewStatus;
    suppressed_at: string | null;
    suppression_reason: string | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type OutreachMessageRow = {
    id: string;
    workspace_id: string;
    campaign_id: string;
    account_id: string;
    contact_id: string;
    sequence_id: string | null;
    step_id: string | null;
    status: OutreachMessageStatus;
    subject: string;
    preview_text: string | null;
    body_text: string | null;
    body_html: string;
    personalization_basis: string | null;
    risk_score: number;
    approved_by_profile_id: string | null;
    approved_at: string | null;
    scheduled_for: string | null;
    provider: string | null;
    provider_message_id: string | null;
    idempotency_key: string | null;
    last_event_at: string | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type OutreachStrategyRow = {
    id: string;
    workspace_id: string;
    campaign_id: string;
    account_id: string | null;
    review_status: OutreachReviewStatus;
    account_summary: string | null;
    fit_reasons: string[];
    trigger_event: string | null;
    offer_angle: string | null;
    risk_flags: string[];
    citations: Json;
    generated_by: string;
    approved_by_profile_id: string | null;
    approved_at: string | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type OutreachSequenceRow = {
    id: string;
    workspace_id: string;
    campaign_id: string;
    strategy_id: string | null;
    name: string;
    status: OutreachReviewStatus;
    stop_rules: string[];
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type OutreachWorkerResult = {
    success: boolean;
    jobId?: string;
    workspaceId?: string | null;
    message: string;
};

export type OutreachProspectReviewItem = {
    id: string;
    campaign_id: string | null;
    campaign_name: string | null;
    name: string;
    domain: string | null;
    website_url: string | null;
    stage: OutreachAccountStage;
    review_status: OutreachReviewStatus;
    fit_score: number;
    fit_summary: string | null;
    why_now_trigger: string | null;
    contactCount: number;
    documentCount: number;
    draftMessageCount: number;
    scheduledMessageCount: number;
    sentMessageCount: number;
    updated_at: string;
};

export type OutreachMessageReviewItem = Pick<OutreachMessageRow, "id" | "campaign_id" | "account_id" | "contact_id" | "status" | "subject" | "body_html" | "scheduled_for" | "risk_score" | "updated_at"> & {
    account_name: string | null;
    contact_email: string | null;
};

export type OutreachDashboardData = {
    workspaceId: string;
    campaigns: Array<OutreachCampaignRow & {
        accountCount: number;
        contactCount: number;
        approvedMessageCount: number;
        scheduledMessageCount: number;
        queuedDispatchJobCount: number;
        sentMessageCount: number;
    }>;
    pendingAccounts: OutreachProspectReviewItem[];
    approvedAccounts: OutreachProspectReviewItem[];
    pendingMessages: OutreachMessageReviewItem[];
    recentEvents: Array<{
        id: string;
        campaign_id: string | null;
        message_id: string | null;
        event_type: OutreachEventType;
        occurred_at: string;
        provider: string | null;
    }>;
    stats: {
        campaigns: number;
        activeCampaigns: number;
        accounts: number;
        contacts: number;
        eligibleContacts: number;
        queuedDiscoveryJobs: number;
        queuedDispatchJobs: number;
        sentMessages: number;
        bouncedMessages: number;
        complainedMessages: number;
        suppressions: number;
    };
    error: string | null;
};
