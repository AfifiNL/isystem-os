-- Universal governance hardening for the Business OS spine and adjacent operators.

BEGIN;

INSERT INTO public.capabilities (capability_key, name, description, metadata)
VALUES
  ('outreach.read', 'Outreach Read', 'Read outreach campaigns, accounts, contacts, messages, and audit trails in workspace scope.', jsonb_build_object('domain', 'outreach')),
  ('outreach.write', 'Outreach Write', 'Create and update governed outreach campaigns, sources, accounts, contacts, messages, and jobs in workspace scope.', jsonb_build_object('domain', 'outreach')),
  ('outreach.manage', 'Outreach Manage', 'Administer outreach suppressions, settings, and destructive outreach operations in workspace scope.', jsonb_build_object('domain', 'outreach')),
  ('privacy.read', 'Privacy Read', 'Read workspace privacy settings and data-subject request records in workspace scope.', jsonb_build_object('domain', 'privacy')),
  ('privacy.manage', 'Privacy Manage', 'Manage workspace privacy settings and data-subject request fulfillment in workspace scope.', jsonb_build_object('domain', 'privacy'))
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
    ELSE false
  END
FROM (VALUES ('admin'::text), ('manager'::text), ('user'::text)) AS roles(role_name)
CROSS JOIN public.capabilities c
WHERE c.capability_key IN ('outreach.read', 'outreach.write', 'outreach.manage', 'privacy.read', 'privacy.manage')
ON CONFLICT (role, capability_id)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  updated_at = now();

DO $$
DECLARE
  v_table text;
BEGIN
  IF to_regclass('public.outreach_workspace_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_settings_select_policy ON public.outreach_workspace_settings;
    DROP POLICY IF EXISTS outreach_settings_write_policy ON public.outreach_workspace_settings;
  END IF;
  IF to_regclass('public.outreach_prospect_accounts') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_accounts_select_policy ON public.outreach_prospect_accounts;
    DROP POLICY IF EXISTS outreach_accounts_write_policy ON public.outreach_prospect_accounts;
  END IF;
  IF to_regclass('public.outreach_knowledge_documents') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_documents_select_policy ON public.outreach_knowledge_documents;
    DROP POLICY IF EXISTS outreach_documents_write_policy ON public.outreach_knowledge_documents;
  END IF;
  IF to_regclass('public.outreach_knowledge_claims') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_claims_select_policy ON public.outreach_knowledge_claims;
    DROP POLICY IF EXISTS outreach_claims_write_policy ON public.outreach_knowledge_claims;
  END IF;
  IF to_regclass('public.outreach_sequence_steps') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_steps_select_policy ON public.outreach_sequence_steps;
    DROP POLICY IF EXISTS outreach_steps_write_policy ON public.outreach_sequence_steps;
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'outreach_workspace_settings',
    'outreach_campaigns',
    'outreach_sources',
    'outreach_discovery_jobs',
    'outreach_prospect_accounts',
    'outreach_contacts',
    'outreach_knowledge_documents',
    'outreach_knowledge_claims',
    'outreach_strategies',
    'outreach_sequences',
    'outreach_sequence_steps',
    'outreach_messages',
    'outreach_dispatch_jobs'
  ]
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_select_policy', v_table);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_write_policy', v_table);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (public.can_access_workspace(workspace_id, %L))', v_table || '_select_policy', v_table, 'outreach.read');
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (public.can_access_workspace(workspace_id, %L)) WITH CHECK (public.can_access_workspace(workspace_id, %L))', v_table || '_write_policy', v_table, 'outreach.write', 'outreach.write');
    END IF;
  END LOOP;

  IF to_regclass('public.outreach_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_events_select_policy ON public.outreach_events;
    CREATE POLICY outreach_events_select_policy
      ON public.outreach_events
      FOR SELECT
      USING (public.can_access_workspace(workspace_id, 'outreach.read'));
  END IF;

  IF to_regclass('public.outreach_suppressions') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_suppressions_select_policy ON public.outreach_suppressions;
    DROP POLICY IF EXISTS outreach_suppressions_write_policy ON public.outreach_suppressions;
    CREATE POLICY outreach_suppressions_select_policy
      ON public.outreach_suppressions
      FOR SELECT
      USING (workspace_id IS NULL OR public.can_access_workspace(workspace_id, 'outreach.read'));
    CREATE POLICY outreach_suppressions_write_policy
      ON public.outreach_suppressions
      FOR ALL
      USING (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'outreach.manage'))
      WITH CHECK (workspace_id IS NOT NULL AND public.can_access_workspace(workspace_id, 'outreach.manage'));
  END IF;

  IF to_regclass('public.outreach_audit_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS outreach_audit_events_select_policy ON public.outreach_audit_events;
    DROP POLICY IF EXISTS outreach_audit_events_insert_policy ON public.outreach_audit_events;
    CREATE POLICY outreach_audit_events_select_policy
      ON public.outreach_audit_events
      FOR SELECT
      USING (public.can_access_workspace(workspace_id, 'outreach.read'));
    CREATE POLICY outreach_audit_events_insert_policy
      ON public.outreach_audit_events
      FOR INSERT
      WITH CHECK (public.can_access_workspace(workspace_id, 'outreach.write'));
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.workspace_gdpr_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "workspace_gdpr_settings_workspace_members_all" ON public.workspace_gdpr_settings;
    DROP POLICY IF EXISTS workspace_gdpr_settings_read_policy ON public.workspace_gdpr_settings;
    DROP POLICY IF EXISTS workspace_gdpr_settings_manage_policy ON public.workspace_gdpr_settings;
    CREATE POLICY workspace_gdpr_settings_read_policy
      ON public.workspace_gdpr_settings
      FOR SELECT
      USING (public.can_access_workspace(workspace_id, 'privacy.read'));
    CREATE POLICY workspace_gdpr_settings_manage_policy
      ON public.workspace_gdpr_settings
      FOR ALL
      USING (public.can_access_workspace(workspace_id, 'privacy.manage'))
      WITH CHECK (public.can_access_workspace(workspace_id, 'privacy.manage'));
  END IF;

  IF to_regclass('public.workspace_gdpr_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "workspace_gdpr_requests_workspace_members_all" ON public.workspace_gdpr_requests;
    DROP POLICY IF EXISTS workspace_gdpr_requests_read_policy ON public.workspace_gdpr_requests;
    DROP POLICY IF EXISTS workspace_gdpr_requests_manage_policy ON public.workspace_gdpr_requests;
    CREATE POLICY workspace_gdpr_requests_read_policy
      ON public.workspace_gdpr_requests
      FOR SELECT
      USING (public.can_access_workspace(workspace_id, 'privacy.read'));
    CREATE POLICY workspace_gdpr_requests_manage_policy
      ON public.workspace_gdpr_requests
      FOR ALL
      USING (public.can_access_workspace(workspace_id, 'privacy.manage'))
      WITH CHECK (public.can_access_workspace(workspace_id, 'privacy.manage'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_payment_webhook_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment_webhook_events is append-only';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'payment_webhook_events can only be transitioned by service role';
    END IF;

    IF ROW(
      OLD.id,
      OLD.workspace_id,
      OLD.booking_payment_id,
      OLD.reservation_id,
      OLD.provider,
      OLD.provider_event_id,
      OLD.provider_event_type,
      OLD.verification_status,
      OLD.verification_mode,
      OLD.raw_body_sha256,
      OLD.headers_json,
      OLD.payload_json,
      OLD.resource_json,
      OLD.delivery_attempt,
      OLD.received_at,
      OLD.metadata,
      OLD.created_at
    ) IS DISTINCT FROM ROW(
      NEW.id,
      NEW.workspace_id,
      NEW.booking_payment_id,
      NEW.reservation_id,
      NEW.provider,
      NEW.provider_event_id,
      NEW.provider_event_type,
      NEW.verification_status,
      NEW.verification_mode,
      NEW.raw_body_sha256,
      NEW.headers_json,
      NEW.payload_json,
      NEW.resource_json,
      NEW.delivery_attempt,
      NEW.received_at,
      NEW.metadata,
      NEW.created_at
    ) THEN
      RAISE EXCEPTION 'payment_webhook_events evidence columns are immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.payment_webhook_events') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS prevent_payment_webhook_event_mutation ON public.payment_webhook_events;
    CREATE TRIGGER prevent_payment_webhook_event_mutation
      BEFORE UPDATE OR DELETE ON public.payment_webhook_events
      FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_webhook_event_mutation();
  END IF;
END $$;

COMMIT;
