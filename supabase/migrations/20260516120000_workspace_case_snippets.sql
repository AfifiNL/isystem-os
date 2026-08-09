-- Workspace-scoped repository of real client anecdotes and outcomes that
-- content-generation routes weave into drafts. The single highest-signal
-- humanizing move in AI-generated blog posts is a named, specific story —
-- a generic LLM cannot invent these, so they have to come from operator-
-- supplied data.
--
-- Universal feature → lands on core (no fork header).

CREATE TABLE IF NOT EXISTS public.workspace_case_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Short label for the operator UI ("Customer onboarding cut from 9 weeks to 12 days").
  title text NOT NULL,

  -- The anecdote itself. 1-3 sentences. Contains the named scenario, metric,
  -- or outcome the writer should reference. Treat as authoritative prose —
  -- the prompt instructs the model to weave it in verbatim or near-verbatim.
  body text NOT NULL,

  -- Optional tags so generation can pick a snippet aligned with the article
  -- topic (e.g. ["onboarding", "automation", "compliance"]).
  tags text[] NOT NULL DEFAULT '{}',

  -- When true the snippet is eligible for automatic insertion into drafts.
  -- Operators can soft-disable a snippet without deleting it.
  is_active boolean NOT NULL DEFAULT true,

  -- Optional contextual fields. None are required because the snippet body
  -- already carries the story; these are for filtering and analytics.
  industry text,
  outcome_summary text,

  -- Tracks usage so the picker can prefer less-used snippets and admins can
  -- see what's been recycled.
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_case_snippets_workspace
  ON public.workspace_case_snippets (workspace_id, is_active, last_used_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_workspace_case_snippets_tags
  ON public.workspace_case_snippets USING gin (tags);

ALTER TABLE public.workspace_case_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_snippets_select_policy" ON public.workspace_case_snippets;
DROP POLICY IF EXISTS "case_snippets_insert_policy" ON public.workspace_case_snippets;
DROP POLICY IF EXISTS "case_snippets_update_policy" ON public.workspace_case_snippets;
DROP POLICY IF EXISTS "case_snippets_delete_policy" ON public.workspace_case_snippets;

-- Reads require workspace membership (snippets contain real client names and
-- internal context — they are NOT public).
CREATE POLICY "case_snippets_select_policy"
ON public.workspace_case_snippets
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

CREATE POLICY "case_snippets_insert_policy"
ON public.workspace_case_snippets
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

CREATE POLICY "case_snippets_update_policy"
ON public.workspace_case_snippets
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'content.write'))
WITH CHECK (public.can_access_workspace(workspace_id, 'content.write'));

CREATE POLICY "case_snippets_delete_policy"
ON public.workspace_case_snippets
FOR DELETE
USING (public.can_access_workspace(workspace_id, 'content.write'));

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.tg_workspace_case_snippets_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_case_snippets_set_updated_at ON public.workspace_case_snippets;
CREATE TRIGGER workspace_case_snippets_set_updated_at
BEFORE UPDATE ON public.workspace_case_snippets
FOR EACH ROW
EXECUTE FUNCTION public.tg_workspace_case_snippets_set_updated_at();
