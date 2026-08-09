-- AI Credit System
-- Adds monetary credit ledger for Gemini-backed AI features, separate from the
-- existing compute_credits column (which remains bound to video render jobs).
--
-- Unit: "millicents" = 1/10,000 of EUR 1. BIGINT for headroom.
-- Ledger is the source of truth; workspaces.ai_balance_millicents is a
-- trigger-maintained cache so reads stay fast and cannot drift.
--
-- Platform fee: 7% above Google base cost. Named "platform_fee_*" system-wide
-- so DB columns, admin UI, and service agreement use the same term.

-- ─── 1. Balance column on workspaces ─────────────────────────────────────────

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS ai_balance_millicents BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.workspaces.ai_balance_millicents IS
  'AI credit balance in millicents (1/10,000 EUR). Maintained by trigger on ai_credit_ledger. May go negative if a Google call overruns the last pre-check; admin tops up to recover.';

-- ─── 2. Usage events (one row per metered AI operation) ─────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  route                       TEXT NOT NULL,
  model                       TEXT NOT NULL,
  unit_type                   TEXT NOT NULL CHECK (unit_type IN ('tokens', 'image', 'tts_char')),
  tokens_in                   INTEGER,
  tokens_out                  INTEGER,
  image_count                 INTEGER,
  char_count                  INTEGER,
  base_cost_millicents        BIGINT NOT NULL CHECK (base_cost_millicents >= 0),
  platform_fee_millicents     BIGINT NOT NULL CHECK (platform_fee_millicents >= 0),
  charged_millicents          BIGINT NOT NULL CHECK (charged_millicents >= 0),
  status                      TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('succeeded', 'failed', 'partial')),
  metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_workspace_created
  ON public.ai_usage_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_route
  ON public.ai_usage_events (route);

COMMENT ON TABLE public.ai_usage_events IS 'Audit trail of every metered Gemini call. One row per LLM/image/TTS invocation.';

-- ─── 3. Credit ledger (append-only; single source of balance truth) ──────────

CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  delta_millicents  BIGINT NOT NULL,  -- positive = top-up, negative = spend/adjustment
  reason            TEXT NOT NULL CHECK (reason IN ('manual_topup', 'ai_usage', 'refund', 'adjustment')),
  actor_profile_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_event_id    UUID REFERENCES public.ai_usage_events(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_workspace_created
  ON public.ai_credit_ledger (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_credit_ledger_reason
  ON public.ai_credit_ledger (reason);

COMMENT ON TABLE public.ai_credit_ledger IS 'Append-only ledger of credit movements. Trigger apply_ai_credit_ledger keeps workspaces.ai_balance_millicents in sync.';

-- ─── 4. Trigger: ledger insert updates cached balance ────────────────────────

CREATE OR REPLACE FUNCTION public.apply_ai_credit_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.workspaces
     SET ai_balance_millicents = ai_balance_millicents + NEW.delta_millicents
   WHERE id = NEW.workspace_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_ai_credit_ledger ON public.ai_credit_ledger;
CREATE TRIGGER trg_apply_ai_credit_ledger
  AFTER INSERT ON public.ai_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_ai_credit_ledger();

-- ─── 5. Atomic usage-metering RPC ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.charge_ai_usage(
  p_workspace_id              UUID,
  p_profile_id                UUID,
  p_route                     TEXT,
  p_model                     TEXT,
  p_unit_type                 TEXT,
  p_tokens_in                 INTEGER,
  p_tokens_out                INTEGER,
  p_image_count               INTEGER,
  p_char_count                INTEGER,
  p_base_cost_millicents      BIGINT,
  p_platform_fee_millicents   BIGINT,
  p_status                    TEXT,
  p_metadata                  JSONB
)
RETURNS public.ai_usage_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event     public.ai_usage_events;
  v_charged   BIGINT;
BEGIN
  v_charged := COALESCE(p_base_cost_millicents, 0) + COALESCE(p_platform_fee_millicents, 0);

  INSERT INTO public.ai_usage_events (
    workspace_id, profile_id, route, model, unit_type,
    tokens_in, tokens_out, image_count, char_count,
    base_cost_millicents, platform_fee_millicents, charged_millicents,
    status, metadata
  ) VALUES (
    p_workspace_id, p_profile_id, p_route, p_model, p_unit_type,
    p_tokens_in, p_tokens_out, p_image_count, p_char_count,
    p_base_cost_millicents, p_platform_fee_millicents, v_charged,
    COALESCE(p_status, 'succeeded'), COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_event;

  INSERT INTO public.ai_credit_ledger (
    workspace_id, delta_millicents, reason, actor_profile_id, usage_event_id
  ) VALUES (
    p_workspace_id, -v_charged, 'ai_usage', p_profile_id, v_event.id
  );

  RETURN v_event;
END;
$$;

-- ─── 6. Credit-grant RPC (admin top-ups and adjustments) ─────────────────────

CREATE OR REPLACE FUNCTION public.grant_ai_credits(
  p_workspace_id      UUID,
  p_delta_millicents  BIGINT,
  p_reason            TEXT,
  p_notes             TEXT
)
RETURNS public.ai_credit_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row     public.ai_credit_ledger;
  v_actor   UUID;
BEGIN
  IF p_reason NOT IN ('manual_topup', 'refund', 'adjustment') THEN
    RAISE EXCEPTION 'grant_ai_credits: reason must be one of manual_topup, refund, adjustment';
  END IF;

  v_actor := auth.uid();

  INSERT INTO public.ai_credit_ledger (
    workspace_id, delta_millicents, reason, actor_profile_id, notes
  ) VALUES (
    p_workspace_id, p_delta_millicents, p_reason, v_actor, p_notes
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ─── 7. Rate-limit log (replaces in-memory Map-based limiter) ────────────────

CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  route         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_request_log_ws_route_created
  ON public.ai_request_log (workspace_id, route, created_at DESC);

COMMENT ON TABLE public.ai_request_log IS 'Sliding-window rate-limit log. Cleanup: rows older than 1 hour via cron or on-insert pruning.';

CREATE OR REPLACE FUNCTION public.count_recent_ai_requests(
  p_workspace_id UUID,
  p_route        TEXT,
  p_window_secs  INTEGER DEFAULT 60
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.ai_request_log
   WHERE workspace_id = p_workspace_id
     AND route = p_route
     AND created_at > now() - make_interval(secs => p_window_secs);
$$;

CREATE OR REPLACE FUNCTION public.record_ai_request(
  p_workspace_id UUID,
  p_route        TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.ai_request_log (workspace_id, route)
       VALUES (p_workspace_id, p_route);
$$;

-- Opportunistic pruning: every 500th insert (avg), clean up stale rows.
CREATE OR REPLACE FUNCTION public.prune_ai_request_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (random() * 500)::INTEGER = 0 THEN
    DELETE FROM public.ai_request_log
          WHERE created_at < now() - interval '1 hour';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_ai_request_log ON public.ai_request_log;
CREATE TRIGGER trg_prune_ai_request_log
  AFTER INSERT ON public.ai_request_log
  FOR EACH ROW EXECUTE FUNCTION public.prune_ai_request_log();

-- ─── 8. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_credit_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_request_log    ENABLE ROW LEVEL SECURITY;

-- Members (manager/admin) of the workspace can read their own ledger + usage.
-- All writes go through SECURITY DEFINER RPCs; no direct INSERT/UPDATE/DELETE policies.

DROP POLICY IF EXISTS "ai_credit_ledger_select_workspace_members" ON public.ai_credit_ledger;
CREATE POLICY "ai_credit_ledger_select_workspace_members"
  ON public.ai_credit_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.workspace_id = ai_credit_ledger.workspace_id
        AND ma.manager_profile_id = auth.uid()
        AND ma.is_active = true
        AND ma.ends_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "ai_usage_events_select_workspace_members" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_select_workspace_members"
  ON public.ai_usage_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.workspace_id = ai_usage_events.workspace_id
        AND ma.manager_profile_id = auth.uid()
        AND ma.is_active = true
        AND ma.ends_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ai_request_log is service-only (no SELECT policy = no access for anon/authenticated)

-- ─── 9. Grants on RPCs ──────────────────────────────────────────────────────
-- charge_ai_usage, count_recent_ai_requests, record_ai_request: server-side
-- only. Called from API routes with the Supabase service role key. We REVOKE
-- from authenticated/anon (defense in depth), then GRANT EXECUTE to service_role
-- explicitly — Supabase treats that role as the service-role-key identity.
--
-- grant_ai_credits: called from the admin server action with the user's
-- session client. Admin check happens in TypeScript before invocation.

REVOKE ALL ON FUNCTION public.charge_ai_usage FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_ai_usage TO service_role;

REVOKE ALL ON FUNCTION public.grant_ai_credits FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_ai_credits TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.count_recent_ai_requests FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_recent_ai_requests TO service_role;

REVOKE ALL ON FUNCTION public.record_ai_request FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_request TO service_role;
