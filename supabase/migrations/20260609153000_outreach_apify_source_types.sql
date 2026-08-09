-- Outreach Control Center: optional Apify discovery/enrichment source labels.

ALTER TYPE public.outreach_source_type ADD VALUE IF NOT EXISTS 'apify_google_maps';
ALTER TYPE public.outreach_source_type ADD VALUE IF NOT EXISTS 'apify_website_crawler';
