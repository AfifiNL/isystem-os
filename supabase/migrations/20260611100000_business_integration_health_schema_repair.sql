-- Repair older workspace_integrations deployments so the Business OS health
-- registry can write runtime evidence after the self-hosted cutover.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_integration_status') THEN
    CREATE TYPE public.business_integration_status AS ENUM ('healthy', 'degraded', 'failing', 'unknown', 'disabled');
  END IF;
END $$;

ALTER TABLE public.workspace_integrations
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS credential_ref text,
  ADD COLUMN IF NOT EXISTS integration_key text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  ADD COLUMN IF NOT EXISTS rate_limit_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_message text;

UPDATE public.workspace_integrations
SET display_name = COALESCE(NULLIF(display_name, ''), provider)
WHERE display_name IS NULL OR btrim(display_name) = '';

ALTER TABLE public.workspace_integrations
  ALTER COLUMN display_name SET DEFAULT 'Business OS integration';

UPDATE public.workspace_integrations
SET integration_key = COALESCE(
  NULLIF(provider_account_id, ''),
  NULLIF(display_name, ''),
  NULLIF(credential_ref, ''),
  id::text
)
WHERE integration_key IS NULL OR btrim(integration_key) = '';

ALTER TABLE public.workspace_integrations
  ALTER COLUMN integration_key SET NOT NULL;

DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'workspace_integrations'
    AND column_name = 'status';

  IF v_udt IS DISTINCT FROM 'business_integration_status' THEN
    ALTER TABLE public.workspace_integrations
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.workspace_integrations
      ALTER COLUMN status TYPE public.business_integration_status
      USING (
        CASE status::text
          WHEN 'active' THEN 'healthy'
          WHEN 'draft' THEN 'unknown'
          WHEN 'archived' THEN 'disabled'
          WHEN 'disabled' THEN 'disabled'
          WHEN 'degraded' THEN 'degraded'
          WHEN 'down' THEN 'failing'
          WHEN 'healthy' THEN 'healthy'
          WHEN 'failing' THEN 'failing'
          ELSE 'unknown'
        END
      )::public.business_integration_status;

    ALTER TABLE public.workspace_integrations
      ALTER COLUMN status SET DEFAULT 'unknown'::public.business_integration_status;
  END IF;
END $$;

DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'workspace_integration_health_checks'
    AND column_name = 'status';

  IF v_udt IS DISTINCT FROM 'business_integration_status' THEN
    ALTER TABLE public.workspace_integration_health_checks
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.workspace_integration_health_checks
      ALTER COLUMN status TYPE public.business_integration_status
      USING (
        CASE status::text
          WHEN 'down' THEN 'failing'
          WHEN 'healthy' THEN 'healthy'
          WHEN 'degraded' THEN 'degraded'
          WHEN 'failing' THEN 'failing'
          WHEN 'disabled' THEN 'disabled'
          ELSE 'unknown'
        END
      )::public.business_integration_status;

    ALTER TABLE public.workspace_integration_health_checks
      ALTER COLUMN status SET DEFAULT 'unknown'::public.business_integration_status;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_integrations_workspace_provider_key_unique
  ON public.workspace_integrations (workspace_id, provider, integration_key);

CREATE INDEX IF NOT EXISTS workspace_integrations_workspace_status_idx
  ON public.workspace_integrations (workspace_id, status, updated_at DESC);
