
alter table public.workspace_notes
    add column if not exists archived boolean not null default false,
    add column if not exists archived_at timestamptz;

create index if not exists workspace_notes_owner_archived_idx
    on public.workspace_notes (workspace_id, profile_id, archived, updated_at desc);
