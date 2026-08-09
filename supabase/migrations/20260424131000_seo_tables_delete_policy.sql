--
-- Background: the original SEO control-center migration
-- (20260322223000_seo_control_center.sql) defined SELECT / INSERT / UPDATE
-- policies on the SEO tables but no DELETE policy. With RLS enabled, a DELETE
-- that matches no policy silently affects zero rows — no error is thrown — so
-- the bulk-delete and single-row delete actions in the dashboard looked like
-- they did nothing.
--
-- This migration adds the missing DELETE policy to every SEO table, gated on
-- `content.write` capability to match the existing UPDATE policy.

drop policy if exists "seo_internal_link_opportunities_delete_policy" on public.seo_internal_link_opportunities;
create policy "seo_internal_link_opportunities_delete_policy"
on public.seo_internal_link_opportunities
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));

drop policy if exists "seo_topic_clusters_delete_policy" on public.seo_topic_clusters;
create policy "seo_topic_clusters_delete_policy"
on public.seo_topic_clusters
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));

drop policy if exists "seo_content_plans_delete_policy" on public.seo_content_plans;
create policy "seo_content_plans_delete_policy"
on public.seo_content_plans
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));

drop policy if exists "seo_content_opportunities_delete_policy" on public.seo_content_opportunities;
create policy "seo_content_opportunities_delete_policy"
on public.seo_content_opportunities
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));

drop policy if exists "seo_recommendation_runs_delete_policy" on public.seo_recommendation_runs;
create policy "seo_recommendation_runs_delete_policy"
on public.seo_recommendation_runs
for delete
using (public.can_access_workspace(workspace_id, 'content.write'));
