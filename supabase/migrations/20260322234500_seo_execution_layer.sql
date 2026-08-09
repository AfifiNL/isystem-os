
ALTER TYPE public.seo_recommendation_status ADD VALUE IF NOT EXISTS 'ready_to_apply';
ALTER TYPE public.seo_recommendation_status ADD VALUE IF NOT EXISTS 'applied';
ALTER TYPE public.seo_recommendation_status ADD VALUE IF NOT EXISTS 'manual_review_required';
ALTER TYPE public.seo_recommendation_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE public.seo_recommendation_status ADD VALUE IF NOT EXISTS 'rolled_back';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_execution_status'
  ) THEN
    CREATE TYPE public.seo_execution_status AS ENUM (
      'previewed',
      'applied',
      'manual_review_required',
      'failed',
      'rolled_back'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_rollback_status'
  ) THEN
    CREATE TYPE public.seo_rollback_status AS ENUM (
      'not_requested',
      'rolled_back',
      'conflict',
      'failed'
    );
  END IF;
END $$;

ALTER TABLE public.seo_internal_link_opportunities
  ADD COLUMN IF NOT EXISTS last_preview_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_preview_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_review_reason text,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS rolled_back_at timestamptz;

CREATE TABLE IF NOT EXISTS public.seo_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.seo_internal_link_opportunities(id) ON DELETE CASCADE,
  source_content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  target_content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  execution_status public.seo_execution_status NOT NULL DEFAULT 'previewed',
  rollback_status public.seo_rollback_status NOT NULL DEFAULT 'not_requested',
  content_field_mutated text NOT NULL DEFAULT 'content_markdown',
  content_format text NOT NULL,
  renderer text NOT NULL,
  mutation_strategy text NOT NULL,
  source_slug text,
  target_slug text,
  original_content_snapshot text NOT NULL,
  updated_content_snapshot text,
  preview_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  applied_at timestamptz,
  applied_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rollback_at timestamptz,
  rolled_back_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_internal_link_opportunities
  ADD COLUMN IF NOT EXISTS last_execution_event_id uuid REFERENCES public.seo_execution_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS seo_internal_link_opportunities_workspace_recommendation_status_idx
  ON public.seo_internal_link_opportunities (workspace_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS seo_execution_events_workspace_created_idx
  ON public.seo_execution_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_execution_events_workspace_recommendation_idx
  ON public.seo_execution_events (workspace_id, recommendation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_execution_events_workspace_source_content_idx
  ON public.seo_execution_events (workspace_id, source_content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_execution_events_workspace_target_content_idx
  ON public.seo_execution_events (workspace_id, target_content_id, created_at DESC);

ALTER TABLE public.seo_execution_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_execution_events_select_policy" ON public.seo_execution_events;
CREATE POLICY "seo_execution_events_select_policy"
ON public.seo_execution_events
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "seo_execution_events_insert_policy" ON public.seo_execution_events;
CREATE POLICY "seo_execution_events_insert_policy"
ON public.seo_execution_events
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_execution_events_update_policy" ON public.seo_execution_events;
CREATE POLICY "seo_execution_events_update_policy"
ON public.seo_execution_events
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_seo_execution_events'
      AND tgrelid = 'public.seo_execution_events'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_seo_execution_events
    BEFORE UPDATE ON public.seo_execution_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
