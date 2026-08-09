--
-- Productivity apps (Notes + Voice Memos) for the iSystem desktop OS.
-- Scoped per-user AND per-workspace so notes don't leak between workspaces
-- a user switches between, and multiple team members in the same workspace
-- keep private notebooks.
--
-- Applied out-of-band in production on 2026-04-22 via MCP.

create table if not exists workspace_notes (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    profile_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Untitled note',
    body text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists workspace_notes_owner_idx
    on public.workspace_notes (workspace_id, profile_id, updated_at desc);

alter table public.workspace_notes enable row level security;

create policy "workspace_notes_select_owner"
    on public.workspace_notes for select
    using (profile_id = auth.uid());

create policy "workspace_notes_insert_owner"
    on public.workspace_notes for insert
    with check (profile_id = auth.uid());

create policy "workspace_notes_update_owner"
    on public.workspace_notes for update
    using (profile_id = auth.uid());

create policy "workspace_notes_delete_owner"
    on public.workspace_notes for delete
    using (profile_id = auth.uid());

create table if not exists workspace_voice_memos (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    profile_id uuid not null references auth.users(id) on delete cascade,
    title text not null default 'Voice memo',
    storage_path text not null,
    duration_seconds integer not null default 0,
    mime_type text not null default 'audio/webm',
    created_at timestamptz not null default now()
);

create index if not exists workspace_voice_memos_owner_idx
    on public.workspace_voice_memos (workspace_id, profile_id, created_at desc);

alter table public.workspace_voice_memos enable row level security;

create policy "workspace_voice_memos_select_owner"
    on public.workspace_voice_memos for select
    using (profile_id = auth.uid());

create policy "workspace_voice_memos_insert_owner"
    on public.workspace_voice_memos for insert
    with check (profile_id = auth.uid());

create policy "workspace_voice_memos_delete_owner"
    on public.workspace_voice_memos for delete
    using (profile_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('workspace-voice-memos', 'workspace-voice-memos', false)
on conflict (id) do nothing;

create policy "voice_memos_owner_read"
    on storage.objects for select
    using (
        bucket_id = 'workspace-voice-memos'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

create policy "voice_memos_owner_write"
    on storage.objects for insert
    with check (
        bucket_id = 'workspace-voice-memos'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

create policy "voice_memos_owner_delete"
    on storage.objects for delete
    using (
        bucket_id = 'workspace-voice-memos'
        and (storage.foldername(name))[2] = auth.uid()::text
    );
