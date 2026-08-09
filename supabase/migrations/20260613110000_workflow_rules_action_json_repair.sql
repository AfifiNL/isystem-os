-- Repair schema drift from an earlier Business OS Spine table.
-- The canonical schema in 20260609170000_business_os_spine.sql includes action_json,
-- but CREATE TABLE IF NOT EXISTS did not add it for databases where the table already existed.

ALTER TABLE public.workspace_workflow_rules
  ADD COLUMN IF NOT EXISTS action_json jsonb DEFAULT '{}'::jsonb;

UPDATE public.workspace_workflow_rules
SET action_json = '{}'::jsonb
WHERE action_json IS NULL;

ALTER TABLE public.workspace_workflow_rules
  ALTER COLUMN action_json SET DEFAULT '{}'::jsonb,
  ALTER COLUMN action_json SET NOT NULL;

NOTIFY pgrst, 'reload schema';
