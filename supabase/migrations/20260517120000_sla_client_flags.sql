-- Client portal SLA write path — `cleaning_schedule_notes` table.
--
-- Before this migration, portal clients could *see* their task status but had
-- no way to push information back the other direction. A cleaner who missed
-- the back office today, or a tenant who wants to flag that the lobby
-- coffee machine is broken, had to email or call the operator out-of-band.
-- That defeats half the value of the partner portal.
--
-- Design:
--
-- - Append-only log of notes per cleaning_schedule. No edits, no deletes —
--   if a manager wants to "resolve" a flag they post a follow-up note with
--   `is_resolution = true`. Audit trail is preserved.
-- - Two author kinds: 'portal_client' and 'workspace_manager'. The author's
--   profile_id is captured so we know which human posted it.
-- - `is_flag` distinguishes routine notes from actionable alerts. A flag
--   typically comes with the schedule being flipped to status='issue' in
--   the same transaction (handled in the server action, not the schema).
-- - workspace_id denormalized for RLS shortcut and inbox aggregation.

CREATE TABLE IF NOT EXISTS public.cleaning_schedule_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaning_schedule_id uuid NOT NULL REFERENCES public.cleaning_schedules(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    author_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_kind text NOT NULL CHECK (author_kind IN ('portal_client', 'workspace_manager')),
    body text NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 4000),
    is_flag boolean NOT NULL DEFAULT false,
    is_resolution boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cleaning_schedule_notes_resolution_only_by_manager
        CHECK (NOT is_resolution OR author_kind = 'workspace_manager')
);

CREATE INDEX IF NOT EXISTS cleaning_schedule_notes_schedule_id_idx
    ON public.cleaning_schedule_notes (cleaning_schedule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cleaning_schedule_notes_workspace_unresolved_idx
    ON public.cleaning_schedule_notes (workspace_id, created_at DESC)
    WHERE is_flag = true AND is_resolution = false;

ALTER TABLE public.cleaning_schedule_notes ENABLE ROW LEVEL SECURITY;

-- Portal clients can SELECT notes on their own schedules. Walked through
-- facility_locations → client_portal_users → auth.uid() to keep cross-tenant
-- isolation enforced at the database, not the application layer.
CREATE POLICY "Portal clients can view own notes"
    ON public.cleaning_schedule_notes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.cleaning_schedules cs
            JOIN public.facility_locations fl ON fl.id = cs.location_id
            JOIN public.client_portal_users cpu ON cpu.id = fl.client_id
            WHERE cs.id = cleaning_schedule_notes.cleaning_schedule_id
              AND cpu.profile_id = auth.uid()
        )
    );

-- Portal clients can INSERT a note on their own schedules. The CHECK enforces
-- that they cannot impersonate a manager (author_kind must be portal_client)
-- and cannot pretend to be resolving anything.
CREATE POLICY "Portal clients can add notes on own schedules"
    ON public.cleaning_schedule_notes
    FOR INSERT
    WITH CHECK (
        author_kind = 'portal_client'
        AND is_resolution = false
        AND EXISTS (
            SELECT 1
            FROM public.cleaning_schedules cs
            JOIN public.facility_locations fl ON fl.id = cs.location_id
            JOIN public.client_portal_users cpu ON cpu.id = fl.client_id
            WHERE cs.id = cleaning_schedule_notes.cleaning_schedule_id
              AND cpu.profile_id = auth.uid()
              AND cpu.workspace_id = cleaning_schedule_notes.workspace_id
        )
    );

-- Workspace admins/managers can do anything within their workspace.
CREATE POLICY "Workspace owners can manage notes"
    ON public.cleaning_schedule_notes
    FOR ALL
    USING (public.can_access_workspace(workspace_id))
    WITH CHECK (public.can_access_workspace(workspace_id));
