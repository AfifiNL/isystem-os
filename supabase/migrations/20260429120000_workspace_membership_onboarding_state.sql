--
-- Adds per-membership onboarding state for first-time invited workspace
-- managers. State is keyed on (workspace_id, profile_id) — not on the
-- profile alone — because a single manager can be invited to multiple
-- workspaces and each one has its own first-run guided tour.
--
-- Schema shape of onboarding_state (jsonb, defaults to '{}'::jsonb):
--   {
--     "version": 1,
--     "currentStep": 0,
--     "completedSteps": ["welcome", "content", ...],
--     "coachMarksSeen": ["content", "seo", ...]
--   }
--
-- Lifecycle columns:
--   onboarding_completed_at — set when the user finishes every step.
--   onboarding_skipped_at   — set when the user dismisses the Welcome
--                              window (skippable from step 1).
--
-- Either timestamp suppresses the auto-launching Welcome window. Coach
-- marks are independent and continue firing per-app on first window open.

ALTER TABLE public.workspace_memberships
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_skipped_at timestamptz;

COMMENT ON COLUMN public.workspace_memberships.onboarding_state IS
  'Per-membership first-run tour progress: { version, currentStep, completedSteps[], coachMarksSeen[] }.';
COMMENT ON COLUMN public.workspace_memberships.onboarding_completed_at IS
  'Set when the manager finishes the guided tour. Null while in-progress or skipped.';
COMMENT ON COLUMN public.workspace_memberships.onboarding_skipped_at IS
  'Set when the manager dismisses the Welcome window. Suppresses auto-launch but coach marks remain active.';

-- Existing memberships predate the onboarding flow — mark them as skipped
-- so the Welcome window does not auto-launch for users who have already
-- been working in the dashboard. New rows inserted via the invite flow
-- will leave both timestamps null and trigger the onboarding on first
-- /dashboard visit.
UPDATE public.workspace_memberships
SET onboarding_skipped_at = COALESCE(onboarding_skipped_at, now())
WHERE onboarding_completed_at IS NULL
  AND onboarding_skipped_at IS NULL;
