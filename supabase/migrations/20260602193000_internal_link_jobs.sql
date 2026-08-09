
CREATE TABLE IF NOT EXISTS public.seo_internal_link_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'superseded')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  content_hash text NOT NULL CHECK (char_length(content_hash) = 64),
  model_config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_summary_millicents bigint NOT NULL DEFAULT 0 CHECK (cost_summary_millicents >= 0),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_internal_link_jobs_running_locked_check
    CHECK (status <> 'running' OR locked_at IS NOT NULL),
  CONSTRAINT seo_internal_link_jobs_completed_timestamp_check
    CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

COMMENT ON TABLE public.seo_internal_link_jobs IS
  'Durable queue for internal-link background analysis. Enqueued on publish; processed by a separate worker.';

COMMENT ON COLUMN public.seo_internal_link_jobs.content_hash IS
  'SHA-256 hash of the content body snapshot used to dedupe unchanged publish events.';

CREATE UNIQUE INDEX IF NOT EXISTS seo_internal_link_jobs_content_hash_unique_idx
  ON public.seo_internal_link_jobs (workspace_id, template_id, content_id, locale, content_hash);

CREATE INDEX IF NOT EXISTS seo_internal_link_jobs_workspace_status_run_idx
  ON public.seo_internal_link_jobs (workspace_id, status, run_after, created_at);

CREATE INDEX IF NOT EXISTS seo_internal_link_jobs_content_idx
  ON public.seo_internal_link_jobs (workspace_id, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_internal_link_jobs_locked_idx
  ON public.seo_internal_link_jobs (status, locked_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS seo_internal_link_jobs_template_locale_status_idx
  ON public.seo_internal_link_jobs (template_id, locale, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_seo_internal_link_job_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_content_workspace_id uuid;
  v_content_template_id text;
  v_content_locale text;
BEGIN
  SELECT
    public.get_effective_content_workspace_id(ci.workspace_id, ci.template_id),
    ci.template_id,
    ci.locale
  INTO v_content_workspace_id, v_content_template_id, v_content_locale
  FROM public.content_items ci
  WHERE ci.id = NEW.content_id;

  IF v_content_workspace_id IS NULL THEN
    RAISE EXCEPTION 'seo_internal_link_jobs content_id % is missing or cannot resolve workspace scope', NEW.content_id;
  END IF;

  IF v_content_workspace_id <> NEW.workspace_id THEN
    RAISE EXCEPTION 'seo_internal_link_jobs workspace/content mismatch (workspace=% content_workspace=%)',
      NEW.workspace_id, v_content_workspace_id;
  END IF;

  IF v_content_template_id IS DISTINCT FROM NEW.template_id THEN
    RAISE EXCEPTION 'seo_internal_link_jobs template/content mismatch (template_id=% content_template_id=%)',
      NEW.template_id, v_content_template_id;
  END IF;

  IF v_content_locale IS DISTINCT FROM NEW.locale THEN
    RAISE EXCEPTION 'seo_internal_link_jobs locale/content mismatch (locale=% content_locale=%)',
      NEW.locale, v_content_locale;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_seo_internal_link_job_scope_trigger ON public.seo_internal_link_jobs;
CREATE TRIGGER enforce_seo_internal_link_job_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, content_id, locale
  ON public.seo_internal_link_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seo_internal_link_job_scope();

DROP TRIGGER IF EXISTS set_updated_at_seo_internal_link_jobs ON public.seo_internal_link_jobs;
CREATE TRIGGER set_updated_at_seo_internal_link_jobs
  BEFORE UPDATE ON public.seo_internal_link_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.seo_internal_link_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_internal_link_jobs_select_policy" ON public.seo_internal_link_jobs;
CREATE POLICY "seo_internal_link_jobs_select_policy"
ON public.seo_internal_link_jobs
FOR SELECT
USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS "seo_internal_link_jobs_insert_policy" ON public.seo_internal_link_jobs;
CREATE POLICY "seo_internal_link_jobs_insert_policy"
ON public.seo_internal_link_jobs
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_internal_link_jobs_update_policy" ON public.seo_internal_link_jobs;
CREATE POLICY "seo_internal_link_jobs_update_policy"
ON public.seo_internal_link_jobs
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_internal_link_jobs_delete_policy" ON public.seo_internal_link_jobs;
CREATE POLICY "seo_internal_link_jobs_delete_policy"
ON public.seo_internal_link_jobs
FOR DELETE
USING (public.can_access_workspace(workspace_id, 'content.delete'));

DROP POLICY IF EXISTS "seo_internal_link_jobs_service_role_policy" ON public.seo_internal_link_jobs;
CREATE POLICY "seo_internal_link_jobs_service_role_policy"
ON public.seo_internal_link_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Atomic queue claim with skip locked concurrency safety
CREATE OR REPLACE FUNCTION public.claim_next_seo_internal_link_job(p_worker_id text)
RETURNS public.seo_internal_link_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.seo_internal_link_jobs;
BEGIN
  UPDATE public.seo_internal_link_jobs
  SET status = 'running',
      locked_at = now(),
      attempts = attempts + 1,
      summary = jsonb_build_object('worker_id', p_worker_id) || summary
  WHERE id = (
    SELECT id
    FROM public.seo_internal_link_jobs
    WHERE status = 'queued' AND run_after <= now()
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_job;
END;
$$;
