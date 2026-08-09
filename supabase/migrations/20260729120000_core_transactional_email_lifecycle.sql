-- Universal transactional email lifecycle for public inquiries and account access.
-- Marketing/newsletter consent remains separate from these operational messages.

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    company text,
    request_type text,
    timeline text,
    challenge text,
    locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
    marketing_consent boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'spam')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_inquiries_workspace_created_idx
    ON public.contact_inquiries (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contact_inquiries_workspace_status_idx
    ON public.contact_inquiries (workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.transactional_email_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    aggregate_type text NOT NULL,
    aggregate_id uuid,
    event_type text NOT NULL,
    recipient_role text NOT NULL CHECK (recipient_role IN ('customer', 'manager', 'user')),
    recipient_email text NOT NULL,
    locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
    from_email text NOT NULL,
    reply_to_email text,
    subject text NOT NULL,
    html_body text NOT NULL,
    idempotency_key text NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'sent', 'delivered', 'failed', 'skipped', 'bounced', 'complained')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    provider_message_id text,
    last_error text,
    payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT transactional_email_jobs_workspace_idempotency_key
        UNIQUE (workspace_id, idempotency_key)
);

-- Converge databases that briefly carried the pre-portability global UNIQUE
-- constraint. Logical email keys are workspace-local; the row id remains the
-- globally unique provider retry key.
DO $$
DECLARE
    legacy_constraint record;
BEGIN
    FOR legacy_constraint IN
        SELECT constraint_row.conname
        FROM pg_catalog.pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.transactional_email_jobs'::regclass
          AND constraint_row.contype = 'u'
          AND pg_catalog.pg_get_constraintdef(constraint_row.oid) = 'UNIQUE (idempotency_key)'
    LOOP
        EXECUTE pg_catalog.format(
            'ALTER TABLE public.transactional_email_jobs DROP CONSTRAINT %I',
            legacy_constraint.conname
        );
    END LOOP;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.transactional_email_jobs'::regclass
          AND conname = 'transactional_email_jobs_workspace_idempotency_key'
    ) THEN
        ALTER TABLE public.transactional_email_jobs
            ADD CONSTRAINT transactional_email_jobs_workspace_idempotency_key
            UNIQUE (workspace_id, idempotency_key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS transactional_email_jobs_dispatch_idx
    ON public.transactional_email_jobs (status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed', 'skipped');

CREATE INDEX IF NOT EXISTS transactional_email_jobs_running_lease_idx
    ON public.transactional_email_jobs (updated_at, created_at)
    WHERE status = 'running';

CREATE INDEX IF NOT EXISTS transactional_email_jobs_workspace_idx
    ON public.transactional_email_jobs (workspace_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS transactional_email_jobs_provider_message_idx
    ON public.transactional_email_jobs (provider_message_id)
    WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactional_email_jobs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_updated_at_contact_inquiries ON public.contact_inquiries;
CREATE TRIGGER set_updated_at_contact_inquiries
    BEFORE UPDATE ON public.contact_inquiries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_transactional_email_jobs ON public.transactional_email_jobs;
CREATE TRIGGER set_updated_at_transactional_email_jobs
    BEFORE UPDATE ON public.transactional_email_jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "contact_inquiries_select_policy" ON public.contact_inquiries;
DROP POLICY IF EXISTS "contact_inquiries_update_policy" ON public.contact_inquiries;
DROP POLICY IF EXISTS "transactional_email_jobs_select_policy" ON public.transactional_email_jobs;

-- These tables contain inquiry PII and complete outbound message bodies. The
-- current runtime accesses them only through the server-side service client;
-- authenticated dashboards consume the separately governed Business Spine
-- work items instead of reading this evidence directly.
REVOKE ALL ON TABLE public.contact_inquiries FROM PUBLIC;
REVOKE ALL ON TABLE public.transactional_email_jobs FROM PUBLIC;
REVOKE ALL ON TABLE public.contact_inquiries FROM anon, authenticated;
REVOKE ALL ON TABLE public.transactional_email_jobs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contact_inquiries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transactional_email_jobs TO service_role;
