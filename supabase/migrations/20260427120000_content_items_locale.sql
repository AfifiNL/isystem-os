--
-- Adds per-row locale tracking to content_items so AI-generated content
-- (drafts, blog posts, video scripts, etc.) records the language it was
-- written in, and so locale-prefixed public routes can filter cleanly.
--
-- Three changes:
--   1. content_items.locale column (en|nl|ar) with workspace-default backfill.
--   2. Slug uniqueness moves from global to (template_id, locale, slug) so
--      EN and NL versions of the same piece can coexist within a workspace.
--   3. Index for the public read path (template_id, locale, status).

BEGIN;

-- 1. Add the locale column. Default to 'en' to satisfy NOT NULL on insert.
-- IMPORTANT scope: this column tracks the language of *single-language*
-- content rows — type='blog', type='video', and other AI-generated outputs
-- whose `content_markdown` is written in exactly one language.
--
-- It does NOT apply to type='page' rows. Pages on this fork hold every
-- locale simultaneously inside `visual_layout` JSONB (the LocaleField
-- pattern: `{content,N,props,title,{en,nl,ar}}`), and are rendered via
-- `pickLocaleText()`. The 4/26 AR seeds (`isystem_ar_page_heroes`,
-- `isystem_ar_body_blocks_seed`) update those JSONB paths in place; one
-- page row serves all three locales. Stamping such rows with a single
-- locale would falsely hide them from non-default locale routes.
--
-- For pages we therefore leave `locale` at its 'en' default and never
-- filter pages by it. The locale filter is applied only by single-language
-- read paths (blog list, blog detail, related posts, videos page,
-- home-page content preview).
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

-- Backfill only single-language rows. Pages stay at the 'en' default;
-- their real per-locale copy lives inside visual_layout JSONB.
UPDATE public.content_items ci
SET locale = w.default_locale
FROM public.workspaces w
WHERE ci.workspace_id = w.id
  AND ci.type <> 'page'
  AND ci.locale = 'en'
  AND w.default_locale IN ('en', 'nl', 'ar')
  AND w.default_locale <> 'en';

-- 2. Replace the global slug-uniqueness with a (template_id, locale, slug)
-- composite. Without this, an EN and NL version of the same piece collide
-- on the slug as soon as a second-locale draft is generated.
ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS content_items_template_locale_slug_unique_idx
  ON public.content_items (template_id, locale, slug)
  WHERE template_id IS NOT NULL;

-- 3. Index the public read path. Locale-prefixed routes filter
-- (template_id, locale, status='published') on every list page.
CREATE INDEX IF NOT EXISTS content_items_template_locale_status_idx
  ON public.content_items (template_id, locale, status);

COMMIT;
