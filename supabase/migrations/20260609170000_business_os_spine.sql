-- Business OS spine: universal workspace-scoped customer, workflow, integration, and quote primitives.

DO $$
BEGIN
  CREATE TYPE public.business_lifecycle_status AS ENUM ('prospect', 'lead', 'qualified', 'customer', 'active', 'paused', 'churned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.business_work_item_status AS ENUM ('open', 'in_progress', 'blocked', 'done', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.business_work_item_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.business_integration_status AS ENUM ('unknown', 'healthy', 'degraded', 'failing', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.business_workflow_run_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'retrying');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  legal_name text,
  customer_kind text NOT NULL DEFAULT 'organization' CHECK (customer_kind IN ('organization', 'person')),
  lifecycle_status public.business_lifecycle_status NOT NULL DEFAULT 'lead',
  primary_email text,
  primary_phone text,
  portal_client_id uuid REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_module text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_customers_portal_client_unique
  ON public.workspace_customers (workspace_id, portal_client_id)
  WHERE portal_client_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_customers_primary_email_unique
  ON public.workspace_customers (workspace_id, lower(primary_email))
  WHERE primary_email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS workspace_customers_workspace_status_idx
  ON public.workspace_customers (workspace_id, lifecycle_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS workspace_customers_owner_idx
  ON public.workspace_customers (workspace_id, owner_profile_id)
  WHERE owner_profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workspace_customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.workspace_customers(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text,
  phone text,
  role_label text,
  is_primary boolean NOT NULL DEFAULT false,
  consent_status text NOT NULL DEFAULT 'unknown' CHECK (consent_status IN ('unknown', 'subscribed', 'unsubscribed', 'do_not_contact')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_customer_contacts_reachable CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_customer_contacts_email_unique
  ON public.workspace_customer_contacts (workspace_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_customer_contacts_customer_idx
  ON public.workspace_customer_contacts (workspace_id, customer_id, is_primary DESC);

CREATE TABLE IF NOT EXISTS public.workspace_customer_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.workspace_customers(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  summary text NOT NULL,
  body text,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'system',
  source_module text NOT NULL,
  source_table text,
  source_id uuid,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'portal', 'public')),
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_customer_timeline_idempotency_unique
  ON public.workspace_customer_timeline_events (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS workspace_customer_timeline_customer_idx
  ON public.workspace_customer_timeline_events (workspace_id, customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS workspace_customer_timeline_event_type_idx
  ON public.workspace_customer_timeline_events (workspace_id, event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.workspace_customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'task',
  status public.business_work_item_status NOT NULL DEFAULT 'open',
  priority public.business_work_item_priority NOT NULL DEFAULT 'normal',
  assigned_to_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  source_module text,
  source_entity_type text,
  source_entity_id uuid,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_work_items_idempotency_unique
  ON public.workspace_work_items (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS workspace_work_items_workspace_status_idx
  ON public.workspace_work_items (workspace_id, status, priority DESC, due_at NULLS LAST);
CREATE INDEX IF NOT EXISTS workspace_work_items_assignee_idx
  ON public.workspace_work_items (workspace_id, assigned_to_profile_id, status, due_at)
  WHERE assigned_to_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_work_items_source_idx
  ON public.workspace_work_items (workspace_id, source_module, source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.workspace_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  source_module text NOT NULL,
  source_entity_type text,
  source_entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_workflow_events_idempotency_unique
  ON public.workspace_workflow_events (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS workspace_workflow_events_workspace_idx
  ON public.workspace_workflow_events (workspace_id, event_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_workflow_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  condition_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_workflow_rules_workspace_idx
  ON public.workspace_workflow_rules (workspace_id, is_enabled, trigger_key);

CREATE TABLE IF NOT EXISTS public.workspace_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.workspace_workflow_rules(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.workspace_workflow_events(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES public.workspace_work_items(id) ON DELETE SET NULL,
  status public.business_workflow_run_status NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0 AND max_attempts <= 25),
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_id text,
  idempotency_key text,
  trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_workflow_runs_idempotency_unique
  ON public.workspace_workflow_runs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_workflow_runs_claim_idx
  ON public.workspace_workflow_runs (status, run_after, created_at)
  WHERE status IN ('queued', 'retrying');
CREATE INDEX IF NOT EXISTS workspace_workflow_runs_workspace_idx
  ON public.workspace_workflow_runs (workspace_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  integration_key text NOT NULL,
  status public.business_integration_status NOT NULL DEFAULT 'unknown',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  rate_limit_reset_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, integration_key)
);

CREATE INDEX IF NOT EXISTS workspace_integrations_workspace_status_idx
  ON public.workspace_integrations (workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_integration_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.workspace_integrations(id) ON DELETE CASCADE,
  status public.business_integration_status NOT NULL DEFAULT 'unknown',
  checked_at timestamptz NOT NULL DEFAULT now(),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  status_code integer,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_integration_health_checks_idx
  ON public.workspace_integration_health_checks (workspace_id, integration_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.workspace_integrations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_integration_events_provider_unique
  ON public.workspace_integration_events (workspace_id, provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_integration_events_workspace_idx
  ON public.workspace_integration_events (workspace_id, provider, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.workspace_customers(id) ON DELETE SET NULL,
  portal_client_id uuid REFERENCES public.client_portal_users(id) ON DELETE SET NULL,
  quote_number text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted', 'void')),
  issue_date date NOT NULL DEFAULT current_date,
  expiry_date date,
  currency text NOT NULL DEFAULT 'EUR' CHECK (char_length(currency) = 3 AND currency = upper(currency)),
  subtotal_cents bigint NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  btw_cents bigint NOT NULL DEFAULT 0 CHECK (btw_cents >= 0),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  accepted_at timestamptz,
  converted_invoice_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, quote_number)
);

CREATE INDEX IF NOT EXISTS workspace_quotes_customer_idx
  ON public.workspace_quotes (workspace_id, customer_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.workspace_quotes(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents bigint NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  btw_rate_bp integer NOT NULL DEFAULT 2100 CHECK (btw_rate_bp IN (0, 900, 2100)),
  amount_excl_btw_cents bigint NOT NULL DEFAULT 0 CHECK (amount_excl_btw_cents >= 0),
  btw_amount_cents bigint NOT NULL DEFAULT 0 CHECK (btw_amount_cents >= 0),
  amount_incl_btw_cents bigint NOT NULL DEFAULT 0 CHECK (amount_incl_btw_cents >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, position)
);

CREATE INDEX IF NOT EXISTS workspace_quote_lines_quote_idx
  ON public.workspace_quote_lines (workspace_id, quote_id, position);

CREATE TABLE IF NOT EXISTS public.workspace_commercial_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.workspace_customers(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.workspace_quotes(id) ON DELETE SET NULL,
  link_type text NOT NULL,
  linked_record_type text NOT NULL,
  linked_record_id uuid,
  linked_record_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_commercial_links_target_present CHECK (linked_record_id IS NOT NULL OR linked_record_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS workspace_commercial_links_customer_idx
  ON public.workspace_commercial_links (workspace_id, customer_id, link_type)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_commercial_links_target_idx
  ON public.workspace_commercial_links (workspace_id, linked_record_type, linked_record_id)
  WHERE linked_record_id IS NOT NULL;

CREATE TRIGGER set_updated_at_workspace_customers BEFORE UPDATE ON public.workspace_customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_customer_contacts BEFORE UPDATE ON public.workspace_customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_work_items BEFORE UPDATE ON public.workspace_work_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_workflow_rules BEFORE UPDATE ON public.workspace_workflow_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_workflow_runs BEFORE UPDATE ON public.workspace_workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_integrations BEFORE UPDATE ON public.workspace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_quotes BEFORE UPDATE ON public.workspace_quotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_quote_lines BEFORE UPDATE ON public.workspace_quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_workspace_commercial_links BEFORE UPDATE ON public.workspace_commercial_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.workspace_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_customer_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_integration_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_commercial_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_customers_select ON public.workspace_customers FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_customers_insert ON public.workspace_customers FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_customers_update ON public.workspace_customers FOR UPDATE USING (public.can_access_workspace(workspace_id, 'business_os.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_customers_delete ON public.workspace_customers FOR DELETE USING (public.can_access_workspace(workspace_id, 'business_os.manage'));

CREATE POLICY workspace_customer_contacts_select ON public.workspace_customer_contacts FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_customer_contacts_insert ON public.workspace_customer_contacts FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_customer_contacts_update ON public.workspace_customer_contacts FOR UPDATE USING (public.can_access_workspace(workspace_id, 'business_os.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_customer_contacts_delete ON public.workspace_customer_contacts FOR DELETE USING (public.can_access_workspace(workspace_id, 'business_os.manage'));

CREATE POLICY workspace_customer_timeline_select ON public.workspace_customer_timeline_events FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_customer_timeline_service_role ON public.workspace_customer_timeline_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workspace_work_items_select ON public.workspace_work_items FOR SELECT USING (public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_work_items_insert ON public.workspace_work_items FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_work_items_update ON public.workspace_work_items FOR UPDATE USING (public.can_access_workspace(workspace_id, 'business_os.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_work_items_delete ON public.workspace_work_items FOR DELETE USING (public.can_access_workspace(workspace_id, 'business_os.manage'));

CREATE POLICY workspace_workflow_events_select ON public.workspace_workflow_events FOR SELECT USING (public.can_access_workspace(workspace_id, 'workflow.read'));
CREATE POLICY workspace_workflow_events_service_role ON public.workspace_workflow_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY workspace_workflow_rules_select ON public.workspace_workflow_rules FOR SELECT USING (public.can_access_workspace(workspace_id, 'workflow.read'));
CREATE POLICY workspace_workflow_rules_insert ON public.workspace_workflow_rules FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'workflow.manage'));
CREATE POLICY workspace_workflow_rules_update ON public.workspace_workflow_rules FOR UPDATE USING (public.can_access_workspace(workspace_id, 'workflow.manage')) WITH CHECK (public.can_access_workspace(workspace_id, 'workflow.manage'));
CREATE POLICY workspace_workflow_rules_delete ON public.workspace_workflow_rules FOR DELETE USING (public.can_access_workspace(workspace_id, 'workflow.manage'));
CREATE POLICY workspace_workflow_runs_select ON public.workspace_workflow_runs FOR SELECT USING (public.can_access_workspace(workspace_id, 'workflow.read'));
CREATE POLICY workspace_workflow_runs_service_role ON public.workspace_workflow_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workspace_integrations_select ON public.workspace_integrations FOR SELECT USING (public.can_access_workspace(workspace_id, 'integrations.read'));
CREATE POLICY workspace_integrations_insert ON public.workspace_integrations FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'integrations.manage'));
CREATE POLICY workspace_integrations_update ON public.workspace_integrations FOR UPDATE USING (public.can_access_workspace(workspace_id, 'integrations.manage')) WITH CHECK (public.can_access_workspace(workspace_id, 'integrations.manage'));
CREATE POLICY workspace_integrations_delete ON public.workspace_integrations FOR DELETE USING (public.can_access_workspace(workspace_id, 'integrations.manage'));
CREATE POLICY workspace_integration_health_select ON public.workspace_integration_health_checks FOR SELECT USING (public.can_access_workspace(workspace_id, 'integrations.read'));
CREATE POLICY workspace_integration_health_service_role ON public.workspace_integration_health_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY workspace_integration_events_select ON public.workspace_integration_events FOR SELECT USING (public.can_access_workspace(workspace_id, 'integrations.read'));
CREATE POLICY workspace_integration_events_service_role ON public.workspace_integration_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workspace_quotes_select ON public.workspace_quotes FOR SELECT USING (public.can_access_workspace(workspace_id, 'quotes.read'));
CREATE POLICY workspace_quotes_insert ON public.workspace_quotes FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'quotes.write'));
CREATE POLICY workspace_quotes_update ON public.workspace_quotes FOR UPDATE USING (public.can_access_workspace(workspace_id, 'quotes.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'quotes.write'));
CREATE POLICY workspace_quotes_delete ON public.workspace_quotes FOR DELETE USING (public.can_access_workspace(workspace_id, 'quotes.write'));
CREATE POLICY workspace_quote_lines_select ON public.workspace_quote_lines FOR SELECT USING (public.can_access_workspace(workspace_id, 'quotes.read'));
CREATE POLICY workspace_quote_lines_insert ON public.workspace_quote_lines FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'quotes.write'));
CREATE POLICY workspace_quote_lines_update ON public.workspace_quote_lines FOR UPDATE USING (public.can_access_workspace(workspace_id, 'quotes.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'quotes.write'));
CREATE POLICY workspace_quote_lines_delete ON public.workspace_quote_lines FOR DELETE USING (public.can_access_workspace(workspace_id, 'quotes.write'));
CREATE POLICY workspace_commercial_links_select ON public.workspace_commercial_links FOR SELECT USING (public.can_access_workspace(workspace_id, 'quotes.read') OR public.can_access_workspace(workspace_id, 'business_os.read'));
CREATE POLICY workspace_commercial_links_insert ON public.workspace_commercial_links FOR INSERT WITH CHECK (public.can_access_workspace(workspace_id, 'quotes.write') OR public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_commercial_links_update ON public.workspace_commercial_links FOR UPDATE USING (public.can_access_workspace(workspace_id, 'quotes.write') OR public.can_access_workspace(workspace_id, 'business_os.write')) WITH CHECK (public.can_access_workspace(workspace_id, 'quotes.write') OR public.can_access_workspace(workspace_id, 'business_os.write'));
CREATE POLICY workspace_commercial_links_delete ON public.workspace_commercial_links FOR DELETE USING (public.can_access_workspace(workspace_id, 'quotes.write') OR public.can_access_workspace(workspace_id, 'business_os.manage'));

CREATE OR REPLACE FUNCTION public.claim_next_workspace_workflow_run(p_worker_id text)
RETURNS public.workspace_workflow_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run public.workspace_workflow_runs;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'worker_id is required';
  END IF;

  UPDATE public.workspace_workflow_runs
  SET status = 'running',
      locked_at = now(),
      worker_id = p_worker_id,
      attempts = attempts + 1,
      started_at = COALESCE(started_at, now())
  WHERE id = (
    SELECT id
    FROM public.workspace_workflow_runs
    WHERE status IN ('queued', 'retrying')
      AND run_after <= now()
      AND attempts < max_attempts
    ORDER BY run_after ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_run;

  IF v_run.id IS NOT NULL THEN
    INSERT INTO public.workspace_workflow_events (
      workspace_id,
      event_key,
      source_module,
      source_entity_type,
      source_entity_id,
      idempotency_key,
      payload
    )
    VALUES (
      v_run.workspace_id,
      'workflow.run_claimed',
      'workflow',
      'workspace_workflow_run',
      v_run.id,
      'workflow-run-claimed:' || v_run.id || ':' || v_run.attempts,
      jsonb_build_object('worker_id', p_worker_id)
    )
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING;
  END IF;

  RETURN v_run;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_workspace_workflow_run(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_workspace_workflow_run(text) TO service_role;

INSERT INTO public.capabilities (capability_key, name, description, metadata)
VALUES
  ('business_os.read', 'Business OS Read', 'Read Business OS customers, work items, and timeline data in workspace scope.', jsonb_build_object('domain', 'business_os')),
  ('business_os.write', 'Business OS Write', 'Create and update Business OS customers and work items in workspace scope.', jsonb_build_object('domain', 'business_os')),
  ('business_os.manage', 'Business OS Manage', 'Delete and administer Business OS records in workspace scope.', jsonb_build_object('domain', 'business_os')),
  ('workflow.read', 'Workflow Read', 'Read workflow rules, runs, and events in workspace scope.', jsonb_build_object('domain', 'workflow')),
  ('workflow.manage', 'Workflow Manage', 'Manage workflow rules in workspace scope.', jsonb_build_object('domain', 'workflow')),
  ('integrations.read', 'Integrations Read', 'Read integration configuration and health in workspace scope.', jsonb_build_object('domain', 'integrations')),
  ('integrations.manage', 'Integrations Manage', 'Manage integrations in workspace scope.', jsonb_build_object('domain', 'integrations')),
  ('quotes.read', 'Quotes Read', 'Read quotes and commercial links in workspace scope.', jsonb_build_object('domain', 'quotes')),
  ('quotes.write', 'Quotes Write', 'Create and update quotes and quote lines in workspace scope.', jsonb_build_object('domain', 'quotes'))
ON CONFLICT (capability_key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = public.capabilities.metadata || EXCLUDED.metadata,
  is_active = true,
  updated_at = now();

INSERT INTO public.role_capability_grants (role, capability_id, is_allowed)
SELECT
  role_name,
  c.id,
  CASE
    WHEN role_name = 'admin' THEN true
    WHEN role_name = 'manager' THEN true
    WHEN role_name = 'user' AND c.capability_key IN ('business_os.read', 'quotes.read') THEN true
    ELSE false
  END
FROM (VALUES ('admin'::text), ('manager'::text), ('user'::text)) AS roles(role_name)
CROSS JOIN public.capabilities c
WHERE c.capability_key IN (
  'business_os.read',
  'business_os.write',
  'business_os.manage',
  'workflow.read',
  'workflow.manage',
  'integrations.read',
  'integrations.manage',
  'quotes.read',
  'quotes.write'
)
ON CONFLICT (role, capability_id)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  updated_at = now();
