-- A remote booking that promises automatic Meet/Zoom provisioning must not
-- become confirmed until the customer-safe room is durably recorded.

CREATE OR REPLACE FUNCTION public.booking_enforce_confirmed_meeting_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  configured_provider text := 'none';
  configured_auto_create boolean := false;
BEGIN
  -- Reservation state changes and meeting mutation share one workspace lock.
  -- This makes concurrent confirm/cancel/delete paths serialize to one valid
  -- result and permits cleanup immediately after a committed cancellation.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.workspace_id::text || ':booking-meeting-policy', 0)
  );

  IF NEW.status <> 'confirmed'
     OR (
       TG_OP = 'UPDATE'
       AND OLD.status = 'confirmed'
       AND NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
       AND NEW.service_id IS NOT DISTINCT FROM OLD.service_id
     ) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(service.virtual_meeting_provider::text, 'none'),
    COALESCE(service.auto_create_virtual_meeting, false)
  INTO configured_provider, configured_auto_create
  FROM public.booking_services AS service
  WHERE service.id = NEW.service_id
    AND service.workspace_id = NEW.workspace_id;

  IF configured_auto_create
     AND configured_provider IN ('google_meet', 'zoom')
     AND NOT EXISTS (
       SELECT 1
       FROM public.booking_meetings AS meeting
       WHERE meeting.workspace_id = NEW.workspace_id
         AND meeting.reservation_id = NEW.id
         AND meeting.provider::text = configured_provider
         AND meeting.status = 'ready'
         AND meeting.join_url IS NOT NULL
         AND meeting.join_url ~ '^https://'
     ) THEN
    RAISE EXCEPTION 'Remote reservation cannot be confirmed before its customer meeting is ready.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_reservations_confirmed_meeting_ready
  ON public.booking_reservations;

CREATE TRIGGER booking_reservations_confirmed_meeting_ready
BEFORE INSERT OR UPDATE OF status, workspace_id, service_id ON public.booking_reservations
FOR EACH ROW
EXECUTE FUNCTION public.booking_enforce_confirmed_meeting_ready();

REVOKE ALL ON FUNCTION public.booking_enforce_confirmed_meeting_ready() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.booking_preserve_confirmed_meeting_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reservation_status text;
  configured_provider text := 'none';
  configured_auto_create boolean := false;
  other_ready_meeting_exists boolean := false;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(OLD.workspace_id::text || ':booking-meeting-policy', 0)
  );

  IF TG_OP = 'UPDATE'
     AND (
       NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
       OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
     ) THEN
    RAISE EXCEPTION 'A booking meeting cannot be moved to another reservation.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    reservation.status::text,
    COALESCE(service.virtual_meeting_provider::text, 'none'),
    COALESCE(service.auto_create_virtual_meeting, false)
  INTO reservation_status, configured_provider, configured_auto_create
  FROM public.booking_reservations AS reservation
  JOIN public.booking_services AS service
    ON service.workspace_id = reservation.workspace_id
   AND service.id = reservation.service_id
  WHERE reservation.workspace_id = OLD.workspace_id
    AND reservation.id = OLD.reservation_id;

  IF reservation_status = 'confirmed'
     AND configured_auto_create
     AND configured_provider IN ('google_meet', 'zoom') THEN
    -- Preserve the reservation-level invariant without making failed or
    -- superseded meeting attempts undeletable. The current NEW row may satisfy
    -- it on UPDATE; otherwise another ready row must remain after this write.
    SELECT EXISTS (
      SELECT 1
      FROM public.booking_meetings AS other_meeting
      WHERE other_meeting.workspace_id = OLD.workspace_id
        AND other_meeting.reservation_id = OLD.reservation_id
        AND other_meeting.id <> OLD.id
        AND other_meeting.provider::text = configured_provider
        AND other_meeting.status = 'ready'
        AND other_meeting.join_url IS NOT NULL
        AND other_meeting.join_url ~ '^https://'
    ) INTO other_ready_meeting_exists;

    IF TG_OP = 'DELETE' AND NOT other_ready_meeting_exists THEN
      RAISE EXCEPTION 'A confirmed remote reservation must retain its ready customer meeting.'
        USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE'
       AND (
         NEW.provider::text IS DISTINCT FROM configured_provider
         OR NEW.status IS DISTINCT FROM 'ready'
         OR NEW.join_url IS NULL
         OR NEW.join_url !~ '^https://'
       )
       AND NOT other_ready_meeting_exists THEN
      RAISE EXCEPTION 'A confirmed remote reservation must retain its ready customer meeting.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_meetings_preserve_confirmed_ready
  ON public.booking_meetings;
CREATE TRIGGER booking_meetings_preserve_confirmed_ready
BEFORE UPDATE OF workspace_id, reservation_id, provider, status, join_url OR DELETE
ON public.booking_meetings
FOR EACH ROW
EXECUTE FUNCTION public.booking_preserve_confirmed_meeting_ready();

REVOKE ALL ON FUNCTION public.booking_preserve_confirmed_meeting_ready() FROM PUBLIC;

-- Service configuration participates in the same invariant. Without this
-- guard, changing Google Meet to Zoom (or enabling automatic provisioning) can
-- instantly leave already-confirmed reservations without the provider room the
-- service promises, while the meeting-row invariant correctly refuses to
-- destroy their last ready room.
CREATE OR REPLACE FUNCTION public.booking_preserve_confirmed_service_meetings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.workspace_id::text || ':booking-meeting-policy', 0)
  );

  IF NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
     AND NEW.virtual_meeting_provider IS NOT DISTINCT FROM OLD.virtual_meeting_provider
     AND NEW.auto_create_virtual_meeting IS NOT DISTINCT FROM OLD.auto_create_virtual_meeting THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.auto_create_virtual_meeting, false)
     AND COALESCE(NEW.virtual_meeting_provider::text, 'none') IN ('google_meet', 'zoom')
     AND EXISTS (
       SELECT 1
       FROM public.booking_reservations AS reservation
       WHERE reservation.workspace_id = NEW.workspace_id
         AND reservation.service_id = NEW.id
         AND reservation.status = 'confirmed'
         AND NOT EXISTS (
           SELECT 1
           FROM public.booking_meetings AS meeting
           WHERE meeting.workspace_id = reservation.workspace_id
             AND meeting.reservation_id = reservation.id
             AND meeting.provider::text = NEW.virtual_meeting_provider::text
             AND meeting.status = 'ready'
             AND meeting.join_url IS NOT NULL
             AND meeting.join_url ~ '^https://'
         )
     ) THEN
    RAISE EXCEPTION 'Meeting-provider changes require every confirmed reservation to retain a ready room for the new provider.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_services_preserve_confirmed_meetings
  ON public.booking_services;
CREATE TRIGGER booking_services_preserve_confirmed_meetings
BEFORE UPDATE OF workspace_id, virtual_meeting_provider, auto_create_virtual_meeting
ON public.booking_services
FOR EACH ROW
EXECUTE FUNCTION public.booking_preserve_confirmed_service_meetings();

REVOKE ALL ON FUNCTION public.booking_preserve_confirmed_service_meetings() FROM PUBLIC;
