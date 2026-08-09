-- Comprehensive forward repair for schema drift on workspace_workflow_rules.
-- Root cause: 20260609170000_business_os_spine.sql used CREATE TABLE IF NOT EXISTS,
-- so pre-existing tables kept their old shape instead of receiving the canonical columns.

ALTER TABLE public.workspace_workflow_rules
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS trigger_key text,
  ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS condition_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_json jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.workspace_workflow_rules
SET
  id = COALESCE(id, gen_random_uuid()),
  name = COALESCE(NULLIF(btrim(name), ''), 'Untitled workflow rule'),
  trigger_key = COALESCE(NULLIF(btrim(trigger_key), ''), 'manual.unclassified'),
  is_enabled = COALESCE(is_enabled, false),
  requires_approval = COALESCE(requires_approval, true),
  condition_json = COALESCE(condition_json, '{}'::jsonb),
  action_json = COALESCE(action_json, '{}'::jsonb),
  metadata = COALESCE(metadata, '{}'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.workspace_workflow_rules
    WHERE workspace_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot repair public.workspace_workflow_rules: workspace_id contains null rows; workspace-scoped backfill is required before enforcing the canonical contract.';
  END IF;
END $$;

ALTER TABLE public.workspace_workflow_rules
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN workspace_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN trigger_key SET NOT NULL,
  ALTER COLUMN is_enabled SET DEFAULT false,
  ALTER COLUMN is_enabled SET NOT NULL,
  ALTER COLUMN requires_approval SET DEFAULT true,
  ALTER COLUMN requires_approval SET NOT NULL,
  ALTER COLUMN condition_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN condition_json SET NOT NULL,
  ALTER COLUMN action_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN action_json SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.workspace_workflow_rules'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.workspace_workflow_rules
      ADD CONSTRAINT workspace_workflow_rules_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.workspace_workflow_rules'::regclass
      AND conname = 'workspace_workflow_rules_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_workflow_rules
      ADD CONSTRAINT workspace_workflow_rules_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.workspace_workflow_rules'::regclass
      AND conname = 'workspace_workflow_rules_created_by_fkey'
  ) THEN
    ALTER TABLE public.workspace_workflow_rules
      ADD CONSTRAINT workspace_workflow_rules_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS workspace_workflow_rules_workspace_idx
  ON public.workspace_workflow_rules (workspace_id, is_enabled, trigger_key);

DO $$
BEGIN
  IF to_regprocedure('public.handle_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS set_updated_at_workspace_workflow_rules ON public.workspace_workflow_rules;
    CREATE TRIGGER set_updated_at_workspace_workflow_rules BEFORE UPDATE ON public.workspace_workflow_rules
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.workspace_workflow_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_workflow_rules'
      AND policyname = 'workspace_workflow_rules_select'
  ) THEN
    CREATE POLICY workspace_workflow_rules_select ON public.workspace_workflow_rules
      FOR SELECT USING (public.can_access_workspace(workspace_id, 'workflow.read'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_workflow_rules'
      AND policyname = 'workspace_workflow_rules_insert'
  ) THEN
    CREATE POLICY workspace_workflow_rules_insert ON public.workspace_workflow_rules
      FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'workflow.manage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_workflow_rules'
      AND policyname = 'workspace_workflow_rules_update'
  ) THEN
    CREATE POLICY workspace_workflow_rules_update ON public.workspace_workflow_rules
      FOR UPDATE USING (public.can_access_workspace(workspace_id, 'workflow.manage'))
      WITH CHECK (public.can_access_workspace(workspace_id, 'workflow.manage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_workflow_rules'
      AND policyname = 'workspace_workflow_rules_delete'
  ) THEN
    CREATE POLICY workspace_workflow_rules_delete ON public.workspace_workflow_rules
      FOR DELETE USING (public.can_access_workspace(workspace_id, 'workflow.manage'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
