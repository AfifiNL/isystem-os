-- Creative Studio Phase 2: universal workspace-scoped schema, private render storage, RLS, and queue claim RPC.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_project_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_project_status AS ENUM ('draft', 'strategy_ready', 'needs_review', 'approved', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_brief_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_brief_status AS ENUM ('draft', 'strategy_requested', 'strategy_ready', 'render_ready', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_render_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_render_status AS ENUM ('draft', 'queued', 'running', 'provider_submitted', 'provider_processing', 'completed', 'failed', 'cancelled', 'superseded', 'needs_manual_review');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_asset_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_asset_status AS ENUM ('draft', 'needs_review', 'approved', 'rejected', 'exported', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_asset_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_asset_type AS ENUM ('prompt_manifest', 'storyboard', 'source_image', 'thumbnail', 'rendered_video', 'rendered_clip', 'social_cutdown', 'caption_file', 'export_bundle');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_review_event_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_review_event_type AS ENUM ('strategy_generated', 'safety_flagged', 'rights_required', 'render_approved', 'render_rejected', 'provider_submitted', 'provider_failed', 'evaluator_passed', 'evaluator_failed', 'final_approved', 'exported', 'attached_to_content', 'manual_publish_recorded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_channel_target' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_channel_target AS ENUM ('content', 'newsletter', 'external_publishing', 'outreach', 'booking', 'popup', 'video', 'analytics', 'business_spine', 'manual_export');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creative_provider' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.creative_provider AS ENUM ('higgsfield', 'fake', 'manual_admin', 'vertex_veo_future');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.creative_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  name text NOT NULL CHECK (btrim(name) <> ''),
  objective text NOT NULL CHECK (btrim(objective) <> ''),
  target_audience text,
  target_channel text,
  status public.creative_project_status NOT NULL DEFAULT 'draft',
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creative_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  project_id uuid NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  source_module text NOT NULL CHECK (btrim(source_module) <> ''),
  source_entity_type text,
  source_entity_id uuid,
  title text NOT NULL CHECK (btrim(title) <> ''),
  brief_markdown text NOT NULL CHECK (btrim(brief_markdown) <> ''),
  brand_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_evidence_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_url text CHECK (target_url IS NULL OR target_url ~* '^https?://'),
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  rights_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.creative_brief_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creative_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  project_id uuid NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  brief_id uuid NOT NULL REFERENCES public.creative_briefs(id) ON DELETE CASCADE,
  source_model text NOT NULL CHECK (btrim(source_model) <> ''),
  strategy_prompt text NOT NULL CHECK (btrim(strategy_prompt) <> ''),
  provider_prompt text NOT NULL CHECK (btrim(provider_prompt) <> ''),
  negative_prompt text,
  scene_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluator_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_hash text NOT NULL CHECK (btrim(prompt_hash) <> ''),
  safety jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, prompt_hash)
);

CREATE TABLE IF NOT EXISTS public.creative_render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  project_id uuid NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  brief_id uuid REFERENCES public.creative_briefs(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES public.creative_prompts(id) ON DELETE SET NULL,
  provider public.creative_provider NOT NULL,
  provider_model text NOT NULL CHECK (btrim(provider_model) <> ''),
  job_kind text NOT NULL CHECK (btrim(job_kind) <> ''),
  status public.creative_render_status NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  provider_job_id text,
  provider_request jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_millicents bigint CHECK (estimated_cost_millicents IS NULL OR estimated_cost_millicents >= 0),
  final_cost_millicents bigint CHECK (final_cost_millicents IS NULL OR final_cost_millicents >= 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  result_asset_id uuid,
  error_code text,
  error_message text,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  CONSTRAINT creative_render_jobs_running_locked_check CHECK (status <> 'running' OR locked_at IS NOT NULL),
  CONSTRAINT creative_render_jobs_completed_timestamp_check CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS creative_render_jobs_provider_job_unique_idx
  ON public.creative_render_jobs (provider, provider_job_id)
  WHERE provider_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creative_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  project_id uuid NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  brief_id uuid REFERENCES public.creative_briefs(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES public.creative_prompts(id) ON DELETE SET NULL,
  provider_job_id uuid REFERENCES public.creative_render_jobs(id) ON DELETE SET NULL,
  asset_type public.creative_asset_type NOT NULL,
  status public.creative_asset_status NOT NULL DEFAULT 'needs_review',
  storage_bucket text NOT NULL DEFAULT 'creative-renders' CHECK (btrim(storage_bucket) <> ''),
  storage_path text NOT NULL CHECK (btrim(storage_path) <> ''),
  mime_type text NOT NULL CHECK (btrim(mime_type) <> ''),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  checksum text CHECK (checksum IS NULL OR char_length(checksum) = 64),
  rights_status text NOT NULL DEFAULT 'needs_review' CHECK (btrim(rights_status) <> ''),
  safety_status text NOT NULL DEFAULT 'needs_review' CHECK (btrim(safety_status) <> ''),
  approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

ALTER TABLE public.creative_render_jobs
  DROP CONSTRAINT IF EXISTS creative_render_jobs_result_asset_id_fkey;
ALTER TABLE public.creative_render_jobs
  ADD CONSTRAINT creative_render_jobs_result_asset_id_fkey
  FOREIGN KEY (result_asset_id) REFERENCES public.creative_assets(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.creative_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  project_id uuid NOT NULL REFERENCES public.creative_projects(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.creative_assets(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.creative_render_jobs(id) ON DELETE SET NULL,
  event_type public.creative_review_event_type NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creative_provider_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  provider public.creative_provider NOT NULL,
  provider_event_id text,
  provider_job_id text,
  signature_valid boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  idempotency_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_error text
);

CREATE UNIQUE INDEX IF NOT EXISTS creative_provider_webhook_events_provider_event_unique_idx
  ON public.creative_provider_webhook_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creative_provider_webhook_events_idempotency_unique_idx
  ON public.creative_provider_webhook_events (provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creative_provider_webhook_events_job_received_unique_idx
  ON public.creative_provider_webhook_events (provider, provider_job_id, received_at)
  WHERE provider_event_id IS NULL AND provider_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.creative_channel_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  asset_id uuid NOT NULL REFERENCES public.creative_assets(id) ON DELETE CASCADE,
  target_module public.creative_channel_target NOT NULL,
  target_entity_type text,
  target_entity_id uuid,
  target_url text CHECK (target_url IS NULL OR target_url ~* '^https?://'),
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'suggested' CHECK (btrim(status) <> ''),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creative_projects_workspace_status_idx ON public.creative_projects (workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS creative_briefs_workspace_project_status_idx ON public.creative_briefs (workspace_id, project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS creative_prompts_workspace_project_idx ON public.creative_prompts (workspace_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_render_jobs_claim_idx ON public.creative_render_jobs (status, run_after, priority, created_at);
CREATE INDEX IF NOT EXISTS creative_render_jobs_workspace_status_idx ON public.creative_render_jobs (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_render_jobs_provider_status_idx ON public.creative_render_jobs (provider, status, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_assets_workspace_project_status_idx ON public.creative_assets (workspace_id, project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS creative_assets_job_idx ON public.creative_assets (provider_job_id) WHERE provider_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creative_review_events_workspace_project_idx ON public.creative_review_events (workspace_id, project_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS creative_review_events_asset_idx ON public.creative_review_events (asset_id, occurred_at DESC) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creative_provider_webhook_events_provider_job_idx ON public.creative_provider_webhook_events (provider, provider_job_id, received_at DESC) WHERE provider_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creative_channel_links_workspace_asset_idx ON public.creative_channel_links (workspace_id, asset_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_creative_project_parent_scope(
  p_expected_workspace_id uuid,
  p_expected_template_id text,
  p_parent_workspace_id uuid,
  p_parent_template_id text,
  p_context text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_parent_workspace_id IS DISTINCT FROM p_expected_workspace_id THEN
    RAISE EXCEPTION '% workspace mismatch (workspace=% parent_workspace=%)', p_context, p_expected_workspace_id, p_parent_workspace_id;
  END IF;

  IF p_expected_template_id IS NOT NULL
    AND p_parent_template_id IS NOT NULL
    AND p_parent_template_id IS DISTINCT FROM p_expected_template_id THEN
    RAISE EXCEPTION '% template mismatch (template_id=% parent_template_id=%)', p_context, p_expected_template_id, p_parent_template_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_creative_brief_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_workspace_id uuid;
  v_project_template_id text;
BEGIN
  SELECT workspace_id, template_id INTO v_project_workspace_id, v_project_template_id
  FROM public.creative_projects
  WHERE id = NEW.project_id;

  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_project_workspace_id, v_project_template_id, 'creative_briefs/project');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_creative_prompt_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_workspace_id uuid;
  v_project_template_id text;
  v_brief_workspace_id uuid;
  v_brief_template_id text;
  v_brief_project_id uuid;
BEGIN
  SELECT workspace_id, template_id INTO v_project_workspace_id, v_project_template_id
  FROM public.creative_projects
  WHERE id = NEW.project_id;
  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_project_workspace_id, v_project_template_id, 'creative_prompts/project');

  SELECT workspace_id, template_id, project_id INTO v_brief_workspace_id, v_brief_template_id, v_brief_project_id
  FROM public.creative_briefs
  WHERE id = NEW.brief_id;
  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_brief_workspace_id, v_brief_template_id, 'creative_prompts/brief');

  IF v_brief_project_id IS DISTINCT FROM NEW.project_id THEN
    RAISE EXCEPTION 'creative_prompts project/brief mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_creative_render_job_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_workspace_id uuid;
  v_project_template_id text;
  v_brief_workspace_id uuid;
  v_brief_template_id text;
  v_brief_project_id uuid;
  v_prompt_workspace_id uuid;
  v_prompt_template_id text;
  v_prompt_project_id uuid;
  v_prompt_brief_id uuid;
  v_asset_workspace_id uuid;
  v_asset_template_id text;
  v_asset_project_id uuid;
BEGIN
  SELECT workspace_id, template_id INTO v_project_workspace_id, v_project_template_id
  FROM public.creative_projects
  WHERE id = NEW.project_id;
  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_project_workspace_id, v_project_template_id, 'creative_render_jobs/project');

  IF NEW.brief_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id INTO v_brief_workspace_id, v_brief_template_id, v_brief_project_id
    FROM public.creative_briefs
    WHERE id = NEW.brief_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_brief_workspace_id, v_brief_template_id, 'creative_render_jobs/brief');
    IF v_brief_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_render_jobs project/brief mismatch';
    END IF;
  END IF;

  IF NEW.prompt_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id, brief_id INTO v_prompt_workspace_id, v_prompt_template_id, v_prompt_project_id, v_prompt_brief_id
    FROM public.creative_prompts
    WHERE id = NEW.prompt_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_prompt_workspace_id, v_prompt_template_id, 'creative_render_jobs/prompt');
    IF v_prompt_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_render_jobs project/prompt mismatch';
    END IF;
    IF NEW.brief_id IS NOT NULL AND v_prompt_brief_id IS DISTINCT FROM NEW.brief_id THEN
      RAISE EXCEPTION 'creative_render_jobs brief/prompt mismatch';
    END IF;
  END IF;

  IF NEW.result_asset_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id INTO v_asset_workspace_id, v_asset_template_id, v_asset_project_id
    FROM public.creative_assets
    WHERE id = NEW.result_asset_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_asset_workspace_id, v_asset_template_id, 'creative_render_jobs/result_asset');
    IF v_asset_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_render_jobs project/result_asset mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_creative_asset_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_workspace_id uuid;
  v_project_template_id text;
  v_brief_workspace_id uuid;
  v_brief_template_id text;
  v_brief_project_id uuid;
  v_prompt_workspace_id uuid;
  v_prompt_template_id text;
  v_prompt_project_id uuid;
  v_prompt_brief_id uuid;
  v_job_workspace_id uuid;
  v_job_template_id text;
  v_job_project_id uuid;
  v_job_brief_id uuid;
  v_job_prompt_id uuid;
BEGIN
  SELECT workspace_id, template_id INTO v_project_workspace_id, v_project_template_id
  FROM public.creative_projects
  WHERE id = NEW.project_id;
  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_project_workspace_id, v_project_template_id, 'creative_assets/project');

  IF NEW.brief_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id INTO v_brief_workspace_id, v_brief_template_id, v_brief_project_id
    FROM public.creative_briefs
    WHERE id = NEW.brief_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_brief_workspace_id, v_brief_template_id, 'creative_assets/brief');
    IF v_brief_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_assets project/brief mismatch';
    END IF;
  END IF;

  IF NEW.prompt_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id, brief_id INTO v_prompt_workspace_id, v_prompt_template_id, v_prompt_project_id, v_prompt_brief_id
    FROM public.creative_prompts
    WHERE id = NEW.prompt_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_prompt_workspace_id, v_prompt_template_id, 'creative_assets/prompt');
    IF v_prompt_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_assets project/prompt mismatch';
    END IF;
    IF NEW.brief_id IS NOT NULL AND v_prompt_brief_id IS DISTINCT FROM NEW.brief_id THEN
      RAISE EXCEPTION 'creative_assets brief/prompt mismatch';
    END IF;
  END IF;

  IF NEW.provider_job_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id, brief_id, prompt_id INTO v_job_workspace_id, v_job_template_id, v_job_project_id, v_job_brief_id, v_job_prompt_id
    FROM public.creative_render_jobs
    WHERE id = NEW.provider_job_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_job_workspace_id, v_job_template_id, 'creative_assets/job');
    IF v_job_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_assets project/job mismatch';
    END IF;
    IF NEW.brief_id IS NOT NULL AND v_job_brief_id IS NOT NULL AND v_job_brief_id IS DISTINCT FROM NEW.brief_id THEN
      RAISE EXCEPTION 'creative_assets brief/job mismatch';
    END IF;
    IF NEW.prompt_id IS NOT NULL AND v_job_prompt_id IS NOT NULL AND v_job_prompt_id IS DISTINCT FROM NEW.prompt_id THEN
      RAISE EXCEPTION 'creative_assets prompt/job mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_creative_review_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_workspace_id uuid;
  v_project_template_id text;
  v_asset_workspace_id uuid;
  v_asset_template_id text;
  v_asset_project_id uuid;
  v_job_workspace_id uuid;
  v_job_template_id text;
  v_job_project_id uuid;
BEGIN
  SELECT workspace_id, template_id INTO v_project_workspace_id, v_project_template_id
  FROM public.creative_projects
  WHERE id = NEW.project_id;
  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_project_workspace_id, v_project_template_id, 'creative_review_events/project');

  IF NEW.asset_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id INTO v_asset_workspace_id, v_asset_template_id, v_asset_project_id
    FROM public.creative_assets
    WHERE id = NEW.asset_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_asset_workspace_id, v_asset_template_id, 'creative_review_events/asset');
    IF v_asset_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_review_events project/asset mismatch';
    END IF;
  END IF;

  IF NEW.job_id IS NOT NULL THEN
    SELECT workspace_id, template_id, project_id INTO v_job_workspace_id, v_job_template_id, v_job_project_id
    FROM public.creative_render_jobs
    WHERE id = NEW.job_id;
    PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_job_workspace_id, v_job_template_id, 'creative_review_events/job');
    IF v_job_project_id IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'creative_review_events project/job mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_creative_channel_link_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_asset_workspace_id uuid;
  v_asset_template_id text;
BEGIN
  SELECT workspace_id, template_id INTO v_asset_workspace_id, v_asset_template_id
  FROM public.creative_assets
  WHERE id = NEW.asset_id;

  PERFORM public.enforce_creative_project_parent_scope(NEW.workspace_id, NEW.template_id, v_asset_workspace_id, v_asset_template_id, 'creative_channel_links/asset');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creative_brief_scope_trigger ON public.creative_briefs;
CREATE TRIGGER enforce_creative_brief_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, project_id ON public.creative_briefs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_brief_scope();

DROP TRIGGER IF EXISTS enforce_creative_prompt_scope_trigger ON public.creative_prompts;
CREATE TRIGGER enforce_creative_prompt_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, project_id, brief_id ON public.creative_prompts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_prompt_scope();

DROP TRIGGER IF EXISTS enforce_creative_render_job_scope_trigger ON public.creative_render_jobs;
CREATE TRIGGER enforce_creative_render_job_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, project_id, brief_id, prompt_id, result_asset_id ON public.creative_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_render_job_scope();

DROP TRIGGER IF EXISTS enforce_creative_asset_scope_trigger ON public.creative_assets;
CREATE TRIGGER enforce_creative_asset_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, project_id, brief_id, prompt_id, provider_job_id ON public.creative_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_asset_scope();

DROP TRIGGER IF EXISTS enforce_creative_review_event_scope_trigger ON public.creative_review_events;
CREATE TRIGGER enforce_creative_review_event_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, project_id, asset_id, job_id ON public.creative_review_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_review_event_scope();

DROP TRIGGER IF EXISTS enforce_creative_channel_link_scope_trigger ON public.creative_channel_links;
CREATE TRIGGER enforce_creative_channel_link_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, asset_id ON public.creative_channel_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_channel_link_scope();

DROP TRIGGER IF EXISTS set_updated_at_creative_projects ON public.creative_projects;
CREATE TRIGGER set_updated_at_creative_projects BEFORE UPDATE ON public.creative_projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_creative_briefs ON public.creative_briefs;
CREATE TRIGGER set_updated_at_creative_briefs BEFORE UPDATE ON public.creative_briefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_creative_render_jobs ON public.creative_render_jobs;
CREATE TRIGGER set_updated_at_creative_render_jobs BEFORE UPDATE ON public.creative_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_creative_assets ON public.creative_assets;
CREATE TRIGGER set_updated_at_creative_assets BEFORE UPDATE ON public.creative_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.creative_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_provider_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_channel_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY creative_projects_select_policy ON public.creative_projects
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_projects_write_policy ON public.creative_projects
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_projects_service_role_policy ON public.creative_projects FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_briefs_select_policy ON public.creative_briefs
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_briefs_write_policy ON public.creative_briefs
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_briefs_service_role_policy ON public.creative_briefs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_prompts_select_policy ON public.creative_prompts
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_prompts_insert_policy ON public.creative_prompts
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_prompts_service_role_policy ON public.creative_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_render_jobs_select_policy ON public.creative_render_jobs
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_render_jobs_write_policy ON public.creative_render_jobs
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_render_jobs_service_role_policy ON public.creative_render_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_assets_select_policy ON public.creative_assets
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_assets_write_policy ON public.creative_assets
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_assets_service_role_policy ON public.creative_assets FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_review_events_select_policy ON public.creative_review_events
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_review_events_insert_policy ON public.creative_review_events
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_review_events_service_role_policy ON public.creative_review_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_provider_webhook_events_select_policy ON public.creative_provider_webhook_events
  FOR SELECT USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_provider_webhook_events_service_role_policy ON public.creative_provider_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY creative_channel_links_select_policy ON public.creative_channel_links
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY creative_channel_links_write_policy ON public.creative_channel_links
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY creative_channel_links_service_role_policy ON public.creative_channel_links FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creative-renders',
  'creative-renders',
  false,
  524288000,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'application/json', 'text/vtt', 'application/zip']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON TABLE public.creative_assets IS 'Creative Studio assets stored privately in storage bucket creative-renders. Path convention: workspaces/{workspace_id}/projects/{project_id}/jobs/{job_id}/{asset_id}.{ext}. Do not persist signed URLs; generate short-lived URLs after workspace checks.';

CREATE OR REPLACE FUNCTION public.creative_render_storage_workspace_uuid(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_workspace text;
BEGIN
  IF (storage.foldername(p_name))[1] <> 'workspaces' THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(p_name))[3] <> 'projects' THEN
    RETURN NULL;
  END IF;

  IF (storage.foldername(p_name))[5] <> 'jobs' THEN
    RETURN NULL;
  END IF;

  v_workspace := (storage.foldername(p_name))[2];
  IF v_workspace IS NULL OR v_workspace = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_workspace::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

DROP POLICY IF EXISTS creative_renders_storage_select ON storage.objects;
DROP POLICY IF EXISTS creative_renders_storage_insert ON storage.objects;
DROP POLICY IF EXISTS creative_renders_storage_update ON storage.objects;
DROP POLICY IF EXISTS creative_renders_storage_delete ON storage.objects;
DROP POLICY IF EXISTS creative_renders_storage_service_role ON storage.objects;

CREATE POLICY creative_renders_storage_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'creative-renders'
    AND public.can_access_workspace(public.creative_render_storage_workspace_uuid(name), 'content.read')
  );

CREATE POLICY creative_renders_storage_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'creative-renders'
    AND public.can_access_workspace(public.creative_render_storage_workspace_uuid(name), 'content.write')
  );

CREATE POLICY creative_renders_storage_update ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'creative-renders'
    AND public.can_access_workspace(public.creative_render_storage_workspace_uuid(name), 'content.write')
  ) WITH CHECK (
    bucket_id = 'creative-renders'
    AND public.can_access_workspace(public.creative_render_storage_workspace_uuid(name), 'content.write')
  );

CREATE POLICY creative_renders_storage_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'creative-renders'
    AND public.can_access_workspace(public.creative_render_storage_workspace_uuid(name), 'content.write')
  );

CREATE POLICY creative_renders_storage_service_role ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'creative-renders') WITH CHECK (bucket_id = 'creative-renders');

CREATE OR REPLACE FUNCTION public.claim_next_creative_render_job(p_worker_id text)
RETURNS public.creative_render_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.creative_render_jobs;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;

  UPDATE public.creative_render_jobs
  SET status = 'running',
      locked_at = now(),
      locked_by = p_worker_id,
      attempts = attempts + 1,
      result_summary = jsonb_build_object('worker_id', p_worker_id, 'claimed_at', now()) || result_summary
  WHERE id = (
    SELECT id
    FROM public.creative_render_jobs
    WHERE status = 'queued'
      AND run_after <= now()
      AND attempts < max_attempts
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_creative_render_job(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_creative_render_job(text) TO service_role;
