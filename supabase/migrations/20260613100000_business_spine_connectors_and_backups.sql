-- Business OS Connectors & Backups Schema (Roadmap positioning)
-- Lives on core/client source of truth

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_connector_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider text NOT NULL,
    credential_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, provider)
);

CREATE TABLE IF NOT EXISTS public.workspace_backup_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider text NOT NULL,
    target_uri text NOT NULL,
    schedule_cron text NOT NULL,
    retention_days integer NOT NULL DEFAULT 30,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_backup_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    schedule_id uuid REFERENCES public.workspace_backup_schedules(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'running',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    byte_size bigint,
    archive_uri text,
    error_message text
);

ALTER TABLE public.workspace_connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_connector_credentials_select ON public.workspace_connector_credentials
    FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_connector_credentials_service_role ON public.workspace_connector_credentials
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workspace_backup_schedules_select ON public.workspace_backup_schedules
    FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_backup_schedules_service_role ON public.workspace_backup_schedules
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workspace_backup_runs_select ON public.workspace_backup_runs
    FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_backup_runs_service_role ON public.workspace_backup_runs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
