-- Universal product migration: Market Monitor signals can enter the reviewed
-- Opportunity Engine queue and, after approval, External Publishing.

ALTER TYPE public.workspace_opportunity_category
    ADD VALUE IF NOT EXISTS 'market';
