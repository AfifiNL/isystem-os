-- Reclaim abandoned Source Intelligence jobs after a bounded worker lease.
-- Exhausted stale jobs are failed first so their parent run can settle.

CREATE OR REPLACE FUNCTION public.claim_next_source_ingestion_job(p_worker_id text)
RETURNS public.source_ingestion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.source_ingestion_jobs;
  v_run_id uuid;
BEGIN
  FOR v_run_id IN
    WITH expired_jobs AS (
      UPDATE public.source_ingestion_jobs
      SET status = 'failed',
          completed_at = now(),
          locked_at = NULL,
          worker_id = NULL,
          error_message = 'Worker lease expired after maximum claim attempts.',
          result_summary = COALESCE(result_summary, '{}'::jsonb) || jsonb_build_object(
            'lease_expired_at', now(),
            'lease_timeout_minutes', 15,
            'terminal_reason', 'max_attempts_exhausted'
          )
      WHERE status = 'running'
        AND locked_at < now() - interval '15 minutes'
        AND attempts >= max_attempts
      RETURNING run_id
    )
    SELECT DISTINCT run_id
    FROM expired_jobs
    WHERE run_id IS NOT NULL
  LOOP
    PERFORM public.refresh_source_ingestion_run_metrics(v_run_id);
  END LOOP;

  UPDATE public.source_ingestion_jobs
  SET status = 'running',
      locked_at = now(),
      worker_id = p_worker_id,
      attempts = attempts + 1,
      completed_at = NULL,
      error_message = NULL,
      result_summary = COALESCE(result_summary, '{}'::jsonb) || jsonb_build_object(
        'worker_id', p_worker_id,
        'claimed_at', now(),
        'lease_timeout_minutes', 15,
        'reclaimed_stale_lease', status = 'running'
      )
  WHERE id = (
    SELECT id
    FROM public.source_ingestion_jobs
    WHERE (
        (status = 'queued' AND run_after <= now())
        OR (
          status = 'running'
          AND locked_at < now() - interval '15 minutes'
        )
      )
      AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.source_ingestion_runs
  SET status = 'running',
      started_at = COALESCE(started_at, now()),
      completed_at = NULL
  WHERE id = v_job.run_id
    AND status IN ('queued', 'failed');

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_source_ingestion_job(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_source_ingestion_job(text) TO service_role;
