export interface MarketMonitorConfig {
    id: string;
    workspace_id: string;
    competitor_domains: string[];
    authority_domains: string[];
    industry_keywords: string[];
    enabled: boolean;
    last_run_at: string | null;
    created_at: string;
    updated_at: string;
}

export type MonitorChangeType =
    | "new_page"
    | "competitor_update"
    | "industry_news"
    | "pricing_signal"
    | "regulation_update";

export interface MarketMonitorResult {
    id: string;
    workspace_id: string;
    config_id: string;
    url: string;
    title: string | null;
    snippet: string | null;
    change_type: MonitorChangeType;
    trust_tier: number;
    published_date: string | null;
    detected_at: string;
    read: boolean;
    archived: boolean;
    archived_at: string | null;
}

export interface MonitorScanSummary {
    workspace_id: string;
    scanned_at: string;
    new_results: number;
    errors: string[];
}
