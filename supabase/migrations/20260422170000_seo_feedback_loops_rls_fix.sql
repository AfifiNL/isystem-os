--
-- Loop B RLS fix. The initial migration (20260422160000_seo_feedback_loops)
-- used an incomplete policy pattern that only allowed users with an active
-- manager_assignments row — admin profiles without a per-workspace manager
-- assignment were blocked, producing 403s on every apply.
--
-- This migration mirrors the working pattern from blog_seo_enhancement_runs
-- (migration 20260421130000): active manager assignment OR admin profile.
-- Also drops the legacy "service role manages X" (ALL) and
-- "workspace members can read X" (SELECT using workspace_memberships)
-- policies that predate the per-verb manager_assignments pattern.
--
-- Applied out-of-band in production on 2026-04-22 via MCP. This file exists
-- so fresh installs receive the same final policy state after running both
-- 20260422160000 and this fix migration in order.

-- ─── Drop legacy + incomplete policies ─────────────────────────────────────
drop policy if exists "workspace members can read link graph" on public.inventory_link_graph;
drop policy if exists "service role manages link graph" on public.inventory_link_graph;
drop policy if exists "inventory_link_graph_select_members" on public.inventory_link_graph;
drop policy if exists "inventory_link_graph_insert_members" on public.inventory_link_graph;
drop policy if exists "inventory_link_graph_update_members" on public.inventory_link_graph;

drop policy if exists "workspace members can read proposal events" on public.blog_enhancement_proposal_events;
drop policy if exists "service role manages proposal events" on public.blog_enhancement_proposal_events;
drop policy if exists "proposal_events_select_members" on public.blog_enhancement_proposal_events;
drop policy if exists "proposal_events_insert_members" on public.blog_enhancement_proposal_events;

drop policy if exists "workspace members can read learned authority" on public.workspace_learned_authority_domains;
drop policy if exists "service role manages learned authority" on public.workspace_learned_authority_domains;
drop policy if exists "learned_authority_select_members" on public.workspace_learned_authority_domains;
drop policy if exists "learned_authority_insert_members" on public.workspace_learned_authority_domains;
drop policy if exists "learned_authority_update_members" on public.workspace_learned_authority_domains;

-- ─── Table 1: inventory_link_graph ──────────────────────────────────────────
create policy "inventory_link_graph_select_members"
    on public.inventory_link_graph for select
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = inventory_link_graph.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "inventory_link_graph_insert_members"
    on public.inventory_link_graph for insert
    with check (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = inventory_link_graph.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "inventory_link_graph_update_members"
    on public.inventory_link_graph for update
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = inventory_link_graph.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

-- ─── Table 2: blog_enhancement_proposal_events (append-only, no UPDATE) ────
create policy "proposal_events_select_members"
    on public.blog_enhancement_proposal_events for select
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = blog_enhancement_proposal_events.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "proposal_events_insert_members"
    on public.blog_enhancement_proposal_events for insert
    with check (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = blog_enhancement_proposal_events.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

-- ─── Table 3: workspace_learned_authority_domains ───────────────────────────
create policy "learned_authority_select_members"
    on public.workspace_learned_authority_domains for select
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = workspace_learned_authority_domains.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "learned_authority_insert_members"
    on public.workspace_learned_authority_domains for insert
    with check (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = workspace_learned_authority_domains.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "learned_authority_update_members"
    on public.workspace_learned_authority_domains for update
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = workspace_learned_authority_domains.workspace_id
              and ma.manager_profile_id = auth.uid()
              and ma.is_active = true
              and ma.ends_at is null
        )
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );
