-- Migration for Content Freshness Reviews table.
-- Supports scheduled background staleness scans and tracking of content freshness audits.

CREATE TABLE IF NOT EXISTS public.content_freshness_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'fresh', -- 'fresh', 'warning', 'stale'
  risk text NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high'
  stale_indicators text[] NOT NULL DEFAULT '{}'::text[],
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_freshness_reviews_unique_item UNIQUE (workspace_id, content_item_id)
);

CREATE INDEX IF NOT EXISTS content_freshness_reviews_workspace_checked_idx
  ON public.content_freshness_reviews (workspace_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS content_freshness_reviews_status_idx
  ON public.content_freshness_reviews (workspace_id, status, risk);

ALTER TABLE public.content_freshness_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_freshness_reviews_select_policy" ON public.content_freshness_reviews;
CREATE POLICY "content_freshness_reviews_select_policy"
  ON public.content_freshness_reviews
  FOR SELECT
  USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "content_freshness_reviews_insert_policy" ON public.content_freshness_reviews;
CREATE POLICY "content_freshness_reviews_insert_policy"
  ON public.content_freshness_reviews
  FOR INSERT
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "content_freshness_reviews_update_policy" ON public.content_freshness_reviews;
CREATE POLICY "content_freshness_reviews_update_policy"
  ON public.content_freshness_reviews
  FOR UPDATE
  USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "content_freshness_reviews_delete_policy" ON public.content_freshness_reviews;
CREATE POLICY "content_freshness_reviews_delete_policy"
  ON public.content_freshness_reviews
  FOR DELETE
  USING (public.can_access_workspace(workspace_id, 'content.write'));

-- Trigger for auto updated_at
CREATE OR REPLACE FUNCTION public.set_content_freshness_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_freshness_reviews_set_updated_at ON public.content_freshness_reviews;
CREATE TRIGGER content_freshness_reviews_set_updated_at
  BEFORE UPDATE ON public.content_freshness_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_content_freshness_reviews_updated_at();
