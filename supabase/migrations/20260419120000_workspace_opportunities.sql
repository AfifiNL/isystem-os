
-- AI Opportunity Engine: persistence layer for scan runs and surfaced opportunities.
-- Mirrors the status lifecycle used by seo_content_opportunities so the UI and
-- review workflow stays consistent across modules.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'workspace_opportunity_category'
  ) THEN
    CREATE TYPE public.workspace_opportunity_category AS ENUM (
      'seo',
      'content',
      'conversion'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'workspace_opportunity_severity'
  ) THEN
    CREATE TYPE public.workspace_opportunity_severity AS ENUM (
      'low',
      'medium',
      'high'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'workspace_opportunity_status'
  ) THEN
    CREATE TYPE public.workspace_opportunity_status AS ENUM (
      'pending',
      'approved',
      'dismissed',
      'implemented',
      'superseded'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'workspace_opportunity_scan_status'
  ) THEN
    CREATE TYPE public.workspace_opportunity_scan_status AS ENUM (
      'queued',
      'running',
      'completed',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_opportunity_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status public.workspace_opportunity_scan_status NOT NULL DEFAULT 'queued',
  triggered_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  triggered_via text NOT NULL DEFAULT 'manual',
  signals_found integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scan_id uuid REFERENCES public.workspace_opportunity_scans(id) ON DELETE SET NULL,
  category public.workspace_opportunity_category NOT NULL,
  severity public.workspace_opportunity_severity NOT NULL DEFAULT 'medium',
  status public.workspace_opportunity_status NOT NULL DEFAULT 'pending',
  signal_key text NOT NULL,
  title text NOT NULL,
  summary text,
  recommendation_markdown text,
  signal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_score numeric(6,2) NOT NULL DEFAULT 0,
  resolved_at timestamptz,
  resolved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_opportunities_unique_open_signal UNIQUE (workspace_id, category, signal_key)
);

CREATE INDEX IF NOT EXISTS workspace_opportunity_scans_workspace_created_idx
  ON public.workspace_opportunity_scans (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_opportunities_workspace_status_priority_idx
  ON public.workspace_opportunities (workspace_id, status, priority_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_opportunities_workspace_category_idx
  ON public.workspace_opportunities (workspace_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_opportunities_scan_idx
  ON public.workspace_opportunities (scan_id);

ALTER TABLE public.workspace_opportunity_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_opportunity_scans_select_policy" ON public.workspace_opportunity_scans;
CREATE POLICY "workspace_opportunity_scans_select_policy"
ON public.workspace_opportunity_scans
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "workspace_opportunity_scans_insert_policy" ON public.workspace_opportunity_scans;
CREATE POLICY "workspace_opportunity_scans_insert_policy"
ON public.workspace_opportunity_scans
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "workspace_opportunity_scans_update_policy" ON public.workspace_opportunity_scans;
CREATE POLICY "workspace_opportunity_scans_update_policy"
ON public.workspace_opportunity_scans
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "workspace_opportunities_select_policy" ON public.workspace_opportunities;
CREATE POLICY "workspace_opportunities_select_policy"
ON public.workspace_opportunities
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "workspace_opportunities_insert_policy" ON public.workspace_opportunities;
CREATE POLICY "workspace_opportunities_insert_policy"
ON public.workspace_opportunities
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "workspace_opportunities_update_policy" ON public.workspace_opportunities;
CREATE POLICY "workspace_opportunities_update_policy"
ON public.workspace_opportunities
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

CREATE OR REPLACE FUNCTION public.set_workspace_opportunities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_opportunity_scans_set_updated_at ON public.workspace_opportunity_scans;
CREATE TRIGGER workspace_opportunity_scans_set_updated_at
BEFORE UPDATE ON public.workspace_opportunity_scans
FOR EACH ROW EXECUTE FUNCTION public.set_workspace_opportunities_updated_at();

DROP TRIGGER IF EXISTS workspace_opportunities_set_updated_at ON public.workspace_opportunities;
CREATE TRIGGER workspace_opportunities_set_updated_at
BEFORE UPDATE ON public.workspace_opportunities
FOR EACH ROW EXECUTE FUNCTION public.set_workspace_opportunities_updated_at();
