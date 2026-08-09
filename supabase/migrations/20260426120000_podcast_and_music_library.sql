--
-- Podcast generation + reusable workspace music library.
--
-- Adds:
--   * 'podcast' to content_items_type_check
--   * podcast_shows         (one logical show per workspace; can have many)
--   * podcast_episodes      (audio + transcript + cover + RSS metadata)
--   * workspace_music_tracks (reusable beds/intros/outros, admin/manager-only writes)
--   * podcast_episode_music (junction with mixing offsets / fades / gain)
--   * audio-episodes        (public bucket, MP3 episode delivery for RSS/web)
--   * workspace-music       (private bucket, signed-URL playback for the library)

begin;

-- 0. Idempotency: drop any policies this migration owns so re-applies succeed.
--    (CREATE POLICY has no IF NOT EXISTS form.)
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname, tablename, policyname) in (
      ('public', 'podcast_shows',          'podcast_shows_select_member'),
      ('public', 'podcast_shows',          'podcast_shows_select_public_published'),
      ('public', 'podcast_shows',          'podcast_shows_write_admin_manager'),
      ('public', 'podcast_episodes',       'podcast_episodes_select_member'),
      ('public', 'podcast_episodes',       'podcast_episodes_select_public_published'),
      ('public', 'podcast_episodes',       'podcast_episodes_write_admin_manager'),
      ('public', 'workspace_music_tracks', 'workspace_music_tracks_select_member'),
      ('public', 'workspace_music_tracks', 'workspace_music_tracks_write_admin_manager'),
      ('public', 'podcast_episode_music',  'podcast_episode_music_select_via_episode'),
      ('public', 'podcast_episode_music',  'podcast_episode_music_write_admin_manager'),
      ('storage', 'objects',               'audio_episodes_public_read'),
      ('storage', 'objects',               'audio_episodes_admin_manager_write'),
      ('storage', 'objects',               'audio_episodes_admin_manager_update'),
      ('storage', 'objects',               'audio_episodes_admin_manager_delete'),
      ('storage', 'objects',               'podcast_drafts_member_read'),
      ('storage', 'objects',               'podcast_drafts_admin_manager_write'),
      ('storage', 'objects',               'podcast_drafts_admin_manager_update'),
      ('storage', 'objects',               'podcast_drafts_admin_manager_delete'),
      ('storage', 'objects',               'workspace_music_member_read'),
      ('storage', 'objects',               'workspace_music_admin_manager_write'),
      ('storage', 'objects',               'workspace_music_admin_manager_update'),
      ('storage', 'objects',               'workspace_music_admin_manager_delete')
    )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename
    );
  end loop;
end $$;

-- 1. Extend content_items types -----------------------------------------------

alter table public.content_items
  drop constraint if exists content_items_type_check;

alter table public.content_items
  add constraint content_items_type_check
  check (type = any (array[
    'video'::text,
    'blog'::text,
    'page'::text,
    'newsletter_issue'::text,
    'podcast'::text
  ]));

-- 2. Helper: admin/manager check ---------------------------------------------

create or replace function public.is_workspace_admin_or_manager(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.workspace_memberships wm
    where wm.workspace_id = p_workspace_id
      and wm.profile_id = auth.uid()
      and wm.membership_role = any (array['owner', 'admin', 'manager'])
  );
$$;

-- 3. Podcast shows ------------------------------------------------------------

create table if not exists public.podcast_shows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text,
  slug text not null,
  title text not null,
  subtitle text,
  description text,
  language text not null default 'en',
  author text,
  owner_email text,
  category text,
  explicit boolean not null default false,
  cover_art_url text,
  feed_url text,
  website_url text,
  is_published boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index if not exists podcast_shows_workspace_idx
  on public.podcast_shows (workspace_id, updated_at desc);

alter table public.podcast_shows enable row level security;

create policy "podcast_shows_select_member"
  on public.podcast_shows for select
  using (public.is_workspace_member(workspace_id));

create policy "podcast_shows_select_public_published"
  on public.podcast_shows for select
  to anon, authenticated
  using (is_published = true);

create policy "podcast_shows_write_admin_manager"
  on public.podcast_shows for all
  using (public.is_workspace_admin_or_manager(workspace_id))
  with check (public.is_workspace_admin_or_manager(workspace_id));

-- 4. Podcast episodes ---------------------------------------------------------

create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  show_id uuid not null references public.podcast_shows(id) on delete cascade,
  template_id text,
  content_item_id uuid references public.content_items(id) on delete set null,
  slug text not null,
  title text not null,
  summary text,
  description text,
  season_number integer,
  episode_number integer,
  episode_type text not null default 'full' check (episode_type in ('full', 'trailer', 'bonus')),

  -- audio
  audio_url text,                  -- mixed MP3 (intro + bed + narration + outro)
  audio_byte_size bigint,
  audio_duration_seconds integer,
  audio_mime_type text not null default 'audio/mpeg',
  narration_only_url text,         -- raw chunked TTS WAV/MP3 (for re-mixing)

  -- editorial assets
  cover_art_url text,
  transcript_text text,
  transcript_vtt_url text,
  chapters jsonb not null default '[]'::jsonb,   -- [{start_ms, title}]

  -- generation provenance
  generation_metadata jsonb not null default '{}'::jsonb,
  voice_id text,

  -- publishing
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  scheduled_for timestamptz,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, slug)
);

create index if not exists podcast_episodes_show_idx
  on public.podcast_episodes (show_id, published_at desc nulls last);

create index if not exists podcast_episodes_workspace_status_idx
  on public.podcast_episodes (workspace_id, status, updated_at desc);

alter table public.podcast_episodes enable row level security;

create policy "podcast_episodes_select_member"
  on public.podcast_episodes for select
  using (public.is_workspace_member(workspace_id));

create policy "podcast_episodes_select_public_published"
  on public.podcast_episodes for select
  to anon, authenticated
  using (
    status = 'published'
    and exists (
      select 1 from public.podcast_shows s
      where s.id = show_id and s.is_published = true
    )
  );

create policy "podcast_episodes_write_admin_manager"
  on public.podcast_episodes for all
  using (public.is_workspace_admin_or_manager(workspace_id))
  with check (public.is_workspace_admin_or_manager(workspace_id));

-- 5. Workspace music tracks (reusable library) -------------------------------

create table if not exists public.workspace_music_tracks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text,
  created_by_profile_id uuid references auth.users(id) on delete set null,

  title text not null,
  mood text not null check (mood in (
    'upbeat', 'calm', 'cinematic', 'corporate', 'lofi', 'dramatic', 'warm', 'tense', 'playful', 'ambient'
  )),
  duration_seconds integer not null default 0,

  -- storage
  storage_path text not null,         -- path inside workspace-music bucket
  audio_mime_type text not null default 'audio/mpeg',
  audio_byte_size bigint,

  -- generation provenance
  prompt_text text,
  source text not null default 'generated' check (source in ('generated', 'uploaded')),
  generator_model text,
  cost_millicents integer not null default 0,

  -- usage hints
  is_intro boolean not null default false,
  is_outro boolean not null default false,
  is_bed boolean not null default true,
  loop_safe boolean not null default false,

  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_music_tracks_workspace_idx
  on public.workspace_music_tracks (workspace_id, archived_at, created_at desc);

create index if not exists workspace_music_tracks_mood_idx
  on public.workspace_music_tracks (workspace_id, mood)
  where archived_at is null;

alter table public.workspace_music_tracks enable row level security;

-- Any workspace member can READ the library (so episode editor pickers work).
create policy "workspace_music_tracks_select_member"
  on public.workspace_music_tracks for select
  using (public.is_workspace_member(workspace_id));

-- Only admin/manager/owner can INSERT, UPDATE, or DELETE.
create policy "workspace_music_tracks_write_admin_manager"
  on public.workspace_music_tracks for all
  using (public.is_workspace_admin_or_manager(workspace_id))
  with check (public.is_workspace_admin_or_manager(workspace_id));

-- 6. Episode <-> music junction ----------------------------------------------

create table if not exists public.podcast_episode_music (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  track_id uuid not null references public.workspace_music_tracks(id) on delete restrict,
  role text not null check (role in ('intro', 'bed', 'outro')),
  start_offset_ms integer not null default 0,
  fade_in_ms integer not null default 1500,
  fade_out_ms integer not null default 2000,
  gain_db numeric(5, 2) not null default -18.0,
  created_at timestamptz not null default now(),
  unique (episode_id, role)
);

create index if not exists podcast_episode_music_track_idx
  on public.podcast_episode_music (track_id);

alter table public.podcast_episode_music enable row level security;

-- Read access: anyone who can read the parent episode.
create policy "podcast_episode_music_select_via_episode"
  on public.podcast_episode_music for select
  using (
    exists (
      select 1 from public.podcast_episodes e
      where e.id = episode_id
        and (
          public.is_workspace_member(e.workspace_id)
          or e.status = 'published'
        )
    )
  );

-- Write access: admin/manager on the parent episode's workspace.
create policy "podcast_episode_music_write_admin_manager"
  on public.podcast_episode_music for all
  using (
    exists (
      select 1 from public.podcast_episodes e
      where e.id = episode_id
        and public.is_workspace_admin_or_manager(e.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.podcast_episodes e
      where e.id = episode_id
        and public.is_workspace_admin_or_manager(e.workspace_id)
    )
  );

-- 7. Storage buckets ----------------------------------------------------------

-- Public bucket: ONLY published episode audio (copied here at publish time).
-- Drafts never live here — guessable {workspace_id}/{episode_id} paths would leak.
insert into storage.buckets (id, name, public)
values ('audio-episodes', 'audio-episodes', true)
on conflict (id) do nothing;

-- Private bucket: in-progress episode audio (mixed but unpublished).
insert into storage.buckets (id, name, public)
values ('podcast-drafts', 'podcast-drafts', false)
on conflict (id) do nothing;

-- Private bucket: reusable music library.
insert into storage.buckets (id, name, public)
values ('workspace-music', 'workspace-music', false)
on conflict (id) do nothing;

-- Helper: safely parse the workspace UUID from a storage path's first folder.
-- Returns NULL when the prefix is not a valid UUID; policies treat NULL as deny.
create or replace function public.storage_path_workspace_uuid(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_first text;
begin
  v_first := (storage.foldername(p_name))[1];
  if v_first is null or v_first = '' then
    return null;
  end if;
  begin
    return v_first::uuid;
  exception when others then
    return null;
  end;
end;
$$;

-- audio-episodes: anyone can read (public RSS), only admin/manager can write.
-- Path convention: {workspace_id}/{episode_id}/audio.mp3
create policy "audio_episodes_public_read"
  on storage.objects for select
  using (bucket_id = 'audio-episodes');

create policy "audio_episodes_admin_manager_write"
  on storage.objects for insert
  with check (
    bucket_id = 'audio-episodes'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

create policy "audio_episodes_admin_manager_update"
  on storage.objects for update
  using (
    bucket_id = 'audio-episodes'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

create policy "audio_episodes_admin_manager_delete"
  on storage.objects for delete
  using (
    bucket_id = 'audio-episodes'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

-- podcast-drafts: workspace members can read drafts; admin/manager can write.
create policy "podcast_drafts_member_read"
  on storage.objects for select
  using (
    bucket_id = 'podcast-drafts'
    and public.is_workspace_member(public.storage_path_workspace_uuid(name))
  );

create policy "podcast_drafts_admin_manager_write"
  on storage.objects for insert
  with check (
    bucket_id = 'podcast-drafts'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

create policy "podcast_drafts_admin_manager_update"
  on storage.objects for update
  using (
    bucket_id = 'podcast-drafts'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

create policy "podcast_drafts_admin_manager_delete"
  on storage.objects for delete
  using (
    bucket_id = 'podcast-drafts'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

-- workspace-music: path convention {workspace_id}/{track_id}.{ext}
create policy "workspace_music_member_read"
  on storage.objects for select
  using (
    bucket_id = 'workspace-music'
    and public.is_workspace_member(public.storage_path_workspace_uuid(name))
  );

create policy "workspace_music_admin_manager_write"
  on storage.objects for insert
  with check (
    bucket_id = 'workspace-music'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

create policy "workspace_music_admin_manager_update"
  on storage.objects for update
  using (
    bucket_id = 'workspace-music'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

create policy "workspace_music_admin_manager_delete"
  on storage.objects for delete
  using (
    bucket_id = 'workspace-music'
    and public.is_workspace_admin_or_manager(public.storage_path_workspace_uuid(name))
  );

-- 8. updated_at triggers ------------------------------------------------------

create or replace function public.set_updated_at_now()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_podcast_shows on public.podcast_shows;
create trigger set_updated_at_podcast_shows
  before update on public.podcast_shows
  for each row execute function public.set_updated_at_now();

drop trigger if exists set_updated_at_podcast_episodes on public.podcast_episodes;
create trigger set_updated_at_podcast_episodes
  before update on public.podcast_episodes
  for each row execute function public.set_updated_at_now();

drop trigger if exists set_updated_at_workspace_music_tracks on public.workspace_music_tracks;
create trigger set_updated_at_workspace_music_tracks
  before update on public.workspace_music_tracks
  for each row execute function public.set_updated_at_now();

commit;
