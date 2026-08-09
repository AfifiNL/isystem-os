-- Legal Vault & Bookkeeping — foundation.
--
-- Adds workspace-scoped storage for legal documents, agreement templates,
-- agreement instances, signature audit trail, bookkeeping ledger, and
-- generated reports. All tables enforce RLS via the existing
-- can_access_workspace() helper and respect the NL Belastingdienst 7-year
-- retention requirement (bewaarplicht) for anything tied to bookkeeping.
--
-- Universal feature → lives on core (no fork header).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Capabilities
-- ---------------------------------------------------------------------------

INSERT INTO public.capabilities (capability_key, name, description, metadata)
VALUES
  ('legal.read',         'Legal Read',         'Read agreements, templates, and stored legal documents in the Legal Vault.',                jsonb_build_object('domain', 'legal')),
  ('legal.write',        'Legal Write',        'Create or update agreements, templates, and stored legal documents in the Legal Vault.',   jsonb_build_object('domain', 'legal')),
  ('legal.manage',       'Legal Manage',       'Manage template library and configure Legal Vault behaviour for a workspace.',              jsonb_build_object('domain', 'legal')),
  ('bookkeeping.read',   'Bookkeeping Read',   'Read accounting entries, periods, and generated reports.',                                  jsonb_build_object('domain', 'bookkeeping')),
  ('bookkeeping.write',  'Bookkeeping Write',  'Create, update, or import accounting entries; close periods; generate reports.',            jsonb_build_object('domain', 'bookkeeping'))
ON CONFLICT (capability_key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    metadata = public.capabilities.metadata || EXCLUDED.metadata,
    is_active = true,
    updated_at = now();

-- Role grants. Admin gets everything; manager gets read+write but not manage.
INSERT INTO public.role_capability_grants (role, capability_id, is_allowed)
SELECT
  r.role_name,
  c.id,
  CASE
    WHEN r.role_name = 'admin' THEN true
    WHEN r.role_name = 'manager' AND c.capability_key IN (
      'legal.read', 'legal.write',
      'bookkeeping.read', 'bookkeeping.write'
    ) THEN true
    ELSE false
  END AS is_allowed
FROM (VALUES ('admin'::text), ('manager'::text), ('user'::text)) AS r(role_name)
CROSS JOIN public.capabilities c
WHERE c.capability_key IN (
  'legal.read', 'legal.write', 'legal.manage',
  'bookkeeping.read', 'bookkeeping.write'
)
ON CONFLICT (role, capability_id) DO UPDATE
SET is_allowed = EXCLUDED.is_allowed,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Enum types
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_document_kind') THEN
    CREATE TYPE public.legal_document_kind AS ENUM (
      'agreement', 'invoice', 'receipt', 'accounting_export',
      'identity', 'correspondence', 'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_agreement_status') THEN
    CREATE TYPE public.legal_agreement_status AS ENUM (
      'draft', 'sent', 'viewed', 'signed', 'void', 'expired'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_template_category') THEN
    CREATE TYPE public.legal_template_category AS ENUM (
      'dvo', 'nda', 'dpa', 'invoice', 'quote', 'generic'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_signature_event_kind') THEN
    CREATE TYPE public.legal_signature_event_kind AS ENUM (
      'sent', 'opened', 'viewed', 'signed', 'declined', 'expired', 'voided'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_period_kind') THEN
    CREATE TYPE public.accounting_period_kind AS ENUM ('btw_quarter', 'fiscal_year');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_entry_direction') THEN
    CREATE TYPE public.accounting_entry_direction AS ENUM ('income', 'expense');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_report_kind') THEN
    CREATE TYPE public.accounting_report_kind AS ENUM ('btw_prep', 'year_overview', 'ledger_export');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_report_format') THEN
    CREATE TYPE public.accounting_report_format AS ENUM ('pdf', 'csv', 'ubl_xml');
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

-- legal_documents: every binary stored in the vault (uploaded or generated).
-- Retention is enforced by trigger; soft-delete via deleted_at; hard delete
-- blocked while retention_until is in the future or while referenced by
-- bookkeeping rows.
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind                  public.legal_document_kind NOT NULL,
  title                 text NOT NULL,
  storage_bucket        text NOT NULL DEFAULT 'legal-vault',
  storage_path          text NOT NULL,
  sha256                text NOT NULL,
  size_bytes            bigint NOT NULL CHECK (size_bytes >= 0),
  mime                  text NOT NULL,
  client_id             uuid REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  related_agreement_id  uuid,  -- FK added below to break circular dep
  related_entry_id      uuid,  -- FK added below
  retention_until       date NOT NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_legal_documents_workspace
  ON public.legal_documents (workspace_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_documents_kind
  ON public.legal_documents (workspace_id, kind);
CREATE INDEX IF NOT EXISTS idx_legal_documents_client
  ON public.legal_documents (client_id);

-- legal_agreement_templates: workspace-scoped overrides plus system seeds
-- (workspace_id IS NULL → system template, readable by every workspace).
CREATE TABLE IF NOT EXISTS public.legal_agreement_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  name            text NOT NULL,
  locale          text NOT NULL DEFAULT 'nl',
  jurisdiction    text NOT NULL DEFAULT 'NL',
  category        public.legal_template_category NOT NULL,
  body_mdx        text NOT NULL,
  variables       jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  version         integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_legal_template_slug_per_workspace
  ON public.legal_agreement_templates (COALESCE(workspace_id::text, 'system'), slug);

CREATE INDEX IF NOT EXISTS idx_legal_templates_category
  ON public.legal_agreement_templates (category, is_active);

-- legal_agreements: instance generated from a template (or freeform).
CREATE TABLE IF NOT EXISTS public.legal_agreements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES public.legal_agreement_templates(id) ON DELETE SET NULL,
  document_id     uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  client_id       uuid REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  booking_id      uuid,  -- FK added conditionally below when booking_reservations exists
  status          public.legal_agreement_status NOT NULL DEFAULT 'draft',
  title           text NOT NULL,
  party_name      text NOT NULL,
  party_email     text NOT NULL CHECK (position('@' in party_email) > 1),
  effective_date  date,
  expires_at      date,
  signed_at       timestamptz,
  signed_sha256   text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_token    text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_legal_agreements_public_token
  ON public.legal_agreements (public_token);
CREATE INDEX IF NOT EXISTS idx_legal_agreements_workspace
  ON public.legal_agreements (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_agreements_client
  ON public.legal_agreements (client_id);

-- Now close the circular FK from legal_documents.related_agreement_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_documents_related_agreement_id_fkey'
  ) THEN
    ALTER TABLE public.legal_documents
      ADD CONSTRAINT legal_documents_related_agreement_id_fkey
      FOREIGN KEY (related_agreement_id)
      REFERENCES public.legal_agreements(id) ON DELETE SET NULL;
  END IF;
END$$;

-- legal_signature_events: append-only audit trail (no UPDATE / DELETE policies).
CREATE TABLE IF NOT EXISTS public.legal_signature_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agreement_id      uuid NOT NULL REFERENCES public.legal_agreements(id) ON DELETE CASCADE,
  event             public.legal_signature_event_kind NOT NULL,
  actor_email       text,
  actor_ip          inet,
  actor_user_agent  text,
  payload_sha256    text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_signature_events_agreement
  ON public.legal_signature_events (agreement_id, occurred_at DESC);

-- accounting_periods: BTW quarter + fiscal year buckets.
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind            public.accounting_period_kind NOT NULL,
  starts_on       date NOT NULL,
  ends_on         date NOT NULL CHECK (ends_on >= starts_on),
  closed_at       timestamptz,
  closed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind, starts_on)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_workspace
  ON public.accounting_periods (workspace_id, kind, starts_on DESC);

-- accounting_entries: ledger rows.
-- btw_rate_bp uses basis points (e.g. 2100 = 21.00%); supports 0, 900, 2100,
-- and any future Belastingdienst rate without a schema change.
CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_id               uuid REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
  direction               public.accounting_entry_direction NOT NULL,
  category                text NOT NULL,
  description             text NOT NULL,
  invoice_number          text,
  party_name              text,
  party_vat_number        text,
  amount_excl_btw_cents   bigint NOT NULL,
  btw_rate_bp             integer NOT NULL CHECK (btw_rate_bp >= 0 AND btw_rate_bp <= 10000),
  btw_amount_cents        bigint NOT NULL,
  amount_incl_btw_cents   bigint NOT NULL,
  currency                text NOT NULL DEFAULT 'EUR',
  occurred_on             date NOT NULL,
  document_id             uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  reconciled              boolean NOT NULL DEFAULT false,
  notes                   text,
  created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_entries_workspace
  ON public.accounting_entries (workspace_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_period
  ON public.accounting_entries (period_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_direction
  ON public.accounting_entries (workspace_id, direction, occurred_on DESC);

-- Close the legal_documents.related_entry_id FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_documents_related_entry_id_fkey'
  ) THEN
    ALTER TABLE public.legal_documents
      ADD CONSTRAINT legal_documents_related_entry_id_fkey
      FOREIGN KEY (related_entry_id)
      REFERENCES public.accounting_entries(id) ON DELETE SET NULL;
  END IF;
END$$;

-- accounting_reports: generated artefacts (BTW prep, year overview, exports).
CREATE TABLE IF NOT EXISTS public.accounting_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_id       uuid REFERENCES public.accounting_periods(id) ON DELETE SET NULL,
  kind            public.accounting_report_kind NOT NULL,
  format          public.accounting_report_format NOT NULL,
  document_id     uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  totals          jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  generated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_accounting_reports_workspace
  ON public.accounting_reports (workspace_id, kind, generated_at DESC);

-- Optional FK to booking_reservations when that module is present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'booking_reservations')
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'legal_agreements_booking_id_fkey'
     )
  THEN
    ALTER TABLE public.legal_agreements
      ADD CONSTRAINT legal_agreements_booking_id_fkey
      FOREIGN KEY (booking_id)
      REFERENCES public.booking_reservations(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 4. Triggers — updated_at + retention guard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_legal_vault_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'legal_documents', 'legal_agreement_templates', 'legal_agreements',
    'accounting_entries'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'tg_' || t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at()',
      'tg_' || t || '_updated_at', t
    );
  END LOOP;
END$$;

-- Retention guard: block hard DELETE on legal_documents while the row is
-- inside its 7-year retention window OR while referenced by an accounting
-- entry. Soft-delete (UPDATE deleted_at) is always allowed.
CREATE OR REPLACE FUNCTION public.tg_legal_documents_retention_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_ref_count integer;
BEGIN
  IF OLD.retention_until IS NOT NULL AND OLD.retention_until > current_date THEN
    RAISE EXCEPTION
      'legal_documents row % is within its bewaarplicht retention window (until %); soft-delete by setting deleted_at instead.',
      OLD.id, OLD.retention_until
      USING ERRCODE = '23503';
  END IF;

  SELECT count(*) INTO v_ref_count
  FROM public.accounting_entries ae
  WHERE ae.document_id = OLD.id;

  IF v_ref_count > 0 THEN
    RAISE EXCEPTION
      'legal_documents row % is referenced by % accounting_entries; detach or delete those first.',
      OLD.id, v_ref_count
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tg_legal_documents_retention_guard ON public.legal_documents;
CREATE TRIGGER tg_legal_documents_retention_guard
BEFORE DELETE ON public.legal_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_documents_retention_guard();

-- Auto-set retention_until on insert when not provided. Default: end of
-- current fiscal year + 7 years (bewaarplicht spans seven full fiscal years
-- after the year the row pertains to).
CREATE OR REPLACE FUNCTION public.tg_legal_documents_set_retention()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.retention_until IS NULL THEN
    NEW.retention_until := (date_trunc('year', now())::date + INTERVAL '8 years - 1 day')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_legal_documents_set_retention ON public.legal_documents;
CREATE TRIGGER tg_legal_documents_set_retention
BEFORE INSERT ON public.legal_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_documents_set_retention();

-- ---------------------------------------------------------------------------
-- 5. RLS — everything except legal_signature_events (append-only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_agreement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_signature_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_reports ENABLE ROW LEVEL SECURITY;

-- legal_documents
DROP POLICY IF EXISTS legal_documents_select   ON public.legal_documents;
DROP POLICY IF EXISTS legal_documents_insert   ON public.legal_documents;
DROP POLICY IF EXISTS legal_documents_update   ON public.legal_documents;
DROP POLICY IF EXISTS legal_documents_delete   ON public.legal_documents;

CREATE POLICY legal_documents_select ON public.legal_documents
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_documents_insert ON public.legal_documents
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_documents_update ON public.legal_documents
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
             WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_documents_delete ON public.legal_documents
  FOR DELETE USING (public.can_access_workspace(workspace_id, 'legal.manage'));

-- legal_agreement_templates: system templates (workspace_id IS NULL) are
-- world-readable to authenticated members of any workspace; writes require
-- the workspace-scoped legal.manage capability OR admin role for system
-- templates.
DROP POLICY IF EXISTS legal_templates_select  ON public.legal_agreement_templates;
DROP POLICY IF EXISTS legal_templates_insert  ON public.legal_agreement_templates;
DROP POLICY IF EXISTS legal_templates_update  ON public.legal_agreement_templates;
DROP POLICY IF EXISTS legal_templates_delete  ON public.legal_agreement_templates;

CREATE POLICY legal_templates_select ON public.legal_agreement_templates
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.can_access_workspace(workspace_id, 'legal.read')
  );
CREATE POLICY legal_templates_insert ON public.legal_agreement_templates
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  );
CREATE POLICY legal_templates_update ON public.legal_agreement_templates
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  );
CREATE POLICY legal_templates_delete ON public.legal_agreement_templates
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  );

-- legal_agreements
DROP POLICY IF EXISTS legal_agreements_select  ON public.legal_agreements;
DROP POLICY IF EXISTS legal_agreements_insert  ON public.legal_agreements;
DROP POLICY IF EXISTS legal_agreements_update  ON public.legal_agreements;
DROP POLICY IF EXISTS legal_agreements_delete  ON public.legal_agreements;

CREATE POLICY legal_agreements_select ON public.legal_agreements
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_agreements_insert ON public.legal_agreements
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_agreements_update ON public.legal_agreements
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
             WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_agreements_delete ON public.legal_agreements
  FOR DELETE USING (public.can_access_workspace(workspace_id, 'legal.manage'));

-- legal_signature_events: read scoped to workspace; INSERT only via service
-- role (server actions use the service-role client for audit writes to keep
-- inserts immutable from end-user RLS).
DROP POLICY IF EXISTS legal_signature_events_select ON public.legal_signature_events;
CREATE POLICY legal_signature_events_select ON public.legal_signature_events
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
-- (no INSERT/UPDATE/DELETE policy → defaults deny for anon/authenticated;
--  service role bypasses RLS by design)

-- accounting_periods
DROP POLICY IF EXISTS accounting_periods_select ON public.accounting_periods;
DROP POLICY IF EXISTS accounting_periods_insert ON public.accounting_periods;
DROP POLICY IF EXISTS accounting_periods_update ON public.accounting_periods;
DROP POLICY IF EXISTS accounting_periods_delete ON public.accounting_periods;

CREATE POLICY accounting_periods_select ON public.accounting_periods
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY accounting_periods_insert ON public.accounting_periods
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY accounting_periods_update ON public.accounting_periods
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'))
             WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY accounting_periods_delete ON public.accounting_periods
  FOR DELETE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write')
                    AND closed_at IS NULL);

-- accounting_entries
DROP POLICY IF EXISTS accounting_entries_select ON public.accounting_entries;
DROP POLICY IF EXISTS accounting_entries_insert ON public.accounting_entries;
DROP POLICY IF EXISTS accounting_entries_update ON public.accounting_entries;
DROP POLICY IF EXISTS accounting_entries_delete ON public.accounting_entries;

CREATE POLICY accounting_entries_select ON public.accounting_entries
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY accounting_entries_insert ON public.accounting_entries
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY accounting_entries_update ON public.accounting_entries
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'))
             WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
-- Delete forbidden when period is closed (bewaarplicht). Soft delete pattern
-- not used here because entries are not files; correction lines should be
-- created instead.
CREATE POLICY accounting_entries_delete ON public.accounting_entries
  FOR DELETE USING (
    public.can_access_workspace(workspace_id, 'bookkeeping.write')
    AND (
      period_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.accounting_periods p
        WHERE p.id = period_id AND p.closed_at IS NOT NULL
      )
    )
  );

-- accounting_reports
DROP POLICY IF EXISTS accounting_reports_select ON public.accounting_reports;
DROP POLICY IF EXISTS accounting_reports_insert ON public.accounting_reports;

CREATE POLICY accounting_reports_select ON public.accounting_reports
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY accounting_reports_insert ON public.accounting_reports
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
-- Reports are immutable history; no UPDATE/DELETE policies.

-- ---------------------------------------------------------------------------
-- 6. Storage bucket — 'legal-vault'
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'legal-vault', 'legal-vault', false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'text/csv', 'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: object path convention is `<workspace_id>/<...>`. We use the
-- first path segment to derive the workspace and gate via can_access_workspace.
DROP POLICY IF EXISTS legal_vault_storage_select ON storage.objects;
DROP POLICY IF EXISTS legal_vault_storage_insert ON storage.objects;
DROP POLICY IF EXISTS legal_vault_storage_update ON storage.objects;
DROP POLICY IF EXISTS legal_vault_storage_delete ON storage.objects;

CREATE POLICY legal_vault_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'legal-vault'
    AND public.can_access_workspace(
      NULLIF(split_part(name, '/', 1), '')::uuid,
      'legal.read'
    )
  );

CREATE POLICY legal_vault_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'legal-vault'
    AND public.can_access_workspace(
      NULLIF(split_part(name, '/', 1), '')::uuid,
      'legal.write'
    )
  );

CREATE POLICY legal_vault_storage_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'legal-vault'
    AND public.can_access_workspace(
      NULLIF(split_part(name, '/', 1), '')::uuid,
      'legal.write'
    )
  );

CREATE POLICY legal_vault_storage_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'legal-vault'
    AND public.can_access_workspace(
      NULLIF(split_part(name, '/', 1), '')::uuid,
      'legal.manage'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Helper: derive the current BTW quarter and ensure a period row exists
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_btw_quarter(p_workspace_id uuid, p_on date DEFAULT current_date)
RETURNS public.accounting_periods
LANGUAGE plpgsql
AS $$
DECLARE
  v_quarter integer;
  v_start   date;
  v_end     date;
  v_row     public.accounting_periods;
BEGIN
  v_quarter := extract(quarter from p_on)::int;
  v_start   := make_date(extract(year from p_on)::int, ((v_quarter - 1) * 3) + 1, 1);
  v_end     := (v_start + INTERVAL '3 months - 1 day')::date;

  INSERT INTO public.accounting_periods (workspace_id, kind, starts_on, ends_on)
  VALUES (p_workspace_id, 'btw_quarter', v_start, v_end)
  ON CONFLICT (workspace_id, kind, starts_on) DO NOTHING;

  SELECT * INTO v_row
  FROM public.accounting_periods
  WHERE workspace_id = p_workspace_id
    AND kind = 'btw_quarter'
    AND starts_on = v_start;

  RETURN v_row;
END;
$$;

COMMIT;
