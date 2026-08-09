-- Arabic locale support
-- - Expand workspace locale CHECK constraints to allow 'ar'
-- - Add copy_i18n jsonb columns on booking public-copy tables with backfill from
--   existing plain-text columns into the 'en' key. Public reads use precedence:
--   copy_i18n->>'<active_locale>'  →  copy_i18n->>'en'  →  plain_text_column.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Locale CHECK constraints
-- -----------------------------------------------------------------------------
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_default_locale_check;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_default_locale_check
  CHECK (default_locale = ANY (ARRAY['en'::text, 'nl'::text, 'ar'::text]));

ALTER TABLE public.workspace_settings
  DROP CONSTRAINT IF EXISTS workspace_settings_locale_override_check;

ALTER TABLE public.workspace_settings
  ADD CONSTRAINT workspace_settings_locale_override_check
  CHECK (locale_override IS NULL OR locale_override = ANY (ARRAY['en'::text, 'nl'::text, 'ar'::text]));

-- -----------------------------------------------------------------------------
-- 2. Booking localized public copy
-- -----------------------------------------------------------------------------
ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS copy_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.booking_locations
  ADD COLUMN IF NOT EXISTS copy_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.booking_form_definitions
  ADD COLUMN IF NOT EXISTS copy_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: seed the 'en' key from the existing plain-text columns when copy_i18n
-- is empty or missing the field. Idempotent: only writes when target slot is
-- absent, so re-running this migration on partial data is safe.
UPDATE public.booking_services
SET copy_i18n = jsonb_build_object(
  'en', jsonb_strip_nulls(jsonb_build_object(
    'title', title,
    'subtitle', subtitle,
    'description', description
  ))
)
WHERE copy_i18n = '{}'::jsonb OR NOT (copy_i18n ? 'en');

UPDATE public.booking_locations
SET copy_i18n = jsonb_build_object(
  'en', jsonb_strip_nulls(jsonb_build_object(
    'name', name,
    'instructions', instructions
  ))
)
WHERE copy_i18n = '{}'::jsonb OR NOT (copy_i18n ? 'en');

UPDATE public.booking_form_definitions
SET copy_i18n = jsonb_build_object(
  'en', jsonb_strip_nulls(jsonb_build_object(
    'title', title
  ))
)
WHERE copy_i18n = '{}'::jsonb OR NOT (copy_i18n ? 'en');

COMMENT ON COLUMN public.booking_services.copy_i18n IS
  'Per-locale public copy. Read precedence: copy_i18n->>locale → copy_i18n->>''en'' → plain text column. Admin write path mirrors locale=en into the plain text column for fallback compatibility.';

COMMENT ON COLUMN public.booking_locations.copy_i18n IS
  'Per-locale public copy. Read precedence: copy_i18n->>locale → copy_i18n->>''en'' → plain text column.';

COMMENT ON COLUMN public.booking_form_definitions.copy_i18n IS
  'Per-locale public form copy (title and field labels). Schema JSON also resolves field labels via this map.';

COMMIT;
