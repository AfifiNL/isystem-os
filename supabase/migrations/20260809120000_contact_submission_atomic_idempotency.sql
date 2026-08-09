-- Atomic, tenant-local contact submission and transactional-email outbox.
-- Client identity and provider delivery do not belong in this universal layer.

BEGIN;

ALTER TABLE public.contact_inquiries
  ADD COLUMN IF NOT EXISTS submission_id uuid,
  ADD COLUMN IF NOT EXISTS submission_fingerprint text;

-- Historical contact rows used the public submission UUID as the row id. Keep
-- those submissions replay-addressable while allowing new tenants to reuse the
-- same externally generated UUID without colliding with a global primary key.
UPDATE public.contact_inquiries
SET submission_id = id
WHERE submission_id IS NULL;

ALTER TABLE public.contact_inquiries
  ALTER COLUMN submission_id SET NOT NULL;

-- Rolling deploy compatibility: the pre-RPC application writes the public
-- submission UUID into contact_inquiries.id and does not know this new column.
-- Defaults have already populated NEW.id before this trigger runs.
CREATE OR REPLACE FUNCTION public.set_contact_submission_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.submission_id := COALESCE(NEW.submission_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_contact_submission_identity
  ON public.contact_inquiries;
CREATE TRIGGER set_contact_submission_identity
BEFORE INSERT ON public.contact_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.set_contact_submission_identity();

REVOKE ALL ON FUNCTION public.set_contact_submission_identity() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.submission_fingerprint IS NOT NULL
      AND inquiry.submission_fingerprint !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'Cannot enforce contact submission fingerprints: non-SHA-256 values require repair.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contact_inquiries AS inquiry
    GROUP BY inquiry.workspace_id, inquiry.submission_id
    HAVING pg_catalog.count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce contact submission idempotency: duplicate workspace submission IDs require repair.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.contact_inquiries'::regclass
      AND constraint_row.conname = 'contact_inquiries_submission_fingerprint_sha256'
  ) THEN
    ALTER TABLE public.contact_inquiries
      ADD CONSTRAINT contact_inquiries_submission_fingerprint_sha256
      CHECK (
        submission_fingerprint IS NULL
        OR submission_fingerprint ~ '^[0-9a-f]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.contact_inquiries'::regclass
      AND constraint_row.conname = 'contact_inquiries_workspace_submission_key'
  ) THEN
    ALTER TABLE public.contact_inquiries
      ADD CONSTRAINT contact_inquiries_workspace_submission_key
      UNIQUE (workspace_id, submission_id);
  END IF;
END;
$$;

COMMENT ON COLUMN public.contact_inquiries.submission_id IS
  'Caller-generated idempotency UUID, unique only within its workspace; legacy direct inserts default it to the inquiry row id.';
COMMENT ON COLUMN public.contact_inquiries.submission_fingerprint IS
  'Lowercase SHA-256 of the normalized submitted contact payload; NULL only for historical rows until an exact replay adopts the fingerprint.';

CREATE OR REPLACE FUNCTION public.submit_contact_inquiry_with_email_jobs(
  p_workspace_id uuid,
  p_submission_id uuid,
  p_submission_fingerprint text,
  p_inquiry jsonb,
  p_email_jobs jsonb
)
RETURNS TABLE(inquiry_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inquiry_id uuid;
  v_created boolean := false;
  v_existing_inquiry public.contact_inquiries%ROWTYPE;
  v_job jsonb;
  v_job_id uuid;
  v_existing_job public.transactional_email_jobs%ROWTYPE;
  v_recipient_role text;
  v_recipient_email text;
  v_reply_to_email text;
  v_idempotency_key text;
  v_expected_idempotency_key text;
  v_max_attempts integer;
  v_customer_job_count integer := 0;
  v_seen_idempotency_keys text[] := ARRAY[]::text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Contact submission RPC requires the service role.'
      USING ERRCODE = '42501';
  END IF;

  IF p_workspace_id IS NULL OR p_submission_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id and submission_id are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_submission_fingerprint IS NULL
     OR p_submission_fingerprint <> pg_catalog.btrim(p_submission_fingerprint)
     OR p_submission_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'submission_fingerprint must be a lowercase SHA-256 hex digest.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspaces AS workspace
    WHERE workspace.id = p_workspace_id
      AND workspace.is_active
  ) THEN
    RAISE EXCEPTION 'Contact submission workspace does not exist or is inactive.'
      USING ERRCODE = '23503';
  END IF;

  IF p_inquiry IS NULL OR pg_catalog.jsonb_typeof(p_inquiry) <> 'object' THEN
    RAISE EXCEPTION 'p_inquiry must be a JSON object.'
      USING ERRCODE = '22023';
  END IF;

  IF p_inquiry - ARRAY[
      'workspace_id',
      'submission_id',
      'customer_name',
      'customer_email',
      'company',
      'request_type',
      'timeline',
      'challenge',
      'locale',
      'marketing_consent',
      'metadata'
    ] <> '{}'::jsonb THEN
    RAISE EXCEPTION 'p_inquiry contains unsupported fields.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_inquiry ? 'workspace_id')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'workspace_id') <> 'string'
     OR (p_inquiry ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'p_inquiry.workspace_id must match p_workspace_id.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (p_inquiry ? 'submission_id')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'submission_id') <> 'string'
     OR (p_inquiry ->> 'submission_id')::uuid IS DISTINCT FROM p_submission_id THEN
    RAISE EXCEPTION 'p_inquiry.submission_id must match p_submission_id.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (p_inquiry ? 'customer_name')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'customer_name') <> 'string'
     OR pg_catalog.btrim(p_inquiry ->> 'customer_name') = ''
     OR pg_catalog.char_length(p_inquiry ->> 'customer_name') > 120 THEN
    RAISE EXCEPTION 'p_inquiry.customer_name must be a non-empty string of at most 120 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_inquiry ? 'customer_email')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'customer_email') <> 'string'
     OR p_inquiry ->> 'customer_email' <> pg_catalog.lower(pg_catalog.btrim(p_inquiry ->> 'customer_email'))
     OR pg_catalog.char_length(p_inquiry ->> 'customer_email') > 320
     OR p_inquiry ->> 'customer_email' !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'p_inquiry.customer_email must be a normalized email address.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_inquiry ? 'locale')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'locale') <> 'string'
     OR p_inquiry ->> 'locale' NOT IN ('en', 'nl', 'ar') THEN
    RAISE EXCEPTION 'p_inquiry.locale must be en, nl, or ar.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_inquiry ? 'marketing_consent')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'marketing_consent') <> 'boolean' THEN
    RAISE EXCEPTION 'p_inquiry.marketing_consent must be boolean.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (p_inquiry ? 'metadata')
     OR pg_catalog.jsonb_typeof(p_inquiry -> 'metadata') <> 'object' THEN
    RAISE EXCEPTION 'p_inquiry.metadata must be a JSON object.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_inquiry ? 'company')
     AND pg_catalog.jsonb_typeof(p_inquiry -> 'company') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'p_inquiry.company must be a string or null.'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(p_inquiry ->> 'company') > 160 THEN
    RAISE EXCEPTION 'p_inquiry.company must be at most 160 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_inquiry ? 'request_type')
     AND pg_catalog.jsonb_typeof(p_inquiry -> 'request_type') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'p_inquiry.request_type must be a string or null.'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(p_inquiry ->> 'request_type') > 120 THEN
    RAISE EXCEPTION 'p_inquiry.request_type must be at most 120 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_inquiry ? 'timeline')
     AND pg_catalog.jsonb_typeof(p_inquiry -> 'timeline') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'p_inquiry.timeline must be a string or null.'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(p_inquiry ->> 'timeline') > 240 THEN
    RAISE EXCEPTION 'p_inquiry.timeline must be at most 240 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_inquiry ? 'challenge')
     AND pg_catalog.jsonb_typeof(p_inquiry -> 'challenge') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'p_inquiry.challenge must be a string or null.'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.char_length(p_inquiry ->> 'challenge') > 5000 THEN
    RAISE EXCEPTION 'p_inquiry.challenge must be at most 5000 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF p_email_jobs IS NULL
     OR pg_catalog.jsonb_typeof(p_email_jobs) <> 'array'
     OR pg_catalog.jsonb_array_length(p_email_jobs) < 1
     OR pg_catalog.jsonb_array_length(p_email_jobs) > 101 THEN
    RAISE EXCEPTION 'p_email_jobs must contain between 1 and 101 jobs.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':contact-submission:' || p_submission_id::text,
      0
    )
  );

  INSERT INTO public.contact_inquiries (
    workspace_id,
    submission_id,
    submission_fingerprint,
    customer_name,
    customer_email,
    company,
    request_type,
    timeline,
    challenge,
    locale,
    marketing_consent,
    metadata
  )
  VALUES (
    p_workspace_id,
    p_submission_id,
    p_submission_fingerprint,
    p_inquiry ->> 'customer_name',
    p_inquiry ->> 'customer_email',
    p_inquiry ->> 'company',
    p_inquiry ->> 'request_type',
    p_inquiry ->> 'timeline',
    p_inquiry ->> 'challenge',
    p_inquiry ->> 'locale',
    (p_inquiry ->> 'marketing_consent')::boolean,
    p_inquiry -> 'metadata'
  )
  ON CONFLICT (workspace_id, submission_id) DO NOTHING
  RETURNING id INTO v_inquiry_id;

  IF FOUND THEN
    v_created := true;
  ELSE
    SELECT inquiry.*
    INTO STRICT v_existing_inquiry
    FROM public.contact_inquiries AS inquiry
    WHERE inquiry.workspace_id = p_workspace_id
      AND inquiry.submission_id = p_submission_id
    FOR UPDATE;

    v_inquiry_id := v_existing_inquiry.id;

    IF v_existing_inquiry.submission_fingerprint IS NOT NULL
       AND v_existing_inquiry.submission_fingerprint IS DISTINCT FROM p_submission_fingerprint THEN
      RAISE EXCEPTION 'Contact submission ID was already used with a different fingerprint.'
        USING ERRCODE = '23514';
    END IF;

    IF ROW(
      v_existing_inquiry.customer_name,
      v_existing_inquiry.customer_email,
      v_existing_inquiry.company,
      v_existing_inquiry.request_type,
      v_existing_inquiry.timeline,
      v_existing_inquiry.challenge,
      v_existing_inquiry.locale,
      v_existing_inquiry.marketing_consent,
      v_existing_inquiry.metadata -> 'phone'
    ) IS DISTINCT FROM ROW(
      p_inquiry ->> 'customer_name',
      p_inquiry ->> 'customer_email',
      p_inquiry ->> 'company',
      p_inquiry ->> 'request_type',
      p_inquiry ->> 'timeline',
      p_inquiry ->> 'challenge',
      p_inquiry ->> 'locale',
      (p_inquiry ->> 'marketing_consent')::boolean,
      p_inquiry -> 'metadata' -> 'phone'
    ) THEN
      RAISE EXCEPTION 'Contact submission ID was already used with a different inquiry payload.'
        USING ERRCODE = '23514';
    END IF;

    IF v_existing_inquiry.submission_fingerprint IS NULL THEN
      UPDATE public.contact_inquiries AS inquiry
      SET submission_fingerprint = p_submission_fingerprint
      WHERE inquiry.id = v_existing_inquiry.id
        AND inquiry.submission_fingerprint IS NULL;
    END IF;
  END IF;

  FOR v_job IN
    SELECT job.value
    FROM pg_catalog.jsonb_array_elements(p_email_jobs) AS job(value)
  LOOP
    IF pg_catalog.jsonb_typeof(v_job) <> 'object' THEN
      RAISE EXCEPTION 'Each p_email_jobs item must be a JSON object.'
        USING ERRCODE = '22023';
    END IF;

    IF v_job - ARRAY[
        'workspace_id',
        'aggregate_type',
        'aggregate_id',
        'event_type',
        'recipient_role',
        'recipient_email',
        'locale',
        'from_email',
        'reply_to_email',
        'subject',
        'html_body',
        'idempotency_key',
        'max_attempts',
        'payload_json'
      ] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'A p_email_jobs item contains unsupported fields.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_job ? 'workspace_id')
       OR pg_catalog.jsonb_typeof(v_job -> 'workspace_id') <> 'string'
       OR (v_job ->> 'workspace_id')::uuid IS DISTINCT FROM p_workspace_id THEN
      RAISE EXCEPTION 'Every email job workspace_id must match p_workspace_id.'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (v_job ? 'aggregate_type')
       OR pg_catalog.jsonb_typeof(v_job -> 'aggregate_type') <> 'string'
       OR v_job ->> 'aggregate_type' <> 'contact_inquiry' THEN
      RAISE EXCEPTION 'Every email job aggregate_type must be contact_inquiry.'
        USING ERRCODE = '23514';
    END IF;

    IF (v_job ? 'aggregate_id')
       AND pg_catalog.jsonb_typeof(v_job -> 'aggregate_id') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Email job aggregate_id must be a UUID string or null.'
        USING ERRCODE = '22023';
    END IF;
    IF (v_job ? 'aggregate_id')
       AND pg_catalog.jsonb_typeof(v_job -> 'aggregate_id') = 'string'
       AND (v_job ->> 'aggregate_id')::uuid IS DISTINCT FROM v_inquiry_id THEN
      RAISE EXCEPTION 'Email job aggregate_id must match the resolved inquiry.'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (v_job ? 'recipient_role')
       OR pg_catalog.jsonb_typeof(v_job -> 'recipient_role') <> 'string'
       OR v_job ->> 'recipient_role' NOT IN ('customer', 'manager') THEN
      RAISE EXCEPTION 'Contact email recipient_role must be customer or manager.'
        USING ERRCODE = '22023';
    END IF;
    v_recipient_role := v_job ->> 'recipient_role';

    IF NOT (v_job ? 'recipient_email')
       OR pg_catalog.jsonb_typeof(v_job -> 'recipient_email') <> 'string' THEN
      RAISE EXCEPTION 'Email job recipient_email must be a string.'
        USING ERRCODE = '22023';
    END IF;
    v_recipient_email := pg_catalog.lower(pg_catalog.btrim(v_job ->> 'recipient_email'));
    IF v_recipient_email = ''
       OR pg_catalog.char_length(v_recipient_email) > 320
       OR v_recipient_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
      RAISE EXCEPTION 'Email job recipient_email must be a valid address.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_job ? 'event_type')
       OR pg_catalog.jsonb_typeof(v_job -> 'event_type') <> 'string'
       OR pg_catalog.btrim(v_job ->> 'event_type') = '' THEN
      RAISE EXCEPTION 'Email job event_type must be a non-empty string.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_job ? 'locale')
       OR pg_catalog.jsonb_typeof(v_job -> 'locale') <> 'string'
       OR v_job ->> 'locale' NOT IN ('en', 'nl', 'ar') THEN
      RAISE EXCEPTION 'Email job locale must be en, nl, or ar.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_job ? 'from_email')
       OR pg_catalog.jsonb_typeof(v_job -> 'from_email') <> 'string'
       OR pg_catalog.btrim(v_job ->> 'from_email') = ''
       OR pg_catalog.char_length(v_job ->> 'from_email') > 500 THEN
      RAISE EXCEPTION 'Email job from_email must be a non-empty string of at most 500 characters.'
        USING ERRCODE = '22023';
    END IF;

    IF (v_job ? 'reply_to_email')
       AND pg_catalog.jsonb_typeof(v_job -> 'reply_to_email') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Email job reply_to_email must be a string or null.'
        USING ERRCODE = '22023';
    END IF;
    v_reply_to_email := NULLIF(pg_catalog.btrim(v_job ->> 'reply_to_email'), '');

    IF NOT (v_job ? 'subject')
       OR pg_catalog.jsonb_typeof(v_job -> 'subject') <> 'string'
       OR pg_catalog.btrim(v_job ->> 'subject') = '' THEN
      RAISE EXCEPTION 'Email job subject must be a non-empty string.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_job ? 'html_body')
       OR pg_catalog.jsonb_typeof(v_job -> 'html_body') <> 'string'
       OR pg_catalog.btrim(v_job ->> 'html_body') = '' THEN
      RAISE EXCEPTION 'Email job html_body must be a non-empty string.'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (v_job ? 'idempotency_key')
       OR pg_catalog.jsonb_typeof(v_job -> 'idempotency_key') <> 'string' THEN
      RAISE EXCEPTION 'Email job idempotency_key must be a string.'
        USING ERRCODE = '22023';
    END IF;
    v_idempotency_key := pg_catalog.btrim(v_job ->> 'idempotency_key');
    v_expected_idempotency_key := 'contact-submission:' || p_submission_id::text || ':' ||
      CASE
        WHEN v_recipient_role = 'customer' THEN 'customer'
        ELSE 'manager:' || v_recipient_email
      END;
    IF v_idempotency_key IS DISTINCT FROM v_expected_idempotency_key THEN
      RAISE EXCEPTION 'Email job idempotency_key does not match its deterministic contact key.'
        USING ERRCODE = '23514';
    END IF;
    IF v_idempotency_key = ANY (v_seen_idempotency_keys) THEN
      RAISE EXCEPTION 'p_email_jobs contains a duplicate idempotency_key.'
        USING ERRCODE = '23514';
    END IF;
    v_seen_idempotency_keys := pg_catalog.array_append(v_seen_idempotency_keys, v_idempotency_key);

    IF (v_job ? 'max_attempts')
       AND (
         pg_catalog.jsonb_typeof(v_job -> 'max_attempts') <> 'number'
         OR v_job ->> 'max_attempts' !~ '^[0-9]+$'
       ) THEN
      RAISE EXCEPTION 'Email job max_attempts must be an integer.'
        USING ERRCODE = '22023';
    END IF;
    v_max_attempts := COALESCE((v_job ->> 'max_attempts')::integer, 5);
    IF v_max_attempts < 1 OR v_max_attempts > 20 THEN
      RAISE EXCEPTION 'Email job max_attempts must be between 1 and 20.'
        USING ERRCODE = '22023';
    END IF;

    IF (v_job ? 'payload_json')
       AND pg_catalog.jsonb_typeof(v_job -> 'payload_json') <> 'object' THEN
      RAISE EXCEPTION 'Email job payload_json must be an object.'
        USING ERRCODE = '22023';
    END IF;

    IF v_recipient_role = 'customer' THEN
      v_customer_job_count := v_customer_job_count + 1;
    END IF;

    INSERT INTO public.transactional_email_jobs (
      workspace_id,
      aggregate_type,
      aggregate_id,
      event_type,
      recipient_role,
      recipient_email,
      locale,
      from_email,
      reply_to_email,
      subject,
      html_body,
      idempotency_key,
      max_attempts,
      payload_json
    )
    VALUES (
      p_workspace_id,
      'contact_inquiry',
      v_inquiry_id,
      pg_catalog.btrim(v_job ->> 'event_type'),
      v_recipient_role,
      v_recipient_email,
      v_job ->> 'locale',
      pg_catalog.btrim(v_job ->> 'from_email'),
      v_reply_to_email,
      v_job ->> 'subject',
      v_job ->> 'html_body',
      v_idempotency_key,
      v_max_attempts,
      COALESCE(v_job -> 'payload_json', '{}'::jsonb)
    )
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_job_id;

    IF NOT FOUND THEN
      SELECT email_job.*
      INTO STRICT v_existing_job
      FROM public.transactional_email_jobs AS email_job
      WHERE email_job.workspace_id = p_workspace_id
        AND email_job.idempotency_key = v_idempotency_key
      FOR UPDATE;

      IF ROW(
        v_existing_job.aggregate_type,
        v_existing_job.aggregate_id,
        v_existing_job.event_type,
        v_existing_job.recipient_role,
        v_existing_job.recipient_email,
        v_existing_job.locale,
        v_existing_job.from_email,
        v_existing_job.reply_to_email,
        v_existing_job.subject,
        v_existing_job.html_body,
        v_existing_job.max_attempts,
        v_existing_job.payload_json
      ) IS DISTINCT FROM ROW(
        'contact_inquiry'::text,
        v_inquiry_id,
        pg_catalog.btrim(v_job ->> 'event_type'),
        v_recipient_role,
        v_recipient_email,
        v_job ->> 'locale',
        pg_catalog.btrim(v_job ->> 'from_email'),
        v_reply_to_email,
        v_job ->> 'subject',
        v_job ->> 'html_body',
        v_max_attempts,
        COALESCE(v_job -> 'payload_json', '{}'::jsonb)
      ) THEN
        RAISE EXCEPTION 'Transactional email idempotency key was already used with a different payload.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  IF v_customer_job_count <> 1 THEN
    RAISE EXCEPTION 'A contact submission requires exactly one customer acknowledgement job.'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY SELECT v_inquiry_id, v_created;
END;
$$;

COMMENT ON FUNCTION public.submit_contact_inquiry_with_email_jobs(uuid, uuid, text, jsonb, jsonb) IS
  'Atomically inserts or reuses one workspace contact submission and its deterministic transactional-email jobs.';

REVOKE ALL ON FUNCTION public.submit_contact_inquiry_with_email_jobs(uuid, uuid, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry_with_email_jobs(uuid, uuid, text, jsonb, jsonb)
  TO service_role;

COMMIT;
