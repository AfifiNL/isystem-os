-- Universal compatibility for databases that created the earlier Business OS
-- tables before the canonical Business Spine enums existed.
--
-- Enum additions are isolated in their own migration because PostgreSQL only
-- permits newly added enum values to be used after the transaction commits.

DO $$
BEGIN
  CREATE TYPE public.business_lifecycle_status AS ENUM (
    'prospect',
    'lead',
    'qualified',
    'customer',
    'active',
    'paused',
    'churned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.business_work_item_status AS ENUM (
    'open',
    'in_progress',
    'blocked',
    'done',
    'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.business_work_item_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regtype('public.workspace_work_item_status') IS NOT NULL THEN
    ALTER TYPE public.workspace_work_item_status ADD VALUE IF NOT EXISTS 'open';
    ALTER TYPE public.workspace_work_item_status ADD VALUE IF NOT EXISTS 'dismissed';
  END IF;
END $$;
