-- Phase 7: Workspace compute-credit quota controls

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS compute_credits integer;

ALTER TABLE public.workspaces
  ALTER COLUMN compute_credits SET DEFAULT 10;

UPDATE public.workspaces
SET compute_credits = 10
WHERE compute_credits IS NULL;

ALTER TABLE public.workspaces
  ALTER COLUMN compute_credits SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspaces_compute_credits_non_negative_check'
      AND conrelid = 'public.workspaces'::regclass
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_compute_credits_non_negative_check
      CHECK (compute_credits >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.consume_workspace_compute_credit_and_create_video_job(
  p_workspace_id uuid,
  p_content_id uuid,
  p_storage_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF NOT (
    public.is_workspace_owner(p_workspace_id)
    OR public.is_manager_assigned_workspace(p_workspace_id)
    OR public.is_workspace_member(p_workspace_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized workspace access.';
  END IF;

  UPDATE public.workspaces
  SET compute_credits = compute_credits - 1
  WHERE id = p_workspace_id
    AND compute_credits >= 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient compute credits. Please contact your administrator.';
  END IF;

  INSERT INTO public.video_render_jobs (
    workspace_id,
    content_id,
    status,
    storage_path
  )
  VALUES (
    p_workspace_id,
    p_content_id,
    'pending_admin',
    p_storage_path
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_workspace_compute_credit_and_create_video_job(uuid, uuid, text)
TO authenticated;
