
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_template_key') THEN
        CREATE TYPE public.booking_template_key AS ENUM ('consultation', 'real_estate', 'horeca', 'custom');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_entity_mode') THEN
        CREATE TYPE public.booking_entity_mode AS ENUM ('service', 'listing', 'experience', 'inquiry');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_slot_strategy') THEN
        CREATE TYPE public.booking_slot_strategy AS ENUM ('fixed_slot', 'property_aware', 'capacity_seating', 'flexible_window');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_profile_status') THEN
        CREATE TYPE public.booking_profile_status AS ENUM ('draft', 'active', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_capacity_mode') THEN
        CREATE TYPE public.booking_capacity_mode AS ENUM ('single', 'group', 'pooled', 'capacity');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_location_mode') THEN
        CREATE TYPE public.booking_location_mode AS ENUM ('remote', 'onsite', 'hybrid');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_service_visibility_status') THEN
        CREATE TYPE public.booking_service_visibility_status AS ENUM ('draft', 'published', 'hidden', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_resource_type') THEN
        CREATE TYPE public.booking_resource_type AS ENUM ('staff', 'agent', 'room', 'table_zone', 'property', 'generic_asset');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_location_type') THEN
        CREATE TYPE public.booking_location_type AS ENUM ('site', 'office', 'venue', 'property', 'remote');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_rule_scope_type') THEN
        CREATE TYPE public.booking_rule_scope_type AS ENUM ('workspace', 'service', 'resource', 'location');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_availability_rule_type') THEN
        CREATE TYPE public.booking_availability_rule_type AS ENUM ('recurring', 'date_override', 'seasonal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_reservation_status') THEN
        CREATE TYPE public.booking_reservation_status AS ENUM ('draft', 'pending_review', 'pending_confirmation', 'confirmed', 'completed', 'cancelled_by_customer', 'cancelled_by_workspace', 'no_show', 'expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_trigger_source') THEN
        CREATE TYPE public.booking_trigger_source AS ENUM ('system', 'operator', 'customer', 'public_flow', 'rule_engine');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_actor_type') THEN
        CREATE TYPE public.booking_actor_type AS ENUM ('system', 'user', 'workspace_manager', 'customer', 'anonymous');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_notification_event_type') THEN
        CREATE TYPE public.booking_notification_event_type AS ENUM ('reservation_created', 'reservation_pending_review', 'reservation_confirmed', 'reservation_cancelled', 'reservation_completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_notification_channel') THEN
        CREATE TYPE public.booking_notification_channel AS ENUM ('email', 'internal_dashboard', 'sms', 'webhook');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_notification_delivery_status') THEN
        CREATE TYPE public.booking_notification_delivery_status AS ENUM ('pending', 'sent', 'failed', 'skipped');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_workspace_booking_enabled(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.workspace_tier = 'pro'
      AND w.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_booking_workspace(p_workspace_id uuid, p_capability_key text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_workspace_booking_enabled(p_workspace_id)
    AND public.can_access_workspace(p_workspace_id, p_capability_key);
$$;

CREATE OR REPLACE FUNCTION public.booking_build_public_reference()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path TO 'public'
AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

CREATE OR REPLACE FUNCTION public.set_booking_public_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.public_reference IS NULL OR btrim(NEW.public_reference) = '' THEN
    NEW.public_reference := public.booking_build_public_reference();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.booking_template_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_key text NOT NULL DEFAULT 'primary',
  template_key public.booking_template_key NOT NULL,
  status public.booking_profile_status NOT NULL DEFAULT 'draft',
  entity_mode public.booking_entity_mode NOT NULL DEFAULT 'service',
  slot_strategy public.booking_slot_strategy NOT NULL DEFAULT 'fixed_slot',
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  branding_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  analytics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  placement_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, profile_key)
);

CREATE TABLE IF NOT EXISTS public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_profile_id uuid NOT NULL REFERENCES public.booking_template_profiles(id) ON DELETE CASCADE,
  service_key text NOT NULL,
  service_type text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
  lead_time_minutes integer NOT NULL DEFAULT 0 CHECK (lead_time_minutes >= 0),
  max_advance_days integer NOT NULL DEFAULT 90 CHECK (max_advance_days >= 0),
  capacity_mode public.booking_capacity_mode NOT NULL DEFAULT 'single',
  capacity_value integer NOT NULL DEFAULT 1 CHECK (capacity_value > 0),
  location_mode public.booking_location_mode NOT NULL DEFAULT 'onsite',
  visibility_status public.booking_service_visibility_status NOT NULL DEFAULT 'draft',
  requires_manual_review boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, service_key)
);

CREATE TABLE IF NOT EXISTS public.booking_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  resource_type public.booking_resource_type NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  capacity_value integer NOT NULL DEFAULT 1 CHECK (capacity_value > 0),
  attributes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS public.booking_staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.booking_resources(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role_label text,
  bio text,
  avatar_asset_url text,
  languages_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  specialties_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_bookable boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, resource_id)
);

CREATE TABLE IF NOT EXISTS public.booking_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  location_type public.booking_location_type NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  geo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity_value integer,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS public.booking_service_resources (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.booking_resources(id) ON DELETE CASCADE,
  assignment_mode text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, resource_id)
);

CREATE TABLE IF NOT EXISTS public.booking_service_locations (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.booking_services(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.booking_locations(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (service_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.booking_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_profile_id uuid REFERENCES public.booking_template_profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.booking_services(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.booking_resources(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.booking_locations(id) ON DELETE CASCADE,
  scope_type public.booking_rule_scope_type NOT NULL,
  rule_type public.booking_availability_rule_type NOT NULL,
  timezone text NOT NULL,
  weekday_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  starts_on date,
  ends_on date,
  date_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  time_windows_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_blackout_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.booking_services(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES public.booking_resources(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.booking_locations(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_blackout_windows_valid_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.booking_rule_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.booking_services(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  rule_type text NOT NULL,
  rule_value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_form_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_profile_id uuid NOT NULL REFERENCES public.booking_template_profiles(id) ON DELETE CASCADE,
  form_key text NOT NULL,
  title text NOT NULL,
  schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ui_schema_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, form_key, version)
);

CREATE TABLE IF NOT EXISTS public.booking_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  template_profile_id uuid NOT NULL REFERENCES public.booking_template_profiles(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.booking_services(id) ON DELETE RESTRICT,
  resource_id uuid REFERENCES public.booking_resources(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.booking_locations(id) ON DELETE SET NULL,
  form_definition_id uuid REFERENCES public.booking_form_definitions(id) ON DELETE SET NULL,
  public_reference text NOT NULL UNIQUE,
  customer_full_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size > 0),
  reservation_timezone text NOT NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status public.booking_reservation_status NOT NULL DEFAULT 'draft',
  source_channel text,
  source_campaign text,
  source_referrer text,
  attribution_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes_internal text,
  notes_customer text,
  requires_manual_review boolean NOT NULL DEFAULT false,
  manual_review_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  extension_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_reservations_valid_window CHECK (scheduled_end > scheduled_start)
);

CREATE TABLE IF NOT EXISTS public.booking_reservation_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  form_definition_id uuid REFERENCES public.booking_form_definitions(id) ON DELETE SET NULL,
  submitted_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_flags_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  from_status public.booking_reservation_status,
  to_status public.booking_reservation_status NOT NULL,
  trigger_source public.booking_trigger_source NOT NULL,
  actor_type public.booking_actor_type NOT NULL,
  actor_id uuid,
  reason text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.booking_notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  event_type public.booking_notification_event_type NOT NULL,
  channel public.booking_notification_channel NOT NULL,
  delivery_status public.booking_notification_delivery_status NOT NULL DEFAULT 'pending',
  provider_message_id text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_template_profiles_workspace_status_idx
  ON public.booking_template_profiles (workspace_id, status, template_key);
CREATE INDEX IF NOT EXISTS booking_services_workspace_visibility_idx
  ON public.booking_services (workspace_id, visibility_status, template_profile_id);
CREATE INDEX IF NOT EXISTS booking_resources_workspace_active_idx
  ON public.booking_resources (workspace_id, is_active, resource_type);
CREATE INDEX IF NOT EXISTS booking_locations_workspace_active_idx
  ON public.booking_locations (workspace_id, is_active, location_type);
CREATE INDEX IF NOT EXISTS booking_availability_rules_workspace_scope_idx
  ON public.booking_availability_rules (workspace_id, scope_type, priority);
CREATE INDEX IF NOT EXISTS booking_blackout_windows_workspace_window_idx
  ON public.booking_blackout_windows (workspace_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS booking_rule_definitions_workspace_priority_idx
  ON public.booking_rule_definitions (workspace_id, priority);
CREATE INDEX IF NOT EXISTS booking_form_definitions_workspace_active_idx
  ON public.booking_form_definitions (workspace_id, is_active, template_profile_id);
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_status_start_idx
  ON public.booking_reservations (workspace_id, status, scheduled_start);
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_service_start_idx
  ON public.booking_reservations (workspace_id, service_id, scheduled_start);
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_email_idx
  ON public.booking_reservations (workspace_id, customer_email);
CREATE INDEX IF NOT EXISTS booking_status_history_workspace_created_idx
  ON public.booking_status_history (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_notification_events_workspace_created_idx
  ON public.booking_notification_events (workspace_id, created_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'booking_reservations_resource_no_overlap'
    ) THEN
        ALTER TABLE public.booking_reservations
            ADD CONSTRAINT booking_reservations_resource_no_overlap
            EXCLUDE USING gist (
                resource_id WITH =,
                tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
            )
            WHERE (
                resource_id IS NOT NULL
                AND status = ANY (ARRAY['pending_review'::public.booking_reservation_status, 'pending_confirmation'::public.booking_reservation_status, 'confirmed'::public.booking_reservation_status])
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_booking_public_reference_trigger'
          AND tgrelid = 'public.booking_reservations'::regclass
    ) THEN
        CREATE TRIGGER set_booking_public_reference_trigger
        BEFORE INSERT ON public.booking_reservations
        FOR EACH ROW EXECUTE FUNCTION public.set_booking_public_reference();
    END IF;
END $$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'booking_template_profiles',
    'booking_services',
    'booking_resources',
    'booking_staff_profiles',
    'booking_locations',
    'booking_availability_rules',
    'booking_blackout_windows',
    'booking_rule_definitions',
    'booking_form_definitions',
    'booking_reservations'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'set_updated_at_' || table_name
        AND tgrelid = to_regclass(format('public.%I', table_name))
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
        'set_updated_at_' || table_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO public.capabilities (capability_key, name, description, metadata)
VALUES
  ('booking.read', 'Booking Read', 'Read booking configuration and reservation data in workspace scope.', jsonb_build_object('domain', 'booking')),
  ('booking.manage', 'Booking Manage', 'Create and update booking configuration and reservations in workspace scope.', jsonb_build_object('domain', 'booking')),
  ('booking.publish', 'Booking Publish', 'Publish booking profiles and public booking states in workspace scope.', jsonb_build_object('domain', 'booking')),
  ('booking.analytics', 'Booking Analytics', 'Read booking funnel and operational analytics in workspace scope.', jsonb_build_object('domain', 'booking'))
ON CONFLICT (capability_key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = public.capabilities.metadata || EXCLUDED.metadata,
  is_active = true,
  updated_at = now();

INSERT INTO public.role_capability_grants (role, capability_id, is_allowed)
SELECT
  r.role_name,
  c.id,
  CASE
    WHEN r.role_name = 'admin' THEN true
    WHEN r.role_name = 'manager' AND c.capability_key IN ('booking.read', 'booking.manage', 'booking.publish', 'booking.analytics') THEN true
    ELSE false
  END AS is_allowed
FROM (VALUES ('admin'::text), ('manager'::text), ('user'::text)) AS r(role_name)
CROSS JOIN public.capabilities c
WHERE c.capability_key IN ('booking.read', 'booking.manage', 'booking.publish', 'booking.analytics')
ON CONFLICT (role, capability_id)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  updated_at = now();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'booking_template_profiles',
    'booking_services',
    'booking_resources',
    'booking_staff_profiles',
    'booking_locations',
    'booking_service_resources',
    'booking_service_locations',
    'booking_availability_rules',
    'booking_blackout_windows',
    'booking_rule_definitions',
    'booking_form_definitions',
    'booking_reservations',
    'booking_reservation_intake',
    'booking_status_history',
    'booking_notification_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_select_policy ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert_policy ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update_policy ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete_policy ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_select_policy ON public.%I FOR SELECT USING (public.can_access_booking_workspace(workspace_id, ''booking.read''))',
      table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I_insert_policy ON public.%I FOR INSERT WITH CHECK (public.can_access_booking_workspace(workspace_id, ''booking.manage''))',
      table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I_update_policy ON public.%I FOR UPDATE USING (public.can_access_booking_workspace(workspace_id, ''booking.manage'')) WITH CHECK (public.can_access_booking_workspace(workspace_id, ''booking.manage''))',
      table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I_delete_policy ON public.%I FOR DELETE USING (public.can_access_booking_workspace(workspace_id, ''booking.manage''))',
      table_name,
      table_name
    );
  END LOOP;
END $$;

COMMIT;
