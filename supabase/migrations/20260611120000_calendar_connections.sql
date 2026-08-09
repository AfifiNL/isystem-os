-- Migration for Calendar Connections & Event Mappings.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  account_email text NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary',
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  sync_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_calendar_connections_unique UNIQUE (workspace_id, provider, account_email, calendar_id)
);

CREATE TABLE IF NOT EXISTS public.booking_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.workspace_calendar_connections(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_calendar_events_unique UNIQUE (workspace_id, reservation_id, connection_id)
);

-- Enable RLS
ALTER TABLE public.workspace_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_calendar_events ENABLE ROW LEVEL SECURITY;

-- workspace_calendar_connections policies
CREATE POLICY workspace_calendar_connections_select_policy ON public.workspace_calendar_connections
  FOR SELECT USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY workspace_calendar_connections_insert_policy ON public.workspace_calendar_connections
  FOR INSERT WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY workspace_calendar_connections_update_policy ON public.workspace_calendar_connections
  FOR UPDATE USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'))
  WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY workspace_calendar_connections_delete_policy ON public.workspace_calendar_connections
  FOR DELETE USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

-- booking_calendar_events policies
CREATE POLICY booking_calendar_events_select_policy ON public.booking_calendar_events
  FOR SELECT USING (public.can_access_booking_workspace(workspace_id, 'booking.read'));

CREATE POLICY booking_calendar_events_insert_policy ON public.booking_calendar_events
  FOR INSERT WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY booking_calendar_events_update_policy ON public.booking_calendar_events
  FOR UPDATE USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'))
  WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY booking_calendar_events_delete_policy ON public.booking_calendar_events
  FOR DELETE USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

-- Triggers for auto updated_at
DROP TRIGGER IF EXISTS set_updated_at_workspace_calendar_connections ON public.workspace_calendar_connections;
CREATE TRIGGER set_updated_at_workspace_calendar_connections
  BEFORE UPDATE ON public.workspace_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_booking_calendar_events ON public.booking_calendar_events;
CREATE TRIGGER set_updated_at_booking_calendar_events
  BEFORE UPDATE ON public.booking_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;
