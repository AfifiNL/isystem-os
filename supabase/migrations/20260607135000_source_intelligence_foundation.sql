-- Source Intelligence Layer: universal, workspace-scoped evidence registry and ingestion queue.

CREATE TYPE public.source_quality AS ENUM ('unverified', 'low', 'medium', 'high', 'authoritative');
CREATE TYPE public.source_trust_tier AS ENUM ('unknown', 'community', 'vendor', 'industry', 'regulatory', 'internal');
CREATE TYPE public.source_evidence_type AS ENUM ('citation', 'supporting', 'contradicting', 'benchmark', 'definition', 'case_study', 'statistic');
CREATE TYPE public.source_ingestion_job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'superseded');

CREATE TABLE public.source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  canonical_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'website' CHECK (source_type IN ('website', 'rss', 'pdf', 'dataset', 'manual', 'internal', 'api')),
  quality public.source_quality NOT NULL DEFAULT 'unverified',
  trust_tier public.source_trust_tier NOT NULL DEFAULT 'unknown',
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  topic_tags text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  is_public_safe boolean NOT NULL DEFAULT false,
  crawl_frequency interval NOT NULL DEFAULT interval '7 days',
  last_ingested_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_registry_global_requires_public_safe CHECK (workspace_id IS NOT NULL OR is_public_safe = true)
);

CREATE UNIQUE INDEX source_registry_global_canonical_url_unique_idx
  ON public.source_registry (lower(canonical_url))
  WHERE workspace_id IS NULL;

CREATE UNIQUE INDEX source_registry_workspace_canonical_url_unique_idx
  ON public.source_registry (workspace_id, lower(canonical_url))
  WHERE workspace_id IS NOT NULL;

CREATE INDEX source_registry_workspace_quality_idx ON public.source_registry (workspace_id, quality, trust_tier);
CREATE INDEX source_registry_locale_idx ON public.source_registry (locale);
CREATE INDEX source_registry_topic_tags_idx ON public.source_registry USING gin (topic_tags);
CREATE INDEX source_registry_active_ingested_idx ON public.source_registry (is_active, last_ingested_at);

CREATE TABLE public.source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  registry_id uuid NOT NULL REFERENCES public.source_registry(id) ON DELETE CASCADE,
  canonical_url text NOT NULL,
  title text NOT NULL,
  description text,
  author text,
  publisher text,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  quality public.source_quality NOT NULL DEFAULT 'unverified',
  trust_tier public.source_trust_tier NOT NULL DEFAULT 'unknown',
  topic_tags text[] NOT NULL DEFAULT '{}'::text[],
  published_at timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  content_hash text CHECK (content_hash IS NULL OR char_length(content_hash) = 64),
  raw_text text,
  summary text,
  is_public_safe boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX source_documents_global_canonical_url_unique_idx
  ON public.source_documents (lower(canonical_url))
  WHERE workspace_id IS NULL;

CREATE UNIQUE INDEX source_documents_workspace_canonical_url_unique_idx
  ON public.source_documents (workspace_id, lower(canonical_url))
  WHERE workspace_id IS NOT NULL;

CREATE INDEX source_documents_registry_idx ON public.source_documents (registry_id, retrieved_at DESC);
CREATE INDEX source_documents_workspace_quality_idx ON public.source_documents (workspace_id, quality, trust_tier);
CREATE INDEX source_documents_published_idx ON public.source_documents (published_at DESC NULLS LAST);
CREATE INDEX source_documents_locale_idx ON public.source_documents (locale);
CREATE INDEX source_documents_topic_tags_idx ON public.source_documents USING gin (topic_tags);
CREATE INDEX source_documents_public_safe_idx ON public.source_documents (is_public_safe, quality, published_at DESC);

CREATE TABLE public.source_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  registry_id uuid NOT NULL REFERENCES public.source_registry(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  heading text,
  body text NOT NULL,
  token_count integer NOT NULL DEFAULT 0 CHECK (token_count >= 0),
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX source_chunks_document_idx ON public.source_chunks (document_id, chunk_index);
CREATE INDEX source_chunks_registry_idx ON public.source_chunks (registry_id);
CREATE INDEX source_chunks_workspace_idx ON public.source_chunks (workspace_id);

CREATE TABLE public.source_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.source_documents(id) ON DELETE CASCADE,
  chunk_id uuid REFERENCES public.source_chunks(id) ON DELETE SET NULL,
  registry_id uuid NOT NULL REFERENCES public.source_registry(id) ON DELETE CASCADE,
  claim_text text NOT NULL,
  normalized_claim text,
  evidence_type public.source_evidence_type NOT NULL DEFAULT 'supporting',
  confidence numeric(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  quality public.source_quality NOT NULL DEFAULT 'unverified',
  topic_tags text[] NOT NULL DEFAULT '{}'::text[],
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_claims_document_idx ON public.source_claims (document_id);
CREATE INDEX source_claims_chunk_idx ON public.source_claims (chunk_id);
CREATE INDEX source_claims_registry_idx ON public.source_claims (registry_id);
CREATE INDEX source_claims_workspace_quality_idx ON public.source_claims (workspace_id, quality, confidence DESC);
CREATE INDEX source_claims_evidence_type_idx ON public.source_claims (evidence_type);
CREATE INDEX source_claims_published_idx ON public.source_claims (published_at DESC NULLS LAST);
CREATE INDEX source_claims_locale_idx ON public.source_claims (locale);
CREATE INDEX source_claims_topic_tags_idx ON public.source_claims USING gin (topic_tags);

CREATE TABLE public.source_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  registry_id uuid REFERENCES public.source_registry(id) ON DELETE SET NULL,
  started_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.source_ingestion_job_status NOT NULL DEFAULT 'queued',
  run_reason text NOT NULL DEFAULT 'scheduled' CHECK (run_reason IN ('scheduled', 'manual', 'webhook', 'backfill', 'retry')),
  total_jobs integer NOT NULL DEFAULT 0 CHECK (total_jobs >= 0),
  completed_jobs integer NOT NULL DEFAULT 0 CHECK (completed_jobs >= 0),
  failed_jobs integer NOT NULL DEFAULT 0 CHECK (failed_jobs >= 0),
  superseded_jobs integer NOT NULL DEFAULT 0 CHECK (superseded_jobs >= 0),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_ingestion_runs_completed_timestamp_check CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX source_ingestion_runs_workspace_status_idx ON public.source_ingestion_runs (workspace_id, status, created_at DESC);
CREATE INDEX source_ingestion_runs_registry_idx ON public.source_ingestion_runs (registry_id, created_at DESC);

CREATE TABLE public.source_ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  registry_id uuid NOT NULL REFERENCES public.source_registry(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.source_ingestion_runs(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'nl', 'ar')),
  status public.source_ingestion_job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_id text,
  document_id uuid REFERENCES public.source_documents(id) ON DELETE SET NULL,
  input_hash text CHECK (input_hash IS NULL OR char_length(input_hash) = 64),
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_ingestion_jobs_running_locked_check CHECK (status <> 'running' OR locked_at IS NOT NULL),
  CONSTRAINT source_ingestion_jobs_completed_timestamp_check CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE UNIQUE INDEX source_ingestion_jobs_active_url_unique_idx
  ON public.source_ingestion_jobs (registry_id, lower(source_url), locale)
  WHERE status IN ('queued', 'running');

CREATE INDEX source_ingestion_jobs_status_run_idx ON public.source_ingestion_jobs (status, run_after, priority, created_at);
CREATE INDEX source_ingestion_jobs_workspace_status_idx ON public.source_ingestion_jobs (workspace_id, status, created_at DESC);
CREATE INDEX source_ingestion_jobs_registry_status_idx ON public.source_ingestion_jobs (registry_id, status, created_at DESC);
CREATE INDEX source_ingestion_jobs_locked_idx ON public.source_ingestion_jobs (status, locked_at) WHERE status = 'running';

CREATE TABLE public.content_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text NOT NULL,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.source_documents(id) ON DELETE SET NULL,
  source_claim_id uuid REFERENCES public.source_claims(id) ON DELETE SET NULL,
  evidence_type public.source_evidence_type NOT NULL DEFAULT 'citation',
  anchor_text text,
  citation_url text,
  citation_label text,
  confidence numeric(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  is_public_safe boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_evidence_links_source_present_check CHECK (source_document_id IS NOT NULL OR source_claim_id IS NOT NULL OR citation_url IS NOT NULL)
);

CREATE UNIQUE INDEX content_evidence_links_unique_claim_idx
  ON public.content_evidence_links (content_id, source_claim_id, evidence_type)
  WHERE source_claim_id IS NOT NULL;
CREATE INDEX content_evidence_links_content_idx ON public.content_evidence_links (workspace_id, template_id, content_id);
CREATE INDEX content_evidence_links_document_idx ON public.content_evidence_links (source_document_id);
CREATE INDEX content_evidence_links_claim_idx ON public.content_evidence_links (source_claim_id);
CREATE INDEX content_evidence_links_public_safe_idx ON public.content_evidence_links (is_public_safe, evidence_type, created_at DESC);

CREATE TABLE public.source_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.source_documents(id) ON DELETE SET NULL,
  source_claim_id uuid REFERENCES public.source_claims(id) ON DELETE SET NULL,
  content_evidence_link_id uuid REFERENCES public.content_evidence_links(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('accepted', 'rejected', 'flagged', 'corrected', 'public_citation_clicked', 'quality_adjusted')),
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  feedback_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_feedback_events_workspace_idx ON public.source_feedback_events (workspace_id, created_at DESC);
CREATE INDEX source_feedback_events_document_idx ON public.source_feedback_events (source_document_id, created_at DESC);
CREATE INDEX source_feedback_events_claim_idx ON public.source_feedback_events (source_claim_id, created_at DESC);
CREATE INDEX source_feedback_events_type_idx ON public.source_feedback_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_source_document_registry_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registry_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_registry_workspace_id FROM public.source_registry WHERE id = NEW.registry_id;
  IF v_registry_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'source_documents workspace/registry mismatch (workspace=% registry_workspace=%)', NEW.workspace_id, v_registry_workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_source_child_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_document_workspace_id uuid;
  v_document_registry_id uuid;
BEGIN
  SELECT workspace_id, registry_id INTO v_document_workspace_id, v_document_registry_id
  FROM public.source_documents
  WHERE id = NEW.document_id;

  IF v_document_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'source child workspace/document mismatch (workspace=% document_workspace=%)', NEW.workspace_id, v_document_workspace_id;
  END IF;
  IF v_document_registry_id IS DISTINCT FROM NEW.registry_id THEN
    RAISE EXCEPTION 'source child registry/document mismatch (registry=% document_registry=%)', NEW.registry_id, v_document_registry_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_source_job_registry_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registry_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_registry_workspace_id FROM public.source_registry WHERE id = NEW.registry_id;
  IF v_registry_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'source_ingestion_jobs workspace/registry mismatch (workspace=% registry_workspace=%)', NEW.workspace_id, v_registry_workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_content_evidence_link_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_content_workspace_id uuid;
  v_content_template_id text;
  v_document_workspace_id uuid;
  v_claim_workspace_id uuid;
BEGIN
  SELECT public.get_effective_content_workspace_id(ci.workspace_id, ci.template_id), ci.template_id
  INTO v_content_workspace_id, v_content_template_id
  FROM public.content_items ci
  WHERE ci.id = NEW.content_id;

  IF v_content_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'content_evidence_links workspace/content mismatch (workspace=% content_workspace=%)', NEW.workspace_id, v_content_workspace_id;
  END IF;
  IF v_content_template_id IS DISTINCT FROM NEW.template_id THEN
    RAISE EXCEPTION 'content_evidence_links template/content mismatch (template_id=% content_template_id=%)', NEW.template_id, v_content_template_id;
  END IF;

  IF NEW.source_document_id IS NOT NULL THEN
    SELECT workspace_id INTO v_document_workspace_id FROM public.source_documents WHERE id = NEW.source_document_id;
    IF v_document_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'content_evidence_links workspace/document mismatch';
    END IF;
  END IF;

  IF NEW.source_claim_id IS NOT NULL THEN
    SELECT workspace_id INTO v_claim_workspace_id FROM public.source_claims WHERE id = NEW.source_claim_id;
    IF v_claim_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'content_evidence_links workspace/claim mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_source_document_registry_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, registry_id ON public.source_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_source_document_registry_scope();

CREATE TRIGGER enforce_source_chunks_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, registry_id, document_id ON public.source_chunks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_source_child_scope();

CREATE TRIGGER enforce_source_claims_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, registry_id, document_id ON public.source_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_source_child_scope();

CREATE TRIGGER enforce_source_ingestion_jobs_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, registry_id ON public.source_ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_source_job_registry_scope();

CREATE TRIGGER enforce_content_evidence_link_scope_trigger
  BEFORE INSERT OR UPDATE OF workspace_id, template_id, content_id, source_document_id, source_claim_id ON public.content_evidence_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_evidence_link_scope();

CREATE TRIGGER set_updated_at_source_registry BEFORE UPDATE ON public.source_registry
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_source_documents BEFORE UPDATE ON public.source_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_source_chunks BEFORE UPDATE ON public.source_chunks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_source_claims BEFORE UPDATE ON public.source_claims
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_source_ingestion_runs BEFORE UPDATE ON public.source_ingestion_runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_source_ingestion_jobs BEFORE UPDATE ON public.source_ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_content_evidence_links BEFORE UPDATE ON public.content_evidence_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_feedback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_registry_select_policy ON public.source_registry
  FOR SELECT USING (workspace_id IS NULL OR public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_registry_insert_policy ON public.source_registry
  FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_registry_update_policy ON public.source_registry
  FOR UPDATE USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_registry_delete_policy ON public.source_registry
  FOR DELETE USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.delete'));
CREATE POLICY source_registry_service_role_policy ON public.source_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY source_documents_select_policy ON public.source_documents
  FOR SELECT USING ((workspace_id IS NULL AND is_public_safe = true) OR public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_documents_insert_policy ON public.source_documents
  FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_documents_update_policy ON public.source_documents
  FOR UPDATE USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_documents_delete_policy ON public.source_documents
  FOR DELETE USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.delete'));
CREATE POLICY source_documents_service_role_policy ON public.source_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY source_chunks_select_policy ON public.source_chunks
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_chunks_service_role_policy ON public.source_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY source_claims_select_policy ON public.source_claims
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_claims_service_role_policy ON public.source_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY source_ingestion_runs_select_policy ON public.source_ingestion_runs
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_ingestion_runs_insert_policy ON public.source_ingestion_runs
  FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_ingestion_runs_update_policy ON public.source_ingestion_runs
  FOR UPDATE USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_ingestion_runs_service_role_policy ON public.source_ingestion_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY source_ingestion_jobs_select_policy ON public.source_ingestion_jobs
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_ingestion_jobs_insert_policy ON public.source_ingestion_jobs
  FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_ingestion_jobs_update_policy ON public.source_ingestion_jobs
  FOR UPDATE USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_ingestion_jobs_service_role_policy ON public.source_ingestion_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY content_evidence_links_select_policy ON public.content_evidence_links
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY content_evidence_links_public_safe_select_policy ON public.content_evidence_links
  FOR SELECT TO anon, authenticated USING (
    is_public_safe = true
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = content_id AND ci.status = 'published'
    )
  );
CREATE POLICY content_evidence_links_insert_policy ON public.content_evidence_links
  FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY content_evidence_links_update_policy ON public.content_evidence_links
  FOR UPDATE USING (public.can_access_workspace(workspace_id, 'content.write'))
  WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY content_evidence_links_delete_policy ON public.content_evidence_links
  FOR DELETE USING (public.can_access_workspace(workspace_id, 'content.delete'));
CREATE POLICY content_evidence_links_service_role_policy ON public.content_evidence_links FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY source_feedback_events_select_policy ON public.source_feedback_events
  FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY source_feedback_events_insert_policy ON public.source_feedback_events
  FOR INSERT WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY source_feedback_events_service_role_policy ON public.source_feedback_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_next_source_ingestion_job(p_worker_id text)
RETURNS public.source_ingestion_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.source_ingestion_jobs;
BEGIN
  UPDATE public.source_ingestion_jobs
  SET status = 'running',
      locked_at = now(),
      worker_id = p_worker_id,
      attempts = attempts + 1,
      result_summary = jsonb_build_object('worker_id', p_worker_id, 'claimed_at', now()) || result_summary
  WHERE id = (
    SELECT id
    FROM public.source_ingestion_jobs
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

  UPDATE public.source_ingestion_runs
  SET status = 'running', started_at = COALESCE(started_at, now())
  WHERE id = v_job.run_id AND status = 'queued';

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.supersede_source_ingestion_jobs(p_registry_id uuid, p_source_url text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.source_registry WHERE id = p_registry_id;

  IF auth.role() IS DISTINCT FROM 'service_role'
    AND NOT public.can_access_workspace(v_workspace_id, 'content.write') THEN
    RAISE EXCEPTION 'Forbidden: content.write access required to supersede source ingestion jobs';
  END IF;

  UPDATE public.source_ingestion_jobs
  SET status = 'superseded', completed_at = now(), error_message = NULL
  WHERE registry_id = p_registry_id
    AND status IN ('queued', 'failed')
    AND (p_source_url IS NULL OR lower(source_url) = lower(p_source_url));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_source_ingestion_run_metrics(p_run_id uuid)
RETURNS public.source_ingestion_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run public.source_ingestion_runs;
  v_workspace_id uuid;
BEGIN
  SELECT workspace_id INTO v_workspace_id FROM public.source_ingestion_runs WHERE id = p_run_id;

  IF auth.role() IS DISTINCT FROM 'service_role'
    AND NOT public.can_access_workspace(v_workspace_id, 'content.write') THEN
    RAISE EXCEPTION 'Forbidden: content.write access required to refresh source ingestion metrics';
  END IF;

  UPDATE public.source_ingestion_runs r
  SET total_jobs = stats.total_jobs,
      completed_jobs = stats.completed_jobs,
      failed_jobs = stats.failed_jobs,
      superseded_jobs = stats.superseded_jobs,
      status = CASE
        WHEN stats.total_jobs > 0 AND stats.completed_jobs + stats.failed_jobs + stats.superseded_jobs >= stats.total_jobs THEN
          CASE WHEN stats.failed_jobs > 0 THEN 'failed'::public.source_ingestion_job_status ELSE 'completed'::public.source_ingestion_job_status END
        WHEN stats.running_jobs > 0 THEN 'running'::public.source_ingestion_job_status
        ELSE r.status
      END,
      completed_at = CASE
        WHEN stats.total_jobs > 0 AND stats.completed_jobs + stats.failed_jobs + stats.superseded_jobs >= stats.total_jobs THEN COALESCE(r.completed_at, now())
        ELSE r.completed_at
      END
  FROM (
    SELECT
      count(*)::integer AS total_jobs,
      count(*) FILTER (WHERE status = 'completed')::integer AS completed_jobs,
      count(*) FILTER (WHERE status = 'failed')::integer AS failed_jobs,
      count(*) FILTER (WHERE status = 'superseded')::integer AS superseded_jobs,
      count(*) FILTER (WHERE status = 'running')::integer AS running_jobs
    FROM public.source_ingestion_jobs
    WHERE run_id = p_run_id
  ) stats
  WHERE r.id = p_run_id
  RETURNING r.* INTO v_run;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_source_ingestion_job(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.supersede_source_ingestion_jobs(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_source_ingestion_run_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_source_ingestion_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.supersede_source_ingestion_jobs(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_source_ingestion_run_metrics(uuid) TO authenticated, service_role;
