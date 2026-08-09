-- Legal Vault — audit ledger and policy-driven retention foundation.
-- Universal feature → lives on core/client source of truth (no fork header).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Retention policies
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.legal_retention_policies (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug                   text NOT NULL,
  name                   text NOT NULL,
  description            text,
  retention_years        integer CHECK (retention_years IS NULL OR retention_years >= 0),
  retention_anchor       text NOT NULL DEFAULT 'document_date'
                         CHECK (retention_anchor IN ('document_date', 'created_at', 'contract_end', 'legal_hold')),
  applies_to_kinds       public.legal_document_kind[] NOT NULL DEFAULT ARRAY[]::public.legal_document_kind[],
  is_legal_hold          boolean NOT NULL DEFAULT false,
  is_default             boolean NOT NULL DEFAULT false,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_legal_retention_policy_slug_per_workspace
  ON public.legal_retention_policies (COALESCE(workspace_id::text, 'system'), slug);

CREATE INDEX IF NOT EXISTS idx_legal_retention_policies_workspace
  ON public.legal_retention_policies (workspace_id, is_default, created_at DESC);

INSERT INTO public.legal_retention_policies (
  workspace_id,
  slug,
  name,
  description,
  retention_years,
  retention_anchor,
  applies_to_kinds,
  is_legal_hold,
  is_default,
  metadata
)
VALUES
  (
    NULL,
    'nl-fiscal-7y',
    'NL fiscal administration — 7 years',
    'Default Belastingdienst bewaarplicht for fiscal administration, invoices, receipts, agreements, correspondence, and bookkeeping exports.',
    7,
    'document_date',
    ARRAY['agreement','invoice','receipt','accounting_export','correspondence','other']::public.legal_document_kind[],
    false,
    true,
    jsonb_build_object('jurisdiction', 'NL', 'source', 'Belastingdienst', 'compliance_area', 'fiscal_retention')
  ),
  (
    NULL,
    'nl-real-estate-10y',
    'NL immovable-property records — 10 years',
    'Belastingdienst retention policy for records involving immovable property or rights over immovable property.',
    10,
    'document_date',
    ARRAY['agreement','invoice','receipt','correspondence','other']::public.legal_document_kind[],
    false,
    false,
    jsonb_build_object('jurisdiction', 'NL', 'source', 'Belastingdienst', 'compliance_area', 'real_estate_retention')
  ),
  (
    NULL,
    'nl-contract-active-plus-7y',
    'NL active contract plus 7 years',
    'Policy for long-running contracts where the seven-year retention counter starts after contract end/current value expiry.',
    7,
    'contract_end',
    ARRAY['agreement','correspondence','other']::public.legal_document_kind[],
    false,
    false,
    jsonb_build_object('jurisdiction', 'NL', 'source', 'Belastingdienst', 'compliance_area', 'active_contract_retention')
  ),
  (
    NULL,
    'legal-hold-indefinite',
    'Legal hold — indefinite',
    'Preserve records indefinitely while a dispute, investigation, or regulatory hold is active.',
    NULL,
    'legal_hold',
    ARRAY['agreement','invoice','receipt','accounting_export','identity','correspondence','other']::public.legal_document_kind[],
    true,
    false,
    jsonb_build_object('compliance_area', 'legal_hold')
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Document metadata extensions
-- ---------------------------------------------------------------------------

ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS retention_policy_id uuid REFERENCES public.legal_retention_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'upload'
    CHECK (source_channel IN ('upload', 'email', 'generated', 'api', 'import', 'signature', 'export', 'other')),
  ADD COLUMN IF NOT EXISTS source_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_original_source boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_classification text NOT NULL DEFAULT 'confidential'
    CHECK (data_classification IN ('public', 'internal', 'confidential', 'sensitive_personal', 'special_category')),
  ADD COLUMN IF NOT EXISTS legal_hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS legal_hold_reason text,
  ADD COLUMN IF NOT EXISTS verified_sha256_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS restored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_legal_documents_retention_policy
  ON public.legal_documents (retention_policy_id);

CREATE INDEX IF NOT EXISTS idx_legal_documents_classification
  ON public.legal_documents (workspace_id, data_classification, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_documents_legal_hold
  ON public.legal_documents (workspace_id, legal_hold_until)
  WHERE legal_hold_until IS NOT NULL;

UPDATE public.legal_documents d
SET retention_policy_id = p.id
FROM public.legal_retention_policies p
WHERE d.retention_policy_id IS NULL
  AND p.workspace_id IS NULL
  AND p.slug = 'nl-fiscal-7y';

-- ---------------------------------------------------------------------------
-- 3. Generic append-only Legal Vault audit ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.legal_audit_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email           text,
  actor_role            text,
  event                 text NOT NULL,
  resource_type         text NOT NULL,
  resource_id           uuid,
  actor_ip              inet,
  actor_user_agent      text,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_event_hash   text,
  event_hash            text NOT NULL,
  occurred_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_audit_events_workspace_time
  ON public.legal_audit_events (workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_audit_events_resource
  ON public.legal_audit_events (workspace_id, resource_type, resource_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_audit_events_actor
  ON public.legal_audit_events (workspace_id, actor_user_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Trigger coverage and RLS
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tg_legal_retention_policies_updated_at ON public.legal_retention_policies;
CREATE TRIGGER tg_legal_retention_policies_updated_at
BEFORE UPDATE ON public.legal_retention_policies
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at();

ALTER TABLE public.legal_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_retention_policies_select ON public.legal_retention_policies;
DROP POLICY IF EXISTS legal_retention_policies_insert ON public.legal_retention_policies;
DROP POLICY IF EXISTS legal_retention_policies_update ON public.legal_retention_policies;
DROP POLICY IF EXISTS legal_retention_policies_delete ON public.legal_retention_policies;

CREATE POLICY legal_retention_policies_select ON public.legal_retention_policies
  FOR SELECT USING (
    workspace_id IS NULL
    OR public.can_access_workspace(workspace_id, 'legal.read')
  );
CREATE POLICY legal_retention_policies_insert ON public.legal_retention_policies
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  );
CREATE POLICY legal_retention_policies_update ON public.legal_retention_policies
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  );
CREATE POLICY legal_retention_policies_delete ON public.legal_retention_policies
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND public.can_access_workspace(workspace_id, 'legal.manage')
  );

DROP POLICY IF EXISTS legal_audit_events_select ON public.legal_audit_events;
CREATE POLICY legal_audit_events_select ON public.legal_audit_events
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
-- No INSERT/UPDATE/DELETE policies: audit writes use service-role only.

COMMIT;
