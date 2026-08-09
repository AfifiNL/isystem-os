CREATE UNIQUE INDEX IF NOT EXISTS manager_assignments_active_workspace_manager_idx
  ON public.manager_assignments (workspace_id, manager_profile_id)
  WHERE is_active = true AND ends_at IS NULL;

DROP INDEX IF EXISTS public.manager_assignments_single_active_per_manager_idx;
