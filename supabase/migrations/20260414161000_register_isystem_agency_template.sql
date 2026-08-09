-- Register the `isystem-agency` template id in the theme catalog. Structural
-- only: this migration declares that the template *exists* and creates an
-- empty 1.0.0 version slot. Brand-voice strings, AI system context, and
-- visual-style copy live in `supabase/seed/iSystem/01-agency-theme-content.sql`
-- and only run when an iSystem-branded workspace is being seeded.
--
-- Other clients can either ignore this template or register their own
-- template in their own client-only migration.

INSERT INTO public.theme_catalog (
    theme_key,
    name,
    description,
    metadata
)
VALUES (
    'isystem-agency',
    'iSystem Agency',
    'Digital systems consultancy template — modular pages, premium presentation, AI-aware content surfaces.',
    jsonb_build_object(
        'positioning', 'founder-led digital systems consultancy',
        'market', 'netherlands-and-international'
    )
)
ON CONFLICT (theme_key) DO UPDATE
SET
    name = excluded.name,
    description = excluded.description,
    metadata = COALESCE(public.theme_catalog.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

INSERT INTO public.theme_versions (
    theme_id,
    version,
    status,
    config,
    is_default,
    released_at
)
SELECT
    tc.id,
    '1.0.0',
    'active',
    jsonb_build_object(
        'legacy_template_id', 'isystem-agency',
        'modules', jsonb_build_array('orchestrator', 'generate', 'content', 'settings')
    ),
    true,
    timezone('utc', now())
FROM public.theme_catalog tc
WHERE tc.theme_key = 'isystem-agency'
  AND NOT EXISTS (
    SELECT 1
    FROM public.theme_versions tv
    WHERE tv.theme_id = tc.id
      AND tv.version = '1.0.0'
  );
