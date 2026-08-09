CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    content_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
    page_slug text,
    event_type text NOT NULL,
    event_name text NOT NULL,
    visitor_id text,
    session_id text,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    path text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_workspace_created_idx
  ON public.analytics_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_page_slug_idx
  ON public.analytics_events (page_slug);

CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx
  ON public.analytics_events (event_type);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events_select_policy" ON public.analytics_events;
CREATE POLICY "analytics_events_select_policy"
ON public.analytics_events
FOR SELECT
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
);

