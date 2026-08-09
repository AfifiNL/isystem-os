-- Legal Vault — evidence-grade SES signing foundation.
-- Universal feature → lives on core/client source of truth (no fork header).

BEGIN;

ALTER TABLE public.legal_agreements
  ADD COLUMN IF NOT EXISTS public_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_token_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_level text NOT NULL DEFAULT 'eidas_ses'
    CHECK (signature_level IN ('eidas_ses', 'eidas_ses_otp', 'eidas_aes_external', 'eidas_qes_external')),
  ADD COLUMN IF NOT EXISTS evidence_bundle_id uuid;

ALTER TABLE public.legal_signature_events
  ADD COLUMN IF NOT EXISTS sequence_number integer,
  ADD COLUMN IF NOT EXISTS auth_method text,
  ADD COLUMN IF NOT EXISTS auth_provider text,
  ADD COLUMN IF NOT EXISTS auth_reference text,
  ADD COLUMN IF NOT EXISTS previous_event_hash text,
  ADD COLUMN IF NOT EXISTS event_hash text,
  ADD COLUMN IF NOT EXISTS evidence_snapshot_id uuid;

CREATE INDEX IF NOT EXISTS idx_legal_signature_events_sequence
  ON public.legal_signature_events (agreement_id, sequence_number);

CREATE TABLE IF NOT EXISTS public.legal_signing_challenges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agreement_id      uuid NOT NULL REFERENCES public.legal_agreements(id) ON DELETE CASCADE,
  public_token      text NOT NULL,
  signer_email      text NOT NULL,
  challenge_hash    text NOT NULL,
  sent_email_id     text,
  attempts          integer NOT NULL DEFAULT 0,
  verified_at       timestamptz,
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_signing_challenges_agreement
  ON public.legal_signing_challenges (agreement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_signing_challenges_token
  ON public.legal_signing_challenges (public_token, signer_email, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.legal_evidence_bundles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agreement_id         uuid NOT NULL REFERENCES public.legal_agreements(id) ON DELETE CASCADE,
  document_id          uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  bundle_document_id   uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  bundle_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  sha256               text NOT NULL,
  signature_level      text NOT NULL DEFAULT 'eidas_ses_otp',
  timestamp_provider   text NOT NULL DEFAULT 'local_server_clock',
  timestamp_token      text,
  generated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_evidence_bundles_agreement
  ON public.legal_evidence_bundles (agreement_id, generated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_agreements_evidence_bundle_id_fkey'
  ) THEN
    ALTER TABLE public.legal_agreements
      ADD CONSTRAINT legal_agreements_evidence_bundle_id_fkey
      FOREIGN KEY (evidence_bundle_id)
      REFERENCES public.legal_evidence_bundles(id) ON DELETE SET NULL;
  END IF;
END$$;

ALTER TABLE public.legal_signing_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_evidence_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_evidence_bundles_select ON public.legal_evidence_bundles;
CREATE POLICY legal_evidence_bundles_select ON public.legal_evidence_bundles
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
-- Evidence bundle writes use service-role only.

DROP POLICY IF EXISTS legal_signing_challenges_select ON public.legal_signing_challenges;
-- Signing challenge rows are service-role only; no end-user SELECT/INSERT/UPDATE/DELETE policies.

COMMIT;
