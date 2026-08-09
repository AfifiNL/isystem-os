--
-- Workspace popup management. Lets workspace admins/managers run timed or
-- exit-intent popups across all public pages, picking from a fixed set of
-- iSystem-styled templates. The schema is generic enough that the framework
-- (table + resolver + host + event endpoint + admin editor) can be lifted
-- into the master boilerplate later — only the four React templates in
-- src/features/popups/ui/templates/* are intentionally iSystem-specific.
--
-- New tables:
--   workspace_popups            - one row per popup configuration
--   workspace_popup_events      - append-only log of impressions / dismissals / conversions
--
-- visitor_id on events is sourced from localStorage on the client. It's the
-- right key for frequency-capping UX, but it must NOT be treated as
-- authoritative "this user saw it" — clearing storage resets it. Use it for
-- analytics aggregates only.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_popups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    -- Which predefined React template to render. Add new variants by extending
    -- this CHECK list and shipping the matching component in
    -- src/features/popups/ui/templates/.
    template_kind   text NOT NULL CHECK (template_kind IN (
        'newsletter-classic',
        'newsletter-minimal',
        'booking-promo',
        'booking-urgency'
    )),
    -- Trigger configuration. trigger_type is the discriminator; trigger_config
    -- holds type-specific knobs:
    --   exit_intent: {} (desktop only — the host component skips touch devices)
    --   timed:       { delay_ms: integer >= 500 }
    trigger_type    text NOT NULL CHECK (trigger_type IN ('exit_intent', 'timed')),
    trigger_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Localized content payload. Schema enforced by the zod layer in
    -- src/features/popups/schema.ts. Shape:
    --   { title: LocalizedText, body: LocalizedText, ctaLabel: LocalizedText,
    --     ctaHref: string, dismissLabel?: LocalizedText, eyebrow?: LocalizedText }
    content         jsonb NOT NULL,
    -- Audience filters (all optional). Path globs are matched AFTER stripping
    -- the locale prefix so "/blog/*" hits "/ar/blog/foo" too.
    --   { locales?: ('en'|'nl'|'ar')[],
    --     include_paths?: string[],   -- glob patterns (e.g. "/blog/*", "/")
    --     exclude_paths?: string[] }
    audience        jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Schedule window. Both timestamps are UTC; the admin UI converts to
    -- local for display. Either or both may be NULL ("always on" until
    -- explicitly disabled).
    starts_at       timestamptz,
    ends_at         timestamptz,
    -- Multi-popup conflict resolution. Higher priority wins when multiple
    -- popups match the same request. Ties broken by most-recently-updated.
    priority        integer NOT NULL DEFAULT 0,
    -- How long a dismissal suppresses re-display for the same visitor. Read
    -- by the client from localStorage; we don't enforce server-side because
    -- the dismissal log is best-effort and visitor_id is spoofable.
    dismissal_ttl_seconds integer NOT NULL DEFAULT 604800 CHECK (dismissal_ttl_seconds >= 0), -- 7 days
    is_active       boolean NOT NULL DEFAULT false,
    created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_popups_workspace_active_idx
    ON public.workspace_popups (workspace_id, is_active, priority DESC, updated_at DESC);

ALTER TABLE public.workspace_popups ENABLE ROW LEVEL SECURITY;

-- Public read of ACTIVE popups only — the (public) layout calls this with
-- the anon key during SSR. Inactive / scheduled-out rows stay invisible.
DROP POLICY IF EXISTS "workspace_popups_public_read_active" ON public.workspace_popups;
CREATE POLICY "workspace_popups_public_read_active"
    ON public.workspace_popups FOR SELECT
    USING (is_active = true);

-- Admin/manager writes. Membership is checked via the existing memberships
-- table (role 'admin' or 'manager') plus workspace ownership.
DROP POLICY IF EXISTS "workspace_popups_admin_all" ON public.workspace_popups;
CREATE POLICY "workspace_popups_admin_all"
    ON public.workspace_popups FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_popups.workspace_id
              AND (
                  w.owner_profile_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.workspace_memberships m
                      WHERE m.workspace_id = w.id
                        AND m.profile_id = auth.uid()
                        AND m.membership_role IN ('owner', 'admin', 'manager')
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_popups.workspace_id
              AND (
                  w.owner_profile_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.workspace_memberships m
                      WHERE m.workspace_id = w.id
                        AND m.profile_id = auth.uid()
                        AND m.membership_role IN ('owner', 'admin', 'manager')
                  )
              )
        )
    );

CREATE TABLE IF NOT EXISTS public.workspace_popup_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    popup_id        uuid NOT NULL REFERENCES public.workspace_popups(id) ON DELETE CASCADE,
    workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    -- impression: popup rendered to the user
    -- dismiss:    user closed it (X / backdrop / ESC)
    -- convert:    user clicked the primary CTA
    event_type      text NOT NULL CHECK (event_type IN ('impression', 'dismiss', 'convert')),
    visitor_id      text,        -- localStorage-derived; NOT trusted for auth
    session_id      text,
    locale          text CHECK (locale IS NULL OR locale IN ('en', 'nl', 'ar')),
    path            text,        -- already locale-stripped on client
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_popup_events_popup_idx
    ON public.workspace_popup_events (popup_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_popup_events_workspace_idx
    ON public.workspace_popup_events (workspace_id, created_at DESC);

ALTER TABLE public.workspace_popup_events ENABLE ROW LEVEL SECURITY;

-- Reads gated to workspace members (admin/manager only — events power the
-- analytics in the editor). Inserts go through /api/popups/event with the
-- service-role client, so we don't need a public INSERT policy.
DROP POLICY IF EXISTS "workspace_popup_events_member_read" ON public.workspace_popup_events;
CREATE POLICY "workspace_popup_events_member_read"
    ON public.workspace_popup_events FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_popup_events.workspace_id
              AND (
                  w.owner_profile_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.workspace_memberships m
                      WHERE m.workspace_id = w.id
                        AND m.profile_id = auth.uid()
                        AND m.membership_role IN ('owner', 'admin', 'manager')
                  )
              )
        )
    );

-- Updated-at touch trigger. Mirrors the pattern used elsewhere in this fork.
CREATE OR REPLACE FUNCTION public.touch_workspace_popups_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_popups_touch_updated_at ON public.workspace_popups;
CREATE TRIGGER workspace_popups_touch_updated_at
    BEFORE UPDATE ON public.workspace_popups
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_workspace_popups_updated_at();

COMMIT;
