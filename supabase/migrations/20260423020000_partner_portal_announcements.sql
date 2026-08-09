
begin;

-- Clarify semantics of client_portal_users: it serves as the authoritative
-- list of iSystem Partner Portal memberships for every template type, not
-- just facility-services clients. The physical name is retained to avoid a
-- breaking rename across RLS policies, FKs, and the generated types file.
comment on table public.client_portal_users is
    'iSystem Partner Portal memberships. One row per partner per workspace across every template (facility-services, isystem-agency, saas-product, etc.). Consumed by /portal/* routes via getPartnerPortalAccess().';

create table if not exists public.partner_portal_announcements (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces(id) on delete cascade,
    title text not null,
    body text,
    tone text not null default 'info' check (tone = any (array['info'::text, 'milestone'::text, 'action'::text])),
    is_published boolean not null default true,
    published_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.partner_portal_announcements is
    'Partner-visible announcements surfaced in the generic Partner Portal dashboard. Scoped by workspace and respects RLS membership.';

create index if not exists partner_portal_announcements_workspace_published_idx
    on public.partner_portal_announcements (workspace_id, is_published, published_at desc);

alter table public.partner_portal_announcements enable row level security;

drop policy if exists "partner_portal_announcements_select_policy" on public.partner_portal_announcements;
drop policy if exists "partner_portal_announcements_insert_policy" on public.partner_portal_announcements;
drop policy if exists "partner_portal_announcements_update_policy" on public.partner_portal_announcements;
drop policy if exists "partner_portal_announcements_delete_policy" on public.partner_portal_announcements;

-- Partners can read published announcements for any workspace they belong to.
-- Admins/managers with workspace access also read (via can_access_workspace).
create policy "partner_portal_announcements_select_policy"
    on public.partner_portal_announcements
    for select
    using (
        public.can_access_workspace(workspace_id, null)
        or (
            is_published
            and exists (
                select 1 from public.client_portal_users cpu
                where cpu.workspace_id = partner_portal_announcements.workspace_id
                  and cpu.profile_id = auth.uid()
            )
        )
    );

create policy "partner_portal_announcements_insert_policy"
    on public.partner_portal_announcements
    for insert
    with check (public.can_access_workspace(workspace_id, 'content.write'));

create policy "partner_portal_announcements_update_policy"
    on public.partner_portal_announcements
    for update
    using (public.can_access_workspace(workspace_id, 'content.write'))
    with check (public.can_access_workspace(workspace_id, 'content.write'));

create policy "partner_portal_announcements_delete_policy"
    on public.partner_portal_announcements
    for delete
    using (public.can_access_workspace(workspace_id, 'content.write'));

do $$
begin
    if not exists (
        select 1 from pg_trigger where tgname = 'set_updated_at_partner_portal_announcements'
    ) then
        execute 'create trigger set_updated_at_partner_portal_announcements before update on public.partner_portal_announcements for each row execute function public.handle_updated_at()';
    end if;
end $$;

commit;
