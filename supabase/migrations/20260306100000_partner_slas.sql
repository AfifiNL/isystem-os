
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Client Portal Users — links auth profiles to a workspace for portal access
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.client_portal_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT client_portal_users_unique UNIQUE (workspace_id, profile_id)
);

ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can see their own portal record
CREATE POLICY "Portal users can view own record"
    ON public.client_portal_users
    FOR SELECT
    USING (profile_id = auth.uid());

-- Admins/owners can manage portal users via existing helper
CREATE POLICY "Workspace owners can manage portal users"
    ON public.client_portal_users
    FOR ALL
    USING (public.can_access_workspace(workspace_id))
    WITH CHECK (public.can_access_workspace(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Facility Locations — physical sites managed for a portal client
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.facility_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.client_portal_users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.facility_locations ENABLE ROW LEVEL SECURITY;

-- Portal clients can read locations linked to their profile via client_portal_users
CREATE POLICY "Portal clients can view own locations"
    ON public.facility_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.client_portal_users cpu
            WHERE cpu.id = facility_locations.client_id
              AND cpu.profile_id = auth.uid()
              AND cpu.workspace_id = facility_locations.workspace_id
        )
    );

-- Admins/owners can manage locations
CREATE POLICY "Workspace owners can manage locations"
    ON public.facility_locations
    FOR ALL
    USING (public.can_access_workspace(workspace_id))
    WITH CHECK (public.can_access_workspace(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Cleaning Schedules — per-location tasks with SLA status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.cleaning_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location_id UUID NOT NULL REFERENCES public.facility_locations(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    frequency TEXT,
    last_completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('compliant', 'pending', 'issue')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.cleaning_schedules ENABLE ROW LEVEL SECURITY;

-- Portal clients can read schedules for their locations
CREATE POLICY "Portal clients can view own schedules"
    ON public.cleaning_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.facility_locations fl
            JOIN public.client_portal_users cpu ON cpu.id = fl.client_id
            WHERE fl.id = cleaning_schedules.location_id
              AND cpu.profile_id = auth.uid()
        )
    );

-- Admins/owners can manage schedules (resolve workspace_id via location)
CREATE POLICY "Workspace owners can manage schedules"
    ON public.cleaning_schedules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.facility_locations fl
            WHERE fl.id = cleaning_schedules.location_id
              AND public.can_access_workspace(fl.workspace_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.facility_locations fl
            WHERE fl.id = cleaning_schedules.location_id
              AND public.can_access_workspace(fl.workspace_id)
        )
    );
