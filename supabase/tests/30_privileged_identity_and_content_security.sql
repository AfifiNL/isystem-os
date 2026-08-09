BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(60);

CREATE OR REPLACE FUNCTION pg_temp.security_sql_raises(
  statement_sql text,
  expected_state text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  caught_state text;
BEGIN
  EXECUTE statement_sql;
  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS caught_state = RETURNED_SQLSTATE;
    RETURN caught_state = expected_state;
END;
$$;

-- Temporary schemas are session-owned and cannot be granted as `pg_temp`.
-- Temporary functions retain PUBLIC EXECUTE for this rollback-only probe.
GRANT EXECUTE ON FUNCTION extensions.ok(boolean, text)
  TO anon, authenticated, service_role;

-- Two isolated authenticated principals. Auth triggers create their profiles.
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'security-owner-a@example.invalid',
    '',
    pg_catalog.now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd0000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'security-owner-b@example.invalid',
    '',
    pg_catalog.now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    pg_catalog.now(),
    pg_catalog.now()
  );

SELECT extensions.ok(
  NOT pg_catalog.has_column_privilege(
    'authenticated',
    'public.profiles',
    'role',
    'UPDATE'
  ),
  'authenticated has no UPDATE privilege on profiles.role'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.profiles',
    'INSERT'
  ),
  'authenticated cannot create a forged privileged profile row'
);

SELECT extensions.ok(
  pg_catalog.has_column_privilege(
    'authenticated',
    'public.profiles',
    'display_name',
    'UPDATE'
  ),
  'authenticated retains UPDATE privilege on safe profile presentation fields'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.profiles'::regclass
      AND trigger_row.tgname = 'protect_profile_privileged_columns_trigger'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  ),
  'profiles privileged-column trigger is enabled'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'storage.objects'::regclass
      AND policy.polname IN (
        'author_avatars_auth_write',
        'author_avatars_auth_update',
        'author_avatars_auth_delete'
      )
  ),
  'authenticated global author-avatar mutation policies are removed'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_roles AS role_row
      ON role_row.oid = ANY (policy.polroles)
    WHERE policy.polrelid = 'storage.objects'::regclass
      AND policy.polname = 'author_avatars_service_write'
      AND role_row.rolname = 'service_role'
  ),
  'author-avatar mutations are restricted to service_role'
);

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

UPDATE public.profiles
SET display_name = 'Safe self edit'
WHERE id = 'd0000000-0000-4000-8000-000000000001';

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      UPDATE public.profiles
      SET role = 'admin'
      WHERE id = 'd0000000-0000-4000-8000-000000000001'
    $test$,
    '42501'
  ),
  'authenticated cannot self-promote profiles.role'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      UPDATE public.profiles
      SET email = 'forged@example.invalid'
      WHERE id = 'd0000000-0000-4000-8000-000000000001'
    $test$,
    '42501'
  ),
  'authenticated cannot rewrite the auth-synchronized profile email'
);

UPDATE public.profiles
SET display_name = 'Forbidden cross-row edit'
WHERE id = 'd0000000-0000-4000-8000-000000000002';

RESET ROLE;

SELECT extensions.ok(
  (
    SELECT profile.display_name = 'Safe self edit'
    FROM public.profiles AS profile
    WHERE profile.id = 'd0000000-0000-4000-8000-000000000001'
  ),
  'safe authenticated self-profile edits persist'
);

SELECT extensions.ok(
  (
    SELECT profile.display_name IS DISTINCT FROM 'Forbidden cross-row edit'
    FROM public.profiles AS profile
    WHERE profile.id = 'd0000000-0000-4000-8000-000000000002'
  ),
  'profiles self-update policy blocks edits to another profile'
);

SELECT extensions.ok(
  (
    SELECT profile.role = 'user'
    FROM public.profiles AS profile
    WHERE profile.id = 'd0000000-0000-4000-8000-000000000001'
  ),
  'failed self-escalation leaves the global role unchanged'
);

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;

UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000002'
);

RESET ROLE;

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 2
    FROM public.profiles AS profile
    WHERE profile.id IN (
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000002'
    )
      AND profile.role = 'admin'
  ),
  'service_role remains an authorized global-role management path'
);

-- Credit-grant ACL, search-path, validation, and authorized execution.
SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.grant_ai_credits(uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute the compatibility credit-grant RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.grant_ai_credits(uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the compatibility credit-grant RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.grant_ai_credits(uuid,bigint,text,text,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute the metadata-aware credit-grant RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.grant_ai_credits(uuid,bigint,text,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute the metadata-aware credit-grant RPC'
);

SELECT extensions.ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.grant_ai_credits(uuid,bigint,text,text,jsonb)',
    'EXECUTE'
  ),
  'service_role can execute the validated credit-grant RPC'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.grant_ai_credits(uuid,bigint,text,text,jsonb)'::regprocedure
      AND procedure_row.prosecdef
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(procedure_row.proconfig) AS setting(value)
        WHERE setting.value LIKE 'search_path=%'
          AND setting.value NOT LIKE '%public%'
      )
  ),
  'credit-grant RPC is SECURITY DEFINER with a non-public search path'
);

INSERT INTO public.workspaces (
  id,
  slug,
  name,
  owner_profile_id,
  legacy_template_id
)
VALUES
  (
    'd1000000-0000-4000-8000-000000000001',
    'security-workspace-a',
    'Security Workspace A',
    'd0000000-0000-4000-8000-000000000001',
    'ecommerce'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'security-workspace-b',
    'Security Workspace B',
    'd0000000-0000-4000-8000-000000000002',
    'nonprofit'
  );

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.grant_ai_credits(uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'authenticated direct credit grant is denied by function ACL'
);

RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.grant_ai_credits(uuid,bigint,text,text)',
    'EXECUTE'
  ),
  'anon direct credit grant is denied by function ACL'
);

RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;

DO $$
BEGIN
  PERFORM public.grant_ai_credits(
    'd1000000-0000-4000-8000-000000000001',
    2500,
    'manual_topup',
    'authorized test grant',
    '{"source":"pgtap"}'::jsonb
  );
END;
$$;

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      SELECT public.grant_ai_credits(
        'd1000000-0000-4000-8000-000000000001',
        1000000001,
        'manual_topup',
        'out of bounds',
        '{}'::jsonb
      )
    $test$,
    '22023'
  ),
  'credit grants reject an out-of-bounds delta'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      SELECT public.grant_ai_credits(
        'd1000000-0000-4000-8000-000000000001',
        1,
        'ai_usage',
        'invalid reason',
        '{}'::jsonb
      )
    $test$,
    '22023'
  ),
  'credit grants reject a non-administrative reason'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      SELECT public.grant_ai_credits(
        'd1000000-0000-4000-8000-000000000001',
        1,
        'adjustment',
        'invalid metadata',
        '[]'::jsonb
      )
    $test$,
    '22023'
  ),
  'credit grants reject non-object metadata'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      SELECT public.grant_ai_credits(
        'd1000000-0000-4000-8000-000000000099',
        1,
        'adjustment',
        'missing workspace',
        '{}'::jsonb
      )
    $test$,
    '22023'
  ),
  'credit grants reject an unknown workspace'
);

RESET ROLE;

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.ai_credit_ledger AS ledger
    WHERE ledger.workspace_id = 'd1000000-0000-4000-8000-000000000001'
      AND ledger.delta_millicents = 2500
      AND ledger.reason = 'manual_topup'
      AND ledger.metadata = '{"source":"pgtap"}'::jsonb
  ),
  'authorized validated credit grant writes its bounded metadata-bearing ledger row'
);

SELECT extensions.is(
  (
    SELECT workspace.ai_balance_millicents
    FROM public.workspaces AS workspace
    WHERE workspace.id = 'd1000000-0000-4000-8000-000000000001'
  ),
  2500::bigint,
  'authorized credit grant updates the cached workspace balance exactly once'
);

-- Content catalog contracts.
SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.sync_content_item_workspace_template()'::regprocedure
      AND procedure_row.prosecdef
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(procedure_row.proconfig) AS setting(value)
        WHERE setting.value LIKE 'search_path=%'
          AND setting.value NOT LIKE '%public%'
      )
  ),
  'content workspace/template trigger is SECURITY DEFINER with a non-public search path'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.sync_content_item_workspace_template()',
    'EXECUTE'
  ),
  'authenticated cannot invoke the content synchronization trigger directly'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'public.content_items'::regclass
      AND policy.polname IN (
        'content_items_insert_policy',
        'content_items_update_policy',
        'content_items_delete_policy'
      )
      AND (
        COALESCE(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
          ''
        ) ILIKE '%author_id%'
        OR COALESCE(
          pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
          ''
        ) ILIKE '%author_id%'
      )
  ),
  'content mutation policies contain no author-only authorization bypass'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 3
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'public.content_items'::regclass
      AND policy.polname IN (
        'content_items_insert_policy',
        'content_items_update_policy',
        'content_items_delete_policy'
      )
      AND (
        COALESCE(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
          ''
        ) ILIKE '%can_access_workspace%'
        OR COALESCE(
          pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
          ''
        ) ILIKE '%can_access_workspace%'
      )
  ),
  'all content mutation policies require workspace capability checks'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
      ILIKE '%content.publish%'
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'public.content_items'::regclass
      AND policy.polname = 'content_items_update_policy'
  ),
  'content update WITH CHECK requires publish capability for published rows'
);

-- Cross-tenant runtime behavior. The service fixture in workspace B uses the
-- same author ID deliberately: author ownership must never replace tenant ACL.
INSERT INTO public.content_items (
  id,
  title,
  slug,
  type,
  status,
  author_id,
  workspace_id,
  template_id
)
VALUES
  (
    'd2000000-0000-4000-8000-000000000002',
    'Workspace B protected draft',
    'security-workspace-b-protected',
    'blog',
    'draft',
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002',
    'nonprofit'
  );

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

INSERT INTO public.content_items (
  id,
  title,
  slug,
  type,
  status,
  author_id,
  workspace_id,
  template_id
)
VALUES
  (
    'd2000000-0000-4000-8000-000000000001',
    'Workspace A legitimate draft',
    'security-workspace-a-legitimate',
    'blog',
    'draft',
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'ecommerce'
  ),
  (
    'd2000000-0000-4000-8000-000000000003',
    'Workspace A deletable draft',
    'security-workspace-a-deletable',
    'blog',
    'draft',
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'ecommerce'
  );

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      INSERT INTO public.content_items (
        title, slug, type, status, author_id, workspace_id, template_id
      ) VALUES (
        'Cross tenant injection',
        'security-cross-tenant-injection',
        'blog',
        'draft',
        'd0000000-0000-4000-8000-000000000001',
        'd1000000-0000-4000-8000-000000000002',
        'nonprofit'
      )
    $test$,
    '42501'
  ),
  'content INSERT rejects a workspace where the author lacks content.write'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      INSERT INTO public.content_items (
        title, slug, type, status, author_id, workspace_id, template_id
      ) VALUES (
        'Mismatched template injection',
        'security-mismatched-template',
        'blog',
        'draft',
        'd0000000-0000-4000-8000-000000000001',
        'd1000000-0000-4000-8000-000000000001',
        'nonprofit'
      )
    $test$,
    '23514'
  ),
  'content INSERT rejects mismatched workspace/template identity'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      UPDATE public.content_items
      SET workspace_id = 'd1000000-0000-4000-8000-000000000002',
          template_id = 'nonprofit'
      WHERE id = 'd2000000-0000-4000-8000-000000000001'
    $test$,
    '42501'
  ),
  'content UPDATE requires access to both old and new workspace scopes'
);

UPDATE public.content_items
SET status = 'published'
WHERE id = 'd2000000-0000-4000-8000-000000000001';

UPDATE public.content_items
SET status = 'published'
WHERE id = 'd2000000-0000-4000-8000-000000000002';

DELETE FROM public.content_items
WHERE id = 'd2000000-0000-4000-8000-000000000002';

DELETE FROM public.content_items
WHERE id = 'd2000000-0000-4000-8000-000000000003';

RESET ROLE;

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.content_items AS content
    WHERE content.id = 'd2000000-0000-4000-8000-000000000001'
      AND content.workspace_id = 'd1000000-0000-4000-8000-000000000001'
      AND content.template_id = 'ecommerce'
      AND content.status = 'published'
  ),
  'legitimate same-tenant content publish succeeds without changing scope'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.content_items AS content
    WHERE content.id = 'd2000000-0000-4000-8000-000000000002'
      AND content.workspace_id = 'd1000000-0000-4000-8000-000000000002'
      AND content.status = 'draft'
  ),
  'cross-tenant author cannot publish content in another workspace'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.content_items AS content
    WHERE content.id = 'd2000000-0000-4000-8000-000000000002'
  ),
  'cross-tenant author cannot delete content in another workspace'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.content_items AS content
    WHERE content.id = 'd2000000-0000-4000-8000-000000000003'
  ),
  'legitimate same-tenant content delete succeeds'
);

-- Adjacent authenticated definer RPC: content identity is now bound to the
-- workspace whose compute credit is consumed.
INSERT INTO storage.objects (id, bucket_id, name, metadata)
VALUES (
  'd3000000-0000-4000-8000-000000000001',
  'batch-queues',
  'd1000000-0000-4000-8000-000000000002/private-queue.json',
  '{}'::jsonb
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.video_render_jobs'::regclass
      AND constraint_row.conname = 'video_render_jobs_workspace_content_fk'
      AND constraint_row.contype = 'f'
      AND pg_catalog.array_length(constraint_row.conkey, 1) = 2
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
        LIKE '%ON DELETE SET NULL (content_id)%'
  ),
  'render jobs have a composite workspace/content FK with column-target SET NULL'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.consume_workspace_compute_credit_and_create_video_job(uuid,uuid,text)',
    'EXECUTE'
  ),
  'anon cannot execute the compute-credit render RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.video_render_jobs',
    'INSERT'
  ),
  'authenticated cannot bypass compute charging with direct render-job INSERT'
);

SELECT extensions.ok(
  NOT pg_catalog.has_column_privilege(
    'authenticated',
    'public.video_render_jobs',
    'workspace_id',
    'UPDATE'
  ),
  'authenticated cannot move a render job to another workspace'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
      ILIKE '%get_my_role%admin%'
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'public.video_render_jobs'::regclass
      AND policy.polname = 'video_render_jobs_update_policy'
  ),
  'render fulfillment UPDATE policy requires a global admin role'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'storage.objects'::regclass
      AND policy.polname IN (
        'Allow authenticated users to insert to batch-queues',
        'Allow authenticated users to select from batch-queues'
      )
  ),
  'legacy globally authenticated batch-queue storage policies are removed'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    WHERE policy.polrelid = 'storage.objects'::regclass
      AND policy.polname = 'batch_queues_workspace_select'
      AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
        ILIKE '%can_access_workspace%'
  ),
  'batch-queue reads require workspace-scoped content access'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.consume_workspace_compute_credit_and_create_video_job(uuid,uuid,text)'::regprocedure
      AND procedure_row.prosecdef
      AND procedure_row.prosrc ILIKE '%v_content_workspace_id%'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(procedure_row.proconfig) AS setting(value)
        WHERE setting.value LIKE 'search_path=%'
          AND setting.value NOT LIKE '%public%'
      )
  ),
  'compute-credit render RPC binds content scope with a non-public search path'
);

UPDATE public.profiles
SET role = 'manager'
WHERE id = 'd0000000-0000-4000-8000-000000000001';

INSERT INTO public.manager_assignments (
  manager_profile_id,
  workspace_id,
  assigned_by_profile_id
)
VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000002'
);

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM storage.objects AS object_row
    WHERE object_row.bucket_id = 'batch-queues'
      AND object_row.name =
        'd1000000-0000-4000-8000-000000000002/private-queue.json'
  ),
  'authenticated workspace A cannot read workspace B batch-queue objects'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      INSERT INTO storage.objects (bucket_id, name, metadata)
      VALUES (
        'batch-queues',
        'd1000000-0000-4000-8000-000000000001/direct-upload.json',
        '{}'::jsonb
      )
    $test$,
    '42501'
  ),
  'authenticated cannot mutate the service-only batch queue'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      INSERT INTO public.video_render_jobs (
        workspace_id, content_id, status, storage_path
      ) VALUES (
        'd1000000-0000-4000-8000-000000000001',
        'd2000000-0000-4000-8000-000000000001',
        'pending_admin',
        'd1000000-0000-4000-8000-000000000001/direct-bypass.json'
      )
    $test$,
    '42501'
  ),
  'authenticated direct render-job INSERT receives permission denied'
);

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      SELECT public.consume_workspace_compute_credit_and_create_video_job(
        'd1000000-0000-4000-8000-000000000001',
        'd2000000-0000-4000-8000-000000000002',
        'd1000000-0000-4000-8000-000000000001/render-cross-tenant.json'
      )
    $test$,
    '23514'
  ),
  'compute-credit render RPC rejects content from another workspace'
);

DO $$
BEGIN
  PERFORM public.consume_workspace_compute_credit_and_create_video_job(
    'd1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001/render-same-tenant.json'
  );
END;
$$;

UPDATE public.video_render_jobs
SET status = 'completed',
    result_video_url =
      'd1000000-0000-4000-8000-000000000002/forged-result.mp4'
WHERE workspace_id = 'd1000000-0000-4000-8000-000000000001'
  AND content_id = 'd2000000-0000-4000-8000-000000000001';

RESET ROLE;

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.video_render_jobs AS render_job
    WHERE render_job.workspace_id = 'd1000000-0000-4000-8000-000000000001'
      AND render_job.content_id = 'd2000000-0000-4000-8000-000000000001'
      AND render_job.storage_path =
        'd1000000-0000-4000-8000-000000000001/render-same-tenant.json'
      AND render_job.status = 'pending_admin'
      AND render_job.result_video_url IS NULL
  ),
  'manager RPC creation succeeds but direct forged fulfillment is denied'
);

SELECT extensions.is(
  (
    SELECT workspace.compute_credits
    FROM public.workspaces AS workspace
    WHERE workspace.id = 'd1000000-0000-4000-8000-000000000001'
  ),
  9,
  'failed cross-tenant render does not charge and valid render charges once'
);

SELECT pg_catalog.set_config('request.jwt.claim.role', 'anon', true);
SET LOCAL ROLE anon;

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM storage.objects AS object_row
    WHERE object_row.bucket_id = 'batch-queues'
      AND object_row.name =
        'd1000000-0000-4000-8000-000000000002/private-queue.json'
  ),
  'anon cannot read private batch-queue objects'
);

RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;

SELECT extensions.ok(
  pg_temp.security_sql_raises(
    $test$
      UPDATE public.video_render_jobs
      SET status = 'completed',
          result_video_url =
            'd1000000-0000-4000-8000-000000000002/cross-tenant-result.mp4'
      WHERE workspace_id = 'd1000000-0000-4000-8000-000000000001'
        AND content_id = 'd2000000-0000-4000-8000-000000000001'
    $test$,
    '23514'
  ),
  'fulfillment trigger rejects a cross-workspace result path even for service_role'
);

UPDATE public.video_render_jobs
SET status = 'completed',
    result_video_url =
      'd1000000-0000-4000-8000-000000000001/validated-result.mp4'
WHERE workspace_id = 'd1000000-0000-4000-8000-000000000001'
  AND content_id = 'd2000000-0000-4000-8000-000000000001';

DO $$
BEGIN
  PERFORM public.consume_workspace_compute_credit_and_create_video_job(
    'd1000000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002/service-render.json'
  );
END;
$$;

RESET ROLE;

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.video_render_jobs AS render_job
    WHERE render_job.workspace_id = 'd1000000-0000-4000-8000-000000000001'
      AND render_job.content_id = 'd2000000-0000-4000-8000-000000000001'
      AND render_job.status = 'completed'
      AND render_job.result_video_url =
        'd1000000-0000-4000-8000-000000000001/validated-result.mp4'
  ),
  'service_role can complete a render with a tenant-bound result path'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.video_render_jobs AS render_job
    JOIN public.workspaces AS workspace
      ON workspace.id = render_job.workspace_id
    WHERE render_job.workspace_id = 'd1000000-0000-4000-8000-000000000002'
      AND render_job.content_id = 'd2000000-0000-4000-8000-000000000002'
      AND render_job.storage_path =
        'd1000000-0000-4000-8000-000000000002/service-render.json'
      AND workspace.compute_credits = 9
  ),
  'service_role can create a valid tenant-bound render job and charge once'
);

-- Adjacent privileged-RPC audit: the only authenticated SECURITY DEFINER
-- mutators intentionally left callable have authorization inside their body.
SELECT extensions.ok(
  (
    SELECT procedure_row.prosrc ILIKE '%get_my_role%'
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.admin_create_workspace(text,text,text)'::regprocedure
  ),
  'authenticated admin_create_workspace retains an in-database role check'
);

SELECT extensions.ok(
  (
    SELECT procedure_row.prosrc ILIKE '%can_access_workspace%'
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.supersede_source_ingestion_jobs(uuid,text)'::regprocedure
  ),
  'authenticated source-job supersession retains an in-database workspace check'
);

SELECT extensions.ok(
  (
    SELECT procedure_row.prosrc ILIKE '%can_access_workspace%'
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.refresh_source_ingestion_run_metrics(uuid)'::regprocedure
  ),
  'authenticated source metrics refresh retains an in-database workspace check'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.booking_expire_unpaid_reservations(uuid)',
    'EXECUTE'
  ),
  'adjacent cross-workspace booking expiry remains service-only'
);

SELECT * FROM extensions.finish();

ROLLBACK;
