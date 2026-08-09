-- Blog post SEO enhancement runs
-- Groups multiple proposal-level mutations (internal link injections, external
-- reference insertions, paraphrase suggestions, meta refreshes) into one
-- reviewable run so rollback restores the whole post atomically.
--
-- preview_payload holds the full BlogEnhancementPreview JSON; proposals are
-- not normalized to rows because they are generated per-preview and never
-- queried individually.

CREATE TABLE IF NOT EXISTS public.blog_seo_enhancement_runs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id               UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  actor_profile_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'previewed'
    CHECK (status IN ('previewed','partially_applied','applied','rolled_back','expired')),
  proposal_count           INTEGER NOT NULL DEFAULT 0,
  accepted_count           INTEGER NOT NULL DEFAULT 0,
  preview_payload          JSONB NOT NULL,
  snapshot_before          JSONB NOT NULL,
  snapshot_after           JSONB,
  total_charged_millicents BIGINT NOT NULL DEFAULT 0,
  expires_at               TIMESTAMPTZ NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at               TIMESTAMPTZ,
  rolled_back_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blog_seo_enh_runs_workspace_content
  ON public.blog_seo_enhancement_runs (workspace_id, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_seo_enh_runs_status
  ON public.blog_seo_enhancement_runs (status, created_at DESC);

COMMENT ON TABLE public.blog_seo_enhancement_runs IS
  'One-click blog post SEO enhancement runs. snapshot_before + snapshot_after enable whole-run rollback. Preview expires 30 min after creation.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.blog_seo_enhancement_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blog_seo_enh_runs_select_members" ON public.blog_seo_enhancement_runs;
CREATE POLICY "blog_seo_enh_runs_select_members"
  ON public.blog_seo_enhancement_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.workspace_id = blog_seo_enhancement_runs.workspace_id
        AND ma.manager_profile_id = auth.uid()
        AND ma.is_active = true
        AND ma.ends_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "blog_seo_enh_runs_insert_members" ON public.blog_seo_enhancement_runs;
CREATE POLICY "blog_seo_enh_runs_insert_members"
  ON public.blog_seo_enhancement_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.workspace_id = blog_seo_enhancement_runs.workspace_id
        AND ma.manager_profile_id = auth.uid()
        AND ma.is_active = true
        AND ma.ends_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "blog_seo_enh_runs_update_members" ON public.blog_seo_enhancement_runs;
CREATE POLICY "blog_seo_enh_runs_update_members"
  ON public.blog_seo_enhancement_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_assignments ma
      WHERE ma.workspace_id = blog_seo_enhancement_runs.workspace_id
        AND ma.manager_profile_id = auth.uid()
        AND ma.is_active = true
        AND ma.ends_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
