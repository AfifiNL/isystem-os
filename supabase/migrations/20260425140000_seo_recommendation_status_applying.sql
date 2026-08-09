-- Adds the "applying" status to the seo_recommendation_status enum so the code's
-- compare-and-swap claim used by applySeoInternalLinkRecommendation and the auto-apply
-- pipeline actually persists. Without this, production returned 500 on every Apply
-- because writes with status="applying" failed Postgres enum validation.
ALTER TYPE seo_recommendation_status ADD VALUE IF NOT EXISTS 'applying';
