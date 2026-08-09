-- Outreach Control Center: universal, workspace-scoped governed outreach intelligence.

CREATE TYPE public.outreach_campaign_status AS ENUM ('draft', 'discovering', 'reviewing', 'strategy', 'scheduled', 'active', 'paused', 'completed', 'archived');
CREATE TYPE public.outreach_review_status AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');
CREATE TYPE public.outreach_job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'superseded');
CREATE TYPE public.outreach_source_type AS ENUM ('tavily_query', 'website', 'uploaded_csv', 'directory', 'market_monitor', 'manual', 'scrapling');
CREATE TYPE public.outreach_account_stage AS ENUM ('discovered', 'enriched', 'qualified', 'selected', 'contacted', 'replied', 'converted', 'closed');
CREATE TYPE public.outreach_lawful_basis AS ENUM ('explicit_consent', 'existing_customer', 'legitimate_interest_assessment', 'manual_warranty', 'blocked', 'unknown');
CREATE TYPE public.outreach_message_status AS ENUM ('draft', 'approved', 'scheduled', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'failed', 'stopped', 'unsubscribed');
CREATE TYPE public.outreach_event_type AS ENUM ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'received', 'replied', 'unsubscribed', 'interested', 'not_relevant', 'booked', 'manual_stop', 'campaign_paused');
CREATE TYPE public.outreach_suppression_kind AS ENUM ('email', 'domain', 'email_hash');
CREATE TYPE public.outreach_suppression_scope AS ENUM ('workspace', 'global');

CREATE TABLE public.outreach_workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  from_name text,
  from_email text,
  reply_to_email text,
  company_address text,
  daily_workspace_cap integer NOT NULL DEFAULT 25 CHECK (daily_workspace_cap >= 0 AND daily_workspace_cap <= 500),
  daily_sender_cap integer NOT NULL DEFAULT 20 CHECK (daily_sender_cap >= 0 AND daily_sender_cap <= 250),
  daily_domain_cap integer NOT NULL DEFAULT 2 CHECK (daily_domain_cap >= 0 AND daily_domain_cap <= 50),
  require_human_approval boolean NOT NULL DEFAULT true,
  warmup_enabled boolean NOT NULL DEFAULT true,
  allowed_lawful_bases public.outreach_lawful_basis[] NOT NULL DEFAULT ARRAY['explicit_consent','existing_customer','legitimate_interest_assessment','manual_warranty']::public.outreach_lawful_basis[],
  default_country text NOT NULL DEFAULT 'NL',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_id text,
  name text NOT NULL,
  brief text NOT NULL,
  icp_description text NOT NULL,
  target_sectors text[] NOT NULL DEFAULT '{}'::text[],
  target_geographies text[] NOT NULL DEFAULT '{}'::text[],
  source_types public.outreach_source_type[] NOT NULL DEFAULT ARRAY['tavily_query','website']::public.outreach_source_type[],
  exclusions text[] NOT NULL DEFAULT '{}'::text[],
  status public.outreach_campaign_status NOT NULL DEFAULT 'draft',
  review_status public.outreach_review_status NOT NULL DEFAULT 'pending',
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paused_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outreach_campaigns_workspace_status_idx ON public.outreach_campaigns (workspace_id, status, created_at DESC);
CREATE INDEX outreach_campaigns_review_idx ON public.outreach_campaigns (workspace_id, review_status, updated_at DESC);

CREATE TABLE public.outreach_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  source_type public.outreach_source_type NOT NULL,
  label text NOT NULL,
  source_url text,
  query text,
  status public.outreach_job_status NOT NULL DEFAULT 'queued',
  last_checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_sources_source_present CHECK (source_url IS NOT NULL OR query IS NOT NULL)
);

CREATE INDEX outreach_sources_workspace_campaign_idx ON public.outreach_sources (workspace_id, campaign_id, created_at DESC);

CREATE TABLE public.outreach_discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.outreach_sources(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (job_type IN ('generate_queries', 'search', 'extract', 'score', 'import')),
  status public.outreach_job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_id text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_discovery_running_locked CHECK (status <> 'running' OR locked_at IS NOT NULL),
  CONSTRAINT outreach_discovery_completed_timestamp CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX outreach_discovery_jobs_status_idx ON public.outreach_discovery_jobs (status, run_after, priority, created_at);
CREATE INDEX outreach_discovery_jobs_workspace_idx ON public.outreach_discovery_jobs (workspace_id, status, created_at DESC);

CREATE TABLE public.outreach_prospect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  domain text,
  website_url text,
  country text,
  sector text,
  company_size text,
  stage public.outreach_account_stage NOT NULL DEFAULT 'discovered',
  review_status public.outreach_review_status NOT NULL DEFAULT 'pending',
  fit_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  fit_summary text,
  why_now_trigger text,
  approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX outreach_accounts_workspace_domain_idx
  ON public.outreach_prospect_accounts (workspace_id, lower(domain))
  WHERE domain IS NOT NULL;
CREATE INDEX outreach_accounts_campaign_review_idx ON public.outreach_prospect_accounts (workspace_id, campaign_id, review_status, fit_score DESC);

CREATE TABLE public.outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.outreach_prospect_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  email text,
  email_hash text CHECK (email_hash IS NULL OR char_length(email_hash) = 64),
  full_name text,
  role_title text,
  contact_type text NOT NULL DEFAULT 'business' CHECK (contact_type IN ('role_mailbox', 'generic_business', 'named_business', 'personal', 'unknown')),
  source_url text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  lawful_basis public.outreach_lawful_basis NOT NULL DEFAULT 'unknown',
  lawful_basis_note text,
  lawful_basis_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  lawful_basis_approved_at timestamptz,
  review_status public.outreach_review_status NOT NULL DEFAULT 'pending',
  suppressed_at timestamptz,
  suppression_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_contacts_channel_present CHECK (email IS NOT NULL OR source_url IS NOT NULL)
);

CREATE UNIQUE INDEX outreach_contacts_workspace_email_idx
  ON public.outreach_contacts (workspace_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX outreach_contacts_account_idx ON public.outreach_contacts (account_id, review_status);
CREATE INDEX outreach_contacts_hash_idx ON public.outreach_contacts (workspace_id, email_hash) WHERE email_hash IS NOT NULL;

CREATE TABLE public.outreach_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.outreach_prospect_accounts(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.outreach_sources(id) ON DELETE SET NULL,
  canonical_url text NOT NULL,
  title text NOT NULL,
  excerpt text,
  content_hash text CHECK (content_hash IS NULL OR char_length(content_hash) = 64),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX outreach_knowledge_documents_account_url_idx ON public.outreach_knowledge_documents (account_id, lower(canonical_url));
CREATE INDEX outreach_knowledge_documents_workspace_idx ON public.outreach_knowledge_documents (workspace_id, campaign_id, retrieved_at DESC);

CREATE TABLE public.outreach_knowledge_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.outreach_prospect_accounts(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.outreach_knowledge_documents(id) ON DELETE CASCADE,
  claim_text text NOT NULL,
  claim_type text NOT NULL DEFAULT 'business_fact',
  confidence numeric(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  citation_url text,
  source_excerpt text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outreach_claims_account_idx ON public.outreach_knowledge_claims (account_id, confidence DESC);
CREATE INDEX outreach_claims_workspace_idx ON public.outreach_knowledge_claims (workspace_id, created_at DESC);

CREATE TABLE public.outreach_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.outreach_prospect_accounts(id) ON DELETE CASCADE,
  review_status public.outreach_review_status NOT NULL DEFAULT 'pending',
  account_summary text,
  fit_reasons text[] NOT NULL DEFAULT '{}'::text[],
  trigger_event text,
  offer_angle text,
  risk_flags text[] NOT NULL DEFAULT '{}'::text[],
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text NOT NULL DEFAULT 'operator',
  approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outreach_strategies_campaign_idx ON public.outreach_strategies (workspace_id, campaign_id, review_status, created_at DESC);

CREATE TABLE public.outreach_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES public.outreach_strategies(id) ON DELETE SET NULL,
  name text NOT NULL,
  status public.outreach_review_status NOT NULL DEFAULT 'pending',
  stop_rules text[] NOT NULL DEFAULT ARRAY['reply','bounce','complaint','unsubscribe','booked','manual_stop']::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outreach_sequences_campaign_idx ON public.outreach_sequences (workspace_id, campaign_id, status);

CREATE TABLE public.outreach_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES public.outreach_sequences(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  delay_days integer NOT NULL DEFAULT 0 CHECK (delay_days >= 0 AND delay_days <= 90),
  objective text NOT NULL,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  required_claim_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, position)
);

CREATE INDEX outreach_sequence_steps_workspace_idx ON public.outreach_sequence_steps (workspace_id, sequence_id, position);

CREATE TABLE public.outreach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.outreach_prospect_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.outreach_contacts(id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES public.outreach_sequences(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.outreach_sequence_steps(id) ON DELETE SET NULL,
  status public.outreach_message_status NOT NULL DEFAULT 'draft',
  subject text NOT NULL,
  preview_text text,
  body_text text,
  body_html text NOT NULL,
  personalization_basis text,
  risk_score numeric(5,2) NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  scheduled_for timestamptz,
  provider text,
  provider_message_id text,
  idempotency_key text,
  last_event_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX outreach_messages_provider_id_idx
  ON public.outreach_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX outreach_messages_idempotency_idx
  ON public.outreach_messages (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX outreach_messages_dispatch_idx ON public.outreach_messages (workspace_id, status, scheduled_for);

CREATE TABLE public.outreach_dispatch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.outreach_campaigns(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.outreach_messages(id) ON DELETE CASCADE,
  status public.outreach_job_status NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_id text,
  idempotency_key text NOT NULL,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_dispatch_running_locked CHECK (status <> 'running' OR locked_at IS NOT NULL),
  CONSTRAINT outreach_dispatch_completed_timestamp CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE UNIQUE INDEX outreach_dispatch_jobs_active_message_idx
  ON public.outreach_dispatch_jobs (message_id)
  WHERE status IN ('queued', 'running');
CREATE UNIQUE INDEX outreach_dispatch_jobs_idempotency_idx ON public.outreach_dispatch_jobs (idempotency_key);
CREATE INDEX outreach_dispatch_jobs_status_idx ON public.outreach_dispatch_jobs (status, run_after, priority, created_at);
CREATE INDEX outreach_dispatch_jobs_workspace_idx ON public.outreach_dispatch_jobs (workspace_id, status, created_at DESC);

CREATE TABLE public.outreach_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.outreach_prospect_accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.outreach_contacts(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.outreach_messages(id) ON DELETE SET NULL,
  event_type public.outreach_event_type NOT NULL,
  provider text,
  provider_event_id text,
  provider_message_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX outreach_events_provider_event_idx
  ON public.outreach_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX outreach_events_campaign_idx ON public.outreach_events (workspace_id, campaign_id, occurred_at DESC);
CREATE INDEX outreach_events_message_idx ON public.outreach_events (message_id, occurred_at DESC);

CREATE TABLE public.outreach_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scope public.outreach_suppression_scope NOT NULL DEFAULT 'workspace',
  kind public.outreach_suppression_kind NOT NULL,
  value text NOT NULL,
  reason text NOT NULL,
  source_event_id uuid REFERENCES public.outreach_events(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CONSTRAINT outreach_suppressions_workspace_scope CHECK ((scope = 'global' AND workspace_id IS NULL) OR (scope = 'workspace' AND workspace_id IS NOT NULL))
);

CREATE UNIQUE INDEX outreach_suppressions_unique_idx
  ON public.outreach_suppressions (scope, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, lower(value));
CREATE INDEX outreach_suppressions_workspace_idx ON public.outreach_suppressions (workspace_id, kind, created_at DESC);

CREATE TABLE public.outreach_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.outreach_prospect_accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.outreach_contacts(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.outreach_messages(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outreach_audit_events_workspace_idx ON public.outreach_audit_events (workspace_id, created_at DESC);
CREATE INDEX outreach_audit_events_campaign_idx ON public.outreach_audit_events (campaign_id, created_at DESC);

CREATE TRIGGER set_updated_at_outreach_workspace_settings BEFORE UPDATE ON public.outreach_workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_campaigns BEFORE UPDATE ON public.outreach_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_sources BEFORE UPDATE ON public.outreach_sources
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_discovery_jobs BEFORE UPDATE ON public.outreach_discovery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_accounts BEFORE UPDATE ON public.outreach_prospect_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_contacts BEFORE UPDATE ON public.outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_documents BEFORE UPDATE ON public.outreach_knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_strategies BEFORE UPDATE ON public.outreach_strategies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_sequences BEFORE UPDATE ON public.outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_sequence_steps BEFORE UPDATE ON public.outreach_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_messages BEFORE UPDATE ON public.outreach_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_outreach_dispatch_jobs BEFORE UPDATE ON public.outreach_dispatch_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.outreach_workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_prospect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_knowledge_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_dispatch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY outreach_settings_select_policy ON public.outreach_workspace_settings FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_settings_write_policy ON public.outreach_workspace_settings FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_settings_service_role_policy ON public.outreach_workspace_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_campaigns_select_policy ON public.outreach_campaigns FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_campaigns_write_policy ON public.outreach_campaigns FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_campaigns_service_role_policy ON public.outreach_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_sources_select_policy ON public.outreach_sources FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_sources_write_policy ON public.outreach_sources FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_sources_service_role_policy ON public.outreach_sources FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_discovery_jobs_select_policy ON public.outreach_discovery_jobs FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_discovery_jobs_write_policy ON public.outreach_discovery_jobs FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_discovery_jobs_service_role_policy ON public.outreach_discovery_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_accounts_select_policy ON public.outreach_prospect_accounts FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_accounts_write_policy ON public.outreach_prospect_accounts FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_accounts_service_role_policy ON public.outreach_prospect_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_contacts_select_policy ON public.outreach_contacts FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_contacts_write_policy ON public.outreach_contacts FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_contacts_service_role_policy ON public.outreach_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_documents_select_policy ON public.outreach_knowledge_documents FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_documents_write_policy ON public.outreach_knowledge_documents FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_documents_service_role_policy ON public.outreach_knowledge_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_claims_select_policy ON public.outreach_knowledge_claims FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_claims_write_policy ON public.outreach_knowledge_claims FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_claims_service_role_policy ON public.outreach_knowledge_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_strategies_select_policy ON public.outreach_strategies FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_strategies_write_policy ON public.outreach_strategies FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_strategies_service_role_policy ON public.outreach_strategies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_sequences_select_policy ON public.outreach_sequences FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_sequences_write_policy ON public.outreach_sequences FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_sequences_service_role_policy ON public.outreach_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_steps_select_policy ON public.outreach_sequence_steps FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_steps_write_policy ON public.outreach_sequence_steps FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_steps_service_role_policy ON public.outreach_sequence_steps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_messages_select_policy ON public.outreach_messages FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_messages_write_policy ON public.outreach_messages FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_messages_service_role_policy ON public.outreach_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_dispatch_jobs_select_policy ON public.outreach_dispatch_jobs FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_dispatch_jobs_write_policy ON public.outreach_dispatch_jobs FOR ALL USING (public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_dispatch_jobs_service_role_policy ON public.outreach_dispatch_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_events_select_policy ON public.outreach_events FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_events_service_role_policy ON public.outreach_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_suppressions_select_policy ON public.outreach_suppressions FOR SELECT USING (workspace_id IS NULL OR public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_suppressions_write_policy ON public.outreach_suppressions FOR ALL USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write')) WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_suppressions_service_role_policy ON public.outreach_suppressions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY outreach_audit_events_select_policy ON public.outreach_audit_events FOR SELECT USING (public.can_access_workspace(workspace_id, 'content.read'));
CREATE POLICY outreach_audit_events_insert_policy ON public.outreach_audit_events FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));
CREATE POLICY outreach_audit_events_service_role_policy ON public.outreach_audit_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.claim_next_outreach_discovery_job(p_worker_id text)
RETURNS public.outreach_discovery_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.outreach_discovery_jobs;
BEGIN
  UPDATE public.outreach_discovery_jobs
  SET status = 'running',
      locked_at = now(),
      worker_id = p_worker_id,
      attempts = attempts + 1,
      result_summary = jsonb_build_object('worker_id', p_worker_id, 'claimed_at', now()) || result_summary
  WHERE id = (
    SELECT id
    FROM public.outreach_discovery_jobs
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

  UPDATE public.outreach_campaigns
  SET status = 'discovering'
  WHERE id = v_job.campaign_id
    AND status IN ('draft', 'reviewing');

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_outreach_dispatch_job(p_worker_id text)
RETURNS public.outreach_dispatch_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.outreach_dispatch_jobs;
BEGIN
  UPDATE public.outreach_dispatch_jobs
  SET status = 'running',
      locked_at = now(),
      worker_id = p_worker_id,
      attempts = attempts + 1,
      result_summary = jsonb_build_object('worker_id', p_worker_id, 'claimed_at', now()) || result_summary
  WHERE id = (
    SELECT j.id
    FROM public.outreach_dispatch_jobs j
    JOIN public.outreach_messages m ON m.id = j.message_id
    JOIN public.outreach_campaigns c ON c.id = j.campaign_id
    WHERE j.status = 'queued'
      AND j.run_after <= now()
      AND j.attempts < j.max_attempts
      AND m.status IN ('approved', 'scheduled')
      AND c.status IN ('scheduled', 'active')
    ORDER BY j.priority ASC, j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.outreach_messages
  SET status = 'sending'
  WHERE id = v_job.message_id;

  RETURN v_job;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_outreach_discovery_job(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_next_outreach_dispatch_job(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_outreach_discovery_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_outreach_dispatch_job(text) TO service_role;
