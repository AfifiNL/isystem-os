--
-- Loop B (signals out): three feedback-loop tables that turn the one-shot
-- Blog SEO Enhance output into persistent workspace state. The tables are
-- write-only from the apply action; read-side consumers (inventory graph,
-- opportunity-engine noise suppression, market-monitor authority learning)
-- land in Loops A and C without requiring further schema changes.
--
-- RLS follows the same pattern as blog_seo_enhancement_runs
-- (migration 20260421130000): per-verb policies checking
-- public.manager_assignments so writes succeed from the user-session
-- Supabase client used by applyBlogPostSeoEnhancement.

-- ─── 1. inventory_link_graph ────────────────────────────────────────────────
-- Every accepted internal-link proposal writes a row. Orphan detection and
-- cluster-aware ranking become `select from` queries instead of recomputed
-- substring scans on every run.
create table if not exists inventory_link_graph (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    source_content_id uuid not null references content_items(id) on delete cascade,
    target_slug text not null,
    anchor_text text not null,
    applied_at timestamptz not null default now(),
    enhancement_run_id uuid references blog_seo_enhancement_runs(id) on delete set null,
    -- Prevents duplicate edges from re-applying the same suggestion across
    -- previews. A workspace can add the same anchor to the same target from
    -- the same source only once — subsequent identical edges upsert.
    unique (workspace_id, source_content_id, target_slug, anchor_text)
);

create index if not exists inventory_link_graph_workspace_target_idx
    on public.inventory_link_graph (workspace_id, target_slug);
create index if not exists inventory_link_graph_workspace_source_idx
    on public.inventory_link_graph (workspace_id, source_content_id);

alter table public.inventory_link_graph enable row level security;

drop policy if exists "inventory_link_graph_select_members" on public.inventory_link_graph;
create policy "inventory_link_graph_select_members"
    on public.inventory_link_graph for select
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = inventory_link_graph.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

drop policy if exists "inventory_link_graph_insert_members" on public.inventory_link_graph;
create policy "inventory_link_graph_insert_members"
    on public.inventory_link_graph for insert
    with check (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = inventory_link_graph.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

drop policy if exists "inventory_link_graph_update_members" on public.inventory_link_graph;
create policy "inventory_link_graph_update_members"
    on public.inventory_link_graph for update
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = inventory_link_graph.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

-- ─── 2. blog_enhancement_proposal_events ───────────────────────────────────
-- Per-proposal accept/reject telemetry. The run-level table already tracks
-- aggregate accepted_count; this table captures which proposal types and
-- signal keys users consistently reject so the Opportunity Engine and
-- future detectors can compute noise scores and suppress weak signals.
create table if not exists blog_enhancement_proposal_events (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    run_id uuid not null references blog_seo_enhancement_runs(id) on delete cascade,
    content_id uuid not null references content_items(id) on delete cascade,
    proposal_id uuid not null,
    proposal_type text not null,
    signal_key text not null,
    decision text not null check (decision in ('accepted', 'rejected')),
    risk_flags text[] not null default '{}',
    decided_at timestamptz not null default now()
);

create index if not exists proposal_events_workspace_signal_idx
    on public.blog_enhancement_proposal_events (workspace_id, signal_key, decision);
create index if not exists proposal_events_workspace_type_idx
    on public.blog_enhancement_proposal_events (workspace_id, proposal_type, decision);
create index if not exists proposal_events_content_idx
    on public.blog_enhancement_proposal_events (content_id, decided_at desc);

alter table public.blog_enhancement_proposal_events enable row level security;

drop policy if exists "proposal_events_select_members" on public.blog_enhancement_proposal_events;
create policy "proposal_events_select_members"
    on public.blog_enhancement_proposal_events for select
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = blog_enhancement_proposal_events.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

drop policy if exists "proposal_events_insert_members" on public.blog_enhancement_proposal_events;
create policy "proposal_events_insert_members"
    on public.blog_enhancement_proposal_events for insert
    with check (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = blog_enhancement_proposal_events.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

-- ─── 3. workspace_learned_authority_domains ─────────────────────────────────
-- Every applied external citation (anchor wrap or new-sentence citation)
-- increments a per-domain counter for the workspace. Market Monitor and the
-- external-ref generator read this to boost domains the workspace has
-- chosen to trust in the past — a workspace-local authority signal that
-- does not require the user to maintain a manual authority list.
create table if not exists workspace_learned_authority_domains (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    domain text not null,
    cite_count integer not null default 0,
    first_cited_at timestamptz not null default now(),
    last_cited_at timestamptz not null default now(),
    primary key (workspace_id, domain)
);

create index if not exists learned_authority_workspace_count_idx
    on public.workspace_learned_authority_domains (workspace_id, cite_count desc);

alter table public.workspace_learned_authority_domains enable row level security;

drop policy if exists "learned_authority_select_members" on public.workspace_learned_authority_domains;
create policy "learned_authority_select_members"
    on public.workspace_learned_authority_domains for select
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = workspace_learned_authority_domains.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

drop policy if exists "learned_authority_insert_members" on public.workspace_learned_authority_domains;
create policy "learned_authority_insert_members"
    on public.workspace_learned_authority_domains for insert
    with check (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = workspace_learned_authority_domains.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );

drop policy if exists "learned_authority_update_members" on public.workspace_learned_authority_domains;
create policy "learned_authority_update_members"
    on public.workspace_learned_authority_domains for update
    using (
        exists (
            select 1 from public.manager_assignments ma
            where ma.workspace_id = workspace_learned_authority_domains.workspace_id
              and ma.manager_profile_id = auth.uid()
        )
    );
