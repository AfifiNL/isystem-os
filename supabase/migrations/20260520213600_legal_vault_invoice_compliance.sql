-- Legal Vault — Dutch invoice and bookkeeping compliance foundation.
-- Universal feature → lives on core/client source of truth (no fork header).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_invoice_status') THEN
    CREATE TYPE public.legal_invoice_status AS ENUM ('draft', 'finalized', 'sent', 'paid', 'void', 'credited');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.legal_invoice_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  legal_name            text NOT NULL,
  trade_name            text,
  address_line1         text NOT NULL,
  address_line2         text,
  postal_code           text NOT NULL,
  city                  text NOT NULL,
  country_code          text NOT NULL DEFAULT 'NL',
  kvk_number            text NOT NULL,
  btw_id                text,
  iban                  text,
  bic                   text,
  invoice_email         text,
  default_payment_terms_days integer NOT NULL DEFAULT 14,
  kor_enabled           boolean NOT NULL DEFAULT false,
  default_btw_rate_bp   integer NOT NULL DEFAULT 2100,
  peppol_participant_id text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (workspace_id)
);

CREATE TABLE IF NOT EXISTS public.legal_invoice_sequences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  prefix         text NOT NULL,
  year           integer NOT NULL,
  next_number    integer NOT NULL DEFAULT 1 CHECK (next_number > 0),
  locked_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, prefix, year)
);

CREATE TABLE IF NOT EXISTS public.legal_invoices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id              uuid REFERENCES public.legal_invoice_profiles(id) ON DELETE SET NULL,
  sequence_id             uuid REFERENCES public.legal_invoice_sequences(id) ON DELETE SET NULL,
  invoice_number          text,
  status                  public.legal_invoice_status NOT NULL DEFAULT 'draft',
  issue_date              date NOT NULL DEFAULT current_date,
  supply_date             date,
  due_date                date,
  client_id               uuid REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  client_name             text NOT NULL,
  client_address          text,
  client_country_code     text NOT NULL DEFAULT 'NL',
  client_btw_id           text,
  client_peppol_id        text,
  purchase_order_reference text,
  oin                     text,
  currency                text NOT NULL DEFAULT 'EUR',
  kor_enabled             boolean NOT NULL DEFAULT false,
  reverse_charge          boolean NOT NULL DEFAULT false,
  reverse_charge_reason   text,
  subtotal_cents          bigint NOT NULL DEFAULT 0,
  btw_total_cents         bigint NOT NULL DEFAULT 0,
  total_cents             bigint NOT NULL DEFAULT 0,
  related_agreement_id    uuid REFERENCES public.legal_agreements(id) ON DELETE SET NULL,
  document_id             uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  accounting_entry_id     uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  finalized_at            timestamptz,
  finalized_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_legal_invoices_workspace_status
  ON public.legal_invoices (workspace_id, status, issue_date DESC);

CREATE TABLE IF NOT EXISTS public.legal_invoice_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id          uuid NOT NULL REFERENCES public.legal_invoices(id) ON DELETE CASCADE,
  description         text NOT NULL,
  quantity            numeric(12, 3) NOT NULL DEFAULT 1,
  unit_price_cents    bigint NOT NULL,
  discount_cents      bigint NOT NULL DEFAULT 0,
  btw_rate_bp         integer NOT NULL CHECK (btw_rate_bp >= 0 AND btw_rate_bp <= 10000),
  btw_reason_code     text,
  line_subtotal_cents bigint NOT NULL,
  line_btw_cents      bigint NOT NULL,
  line_total_cents    bigint NOT NULL,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_invoice_lines_invoice
  ON public.legal_invoice_lines (invoice_id, sort_order);

DROP TRIGGER IF EXISTS tg_legal_invoice_profiles_updated_at ON public.legal_invoice_profiles;
CREATE TRIGGER tg_legal_invoice_profiles_updated_at
BEFORE UPDATE ON public.legal_invoice_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at();

DROP TRIGGER IF EXISTS tg_legal_invoice_sequences_updated_at ON public.legal_invoice_sequences;
CREATE TRIGGER tg_legal_invoice_sequences_updated_at
BEFORE UPDATE ON public.legal_invoice_sequences
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at();

DROP TRIGGER IF EXISTS tg_legal_invoices_updated_at ON public.legal_invoices;
CREATE TRIGGER tg_legal_invoices_updated_at
BEFORE UPDATE ON public.legal_invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at();

ALTER TABLE public.legal_invoice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_invoice_profiles_select ON public.legal_invoice_profiles
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY legal_invoice_profiles_insert ON public.legal_invoice_profiles
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY legal_invoice_profiles_update ON public.legal_invoice_profiles
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));

CREATE POLICY legal_invoice_sequences_select ON public.legal_invoice_sequences
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY legal_invoice_sequences_insert ON public.legal_invoice_sequences
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY legal_invoice_sequences_update ON public.legal_invoice_sequences
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));

CREATE POLICY legal_invoices_select ON public.legal_invoices
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY legal_invoices_insert ON public.legal_invoices
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY legal_invoices_update ON public.legal_invoices
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));

CREATE POLICY legal_invoice_lines_select ON public.legal_invoice_lines
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'bookkeeping.read'));
CREATE POLICY legal_invoice_lines_insert ON public.legal_invoice_lines
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY legal_invoice_lines_update ON public.legal_invoice_lines
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'bookkeeping.write'));
CREATE POLICY legal_invoice_lines_delete ON public.legal_invoice_lines
  FOR DELETE USING (public.can_access_workspace(workspace_id, 'bookkeeping.write'));

COMMIT;
