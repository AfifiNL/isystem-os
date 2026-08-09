-- Restore production delivery paths whose PostgREST conflict and relationship
-- targets changed when tenant-bound composite keys replaced legacy relations.

-- PostgreSQL permits multiple NULL values in a normal unique index, so the
-- partial predicate is unnecessary. Removing it makes this index inferable by
-- PostgREST for ON CONFLICT (workspace_id, idempotency_key).
DROP INDEX IF EXISTS public.workspace_workflow_runs_idempotency_idx;
DROP INDEX IF EXISTS public.workspace_workflow_runs_idempotency_unique;

CREATE UNIQUE INDEX workspace_workflow_runs_idempotency_unique
  ON public.workspace_workflow_runs (workspace_id, idempotency_key);

NOTIFY pgrst, 'reload schema';
