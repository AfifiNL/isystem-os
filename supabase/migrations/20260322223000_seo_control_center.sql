
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_run_type'
  ) THEN
    CREATE TYPE public.seo_run_type AS ENUM (
      'specialist_audit',
      'strategist_analysis',
      'content_graph_refresh'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_run_status'
  ) THEN
    CREATE TYPE public.seo_run_status AS ENUM (
      'queued',
      'running',
      'completed',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_recommendation_status'
  ) THEN
    CREATE TYPE public.seo_recommendation_status AS ENUM (
      'pending',
      'approved',
      'dismissed',
      'implemented',
      'superseded'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_opportunity_type'
  ) THEN
    CREATE TYPE public.seo_opportunity_type AS ENUM (
      'blue_ocean',
      'cluster_gap',
      'orphan_support',
      'conversion_support',
      'authority_expansion'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_funnel_stage'
  ) THEN
    CREATE TYPE public.seo_funnel_stage AS ENUM (
      'top',
      'middle',
      'bottom'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'seo_plan_status'
  ) THEN
    CREATE TYPE public.seo_plan_status AS ENUM (
      'draft',
      'saved',
      'approved',
      'dismissed',
      'in_progress',
      'done'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.seo_recommendation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_type public.seo_run_type NOT NULL,
  status public.seo_run_status NOT NULL DEFAULT 'queued',
  triggered_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_internal_link_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.seo_recommendation_runs(id) ON DELETE SET NULL,
  status public.seo_recommendation_status NOT NULL DEFAULT 'pending',
  source_content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  target_content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  source_slug text,
  target_slug text,
  source_title text NOT NULL,
  target_title text NOT NULL,
  anchor_text text NOT NULL,
  rationale text,
  source_excerpt text,
  target_excerpt text,
  source_traffic integer NOT NULL DEFAULT 0,
  target_conversions integer NOT NULL DEFAULT 0,
  target_conversion_goal text,
  semantic_fit_score numeric(6,2) NOT NULL DEFAULT 0,
  analytics_score numeric(6,2) NOT NULL DEFAULT 0,
  strategic_importance_score numeric(6,2) NOT NULL DEFAULT 0,
  priority_score numeric(6,2) NOT NULL DEFAULT 0,
  confidence_score numeric(6,2) NOT NULL DEFAULT 0,
  existing_link_count integer NOT NULL DEFAULT 0,
  is_orphan_target boolean NOT NULL DEFAULT false,
  suggestion jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_internal_link_opportunities_unique_pair UNIQUE (workspace_id, source_content_id, target_content_id),
  CONSTRAINT seo_internal_link_opportunities_distinct_content CHECK (source_content_id <> target_content_id)
);

CREATE TABLE IF NOT EXISTS public.seo_topic_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.seo_recommendation_runs(id) ON DELETE SET NULL,
  status public.seo_plan_status NOT NULL DEFAULT 'draft',
  name text NOT NULL,
  pillar_topic text,
  summary text,
  primary_intent text,
  funnel_stage public.seo_funnel_stage,
  target_conversion_goal text,
  priority_score numeric(6,2) NOT NULL DEFAULT 0,
  supporting_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_content_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.seo_recommendation_runs(id) ON DELETE SET NULL,
  cluster_id uuid REFERENCES public.seo_topic_clusters(id) ON DELETE SET NULL,
  status public.seo_plan_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  slug_suggestion text,
  primary_keyword text,
  secondary_keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  intent_stage text,
  funnel_stage public.seo_funnel_stage,
  target_conversion_goal text,
  brief_markdown text,
  outline jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_score numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seo_content_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.seo_recommendation_runs(id) ON DELETE SET NULL,
  cluster_id uuid REFERENCES public.seo_topic_clusters(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.seo_content_plans(id) ON DELETE SET NULL,
  status public.seo_recommendation_status NOT NULL DEFAULT 'pending',
  opportunity_type public.seo_opportunity_type NOT NULL,
  title text NOT NULL,
  topic text NOT NULL,
  summary text,
  rationale text,
  cluster_name text,
  recommended_format text,
  target_intent text,
  funnel_stage public.seo_funnel_stage,
  target_conversion_goal text,
  blue_ocean_score numeric(6,2) NOT NULL DEFAULT 0,
  analytics_score numeric(6,2) NOT NULL DEFAULT 0,
  strategic_importance_score numeric(6,2) NOT NULL DEFAULT 0,
  priority_score numeric(6,2) NOT NULL DEFAULT 0,
  analytics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  inventory_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_recommendation_runs_workspace_created_idx
  ON public.seo_recommendation_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_recommendation_runs_workspace_type_created_idx
  ON public.seo_recommendation_runs (workspace_id, run_type, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_internal_link_opportunities_workspace_status_priority_idx
  ON public.seo_internal_link_opportunities (workspace_id, status, priority_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_internal_link_opportunities_workspace_source_idx
  ON public.seo_internal_link_opportunities (workspace_id, source_content_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS seo_internal_link_opportunities_workspace_target_idx
  ON public.seo_internal_link_opportunities (workspace_id, target_content_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS seo_internal_link_opportunities_workspace_run_idx
  ON public.seo_internal_link_opportunities (workspace_id, run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_topic_clusters_workspace_status_priority_idx
  ON public.seo_topic_clusters (workspace_id, status, priority_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_content_plans_workspace_status_priority_idx
  ON public.seo_content_plans (workspace_id, status, priority_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_content_plans_workspace_cluster_idx
  ON public.seo_content_plans (workspace_id, cluster_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_content_opportunities_workspace_status_priority_idx
  ON public.seo_content_opportunities (workspace_id, status, priority_score DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_content_opportunities_workspace_type_idx
  ON public.seo_content_opportunities (workspace_id, opportunity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_content_opportunities_workspace_cluster_idx
  ON public.seo_content_opportunities (workspace_id, cluster_id, created_at DESC);

ALTER TABLE public.seo_recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_internal_link_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_topic_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_content_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_recommendation_runs_select_policy" ON public.seo_recommendation_runs;
CREATE POLICY "seo_recommendation_runs_select_policy"
ON public.seo_recommendation_runs
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "seo_recommendation_runs_insert_policy" ON public.seo_recommendation_runs;
CREATE POLICY "seo_recommendation_runs_insert_policy"
ON public.seo_recommendation_runs
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_recommendation_runs_update_policy" ON public.seo_recommendation_runs;
CREATE POLICY "seo_recommendation_runs_update_policy"
ON public.seo_recommendation_runs
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_internal_link_opportunities_select_policy" ON public.seo_internal_link_opportunities;
CREATE POLICY "seo_internal_link_opportunities_select_policy"
ON public.seo_internal_link_opportunities
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "seo_internal_link_opportunities_insert_policy" ON public.seo_internal_link_opportunities;
CREATE POLICY "seo_internal_link_opportunities_insert_policy"
ON public.seo_internal_link_opportunities
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_internal_link_opportunities_update_policy" ON public.seo_internal_link_opportunities;
CREATE POLICY "seo_internal_link_opportunities_update_policy"
ON public.seo_internal_link_opportunities
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_topic_clusters_select_policy" ON public.seo_topic_clusters;
CREATE POLICY "seo_topic_clusters_select_policy"
ON public.seo_topic_clusters
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "seo_topic_clusters_insert_policy" ON public.seo_topic_clusters;
CREATE POLICY "seo_topic_clusters_insert_policy"
ON public.seo_topic_clusters
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_topic_clusters_update_policy" ON public.seo_topic_clusters;
CREATE POLICY "seo_topic_clusters_update_policy"
ON public.seo_topic_clusters
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_content_plans_select_policy" ON public.seo_content_plans;
CREATE POLICY "seo_content_plans_select_policy"
ON public.seo_content_plans
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "seo_content_plans_insert_policy" ON public.seo_content_plans;
CREATE POLICY "seo_content_plans_insert_policy"
ON public.seo_content_plans
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_content_plans_update_policy" ON public.seo_content_plans;
CREATE POLICY "seo_content_plans_update_policy"
ON public.seo_content_plans
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_content_opportunities_select_policy" ON public.seo_content_opportunities;
CREATE POLICY "seo_content_opportunities_select_policy"
ON public.seo_content_opportunities
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

DROP POLICY IF EXISTS "seo_content_opportunities_insert_policy" ON public.seo_content_opportunities;
CREATE POLICY "seo_content_opportunities_insert_policy"
ON public.seo_content_opportunities
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DROP POLICY IF EXISTS "seo_content_opportunities_update_policy" ON public.seo_content_opportunities;
CREATE POLICY "seo_content_opportunities_update_policy"
ON public.seo_content_opportunities
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_seo_recommendation_runs'
      AND tgrelid = 'public.seo_recommendation_runs'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_seo_recommendation_runs
    BEFORE UPDATE ON public.seo_recommendation_runs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_seo_internal_link_opportunities'
      AND tgrelid = 'public.seo_internal_link_opportunities'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_seo_internal_link_opportunities
    BEFORE UPDATE ON public.seo_internal_link_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_seo_topic_clusters'
      AND tgrelid = 'public.seo_topic_clusters'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_seo_topic_clusters
    BEFORE UPDATE ON public.seo_topic_clusters
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_seo_content_plans'
      AND tgrelid = 'public.seo_content_plans'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_seo_content_plans
    BEFORE UPDATE ON public.seo_content_plans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_seo_content_opportunities'
      AND tgrelid = 'public.seo_content_opportunities'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_seo_content_opportunities
    BEFORE UPDATE ON public.seo_content_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
