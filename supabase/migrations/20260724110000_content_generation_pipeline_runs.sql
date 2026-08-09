-- Durable phase state for the multi-step content generation pipeline.

CREATE TABLE IF NOT EXISTS public.content_generation_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'succeeded', 'failed')),
  current_phase     TEXT CHECK (
                      current_phase IS NULL OR current_phase IN (
                        'brief_validation',
                        'evidence_retrieval',
                        'blueprint',
                        'format_generation',
                        'visual_enrichment',
                        'editorial_validation',
                        'persistence'
                      )
                    ),
  requested_formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  derived_outputs   JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase_state       JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(phase_state) = 'object'),
  input_summary     JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_item_id   UUID REFERENCES public.content_items(id) ON DELETE SET NULL,
  error_code        TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_generation_runs_workspace_created
  ON public.content_generation_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_generation_runs_status_phase
  ON public.content_generation_runs (status, current_phase, updated_at DESC);

COMMENT ON TABLE public.content_generation_runs IS
  'Durable, tenant-scoped state machine for content generation phases and derived outputs.';

ALTER TABLE public.content_generation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_generation_runs_select_members"
  ON public.content_generation_runs;
CREATE POLICY "content_generation_runs_select_members"
  ON public.content_generation_runs
  FOR SELECT
  USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "content_generation_runs_insert_members"
  ON public.content_generation_runs;
CREATE POLICY "content_generation_runs_insert_members"
  ON public.content_generation_runs
  FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND public.can_access_workspace(workspace_id, 'content.write')
  );

DROP POLICY IF EXISTS "content_generation_runs_update_members"
  ON public.content_generation_runs;
CREATE POLICY "content_generation_runs_update_members"
  ON public.content_generation_runs
  FOR UPDATE
  USING (
    profile_id = auth.uid()
    AND public.can_access_workspace(workspace_id, 'content.write')
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND public.can_access_workspace(workspace_id, 'content.write')
  );

REVOKE ALL ON TABLE public.content_generation_runs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.content_generation_runs TO authenticated;
GRANT ALL ON TABLE public.content_generation_runs TO service_role;
