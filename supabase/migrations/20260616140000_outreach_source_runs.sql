-- Add outreach_source_runs table for first-class source run tracking

CREATE TABLE IF NOT EXISTS public.outreach_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.outreach_sources(id) ON DELETE SET NULL,
  provider text NOT NULL,
  run_id text,
  dataset_id text,
  status public.outreach_job_status NOT NULL DEFAULT 'running',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure new columns exist for source runs
ALTER TABLE public.outreach_source_runs
  ADD COLUMN IF NOT EXISTS actor_id text,
  ADD COLUMN IF NOT EXISTS item_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_total_charge_usd numeric,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE INDEX IF NOT EXISTS outreach_source_runs_workspace_idx ON public.outreach_source_runs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_source_runs_campaign_idx ON public.outreach_source_runs (workspace_id, campaign_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_source_runs_run_id_idx ON public.outreach_source_runs (run_id) WHERE run_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_outreach_source_runs ON public.outreach_source_runs;
CREATE TRIGGER set_updated_at_outreach_source_runs BEFORE UPDATE ON public.outreach_source_runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.outreach_source_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outreach_source_runs_select_policy ON public.outreach_source_runs;
DROP POLICY IF EXISTS outreach_source_runs_write_policy ON public.outreach_source_runs;
DROP POLICY IF EXISTS outreach_source_runs_service_role_policy ON public.outreach_source_runs;

CREATE POLICY outreach_source_runs_select_policy ON public.outreach_source_runs FOR SELECT USING (public.can_access_workspace(workspace_id, 'outreach.read'));
CREATE POLICY outreach_source_runs_write_policy ON public.outreach_source_runs FOR ALL USING (public.can_access_workspace(workspace_id, 'outreach.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'outreach.write'));
CREATE POLICY outreach_source_runs_service_role_policy ON public.outreach_source_runs FOR ALL TO service_role USING (true) WITH CHECK (true);