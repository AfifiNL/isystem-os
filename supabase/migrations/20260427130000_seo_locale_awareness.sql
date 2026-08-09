--
-- Adds locale awareness to the SEO Control Center so strategist runs,
-- specialist audits, opportunities, plans, clusters, and internal-link
-- suggestions are scoped to a single content language (en|nl|ar) instead
-- of silently mixing all locales together.
--
-- Why per-row, per-table:
--   * The strategist analyzes a content portfolio. Mixing EN, NL, and AR
--     blogs in the same prompt makes Gemini score Arabic and English
--     versions of the same piece as competing duplicates, suppresses
--     real gap detection, and produces brief markdown in whichever
--     language the workspace context happens to be written in.
--   * Internal-link suggestions must connect content within the same
--     locale; cross-locale links would surface NL anchors on EN routes.
--   * Drafts spawned from opportunities/plans need a locale to publish
--     into the right `/en|/nl|/ar` route.
--
-- Disambiguation note: `seo_execution_events.locale` (added by
-- 20260323001000) means "which builder LocaleField sub-key the mutation
-- targeted" — a builder-field path. The `locale` columns added here
-- mean "the language this recommendation is *about*". Same name,
-- different concept; COMMENTs below make this explicit.
--
-- Forward-fix only: opportunities/links produced before this migration
-- get stamped with the owning workspace's default locale. We do not
-- rewrite past `seo_execution_events.locale`.

BEGIN;

-- ─── 1. seo_recommendation_runs ─────────────────────────────────────────────
ALTER TABLE public.seo_recommendation_runs
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

UPDATE public.seo_recommendation_runs r
SET locale = w.default_locale
FROM public.workspaces w
WHERE r.workspace_id = w.id
  AND r.locale = 'en'
  AND w.default_locale IN ('nl', 'ar');

COMMENT ON COLUMN public.seo_recommendation_runs.locale IS
  'Content language this run analyzed and produced output for (en|nl|ar). Set once at run creation; downstream opportunities/plans/clusters/links inherit it. Replay-deterministic — does NOT mean builder field path (see seo_execution_events.locale for that).';

CREATE INDEX IF NOT EXISTS seo_recommendation_runs_workspace_locale_created_idx
  ON public.seo_recommendation_runs (workspace_id, locale, created_at DESC);

-- ─── 2. seo_internal_link_opportunities ─────────────────────────────────────
ALTER TABLE public.seo_internal_link_opportunities
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

UPDATE public.seo_internal_link_opportunities o
SET locale = w.default_locale
FROM public.workspaces w
WHERE o.workspace_id = w.id
  AND o.locale = 'en'
  AND w.default_locale IN ('nl', 'ar');

COMMENT ON COLUMN public.seo_internal_link_opportunities.locale IS
  'Content language of the source/target pair (en|nl|ar). Cross-locale links are not produced — both source_content_id and target_content_id are expected to be in this locale.';

CREATE INDEX IF NOT EXISTS seo_internal_link_opportunities_workspace_locale_status_idx
  ON public.seo_internal_link_opportunities (workspace_id, locale, status, priority_score DESC);

-- ─── 3. seo_topic_clusters ──────────────────────────────────────────────────
ALTER TABLE public.seo_topic_clusters
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

UPDATE public.seo_topic_clusters c
SET locale = w.default_locale
FROM public.workspaces w
WHERE c.workspace_id = w.id
  AND c.locale = 'en'
  AND w.default_locale IN ('nl', 'ar');

COMMENT ON COLUMN public.seo_topic_clusters.locale IS
  'Content language this cluster covers (en|nl|ar). Cluster names, pillar topics, and supporting topics are written in this language.';

-- ─── 4. seo_content_plans ───────────────────────────────────────────────────
ALTER TABLE public.seo_content_plans
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

UPDATE public.seo_content_plans p
SET locale = w.default_locale
FROM public.workspaces w
WHERE p.workspace_id = w.id
  AND p.locale = 'en'
  AND w.default_locale IN ('nl', 'ar');

COMMENT ON COLUMN public.seo_content_plans.locale IS
  'Content language of the plan brief (en|nl|ar). Drafts spawned from this plan inherit this locale on insert into content_items.';

-- ─── 5. seo_content_opportunities ───────────────────────────────────────────
ALTER TABLE public.seo_content_opportunities
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

UPDATE public.seo_content_opportunities o
SET locale = w.default_locale
FROM public.workspaces w
WHERE o.workspace_id = w.id
  AND o.locale = 'en'
  AND w.default_locale IN ('nl', 'ar');

COMMENT ON COLUMN public.seo_content_opportunities.locale IS
  'Content language of the opportunity (en|nl|ar). Drafts spawned from this opportunity inherit this locale on insert into content_items.';

-- Existing seo_execution_events.locale already exists with different
-- semantics. Annotate it so future readers do not conflate the two.
COMMENT ON COLUMN public.seo_execution_events.locale IS
  'Builder LocaleField sub-key the mutation targeted (e.g. "en", "nl", "ar" path inside content_items.visual_layout JSONB). NOT the language of the source recommendation — for that, join through seo_internal_link_opportunities.locale.';

COMMIT;
