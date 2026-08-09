-- Add workspace-level locale preference for orchestration and admin runtime settings
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS default_locale text;

ALTER TABLE public.workspaces
  ALTER COLUMN default_locale SET DEFAULT 'en';

UPDATE public.workspaces
SET default_locale = 'en'
WHERE default_locale IS NULL OR btrim(default_locale) = '';

ALTER TABLE public.workspaces
  ALTER COLUMN default_locale SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspaces_default_locale_check'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_default_locale_check
      CHECK (default_locale = ANY (ARRAY['en'::text, 'nl'::text]));
  END IF;
END $$;

