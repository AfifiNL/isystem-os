
BEGIN;

CREATE TABLE IF NOT EXISTS public.anti_abuse_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  surface text NOT NULL,
  source_path text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('allow', 'review', 'block', 'throttle')),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_fingerprint text,
  ip_hash text,
  email_hash text,
  user_agent text,
  booking_reservation_id uuid REFERENCES public.booking_reservations(id) ON DELETE SET NULL,
  portal_client_id uuid REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anti_abuse_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  surface text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('ip', 'email', 'fingerprint')),
  subject_value_hash text NOT NULL,
  action text NOT NULL CHECK (action IN ('cooldown', 'blacklist', 'review')),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anti_abuse_events_workspace_created_idx
  ON public.anti_abuse_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_events_surface_decision_idx
  ON public.anti_abuse_events (surface, decision, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_events_fingerprint_idx
  ON public.anti_abuse_events (request_fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_events_ip_hash_idx
  ON public.anti_abuse_events (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_events_email_hash_idx
  ON public.anti_abuse_events (email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_events_portal_client_idx
  ON public.anti_abuse_events (portal_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_events_booking_reservation_idx
  ON public.anti_abuse_events (booking_reservation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS anti_abuse_rules_subject_idx
  ON public.anti_abuse_rules (surface, subject_type, subject_value_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_rules_expires_idx
  ON public.anti_abuse_rules (expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS anti_abuse_rules_workspace_idx
  ON public.anti_abuse_rules (workspace_id, created_at DESC);

ALTER TABLE public.anti_abuse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_abuse_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anti_abuse_events_select_policy ON public.anti_abuse_events;
CREATE POLICY anti_abuse_events_select_policy
ON public.anti_abuse_events
FOR SELECT
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
);

DROP POLICY IF EXISTS anti_abuse_rules_select_policy ON public.anti_abuse_rules;
CREATE POLICY anti_abuse_rules_select_policy
ON public.anti_abuse_rules
FOR SELECT
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
);

DROP POLICY IF EXISTS anti_abuse_events_insert_policy ON public.anti_abuse_events;
CREATE POLICY anti_abuse_events_insert_policy
ON public.anti_abuse_events
FOR INSERT
WITH CHECK (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
);

DROP POLICY IF EXISTS anti_abuse_rules_manage_policy ON public.anti_abuse_rules;
CREATE POLICY anti_abuse_rules_manage_policy
ON public.anti_abuse_rules
FOR ALL
USING (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
)
WITH CHECK (
  workspace_id IS NOT NULL
  AND public.can_access_workspace(workspace_id, NULL)
);

COMMIT;
