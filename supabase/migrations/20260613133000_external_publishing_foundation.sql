-- External Publishing Studio: universal, workspace-scoped publishing package foundation.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_publication_platform' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.external_publication_platform AS ENUM ('medium', 'reddit', 'linkedin', 'devto', 'indiehackers', 'quora', 'generic_forum', 'generic_article');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_publication_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.external_publication_status AS ENUM ('draft', 'generated', 'needs_review', 'approved', 'exported', 'published_manual', 'archived', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_publication_source_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.external_publication_source_type AS ENUM ('gsc_query', 'seo_plan', 'seo_opportunity', 'content_item', 'manual_brief', 'market_signal');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_publication_asset_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.external_publication_asset_type AS ENUM ('featured_image', 'inline_image', 'diagram_mermaid', 'diagram_png', 'link_card', 'download_bundle');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_publication_event_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.external_publication_event_type AS ENUM ('generated', 'validated', 'approved', 'exported', 'published_manual', 'rejected', 'stale', 'analytics_attributed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.external_publication_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  name text NOT NULL,
  goal text NOT NULL,
  target_persona text,
  target_geographies text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft' CHECK (btrim(status) <> ''),
  utm_campaign text NOT NULL CHECK (btrim(utm_campaign) <> ''),
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_publication_campaigns_workspace_utm_campaign_idx
  ON public.external_publication_campaigns (workspace_id, lower(utm_campaign));
CREATE INDEX IF NOT EXISTS external_publication_campaigns_workspace_status_idx
  ON public.external_publication_campaigns (workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_publication_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  campaign_id uuid REFERENCES public.external_publication_campaigns(id) ON DELETE SET NULL,
  platform public.external_publication_platform NOT NULL,
  source_type public.external_publication_source_type NOT NULL,
  source_content_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  source_seo_plan_id uuid REFERENCES public.seo_content_plans(id) ON DELETE SET NULL,
  source_seo_opportunity_id uuid REFERENCES public.seo_content_opportunities(id) ON DELETE SET NULL,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  status public.external_publication_status NOT NULL DEFAULT 'draft',
  topic text NOT NULL,
  primary_query text,
  target_url text NOT NULL CHECK (target_url ~* '^https?://'),
  target_slug text,
  utm_source text NOT NULL CHECK (btrim(utm_source) <> ''),
  utm_medium text NOT NULL DEFAULT 'external_publishing' CHECK (btrim(utm_medium) <> ''),
  utm_campaign text NOT NULL CHECK (btrim(utm_campaign) <> ''),
  utm_content text NOT NULL CHECK (btrim(utm_content) <> ''),
  title_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  body_markdown text,
  body_plaintext text,
  body_platform_specific text,
  copy_blocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  visual_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_pack jsonb NOT NULL DEFAULT '{}'::jsonb,
  gsc_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score integer NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  usefulness_score integer NOT NULL DEFAULT 0 CHECK (usefulness_score BETWEEN 0 AND 100),
  backlink_safety_score integer NOT NULL DEFAULT 0 CHECK (backlink_safety_score BETWEEN 0 AND 100),
  compliance_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  exported_at timestamptz,
  manual_published_url text CHECK (manual_published_url IS NULL OR manual_published_url ~* '^https?://'),
  manual_published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_publication_packages_source_present_check CHECK (
    source_content_id IS NOT NULL
    OR source_seo_plan_id IS NOT NULL
    OR source_seo_opportunity_id IS NOT NULL
    OR metadata ? 'source'
    OR (source_type = 'manual_brief' AND (metadata ? 'manual_brief' OR metadata ? 'brief'))
  )
);

CREATE INDEX IF NOT EXISTS external_publication_packages_workspace_status_idx
  ON public.external_publication_packages (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS external_publication_packages_workspace_platform_status_idx
  ON public.external_publication_packages (workspace_id, platform, status, created_at DESC);
CREATE INDEX IF NOT EXISTS external_publication_packages_workspace_source_content_idx
  ON public.external_publication_packages (workspace_id, source_content_id)
  WHERE source_content_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS external_publication_packages_workspace_source_plan_idx
  ON public.external_publication_packages (workspace_id, source_seo_plan_id)
  WHERE source_seo_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS external_publication_packages_workspace_utm_idx
  ON public.external_publication_packages (workspace_id, utm_campaign, utm_content);

CREATE TABLE IF NOT EXISTS public.external_publication_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.external_publication_packages(id) ON DELETE CASCADE,
  asset_type public.external_publication_asset_type NOT NULL,
  title text NOT NULL,
  description text,
  storage_bucket text,
  storage_path text,
  public_url text CHECK (public_url IS NULL OR public_url ~* '^https?://'),
  markdown_embed text,
  alt_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_publication_assets_workspace_package_idx
  ON public.external_publication_assets (workspace_id, package_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.external_publication_packages(id) ON DELETE CASCADE,
  event_type public.external_publication_event_type NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_publication_events_workspace_package_idx
  ON public.external_publication_events (workspace_id, package_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS external_publication_events_workspace_type_idx
  ON public.external_publication_events (workspace_id, event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.external_publication_platform_profiles (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.external_publication_platform NOT NULL,
  default_disclosure text,
  blocked_communities text[] NOT NULL DEFAULT '{}'::text[],
  preferred_communities jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, platform)
);

CREATE TABLE IF NOT EXISTS public.external_publication_research_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.external_publication_packages(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.external_publication_campaigns(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('apify_website_crawler', 'apify_google_maps', 'apify_linkedin_posts', 'apify_dataset', 'apify_run_poll', 'tavily', 'manual')),
  job_type text NOT NULL CHECK (job_type IN ('search', 'crawl', 'extract', 'import', 'poll')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'superseded')),
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_publication_research_jobs_running_locked_check CHECK (status <> 'running' OR locked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS external_publication_research_jobs_claim_idx
  ON public.external_publication_research_jobs (status, run_after, priority, created_at);
CREATE INDEX IF NOT EXISTS external_publication_research_jobs_workspace_package_idx
  ON public.external_publication_research_jobs (workspace_id, package_id, created_at DESC);
CREATE INDEX IF NOT EXISTS external_publication_research_jobs_workspace_provider_status_idx
  ON public.external_publication_research_jobs (workspace_id, provider, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.external_publication_research_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.external_publication_packages(id) ON DELETE CASCADE,
  research_job_id uuid REFERENCES public.external_publication_research_jobs(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  source_url text NOT NULL CHECK (source_url ~* '^https?://'),
  canonical_url text NOT NULL CHECK (canonical_url ~* '^https?://'),
  title text,
  excerpt text CHECK (excerpt IS NULL OR char_length(excerpt) <= 4000),
  markdown text CHECK (markdown IS NULL OR char_length(markdown) <= 50000),
  content_hash text NOT NULL CHECK (char_length(content_hash) = 64),
  source_kind text NOT NULL CHECK (btrim(source_kind) <> ''),
  trust_tier integer CHECK (trust_tier IS NULL OR trust_tier BETWEEN 1 AND 5),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS external_publication_research_documents_package_url_idx
  ON public.external_publication_research_documents (workspace_id, package_id, lower(canonical_url))
  WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS external_publication_research_documents_workspace_hash_idx
  ON public.external_publication_research_documents (workspace_id, content_hash);

CREATE OR REPLACE FUNCTION public.enforce_external_publication_package_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_campaign_workspace_id uuid;
  v_campaign_template_id text;
  v_content_workspace_id uuid;
  v_content_template_id text;
  v_plan_workspace_id uuid;
  v_opportunity_workspace_id uuid;
BEGIN
  IF NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id, template_id INTO v_campaign_workspace_id, v_campaign_template_id
    FROM public.external_publication_campaigns
    WHERE id = NEW.campaign_id;

    IF v_campaign_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_packages workspace/campaign mismatch (workspace=% campaign_workspace=%)', NEW.workspace_id, v_campaign_workspace_id;
    END IF;
    IF v_campaign_template_id IS NOT NULL AND v_campaign_template_id IS DISTINCT FROM NEW.template_id THEN
      RAISE EXCEPTION 'external_publication_packages template/campaign mismatch (template_id=% campaign_template_id=%)', NEW.template_id, v_campaign_template_id;
    END IF;
  END IF;

  IF NEW.source_content_id IS NOT NULL THEN
    SELECT public.get_effective_content_workspace_id(ci.workspace_id, ci.template_id), ci.template_id
    INTO v_content_workspace_id, v_content_template_id
    FROM public.content_items ci
    WHERE ci.id = NEW.source_content_id;

    IF v_content_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_packages workspace/source_content mismatch';
    END IF;
    IF NEW.template_id IS NOT NULL AND v_content_template_id IS NOT NULL AND v_content_template_id IS DISTINCT FROM NEW.template_id THEN
      RAISE EXCEPTION 'external_publication_packages template/source_content mismatch';
    END IF;
  END IF;

  IF NEW.source_seo_plan_id IS NOT NULL THEN
    SELECT workspace_id INTO v_plan_workspace_id FROM public.seo_content_plans WHERE id = NEW.source_seo_plan_id;
    IF v_plan_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_packages workspace/source_seo_plan mismatch';
    END IF;
  END IF;

  IF NEW.source_seo_opportunity_id IS NOT NULL THEN
    SELECT workspace_id INTO v_opportunity_workspace_id FROM public.seo_content_opportunities WHERE id = NEW.source_seo_opportunity_id;
    IF v_opportunity_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_packages workspace/source_seo_opportunity mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_external_publication_asset_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_package_workspace_id
  FROM public.external_publication_packages
  WHERE id = NEW.package_id;

  IF v_package_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'external_publication_assets workspace/package mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_external_publication_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_package_workspace_id
  FROM public.external_publication_packages
  WHERE id = NEW.package_id;

  IF v_package_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'external_publication_events workspace/package mismatch';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_external_publication_research_job_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package_workspace_id uuid;
  v_campaign_workspace_id uuid;
BEGIN
  IF NEW.package_id IS NOT NULL THEN
    SELECT workspace_id INTO v_package_workspace_id
    FROM public.external_publication_packages
    WHERE id = NEW.package_id;

    IF v_package_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_research_jobs workspace/package mismatch';
    END IF;
  END IF;

  IF NEW.campaign_id IS NOT NULL THEN
    SELECT workspace_id INTO v_campaign_workspace_id
    FROM public.external_publication_campaigns
    WHERE id = NEW.campaign_id;

    IF v_campaign_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_research_jobs workspace/campaign mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_external_publication_research_document_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package_workspace_id uuid;
  v_job_workspace_id uuid;
BEGIN
  IF NEW.package_id IS NOT NULL THEN
    SELECT workspace_id INTO v_package_workspace_id
    FROM public.external_publication_packages
    WHERE id = NEW.package_id;

    IF v_package_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_research_documents workspace/package mismatch';
    END IF;
  END IF;

  IF NEW.research_job_id IS NOT NULL THEN
    SELECT workspace_id INTO v_job_workspace_id
    FROM public.external_publication_research_jobs
    WHERE id = NEW.research_job_id;

    IF v_job_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'external_publication_research_documents workspace/research_job mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_external_publication_package_scope_trigger ON public.external_publication_packages;
CREATE TRIGGER enforce_external_publication_package_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, campaign_id, source_content_id, source_seo_plan_id, source_seo_opportunity_id
  ON public.external_publication_packages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_external_publication_package_scope();

DROP TRIGGER IF EXISTS enforce_external_publication_asset_scope_trigger ON public.external_publication_assets;
CREATE TRIGGER enforce_external_publication_asset_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, package_id ON public.external_publication_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_external_publication_asset_scope();

DROP TRIGGER IF EXISTS enforce_external_publication_event_scope_trigger ON public.external_publication_events;
CREATE TRIGGER enforce_external_publication_event_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, package_id ON public.external_publication_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_external_publication_event_scope();

DROP TRIGGER IF EXISTS enforce_external_publication_research_job_scope_trigger ON public.external_publication_research_jobs;
CREATE TRIGGER enforce_external_publication_research_job_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, package_id, campaign_id ON public.external_publication_research_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_external_publication_research_job_scope();

DROP TRIGGER IF EXISTS enforce_external_publication_research_document_scope_trigger ON public.external_publication_research_documents;
CREATE TRIGGER enforce_external_publication_research_document_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, package_id, research_job_id ON public.external_publication_research_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_external_publication_research_document_scope();

DROP TRIGGER IF EXISTS set_updated_at_external_publication_campaigns ON public.external_publication_campaigns;
CREATE TRIGGER set_updated_at_external_publication_campaigns BEFORE UPDATE ON public.external_publication_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_external_publication_packages ON public.external_publication_packages;
CREATE TRIGGER set_updated_at_external_publication_packages BEFORE UPDATE ON public.external_publication_packages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_external_publication_assets ON public.external_publication_assets;
CREATE TRIGGER set_updated_at_external_publication_assets BEFORE UPDATE ON public.external_publication_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_external_publication_platform_profiles ON public.external_publication_platform_profiles;
CREATE TRIGGER set_updated_at_external_publication_platform_profiles BEFORE UPDATE ON public.external_publication_platform_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_external_publication_research_jobs ON public.external_publication_research_jobs;
CREATE TRIGGER set_updated_at_external_publication_research_jobs BEFORE UPDATE ON public.external_publication_research_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_external_publication_research_documents ON public.external_publication_research_documents;
CREATE TRIGGER set_updated_at_external_publication_research_documents BEFORE UPDATE ON public.external_publication_research_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.external_publication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_publication_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_publication_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_publication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_publication_platform_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_publication_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_publication_research_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY external_publication_campaigns_select_policy ON public.external_publication_campaigns
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_campaigns_write_policy ON public.external_publication_campaigns
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_campaigns_service_role_policy ON public.external_publication_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY external_publication_packages_select_policy ON public.external_publication_packages
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_packages_write_policy ON public.external_publication_packages
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_packages_service_role_policy ON public.external_publication_packages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY external_publication_assets_select_policy ON public.external_publication_assets
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_assets_write_policy ON public.external_publication_assets
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_assets_service_role_policy ON public.external_publication_assets FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY external_publication_events_select_policy ON public.external_publication_events
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_events_insert_policy ON public.external_publication_events
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_events_service_role_policy ON public.external_publication_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY external_publication_platform_profiles_select_policy ON public.external_publication_platform_profiles
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_platform_profiles_write_policy ON public.external_publication_platform_profiles
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_platform_profiles_service_role_policy ON public.external_publication_platform_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY external_publication_research_jobs_select_policy ON public.external_publication_research_jobs
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_research_jobs_write_policy ON public.external_publication_research_jobs
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_research_jobs_service_role_policy ON public.external_publication_research_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY external_publication_research_documents_select_policy ON public.external_publication_research_documents
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY external_publication_research_documents_write_policy ON public.external_publication_research_documents
  FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY external_publication_research_documents_service_role_policy ON public.external_publication_research_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_next_external_publication_research_job(p_worker_id text)
RETURNS public.external_publication_research_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.external_publication_research_jobs;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;

  UPDATE public.external_publication_research_jobs
  SET status = 'running',
      locked_at = now(),
      locked_by = p_worker_id,
      attempts = attempts + 1,
      result_summary = jsonb_build_object('worker_id', p_worker_id, 'claimed_at', now()) || result_summary
  WHERE id = (
    SELECT id
    FROM public.external_publication_research_jobs
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

REVOKE ALL ON FUNCTION public.claim_next_external_publication_research_job(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_external_publication_research_job(text) TO service_role;
