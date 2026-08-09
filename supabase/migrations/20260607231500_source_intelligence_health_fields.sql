ALTER TABLE public.source_registry
  ADD COLUMN IF NOT EXISTS source_health_status text NOT NULL DEFAULT 'unknown'
    CHECK (source_health_status IN ('healthy', 'missing', 'blocked', 'unauthorized', 'rate_limited', 'degraded', 'unknown')),
  ADD COLUMN IF NOT EXISTS last_fetch_status integer,
  ADD COLUMN IF NOT EXISTS last_fetch_error_classification text
    CHECK (last_fetch_error_classification IS NULL OR last_fetch_error_classification IN ('missing', 'blocked', 'unauthorized', 'rate_limited', 'network', 'non_text', 'timeout', 'unknown')),
  ADD COLUMN IF NOT EXISTS last_fetch_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS fallback_url text,
  ADD COLUMN IF NOT EXISTS fetch_strategy text;

CREATE INDEX IF NOT EXISTS source_registry_health_status_idx
  ON public.source_registry (workspace_id, source_health_status, last_fetch_checked_at DESC);

UPDATE public.source_registry
SET
  source_health_status = COALESCE(
    CASE
      WHEN metadata->'source_health'->>'status' IN ('healthy', 'missing', 'blocked', 'unauthorized', 'rate_limited', 'degraded', 'unknown')
        THEN metadata->'source_health'->>'status'
      ELSE NULL
    END,
    source_health_status
  ),
  last_fetch_status = COALESCE(
    CASE
      WHEN metadata->'source_health'->>'last_http_status' ~ '^\d+$'
        THEN (metadata->'source_health'->>'last_http_status')::integer
      ELSE NULL
    END,
    last_fetch_status
  ),
  last_fetch_error_classification = COALESCE(
    CASE
      WHEN metadata->'source_health'->>'last_error_classification' IN ('missing', 'blocked', 'unauthorized', 'rate_limited', 'network', 'non_text', 'timeout', 'unknown')
        THEN metadata->'source_health'->>'last_error_classification'
      ELSE NULL
    END,
    last_fetch_error_classification
  ),
  last_fetch_checked_at = COALESCE(
    CASE
      WHEN NULLIF(metadata->'source_health'->>'last_checked_at', '') IS NOT NULL
        THEN (metadata->'source_health'->>'last_checked_at')::timestamptz
      ELSE NULL
    END,
    last_fetch_checked_at
  ),
  disabled_reason = COALESCE(metadata->'source_health'->>'disabled_reason', disabled_reason),
  fetch_strategy = COALESCE(metadata->>'fetch_strategy', fetch_strategy)
WHERE metadata ? 'source_health' OR metadata ? 'fetch_strategy';

COMMENT ON COLUMN public.source_registry.source_health_status IS 'Source audit status populated by Source Intelligence ingestion and health audit tooling.';
COMMENT ON COLUMN public.source_registry.last_fetch_error_classification IS 'Last structured fetch failure classification: missing, blocked, unauthorized, rate_limited, network, non_text, timeout, or unknown.';
COMMENT ON COLUMN public.source_registry.fallback_url IS 'Operator-curated replacement or fallback URL. Must be validated before use.';
