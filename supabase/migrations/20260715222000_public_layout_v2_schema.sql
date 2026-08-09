-- Schema-only expand step for the public renderer rollout. Legacy
-- content_items.visual_layout remains readable until the v2 route flags are
-- fully promoted.

ALTER TABLE public.content_items
    ADD COLUMN IF NOT EXISTS public_layout_v2 jsonb;

COMMENT ON COLUMN public.content_items.public_layout_v2 IS
    'Versioned PublicPagePuckDataV2 payload used by the public renderer during an expand-contract rollout.';
