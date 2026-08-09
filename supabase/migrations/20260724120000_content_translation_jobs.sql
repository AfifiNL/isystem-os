-- Universal product migration: durable translation jobs replace the
-- request-local promise previously launched by the translation webhook.

CREATE TABLE IF NOT EXISTS public.content_translation_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
    source_version text NOT NULL,
    source_locale text NOT NULL DEFAULT 'en' CHECK (source_locale = 'en'),
    target_locales text[] NOT NULL DEFAULT ARRAY['nl', 'ar']::text[],
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'retrying', 'completed', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    run_after timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    worker_id text,
    idempotency_key text NOT NULL,
    last_error text,
    result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT content_translation_jobs_target_locales_check
        CHECK (
            cardinality(target_locales) > 0
            AND target_locales <@ ARRAY['nl', 'ar']::text[]
        ),
    CONSTRAINT content_translation_jobs_workspace_idempotency_unique
        UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS content_translation_jobs_claim_idx
    ON public.content_translation_jobs (status, run_after, created_at)
    WHERE status IN ('queued', 'retrying', 'running');

CREATE INDEX IF NOT EXISTS content_translation_jobs_workspace_status_idx
    ON public.content_translation_jobs (workspace_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_content_translation_job_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    SELECT workspace_id
      INTO v_workspace_id
      FROM public.content_items
     WHERE id = NEW.source_content_id;

    IF v_workspace_id IS NULL OR v_workspace_id <> NEW.workspace_id THEN
        RAISE EXCEPTION 'translation job workspace does not match source content';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_content_translation_job_scope
    ON public.content_translation_jobs;
CREATE TRIGGER validate_content_translation_job_scope
BEFORE INSERT OR UPDATE OF workspace_id, source_content_id
ON public.content_translation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.validate_content_translation_job_scope();

CREATE OR REPLACE FUNCTION public.set_content_translation_job_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_content_translation_job_updated_at
    ON public.content_translation_jobs;
CREATE TRIGGER set_content_translation_job_updated_at
BEFORE UPDATE ON public.content_translation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_content_translation_job_updated_at();

ALTER TABLE public.content_translation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_translation_jobs_select
    ON public.content_translation_jobs;
CREATE POLICY content_translation_jobs_select
ON public.content_translation_jobs
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS content_translation_jobs_service_role
    ON public.content_translation_jobs;
CREATE POLICY content_translation_jobs_service_role
ON public.content_translation_jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON TABLE public.content_translation_jobs
    FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.content_translation_jobs
    TO authenticated;
GRANT ALL ON TABLE public.content_translation_jobs
    TO service_role;

CREATE OR REPLACE FUNCTION public.claim_next_content_translation_job(
    p_worker_id text,
    p_lease_timeout interval DEFAULT interval '15 minutes'
)
RETURNS public.content_translation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_job public.content_translation_jobs;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
        RAISE EXCEPTION 'worker_id is required';
    END IF;

    IF length(p_worker_id) > 200 THEN
        RAISE EXCEPTION 'worker_id must not exceed 200 characters';
    END IF;

    IF p_lease_timeout IS NULL
       OR p_lease_timeout < interval '1 minute'
       OR p_lease_timeout > interval '2 hours' THEN
        RAISE EXCEPTION 'lease timeout must be between 1 minute and 2 hours';
    END IF;

    UPDATE public.content_translation_jobs
       SET status = 'failed',
           completed_at = now(),
           locked_at = NULL,
           worker_id = NULL,
           last_error = COALESCE(last_error, 'Worker lease expired after final attempt')
     WHERE status = 'running'
       AND locked_at < now() - p_lease_timeout
       AND attempts >= max_attempts;

    UPDATE public.content_translation_jobs
       SET status = 'running',
           attempts = attempts + 1,
           locked_at = now(),
           worker_id = p_worker_id,
           started_at = COALESCE(started_at, now()),
           completed_at = NULL
     WHERE id = (
        SELECT id
          FROM public.content_translation_jobs
         WHERE (
                status IN ('queued', 'retrying')
                OR (
                    status = 'running'
                    AND locked_at < now() - p_lease_timeout
                )
               )
           AND run_after <= now()
           AND attempts < max_attempts
         ORDER BY run_after ASC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
     )
     RETURNING * INTO v_job;

    RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_content_translation_job(text, interval)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_content_translation_job(text, interval)
    TO service_role;
