-- Auto-sync booking plain-text columns into copy_i18n.en on insert/update so
-- the dashboard (which writes to plain text columns only) stays consistent
-- with the localized read path. Arabic and Dutch entries are not touched.

BEGIN;

CREATE OR REPLACE FUNCTION public.booking_services_sync_copy_i18n()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.copy_i18n := jsonb_set(
    COALESCE(NEW.copy_i18n, '{}'::jsonb),
    '{en}',
    jsonb_strip_nulls(jsonb_build_object(
      'title', NEW.title,
      'subtitle', NEW.subtitle,
      'description', NEW.description
    )),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_services_sync_copy_i18n_trg ON public.booking_services;
CREATE TRIGGER booking_services_sync_copy_i18n_trg
BEFORE INSERT OR UPDATE OF title, subtitle, description ON public.booking_services
FOR EACH ROW EXECUTE FUNCTION public.booking_services_sync_copy_i18n();

CREATE OR REPLACE FUNCTION public.booking_locations_sync_copy_i18n()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.copy_i18n := jsonb_set(
    COALESCE(NEW.copy_i18n, '{}'::jsonb),
    '{en}',
    jsonb_strip_nulls(jsonb_build_object(
      'name', NEW.name,
      'instructions', NEW.instructions
    )),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_locations_sync_copy_i18n_trg ON public.booking_locations;
CREATE TRIGGER booking_locations_sync_copy_i18n_trg
BEFORE INSERT OR UPDATE OF name, instructions ON public.booking_locations
FOR EACH ROW EXECUTE FUNCTION public.booking_locations_sync_copy_i18n();

CREATE OR REPLACE FUNCTION public.booking_form_definitions_sync_copy_i18n()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.copy_i18n := jsonb_set(
    COALESCE(NEW.copy_i18n, '{}'::jsonb),
    '{en}',
    jsonb_strip_nulls(jsonb_build_object('title', NEW.title)),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_form_definitions_sync_copy_i18n_trg ON public.booking_form_definitions;
CREATE TRIGGER booking_form_definitions_sync_copy_i18n_trg
BEFORE INSERT OR UPDATE OF title ON public.booking_form_definitions
FOR EACH ROW EXECUTE FUNCTION public.booking_form_definitions_sync_copy_i18n();

COMMIT;
