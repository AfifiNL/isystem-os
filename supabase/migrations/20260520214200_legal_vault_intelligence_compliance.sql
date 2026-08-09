-- Legal Vault — document intelligence, Wet DBA, AVG/DPA workflow foundation.
-- Universal feature → lives on core/client source of truth (no fork header).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_risk_severity') THEN
    CREATE TYPE public.legal_risk_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_review_state') THEN
    CREATE TYPE public.legal_review_state AS ENUM ('draft', 'needs_review', 'accepted', 'rejected', 'resolved');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.legal_document_texts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id           uuid NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  extracted_text        text NOT NULL,
  language              text NOT NULL DEFAULT 'nl',
  extraction_confidence numeric(5, 2),
  page_count            integer,
  extractor_version     text NOT NULL DEFAULT 'manual-v1',
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (document_id, extractor_version)
);

CREATE INDEX IF NOT EXISTS idx_legal_document_texts_workspace
  ON public.legal_document_texts (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_document_texts_search
  ON public.legal_document_texts USING gin (to_tsvector('simple', extracted_text));

CREATE TABLE IF NOT EXISTS public.legal_obligations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agreement_id      uuid REFERENCES public.legal_agreements(id) ON DELETE CASCADE,
  document_id       uuid REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  kind              text NOT NULL,
  title             text NOT NULL,
  description       text,
  due_on            date,
  notice_on         date,
  counterparty      text,
  source_quote      text,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_legal_obligations_workspace_due
  ON public.legal_obligations (workspace_id, status, due_on);

CREATE TABLE IF NOT EXISTS public.legal_risk_findings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agreement_id     uuid REFERENCES public.legal_agreements(id) ON DELETE CASCADE,
  document_id      uuid REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  category         text NOT NULL,
  severity         public.legal_risk_severity NOT NULL DEFAULT 'info',
  title            text NOT NULL,
  description      text NOT NULL,
  source_quote     text,
  page_number      integer,
  playbook_id      text,
  review_state     public.legal_review_state NOT NULL DEFAULT 'needs_review',
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_legal_risk_findings_workspace
  ON public.legal_risk_findings (workspace_id, review_state, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS public.legal_ai_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id     uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  agreement_id    uuid REFERENCES public.legal_agreements(id) ON DELETE SET NULL,
  route           text NOT NULL,
  model           text NOT NULL,
  prompt_version  text NOT NULL,
  input_sha256    text NOT NULL,
  output_sha256   text NOT NULL,
  review_state    public.legal_review_state NOT NULL DEFAULT 'needs_review',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_legal_ai_reviews_workspace
  ON public.legal_ai_reviews (workspace_id, review_state, created_at DESC);

CREATE TABLE IF NOT EXISTS public.legal_privacy_incidents (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title                         text NOT NULL,
  description                   text NOT NULL,
  detected_at                   timestamptz NOT NULL DEFAULT now(),
  assessed_at                   timestamptz,
  report_due_at                 timestamptz,
  ap_report_required            boolean,
  data_subject_notice_required  boolean,
  status                        text NOT NULL DEFAULT 'triage' CHECK (status IN ('triage', 'assessing', 'reported', 'contained', 'closed')),
  impacted_document_ids         uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  evidence                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by                    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_privacy_incidents_workspace
  ON public.legal_privacy_incidents (workspace_id, status, detected_at DESC);

DROP TRIGGER IF EXISTS tg_legal_obligations_updated_at ON public.legal_obligations;
CREATE TRIGGER tg_legal_obligations_updated_at
BEFORE UPDATE ON public.legal_obligations
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at();

DROP TRIGGER IF EXISTS tg_legal_privacy_incidents_updated_at ON public.legal_privacy_incidents;
CREATE TRIGGER tg_legal_privacy_incidents_updated_at
BEFORE UPDATE ON public.legal_privacy_incidents
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_vault_set_updated_at();

ALTER TABLE public.legal_document_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_risk_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_ai_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_privacy_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY legal_document_texts_select ON public.legal_document_texts
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_document_texts_insert ON public.legal_document_texts
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_document_texts_update ON public.legal_document_texts
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));

CREATE POLICY legal_obligations_select ON public.legal_obligations
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_obligations_insert ON public.legal_obligations
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_obligations_update ON public.legal_obligations
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));

CREATE POLICY legal_risk_findings_select ON public.legal_risk_findings
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_risk_findings_insert ON public.legal_risk_findings
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_risk_findings_update ON public.legal_risk_findings
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));

CREATE POLICY legal_ai_reviews_select ON public.legal_ai_reviews
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_ai_reviews_insert ON public.legal_ai_reviews
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_ai_reviews_update ON public.legal_ai_reviews
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));

CREATE POLICY legal_privacy_incidents_select ON public.legal_privacy_incidents
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'legal.read'));
CREATE POLICY legal_privacy_incidents_insert ON public.legal_privacy_incidents
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));
CREATE POLICY legal_privacy_incidents_update ON public.legal_privacy_incidents
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'legal.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'legal.write'));

COMMIT;
