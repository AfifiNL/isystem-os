-- Blog regeneration + indexing engine
-- Universal schema for review-first published blog regeneration and
-- Search Console / Indexing API indexing attempts.

CREATE TABLE IF NOT EXISTS public.blog_regeneration_runs (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id                 uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  actor_profile_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status                     text NOT NULL DEFAULT 'previewed'
    CHECK (status IN ('previewed','partially_applied','applied','rolled_back','expired')),
  preview_payload            jsonb NOT NULL,
  snapshot_before            jsonb NOT NULL,
  snapshot_after             jsonb,
  gsc_snapshot               jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_charged_millicents   bigint NOT NULL DEFAULT 0,
  expires_at                 timestamptz NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  applied_at                 timestamptz,
  rolled_back_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_blog_regeneration_runs_workspace_content
  ON public.blog_regeneration_runs (workspace_id, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_regeneration_runs_status
  ON public.blog_regeneration_runs (status, created_at DESC);

COMMENT ON TABLE public.blog_regeneration_runs IS
  'Review-first full blog regeneration previews. Snapshots enable apply conflict checks and rollback.';

CREATE TABLE IF NOT EXISTS public.seo_indexing_jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id         uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  url                text NOT NULL,
  canonical_path     text NOT NULL,
  source_event       text NOT NULL CHECK (source_event IN ('blog_published','blog_regenerated','manual','repair_retry')),
  status             text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','submitted','indexed','not_indexed','failed','skipped')),
  attempt_count      integer NOT NULL DEFAULT 0,
  next_attempt_at    timestamptz DEFAULT now(),
  last_attempt_at    timestamptz,
  last_error         text,
  last_inspection    jsonb,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_indexing_jobs_workspace_url_open
  ON public.seo_indexing_jobs (workspace_id, url)
  WHERE status IN ('queued','processing','submitted','not_indexed','failed');

CREATE INDEX IF NOT EXISTS idx_seo_indexing_jobs_due
  ON public.seo_indexing_jobs (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_seo_indexing_jobs_workspace_content
  ON public.seo_indexing_jobs (workspace_id, content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_indexing_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.seo_indexing_jobs(id) ON DELETE CASCADE,
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('sitemap','url_inspection','indexing_api')),
  status          text NOT NULL CHECK (status IN ('success','failed','skipped')),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_json   jsonb,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_indexing_attempts_job
  ON public.seo_indexing_attempts (job_id, created_at DESC);

ALTER TABLE public.blog_regeneration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_indexing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_indexing_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_regeneration_runs_select_members" ON public.blog_regeneration_runs;
CREATE POLICY "blog_regeneration_runs_select_members"
  ON public.blog_regeneration_runs FOR SELECT
  USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "blog_regeneration_runs_insert_members" ON public.blog_regeneration_runs;
CREATE POLICY "blog_regeneration_runs_insert_members"
  ON public.blog_regeneration_runs FOR INSERT
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "blog_regeneration_runs_update_members" ON public.blog_regeneration_runs;
CREATE POLICY "blog_regeneration_runs_update_members"
  ON public.blog_regeneration_runs FOR UPDATE
  USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_indexing_jobs_select_members" ON public.seo_indexing_jobs;
CREATE POLICY "seo_indexing_jobs_select_members"
  ON public.seo_indexing_jobs FOR SELECT
  USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "seo_indexing_jobs_insert_members" ON public.seo_indexing_jobs;
CREATE POLICY "seo_indexing_jobs_insert_members"
  ON public.seo_indexing_jobs FOR INSERT
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_indexing_jobs_update_members" ON public.seo_indexing_jobs;
CREATE POLICY "seo_indexing_jobs_update_members"
  ON public.seo_indexing_jobs FOR UPDATE
  USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_indexing_attempts_select_members" ON public.seo_indexing_attempts;
CREATE POLICY "seo_indexing_attempts_select_members"
  ON public.seo_indexing_attempts FOR SELECT
  USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "seo_indexing_attempts_insert_members" ON public.seo_indexing_attempts;
CREATE POLICY "seo_indexing_attempts_insert_members"
  ON public.seo_indexing_attempts FOR INSERT
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
