-- Central, workspace-scoped audit trail for AI execution policy.
-- This schema is universal and belongs in core when the current promotion completes.

CREATE TABLE IF NOT EXISTS public.ai_execution_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  authorization_kind    TEXT NOT NULL CHECK (authorization_kind IN ('active_workspace', 'content', 'system_workspace')),
  route                 TEXT NOT NULL,
  operation             TEXT NOT NULL,
  prompt_id             TEXT NOT NULL,
  prompt_version        TEXT NOT NULL,
  prompt_hash           TEXT NOT NULL,
  requested_model_alias TEXT NOT NULL,
  resolved_model_alias  TEXT,
  resolved_model_id     TEXT,
  status                TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  error_code            TEXT,
  error_message         TEXT,
  runtime_metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_execution_runs_prompt_hash_format
    CHECK (prompt_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_ai_execution_runs_workspace_created
  ON public.ai_execution_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_execution_runs_route_status
  ON public.ai_execution_runs (route, status, created_at DESC);

COMMENT ON TABLE public.ai_execution_runs IS
  'Workspace-scoped success/failure audit for centrally governed AI executions. Prompt values are never persisted.';

ALTER TABLE public.ai_execution_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_execution_runs_select_workspace_members"
  ON public.ai_execution_runs;
CREATE POLICY "ai_execution_runs_select_workspace_members"
  ON public.ai_execution_runs
  FOR SELECT
  USING (public.can_access_workspace(workspace_id, NULL));

REVOKE ALL ON TABLE public.ai_execution_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_execution_runs TO authenticated;
GRANT ALL ON TABLE public.ai_execution_runs TO service_role;
