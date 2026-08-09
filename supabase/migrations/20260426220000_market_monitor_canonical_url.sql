--
-- Adds a canonical_url column to workspace_market_monitor_results and a unique
-- index on (workspace_id, canonical_url). Backfills existing rows by stripping
-- fragments, lowercasing host, and removing trailing slashes — matching the
-- application-level canonicalization in src/features/market-monitor/lib/monitor.ts.
--
-- Non-destructive: no rows are deleted. Existing duplicates remain visible until
-- an operator runs a separate dedupe pass; at that point the unique index will
-- prevent re-insertion of the same canonical URL.

ALTER TABLE public.workspace_market_monitor_results
    ADD COLUMN IF NOT EXISTS canonical_url text;

UPDATE public.workspace_market_monitor_results
SET canonical_url = regexp_replace(
        regexp_replace(
            split_part(url, '#', 1),
            '/+$',
            ''
        ),
        '^(https?://)([^/]+)',
        E'\\1' || lower(substring(url from '^(?:https?://)([^/]+)'))
    )
WHERE canonical_url IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_market_monitor_results_canonical_url_idx
    ON public.workspace_market_monitor_results (workspace_id, canonical_url)
    WHERE canonical_url IS NOT NULL;
