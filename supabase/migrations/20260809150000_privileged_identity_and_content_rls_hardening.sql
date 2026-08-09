-- Universal security hardening for privileged profile identity, AI-credit
-- grants, and tenant-scoped content writes.

BEGIN;

-- ---------------------------------------------------------------------------
-- Profiles: authenticated users may edit presentation fields on their own row,
-- but global identity/authorization fields remain service-managed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
    AND COALESCE(auth.role(), '') <> 'service_role'
    AND CURRENT_USER NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'profiles.role is service-managed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns_trigger
  ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns_trigger
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_columns();

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns()
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (
  display_name,
  avatar_url,
  bio,
  role_title,
  social_links
) ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO service_role;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- Author avatars are public media, but their legacy mutation policies trusted
-- any authenticated account for every object in the bucket. No client upload
-- path uses this bucket; keep mutations on the authorized server path only.
DROP POLICY IF EXISTS "author_avatars_auth_write" ON storage.objects;
DROP POLICY IF EXISTS "author_avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "author_avatars_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "author_avatars_service_write" ON storage.objects;

CREATE POLICY "author_avatars_service_write"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'author-avatars')
WITH CHECK (bucket_id = 'author-avatars');

-- ---------------------------------------------------------------------------
-- AI credits: preserve the existing four-argument API as a service-only
-- compatibility wrapper and expose a metadata-aware service-only overload.
-- ---------------------------------------------------------------------------

ALTER TABLE public.ai_credit_ledger
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ai_credit_ledger AS ledger
    WHERE pg_catalog.jsonb_typeof(ledger.metadata) IS DISTINCT FROM 'object'
      OR pg_catalog.octet_length(ledger.metadata::text) > 16384
  ) THEN
    RAISE EXCEPTION
      'Cannot constrain ai_credit_ledger.metadata: invalid existing values require repair.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.ai_credit_ledger'::regclass
      AND constraint_row.conname = 'ai_credit_ledger_metadata_object_check'
  ) THEN
    ALTER TABLE public.ai_credit_ledger
      ADD CONSTRAINT ai_credit_ledger_metadata_object_check
      CHECK (
        pg_catalog.jsonb_typeof(metadata) = 'object'
        AND pg_catalog.octet_length(metadata::text) <= 16384
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_ai_credits(
  p_workspace_id uuid,
  p_delta_millicents bigint,
  p_reason text,
  p_notes text,
  p_metadata jsonb
)
RETURNS public.ai_credit_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.ai_credit_ledger;
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'grant_ai_credits is restricted to service_role';
  END IF;

  IF p_workspace_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = p_workspace_id
      AND workspace.is_active = true
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'grant_ai_credits requires an active workspace';
  END IF;

  IF p_delta_millicents IS NULL
    OR p_delta_millicents = 0
    OR p_delta_millicents < -1000000000
    OR p_delta_millicents > 1000000000 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'grant_ai_credits delta must be between -1000000000 and 1000000000 millicents and non-zero';
  END IF;

  IF p_reason IS NULL
    OR p_reason <> pg_catalog.btrim(p_reason)
    OR p_reason NOT IN ('manual_topup', 'refund', 'adjustment') THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'grant_ai_credits reason must be manual_topup, refund, or adjustment';
  END IF;

  IF p_notes IS NOT NULL
    AND (
      pg_catalog.btrim(p_notes) = ''
      OR pg_catalog.char_length(p_notes) > 2000
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'grant_ai_credits notes must be null or 1..2000 characters';
  END IF;

  IF pg_catalog.jsonb_typeof(v_metadata) IS DISTINCT FROM 'object'
    OR pg_catalog.octet_length(v_metadata::text) > 16384 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'grant_ai_credits metadata must be a JSON object no larger than 16384 bytes';
  END IF;

  PERFORM 1
  FROM public.workspaces AS workspace
  WHERE workspace.id = p_workspace_id
  FOR UPDATE;

  INSERT INTO public.ai_credit_ledger (
    workspace_id,
    delta_millicents,
    reason,
    actor_profile_id,
    notes,
    metadata
  )
  VALUES (
    p_workspace_id,
    p_delta_millicents,
    p_reason,
    auth.uid(),
    p_notes,
    v_metadata
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_ai_credits(
  p_workspace_id uuid,
  p_delta_millicents bigint,
  p_reason text,
  p_notes text
)
RETURNS public.ai_credit_ledger
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.grant_ai_credits(
    p_workspace_id,
    p_delta_millicents,
    p_reason,
    p_notes,
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.grant_ai_credits(uuid, bigint, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_ai_credits(uuid, bigint, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits(uuid, bigint, text, text, jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits(uuid, bigint, text, text)
  TO service_role;

-- Adjacent audit repair: this authenticated SECURITY DEFINER RPC previously
-- accepted a content UUID from any tenant while charging the caller's
-- workspace. Keep the public contract, but bind content and job scope.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.content_items'::regclass
      AND constraint_row.conname = 'content_items_workspace_id_id_key'
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_workspace_id_id_key
      UNIQUE (workspace_id, id);
  END IF;

  ALTER TABLE public.video_render_jobs
    DROP CONSTRAINT IF EXISTS video_render_jobs_content_id_fkey;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.video_render_jobs'::regclass
      AND constraint_row.conname = 'video_render_jobs_workspace_content_fk'
  ) THEN
    ALTER TABLE public.video_render_jobs
      ADD CONSTRAINT video_render_jobs_workspace_content_fk
      FOREIGN KEY (workspace_id, content_id)
      REFERENCES public.content_items (workspace_id, id)
      ON DELETE SET NULL (content_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.video_render_jobs AS render_job
    LEFT JOIN public.content_items AS content
      ON content.workspace_id = render_job.workspace_id
     AND content.id = render_job.content_id
    WHERE render_job.content_id IS NOT NULL
      AND content.id IS NULL
  ) THEN
    ALTER TABLE public.video_render_jobs
      VALIDATE CONSTRAINT video_render_jobs_workspace_content_fk;
  ELSE
    RAISE WARNING
      'video_render_jobs contains cross-workspace content references; new writes are protected but the composite FK remains NOT VALID pending repair.';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS video_render_jobs_workspace_content_idx
  ON public.video_render_jobs (workspace_id, content_id)
  WHERE content_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_workspace_compute_credit_and_create_video_job(
  p_workspace_id uuid,
  p_content_id uuid,
  p_storage_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id uuid;
  v_content_workspace_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND auth.role() IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'authenticated workspace access is required';
  END IF;

  IF p_workspace_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.workspaces AS workspace
      WHERE workspace.id = p_workspace_id
        AND workspace.is_active = true
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'an active workspace is required';
  END IF;

  IF auth.role() IS DISTINCT FROM 'service_role'
    AND NOT public.can_access_workspace(p_workspace_id, 'content.write') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'content.write access is required';
  END IF;

  SELECT public.get_effective_content_workspace_id(
    content.workspace_id,
    content.template_id
  )
  INTO v_content_workspace_id
  FROM public.content_items AS content
  WHERE content.id = p_content_id;

  IF v_content_workspace_id IS NULL
    OR v_content_workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'video render content must belong to the charged workspace';
  END IF;

  IF p_storage_path IS NULL
    OR pg_catalog.btrim(p_storage_path) = ''
    OR pg_catalog.char_length(p_storage_path) > 1024
    OR p_storage_path ~ '(^|/)\.\.(/|$)'
    OR public.storage_path_workspace_uuid(p_storage_path)
      IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'video render storage path is invalid';
  END IF;

  UPDATE public.workspaces
  SET compute_credits = compute_credits - 1
  WHERE id = p_workspace_id
    AND compute_credits >= 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Insufficient compute credits. Please contact your administrator.';
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

REVOKE ALL ON FUNCTION public.consume_workspace_compute_credit_and_create_video_job(
  uuid,
  uuid,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_workspace_compute_credit_and_create_video_job(
  uuid,
  uuid,
  text
) TO authenticated, service_role;

-- The atomic RPC is the only authenticated creation path: direct inserts
-- bypassed both compute-credit charging and content/workspace validation.
REVOKE INSERT ON TABLE public.video_render_jobs FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON TABLE public.video_render_jobs FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status, result_video_url)
  ON TABLE public.video_render_jobs TO authenticated;
GRANT SELECT, DELETE ON TABLE public.video_render_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.video_render_jobs TO service_role;

DROP POLICY IF EXISTS "video_render_jobs_insert_policy"
  ON public.video_render_jobs;
DROP POLICY IF EXISTS "video_render_jobs_update_policy"
  ON public.video_render_jobs;
DROP POLICY IF EXISTS "video_render_jobs_delete_policy"
  ON public.video_render_jobs;

CREATE OR REPLACE FUNCTION public.validate_video_render_job_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.content_id IS DISTINCT FROM OLD.content_id
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'video render job tenant and source identity are immutable';
  END IF;

  IF NEW.status IS NULL
    OR NEW.status NOT IN (
      'pending',
      'pending_admin',
      'processing',
      'completed',
      'failed'
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'video render job status is invalid';
  END IF;

  IF OLD.status = 'completed'
    AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.result_video_url IS DISTINCT FROM OLD.result_video_url
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'completed video render fulfillment is immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      (OLD.status IN ('pending', 'pending_admin')
        AND NEW.status IN (
          'pending',
          'pending_admin',
          'processing',
          'completed',
          'failed'
        ))
      OR (OLD.status = 'processing'
        AND NEW.status IN ('completed', 'failed'))
      OR (OLD.status = 'failed'
        AND NEW.status IN ('pending_admin', 'processing'))
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'video render job status transition is invalid';
  END IF;

  IF NEW.status = 'completed' THEN
    IF NEW.result_video_url IS NULL
      OR pg_catalog.btrim(NEW.result_video_url) = ''
      OR pg_catalog.char_length(NEW.result_video_url) > 1024
      OR public.storage_path_workspace_uuid(NEW.result_video_url)
        IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'completed video render result must be a workspace-bound storage path';
    END IF;
  ELSIF NEW.result_video_url IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'only completed video render jobs may carry a result path';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_video_render_job_fulfillment_trigger
  ON public.video_render_jobs;
CREATE TRIGGER validate_video_render_job_fulfillment_trigger
BEFORE UPDATE OF
  workspace_id,
  content_id,
  storage_path,
  status,
  result_video_url
ON public.video_render_jobs
FOR EACH ROW
EXECUTE FUNCTION public.validate_video_render_job_fulfillment();

REVOKE ALL ON FUNCTION public.validate_video_render_job_fulfillment()
  FROM PUBLIC, anon, authenticated;

CREATE POLICY "video_render_jobs_update_policy"
ON public.video_render_jobs
FOR UPDATE
TO authenticated
USING (
  public.get_my_role() = 'admin'
  AND public.can_access_workspace(workspace_id, 'content.write')
)
WITH CHECK (
  public.get_my_role() = 'admin'
  AND public.can_access_workspace(workspace_id, 'content.write')
);

CREATE POLICY "video_render_jobs_delete_policy"
ON public.video_render_jobs
FOR DELETE
TO authenticated
USING (public.can_access_workspace(workspace_id, 'content.delete'));

-- The legacy bucket policies exposed every queue object to every signed-in
-- user. Queue producers are server-side; authenticated reads are scoped by
-- the workspace UUID in the first path segment.
DROP POLICY IF EXISTS "Allow authenticated users to insert to batch-queues"
  ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to select from batch-queues"
  ON storage.objects;
DROP POLICY IF EXISTS "batch_queues_service_insert"
  ON storage.objects;
DROP POLICY IF EXISTS "batch_queues_workspace_select"
  ON storage.objects;

CREATE POLICY "batch_queues_service_insert"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'batch-queues'
  AND public.storage_path_workspace_uuid(name) IS NOT NULL
);

CREATE POLICY "batch_queues_workspace_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'batch-queues'
  AND public.can_access_workspace(
    public.storage_path_workspace_uuid(name),
    'content.read'
  )
);

-- ---------------------------------------------------------------------------
-- Content: eliminate the author-only bypass, enforce both OLD and NEW tenant
-- scope through UPDATE policies, and make template synchronization fail closed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_content_item_workspace_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace_id uuid;
  v_legacy_template_id text;
  v_old_workspace_id uuid;
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.template_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'content_items requires workspace_id or template_id';
  END IF;

  IF NEW.workspace_id IS NULL THEN
    SELECT workspace.id, workspace.legacy_template_id
    INTO v_workspace_id, v_legacy_template_id
    FROM public.workspaces AS workspace
    WHERE workspace.legacy_template_id = NEW.template_id
      AND workspace.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'content_items template does not resolve to an active workspace';
    END IF;

    NEW.workspace_id := v_workspace_id;
  ELSE
    SELECT workspace.id, workspace.legacy_template_id
    INTO v_workspace_id, v_legacy_template_id
    FROM public.workspaces AS workspace
    WHERE workspace.id = NEW.workspace_id
      AND workspace.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'content_items workspace does not exist or is inactive';
    END IF;

    IF NEW.template_id IS NULL THEN
      NEW.template_id := v_legacy_template_id;
    ELSIF v_legacy_template_id IS NULL
      OR NEW.template_id IS DISTINCT FROM v_legacy_template_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'content_items workspace/template mismatch';
    END IF;
  END IF;

  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'UPDATE' THEN
      v_old_workspace_id := public.get_effective_content_workspace_id(
        OLD.workspace_id,
        OLD.template_id
      );

      IF v_old_workspace_id IS NULL
        OR NOT public.can_access_workspace(v_old_workspace_id, 'content.write') THEN
        RAISE EXCEPTION USING
          ERRCODE = '42501',
          MESSAGE = 'content.write access to the existing content workspace is required';
      END IF;
    END IF;

    IF NOT public.can_access_workspace(NEW.workspace_id, 'content.write') THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'content.write access to the target content workspace is required';
    END IF;

    IF NEW.status = 'published'
      AND NOT public.can_access_workspace(NEW.workspace_id, 'content.publish') THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'content.publish access to the target content workspace is required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_content_item_workspace_template()
  FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "content_items_insert_policy" ON public.content_items;
DROP POLICY IF EXISTS "content_items_update_policy" ON public.content_items;
DROP POLICY IF EXISTS "content_items_delete_policy" ON public.content_items;

-- RLS policies are the tenant/capability boundary; authenticated callers still
-- need table privileges for the normal content editor path to reach them.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_items TO authenticated;

CREATE POLICY "content_items_insert_policy"
ON public.content_items
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, 'content.write')
  AND (
    status IS DISTINCT FROM 'published'
    OR public.can_access_workspace(workspace_id, 'content.publish')
  )
);

CREATE POLICY "content_items_update_policy"
ON public.content_items
FOR UPDATE
TO authenticated
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, 'content.write')
)
WITH CHECK (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, 'content.write')
  AND (
    status IS DISTINCT FROM 'published'
    OR public.can_access_workspace(workspace_id, 'content.publish')
  )
);

CREATE POLICY "content_items_delete_policy"
ON public.content_items
FOR DELETE
TO authenticated
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, 'content.delete')
);

NOTIFY pgrst, 'reload schema';

COMMIT;
