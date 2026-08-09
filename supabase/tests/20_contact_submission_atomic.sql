BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(29);

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

CREATE OR REPLACE FUNCTION pg_temp.contact_test_inquiry(
  workspace_id uuid,
  submission_id uuid,
  customer_name text DEFAULT 'Atomic Contact Customer'
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'workspace_id', workspace_id::text,
    'submission_id', submission_id::text,
    'customer_name', customer_name,
    'customer_email', 'atomic-contact@example.invalid',
    'company', 'Example Company',
    'request_type', 'platform',
    'timeline', 'this-quarter',
    'challenge', 'Atomic contact test',
    'locale', 'en',
    'marketing_consent', false,
    'metadata', pg_catalog.jsonb_build_object(
      'source', 'release_sql_test',
      'phone', NULL
    )
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.contact_test_jobs(
  workspace_id uuid,
  submission_id uuid
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'workspace_id', workspace_id::text,
      'aggregate_type', 'contact_inquiry',
      'event_type', 'inquiry_acknowledgement',
      'recipient_role', 'customer',
      'recipient_email', 'atomic-contact@example.invalid',
      'locale', 'en',
      'from_email', 'sender@example.invalid',
      'reply_to_email', 'reply@example.invalid',
      'subject', 'We received your inquiry',
      'html_body', '<p>We received your inquiry.</p>',
      'idempotency_key',
        'contact-submission:' || submission_id::text || ':customer',
      'payload_json', pg_catalog.jsonb_build_object('kind', 'acknowledgement')
    ),
    pg_catalog.jsonb_build_object(
      'workspace_id', workspace_id::text,
      'aggregate_type', 'contact_inquiry',
      'event_type', 'manager_inquiry_notification',
      'recipient_role', 'manager',
      'recipient_email', 'manager@example.invalid',
      'locale', 'en',
      'from_email', 'sender@example.invalid',
      'reply_to_email', 'atomic-contact@example.invalid',
      'subject', 'New contact inquiry',
      'html_body', '<p>A new inquiry is ready.</p>',
      'idempotency_key',
        'contact-submission:' || submission_id::text ||
          ':manager:manager@example.invalid',
      'payload_json', pg_catalog.jsonb_build_object('kind', 'manager_notice')
    )
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.contact_rpc_raises(
  workspace_id uuid,
  submission_id uuid,
  submission_fingerprint text,
  inquiry jsonb,
  email_jobs jsonb,
  expected_state text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  caught_state text;
BEGIN
  PERFORM result.inquiry_id
  FROM public.submit_contact_inquiry_with_email_jobs(
    workspace_id,
    submission_id,
    submission_fingerprint,
    inquiry,
    email_jobs
  ) AS result;
  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS caught_state = RETURNED_SQLSTATE;
    RETURN caught_state = expected_state;
END;
$$;

CREATE TEMPORARY TABLE contact_rpc_results (
  result_key text PRIMARY KEY,
  inquiry_id uuid NOT NULL,
  created boolean NOT NULL
);

INSERT INTO public.workspaces (id, slug, name, legacy_template_id)
VALUES
  (
    'b0000000-0000-4000-8000-000000000001',
    'contact-atomic-test-a',
    'Contact Atomic Test A',
    'facility-services'
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'contact-atomic-test-b',
    'Contact Atomic Test B',
    'creative-agency'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.contact_inquiries'::regclass
      AND attribute.attname = 'submission_id'
      AND attribute.atttypid = 'uuid'::regtype
      AND attribute.attnotnull
      AND NOT attribute.attisdropped
  ),
  'contact submission IDs are required UUIDs'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.contact_inquiries'::regclass
      AND constraint_row.conname = 'contact_inquiries_workspace_submission_key'
      AND constraint_row.contype = 'u'
  ),
  'contact idempotency is constrained by workspace and submission ID'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.contact_inquiries'::regclass
      AND constraint_row.conname = 'contact_inquiries_submission_fingerprint_sha256'
      AND constraint_row.contype = 'c'
  ),
  'contact submission fingerprints are constrained to SHA-256 hex'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.oid =
      'public.submit_contact_inquiry_with_email_jobs(uuid,uuid,text,jsonb,jsonb)'::regprocedure
      AND procedure_row.prosecdef
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(procedure_row.proconfig) AS setting(value)
        WHERE setting.value LIKE 'search_path=%'
          AND setting.value NOT LIKE '%public%'
      )
  ),
  'contact submission RPC is SECURITY DEFINER with a non-public search path'
);

SELECT extensions.ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.submit_contact_inquiry_with_email_jobs(uuid,uuid,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'service_role can execute the atomic contact RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'anon',
    'public.submit_contact_inquiry_with_email_jobs(uuid,uuid,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute the atomic contact RPC'
);

SELECT extensions.ok(
  NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.submit_contact_inquiry_with_email_jobs(uuid,uuid,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute the atomic contact RPC'
);

INSERT INTO public.contact_inquiries (
  id,
  workspace_id,
  customer_name,
  customer_email,
  locale,
  marketing_consent,
  metadata
)
VALUES (
  'b1000000-0000-4000-8000-000000000099',
  'b0000000-0000-4000-8000-000000000001',
  'Rolling Deploy Contact',
  'rolling-contact@example.invalid',
  'en',
  false,
  '{}'::jsonb
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.id = 'b1000000-0000-4000-8000-000000000099'
      AND inquiry.submission_id = inquiry.id
      AND inquiry.submission_fingerprint IS NULL
  ),
  'legacy direct inserts remain compatible during a rolling RPC deployment'
);

INSERT INTO contact_rpc_results (result_key, inquiry_id, created)
SELECT
  'first_submit',
  result.inquiry_id,
  result.created
FROM public.submit_contact_inquiry_with_email_jobs(
  'b0000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  pg_catalog.repeat('a', 64),
  pg_temp.contact_test_inquiry(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001'
  ),
  pg_temp.contact_test_jobs(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001'
  )
) AS result;

SELECT extensions.ok(
  (
    SELECT result.created
    FROM contact_rpc_results AS result
    WHERE result.result_key = 'first_submit'
  ),
  'first contact submission reports created=true'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    JOIN contact_rpc_results AS result
      ON result.inquiry_id = inquiry.id
    WHERE result.result_key = 'first_submit'
      AND inquiry.workspace_id = 'b0000000-0000-4000-8000-000000000001'
      AND inquiry.submission_id = 'b1000000-0000-4000-8000-000000000001'
      AND inquiry.submission_fingerprint = pg_catalog.repeat('a', 64)
      AND inquiry.customer_email = 'atomic-contact@example.invalid'
  ),
  'first submit stores the tenant key, fingerprint, and inquiry payload'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 2
      AND pg_catalog.count(*) FILTER (
        WHERE email_job.aggregate_id = result.inquiry_id
          AND email_job.aggregate_type = 'contact_inquiry'
          AND email_job.workspace_id = 'b0000000-0000-4000-8000-000000000001'
      ) = 2
    FROM public.transactional_email_jobs AS email_job
    CROSS JOIN contact_rpc_results AS result
    WHERE result.result_key = 'first_submit'
      AND email_job.idempotency_key LIKE
        'contact-submission:b1000000-0000-4000-8000-000000000001:%'
  ),
  'first submit atomically creates every email job with the resolved aggregate'
);

INSERT INTO contact_rpc_results (result_key, inquiry_id, created)
SELECT
  'exact_retry',
  result.inquiry_id,
  result.created
FROM public.submit_contact_inquiry_with_email_jobs(
  'b0000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  pg_catalog.repeat('a', 64),
  pg_temp.contact_test_inquiry(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001'
  ),
  pg_temp.contact_test_jobs(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001'
  )
) AS result;

SELECT extensions.ok(
  (
    SELECT
      NOT retry.created
      AND retry.inquiry_id = first_submit.inquiry_id
    FROM contact_rpc_results AS retry
    JOIN contact_rpc_results AS first_submit
      ON first_submit.result_key = 'first_submit'
    WHERE retry.result_key = 'exact_retry'
  ),
  'an exact retry returns the same inquiry with created=false'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 2
    FROM public.transactional_email_jobs AS email_job
    WHERE email_job.workspace_id = 'b0000000-0000-4000-8000-000000000001'
      AND email_job.idempotency_key LIKE
        'contact-submission:b1000000-0000-4000-8000-000000000001:%'
  ),
  'an exact retry does not duplicate email jobs'
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    pg_catalog.repeat('b', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001'
    ),
    pg_temp.contact_test_jobs(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001'
    ),
    '23514'
  ),
  'a retry with a different SHA-256 fingerprint is rejected'
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    pg_catalog.repeat('a', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001',
      'Different Contact Customer'
    ),
    pg_temp.contact_test_jobs(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000001'
    ),
    '23514'
  ),
  'a retry with changed inquiry data is rejected even if its fingerprint is reused'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.workspace_id = 'b0000000-0000-4000-8000-000000000001'
      AND inquiry.submission_id = 'b1000000-0000-4000-8000-000000000001'
      AND inquiry.customer_name = 'Atomic Contact Customer'
      AND inquiry.submission_fingerprint = pg_catalog.repeat('a', 64)
  ),
  'conflicting retries leave the original inquiry unchanged'
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000099',
    'b1000000-0000-4000-8000-000000000002',
    pg_catalog.repeat('c', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000099',
      'b1000000-0000-4000-8000-000000000002'
    ),
    pg_temp.contact_test_jobs(
      'b0000000-0000-4000-8000-000000000099',
      'b1000000-0000-4000-8000-000000000002'
    ),
    '23503'
  ),
  'an unknown workspace is rejected'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.submission_id = 'b1000000-0000-4000-8000-000000000002'
  ),
  'an unknown workspace creates no inquiry'
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000003',
    pg_catalog.repeat('d', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000003'
    ),
    pg_catalog.jsonb_set(
      pg_temp.contact_test_jobs(
        'b0000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000003'
      ),
      '{0,workspace_id}',
      pg_catalog.to_jsonb('b0000000-0000-4000-8000-000000000002'::text)
    ),
    '23514'
  ),
  'an email job for another workspace is rejected'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.submission_id = 'b1000000-0000-4000-8000-000000000003'
  ),
  'a cross-workspace job rolls back its inquiry'
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000004',
    pg_catalog.repeat('e', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000004'
    ),
    pg_catalog.jsonb_set(
      pg_temp.contact_test_jobs(
        'b0000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000004'
      ),
      '{0,aggregate_type}',
      pg_catalog.to_jsonb('booking'::text)
    ),
    '23514'
  ),
  'an email job for another aggregate type is rejected'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.submission_id = 'b1000000-0000-4000-8000-000000000004'
  ),
  'a mismatched aggregate rolls back its inquiry'
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000005',
    pg_catalog.repeat('f', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000005'
    ),
    pg_catalog.jsonb_set(
      pg_temp.contact_test_jobs(
        'b0000000-0000-4000-8000-000000000001',
        'b1000000-0000-4000-8000-000000000005'
      ),
      '{0,recipient_email}',
      pg_catalog.to_jsonb('not-an-email'::text)
    ),
    '22023'
  ),
  'an invalid email job is rejected'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.submission_id = 'b1000000-0000-4000-8000-000000000005'
  ),
  'an invalid email job rolls back its inquiry'
);

INSERT INTO public.transactional_email_jobs (
  workspace_id,
  aggregate_type,
  aggregate_id,
  event_type,
  recipient_role,
  recipient_email,
  locale,
  from_email,
  subject,
  html_body,
  idempotency_key,
  payload_json
)
VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'poisoned_test_key',
  NULL,
  'poisoned',
  'manager',
  'manager@example.invalid',
  'en',
  'sender@example.invalid',
  'Poisoned key',
  '<p>Poisoned key</p>',
  'contact-submission:b1000000-0000-4000-8000-000000000006:manager:manager@example.invalid',
  '{}'::jsonb
);

SELECT extensions.ok(
  pg_temp.contact_rpc_raises(
    'b0000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000006',
    pg_catalog.repeat('0', 64),
    pg_temp.contact_test_inquiry(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000006'
    ),
    pg_temp.contact_test_jobs(
      'b0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000006'
    ),
    '23514'
  ),
  'a pre-existing conflicting job forces the atomic submit to fail'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.submission_id = 'b1000000-0000-4000-8000-000000000006'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.transactional_email_jobs AS email_job
    WHERE email_job.workspace_id = 'b0000000-0000-4000-8000-000000000001'
      AND email_job.idempotency_key =
        'contact-submission:b1000000-0000-4000-8000-000000000006:customer'
  ),
  'forced second-job failure rolls back the inquiry and first inserted job'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 1
    FROM public.transactional_email_jobs AS email_job
    WHERE email_job.workspace_id = 'b0000000-0000-4000-8000-000000000001'
      AND email_job.idempotency_key =
        'contact-submission:b1000000-0000-4000-8000-000000000006:manager:manager@example.invalid'
      AND email_job.aggregate_type = 'poisoned_test_key'
  ),
  'forced rollback preserves the pre-existing conflicting job unchanged'
);

INSERT INTO contact_rpc_results (result_key, inquiry_id, created)
SELECT
  'second_workspace',
  result.inquiry_id,
  result.created
FROM public.submit_contact_inquiry_with_email_jobs(
  'b0000000-0000-4000-8000-000000000002',
  'b1000000-0000-4000-8000-000000000001',
  pg_catalog.repeat('1', 64),
  pg_temp.contact_test_inquiry(
    'b0000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001'
  ),
  pg_temp.contact_test_jobs(
    'b0000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001'
  )
) AS result;

SELECT extensions.ok(
  (
    SELECT second_workspace.created
    FROM contact_rpc_results AS second_workspace
    WHERE second_workspace.result_key = 'second_workspace'
  ),
  'the same submission UUID can be created independently in another workspace'
);

SELECT extensions.ok(
  (
    SELECT
      second_workspace.inquiry_id IS DISTINCT FROM first_submit.inquiry_id
      AND (
        SELECT pg_catalog.count(*)
        FROM public.transactional_email_jobs AS email_job
        WHERE email_job.workspace_id = 'b0000000-0000-4000-8000-000000000002'
          AND email_job.aggregate_id = second_workspace.inquiry_id
      ) = 2
    FROM contact_rpc_results AS second_workspace
    JOIN contact_rpc_results AS first_submit
      ON first_submit.result_key = 'first_submit'
    WHERE second_workspace.result_key = 'second_workspace'
  ),
  'tenant-local submission reuse produces a distinct inquiry and scoped jobs'
);

SELECT * FROM extensions.finish();

ROLLBACK;
