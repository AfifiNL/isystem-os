--
-- Adds per-row locale tracking to podcast_episodes so locale-prefixed public
-- routes (/en/podcast/..., /nl/podcast/..., /ar/podcast/...) can filter
-- episodes the same way blog posts already do via content_items.locale.
--
-- Bug context: a Dutch episode "wat-is-een-growth-operating-system-..." was
-- surfacing under /en/podcast/<show>/. Two missing pieces drove this:
--   (a) episodes had no locale column, so even when narration was generated
--       in NL the row carried no language tag.
--   (b) public read queries did not filter by locale at all, so every episode
--       appeared on every locale's URL.
--
-- This migration fixes (a). The application-side query change handles (b).

BEGIN;

-- 1. Add the locale column. Default 'en' to satisfy NOT NULL on insert; the
-- CHECK matches content_items.locale so the two stay in sync.
ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'
    CHECK (locale IN ('en', 'nl', 'ar'));

-- 2. Backfill — priority order matches the application's locale resolution:
--   (a) linked content_item's locale (most accurate signal — the script was
--       generated from this content)
--   (b) the show's `language` field when it's a supported locale code
--   (c) the workspace default
-- Anything that doesn't match falls back to the 'en' default.

-- 2a. From linked content_item.locale
UPDATE public.podcast_episodes pe
SET locale = ci.locale
FROM public.content_items ci
WHERE pe.content_item_id = ci.id
  AND ci.locale IN ('en', 'nl', 'ar')
  AND pe.locale = 'en';

-- 2b. From show.language (only when content_item linkage didn't resolve).
-- podcast_shows.language stores BCP-47-ish codes ("en", "en-US", "nl", "ar").
-- Trim to the leading two-letter segment and accept en/nl/ar.
UPDATE public.podcast_episodes pe
SET locale = lower(split_part(ps.language, '-', 1))
FROM public.podcast_shows ps
WHERE pe.show_id = ps.id
  AND lower(split_part(ps.language, '-', 1)) IN ('en', 'nl', 'ar')
  AND pe.content_item_id IS NULL
  AND pe.locale = 'en';

-- 2c. From workspace default
UPDATE public.podcast_episodes pe
SET locale = w.default_locale
FROM public.workspaces w
WHERE pe.workspace_id = w.id
  AND pe.content_item_id IS NULL
  AND w.default_locale IN ('en', 'nl', 'ar')
  AND w.default_locale <> 'en'
  AND pe.locale = 'en';

-- 3. Public read path index — every locale-prefixed list query filters
-- (show_id, locale, status='published') ordered by published_at desc.
CREATE INDEX IF NOT EXISTS podcast_episodes_show_locale_status_idx
  ON public.podcast_episodes (show_id, locale, status, published_at DESC NULLS LAST);

-- 4. Slug uniqueness moves to (show_id, locale, slug) so EN and NL episodes
-- of the same show can share a slug shape if needed without colliding. There
-- is no existing uniqueness constraint to drop — we only add the new one.
CREATE UNIQUE INDEX IF NOT EXISTS podcast_episodes_show_locale_slug_unique_idx
  ON public.podcast_episodes (show_id, locale, slug);

COMMIT;
