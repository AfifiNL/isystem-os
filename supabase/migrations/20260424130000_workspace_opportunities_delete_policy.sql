--
-- Background: the original workspace_opportunities / workspace_opportunity_scans
-- policies (20260419120000_workspace_opportunities.sql) defined SELECT / INSERT /
-- UPDATE but no DELETE. With RLS enabled, DELETE with no matching policy silently
-- affects zero rows — no error is thrown, so the dashboard "Delete" button looked
-- like it did nothing from the operator's perspective.
--
-- This migration adds the missing DELETE policy for both tables, gated on
-- `content.write` capability just like UPDATE.

drop policy if exists "workspace_opportunities_delete_policy" on public.workspace_opportunities;
create policy "workspace_opportunities_delete_policy"
on public.workspace_opportunities
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));

drop policy if exists "workspace_opportunity_scans_delete_policy" on public.workspace_opportunity_scans;
create policy "workspace_opportunity_scans_delete_policy"
on public.workspace_opportunity_scans
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));
