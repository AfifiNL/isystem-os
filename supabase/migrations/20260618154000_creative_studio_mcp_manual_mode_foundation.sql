-- Creative Studio MCP Manual Mode foundation: additive render job fields and operator fulfillment audit.

ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'prompt_ready';
ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'mcp_manual_required';
ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'mcp_generation_in_progress';
ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'awaiting_manual_upload';
ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'uploaded_for_review';
ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.creative_render_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE public.creative_render_jobs
  ADD COLUMN IF NOT EXISTS provider_mode text NOT NULL DEFAULT 'api_auto',
  ADD COLUMN IF NOT EXISTS manual_provider text,
  ADD COLUMN IF NOT EXISTS manual_external_url text,
  ADD COLUMN IF NOT EXISTS manual_instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS manual_uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_credit_source text,
  ADD COLUMN IF NOT EXISTS manual_notes text;

ALTER TABLE public.creative_render_jobs
  DROP CONSTRAINT IF EXISTS creative_render_jobs_provider_mode_check,
  ADD CONSTRAINT creative_render_jobs_provider_mode_check
  CHECK (provider_mode IN ('api_auto', 'mcp_manual', 'mcp_bridge_experimental', 'fake'));

ALTER TABLE public.creative_render_jobs
  DROP CONSTRAINT IF EXISTS creative_render_jobs_manual_provider_check,
  ADD CONSTRAINT creative_render_jobs_manual_provider_check
  CHECK (manual_provider IS NULL OR manual_provider IN ('higgsfield_mcp'));

ALTER TABLE public.creative_render_jobs
  DROP CONSTRAINT IF EXISTS creative_render_jobs_manual_credit_source_check,
  ADD CONSTRAINT creative_render_jobs_manual_credit_source_check
  CHECK (manual_credit_source IS NULL OR manual_credit_source IN ('operator_creator_credits', 'client_creator_credits', 'unknown'));

ALTER TABLE public.creative_render_jobs
  DROP CONSTRAINT IF EXISTS creative_render_jobs_manual_external_url_check,
  ADD CONSTRAINT creative_render_jobs_manual_external_url_check
  CHECK (manual_external_url IS NULL OR manual_external_url ~* '^https?://');

CREATE INDEX IF NOT EXISTS creative_render_jobs_provider_mode_status_idx
  ON public.creative_render_jobs (workspace_id, provider_mode, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.creative_manual_fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  job_id uuid NOT NULL REFERENCES public.creative_render_jobs(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.creative_assets(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'mcp_command_copied',
    'mcp_generation_started_manually',
    'mcp_result_uploaded',
    'mcp_external_url_attached',
    'mcp_result_rejected',
    'mcp_result_approved'
  )),
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_manual_fulfillment_events_workspace_job_idx
  ON public.creative_manual_fulfillment_events (workspace_id, job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS creative_manual_fulfillment_events_asset_idx
  ON public.creative_manual_fulfillment_events (asset_id, occurred_at DESC)
  WHERE asset_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_creative_manual_fulfillment_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_workspace_id uuid;
  v_job_template_id text;
  v_asset_workspace_id uuid;
  v_asset_template_id text;
BEGIN
  SELECT workspace_id, template_id INTO v_job_workspace_id, v_job_template_id
  FROM public.creative_render_jobs
  WHERE id = NEW.job_id;

  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_job_workspace_id, v_job_template_id, 'creative_manual_fulfillment_events/job');

  IF NEW.asset_id IS NOT NULL THEN
    SELECT workspace_id, template_id INTO v_asset_workspace_id, v_asset_template_id
    FROM public.creative_assets
    WHERE id = NEW.asset_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_asset_workspace_id, v_asset_template_id, 'creative_manual_fulfillment_events/asset');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creative_manual_fulfillment_event_scope_trigger ON public.creative_manual_fulfillment_events;
CREATE TRIGGER enforce_creative_manual_fulfillment_event_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, job_id, asset_id ON public.creative_manual_fulfillment_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_manual_fulfillment_event_scope();

ALTER TABLE public.creative_manual_fulfillment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creative_manual_fulfillment_events_select_policy ON public.creative_manual_fulfillment_events;
CREATE POLICY creative_manual_fulfillment_events_select_policy ON public.creative_manual_fulfillment_events
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));

DROP POLICY IF EXISTS creative_manual_fulfillment_events_insert_policy ON public.creative_manual_fulfillment_events;
CREATE POLICY creative_manual_fulfillment_events_insert_policy ON public.creative_manual_fulfillment_events
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS creative_manual_fulfillment_events_service_role_policy ON public.creative_manual_fulfillment_events;
CREATE POLICY creative_manual_fulfillment_events_service_role_policy ON public.creative_manual_fulfillment_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON COLUMN public.creative_render_jobs.provider_mode IS 'Render fulfillment mode: api_auto uses the server API adapter, mcp_manual is operator copy/paste via Higgsfield MCP, mcp_bridge_experimental is reserved, fake is test-only.';
COMMENT ON COLUMN public.creative_render_jobs.manual_instructions IS 'Operator-facing MCP production pack/checklist metadata only. Never store Higgsfield cookies, sessions, browser credentials, or MCP auth tokens.';
COMMENT ON TABLE public.creative_manual_fulfillment_events IS 'Audit trail for manual Higgsfield MCP fulfillment steps. Events record operator actions only; backend automation of the consumer Higgsfield site or MCP host is forbidden.';
