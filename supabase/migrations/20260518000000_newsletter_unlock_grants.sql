-- Newsletter-unlock grants — gives a subscribed visitor extra free-tool
-- runs beyond the strict 1-per-day IP cap.
--
-- Why this exists:
--
-- The free-tools surface has a hard 1-use-per-tool-per-IP-per-UTC-day cap
-- (`tool_rate_limits`). Honest users who genuinely need a second run are
-- stuck for 24h. Marketing wants to convert that friction into a
-- newsletter signup: "subscribe and we'll give you 3 more runs of this
-- tool right now."
--
-- Design:
--
-- - `newsletter_unlock_grants`: one row per (visitor, subscription event).
--   The `unlock_token` is a random opaque string stored in an HttpOnly
--   cookie. We don't trust the cookie to carry use counters — those live
--   in `newsletter_unlock_consumptions`, server-authoritative.
-- - `newsletter_unlock_consumptions`: append-only log; one row per
--   consumed tool run. "Uses remaining for tool X" =
--   `per_tool_cap - count(consumptions where grant_id=G and tool=X)`.
-- - RPC `newsletter_unlock_consume` is the atomic check-and-insert. It
--   returns the post-consumption remaining count so the API layer can
--   communicate that to the client without a second query.
-- - Expiry is enforced by the RPC, not the cookie — a stolen cookie past
--   expiry still cannot consume. Cleanup of expired grants can run later
--   (no urgency; small rows, indexed by expiry).

CREATE TABLE IF NOT EXISTS public.newsletter_unlock_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unlock_token text NOT NULL UNIQUE,
    email_normalized text NOT NULL,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    source text NOT NULL DEFAULT 'tool_modal',
    granted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CONSTRAINT newsletter_unlock_grants_token_length CHECK (length(unlock_token) >= 24 AND length(unlock_token) <= 128),
    CONSTRAINT newsletter_unlock_grants_expiry_future CHECK (expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS newsletter_unlock_grants_expires_idx
    ON public.newsletter_unlock_grants (expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS newsletter_unlock_grants_email_idx
    ON public.newsletter_unlock_grants (email_normalized, workspace_id);

CREATE TABLE IF NOT EXISTS public.newsletter_unlock_consumptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id uuid NOT NULL REFERENCES public.newsletter_unlock_grants(id) ON DELETE CASCADE,
    tool text NOT NULL,
    consumed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS newsletter_unlock_consumptions_grant_tool_idx
    ON public.newsletter_unlock_consumptions (grant_id, tool);

ALTER TABLE public.newsletter_unlock_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_unlock_consumptions ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT policies for client roles — these tables are only
-- accessed via the service role + the RPC below. Locking them down keeps
-- a leaked anon key from enumerating grants.

-- ─── atomic consume ────────────────────────────────────────────────────────
--
-- Returns: { allowed boolean, uses_remaining integer, reason text }
--
-- "allowed" = true → consumption row was inserted, the caller may proceed
-- and the returned `uses_remaining` reflects the post-consume state.
--
-- "allowed" = false → no row inserted. `reason` is one of:
--   'unknown_token', 'revoked', 'expired', 'cap_reached'.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'newsletter_unlock_consume_result') THEN
        CREATE TYPE public.newsletter_unlock_consume_result AS (
            allowed boolean,
            uses_remaining integer,
            reason text
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.newsletter_unlock_consume(
    p_token text,
    p_tool text,
    p_per_tool_cap integer
) RETURNS public.newsletter_unlock_consume_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grant_id uuid;
    v_expires_at timestamptz;
    v_revoked_at timestamptz;
    v_used_so_far integer;
    v_result public.newsletter_unlock_consume_result;
BEGIN
    SELECT id, expires_at, revoked_at
        INTO v_grant_id, v_expires_at, v_revoked_at
        FROM public.newsletter_unlock_grants
        WHERE unlock_token = p_token
        LIMIT 1;

    IF v_grant_id IS NULL THEN
        v_result := ROW(false, 0, 'unknown_token');
        RETURN v_result;
    END IF;

    IF v_revoked_at IS NOT NULL THEN
        v_result := ROW(false, 0, 'revoked');
        RETURN v_result;
    END IF;

    IF v_expires_at <= now() THEN
        v_result := ROW(false, 0, 'expired');
        RETURN v_result;
    END IF;

    -- Lock the grant row for the duration of the count + insert so two
    -- parallel requests can't both squeeze past the per-tool cap.
    PERFORM 1 FROM public.newsletter_unlock_grants WHERE id = v_grant_id FOR UPDATE;

    SELECT count(*)::int
        INTO v_used_so_far
        FROM public.newsletter_unlock_consumptions
        WHERE grant_id = v_grant_id AND tool = p_tool;

    IF v_used_so_far >= p_per_tool_cap THEN
        v_result := ROW(false, 0, 'cap_reached');
        RETURN v_result;
    END IF;

    INSERT INTO public.newsletter_unlock_consumptions (grant_id, tool)
    VALUES (v_grant_id, p_tool);

    v_result := ROW(true, p_per_tool_cap - (v_used_so_far + 1), null);
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.newsletter_unlock_consume(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.newsletter_unlock_consume(text, text, integer) TO service_role;

-- ─── peek (no consume) ─────────────────────────────────────────────────────
-- Used for the "you have N runs left" UI hint. Reads only; cheap.

CREATE OR REPLACE FUNCTION public.newsletter_unlock_remaining(
    p_token text,
    p_tool text,
    p_per_tool_cap integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grant_id uuid;
    v_expires_at timestamptz;
    v_revoked_at timestamptz;
    v_used_so_far integer;
BEGIN
    SELECT id, expires_at, revoked_at
        INTO v_grant_id, v_expires_at, v_revoked_at
        FROM public.newsletter_unlock_grants
        WHERE unlock_token = p_token
        LIMIT 1;

    IF v_grant_id IS NULL OR v_revoked_at IS NOT NULL OR v_expires_at <= now() THEN
        RETURN 0;
    END IF;

    SELECT count(*)::int
        INTO v_used_so_far
        FROM public.newsletter_unlock_consumptions
        WHERE grant_id = v_grant_id AND tool = p_tool;

    RETURN GREATEST(0, p_per_tool_cap - v_used_so_far);
END;
$$;

REVOKE ALL ON FUNCTION public.newsletter_unlock_remaining(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.newsletter_unlock_remaining(text, text, integer) TO service_role;
