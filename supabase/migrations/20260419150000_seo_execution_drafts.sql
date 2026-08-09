
-- SEO Control Center execution layer: link approved opportunities and started
-- content plans to the content_items draft that represents their follow-through,
-- so "approve" and "start" stop being dead-end status flips.

ALTER TABLE public.seo_content_opportunities
  ADD COLUMN IF NOT EXISTS draft_content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;

ALTER TABLE public.seo_content_plans
  ADD COLUMN IF NOT EXISTS draft_content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS seo_content_opportunities_draft_idx
  ON public.seo_content_opportunities (draft_content_item_id)
  WHERE draft_content_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS seo_content_plans_draft_idx
  ON public.seo_content_plans (draft_content_item_id)
  WHERE draft_content_item_id IS NOT NULL;
