CREATE TABLE IF NOT EXISTS public.analytics_ingestion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    path text,
    event_type text,
    event_name text,
    status text NOT NULL,
    reason text,
    request_fingerprint text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_ingestion_logs_workspace_created_idx
  ON public.analytics_ingestion_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_ingestion_logs_status_idx
  ON public.analytics_ingestion_logs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_workspace_event_created_idx
  ON public.analytics_events (workspace_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_workspace_slug_created_idx
  ON public.analytics_events (workspace_id, page_slug, created_at DESC);

ALTER TABLE public.analytics_ingestion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_ingestion_logs_select_policy" ON public.analytics_ingestion_logs;
CREATE POLICY "analytics_ingestion_logs_select_policy"
ON public.analytics_ingestion_logs
FOR SELECT
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
);
