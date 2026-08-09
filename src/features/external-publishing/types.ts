import type { Tables, TablesInsert } from "@/shared/lib/supabase/database.types";

export const EXTERNAL_PUBLICATION_PLATFORMS = [
    "medium",
    "reddit",
    "linkedin",
    "devto",
    "indiehackers",
    "quora",
    "generic_forum",
    "generic_article",
] as const;

export const EXTERNAL_PUBLICATION_STATUSES = [
    "draft",
    "generated",
    "needs_review",
    "approved",
    "exported",
    "published_manual",
    "archived",
    "rejected",
] as const;

export const EXTERNAL_PUBLICATION_SOURCE_TYPES = [
    "gsc_query",
    "seo_plan",
    "seo_opportunity",
    "content_item",
    "manual_brief",
    "market_signal",
] as const;

export const EXTERNAL_PUBLICATION_ASSET_TYPES = [
    "featured_image",
    "inline_image",
    "diagram_mermaid",
    "diagram_png",
    "link_card",
    "download_bundle",
] as const;

export const EXTERNAL_PUBLICATION_EVENT_TYPES = [
    "generated",
    "validated",
    "approved",
    "exported",
    "published_manual",
    "rejected",
    "stale",
    "analytics_attributed",
] as const;

export const EXTERNAL_PUBLICATION_RESEARCH_PROVIDERS = [
    "apify_website_crawler",
    "apify_google_maps",
    "apify_linkedin_posts",
    "apify_dataset",
    "apify_run_poll",
    "tavily",
    "manual",
] as const;

export const EXTERNAL_PUBLICATION_RESEARCH_JOB_TYPES = ["search", "crawl", "extract", "import", "poll"] as const;

export const EXTERNAL_PUBLICATION_RESEARCH_JOB_STATUSES = ["queued", "running", "completed", "failed", "cancelled", "superseded"] as const;

export type ExternalPublicationPlatform = typeof EXTERNAL_PUBLICATION_PLATFORMS[number];
export type ExternalPublicationStatus = typeof EXTERNAL_PUBLICATION_STATUSES[number];
export type ExternalPublicationSourceType = typeof EXTERNAL_PUBLICATION_SOURCE_TYPES[number];
export type ExternalPublicationAssetType = typeof EXTERNAL_PUBLICATION_ASSET_TYPES[number];
export type ExternalPublicationEventType = typeof EXTERNAL_PUBLICATION_EVENT_TYPES[number];
export type ExternalPublicationResearchProvider = typeof EXTERNAL_PUBLICATION_RESEARCH_PROVIDERS[number];
export type ExternalPublicationResearchJobType = typeof EXTERNAL_PUBLICATION_RESEARCH_JOB_TYPES[number];
export type ExternalPublicationResearchJobStatus = typeof EXTERNAL_PUBLICATION_RESEARCH_JOB_STATUSES[number];

export type ExternalPublicationCampaignRow = Tables<"external_publication_campaigns">;
export type ExternalPublicationPackageRow = Tables<"external_publication_packages">;
export type ExternalPublicationAssetRow = Tables<"external_publication_assets">;
export type ExternalPublicationEventRow = Tables<"external_publication_events">;
export type ExternalPublicationPlatformProfileRow = Tables<"external_publication_platform_profiles">;
export type ExternalPublicationResearchJobRow = Tables<"external_publication_research_jobs">;
export type ExternalPublicationResearchDocumentRow = Tables<"external_publication_research_documents">;

export type ExternalPublicationResearchJobInsert = TablesInsert<"external_publication_research_jobs">;
export type ExternalPublicationResearchDocumentInsert = TablesInsert<"external_publication_research_documents">;
