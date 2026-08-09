--
-- Workspace-scoped voice registry for multi-provider TTS (Gemini prebuilt
-- voices + ElevenLabs library/cloned voices), plus a consent audit trail and
-- per-episode host/guest voice selection.
--
-- Compliance posture:
--   * Raw voice samples are NOT stored after clone creation. The
--     /api/voices/elevenlabs/clone route streams the upload directly to
--     ElevenLabs and discards bytes after success.
--   * voice_consent_audits is append-only — even archive of the parent voice
--     keeps the consent record so we can prove who authorized what when.

begin;

-- 0. Idempotency for re-applies.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where (schemaname, tablename, policyname) in (
      ('public', 'workspace_voices',      'workspace_voices_select_member'),
      ('public', 'workspace_voices',      'workspace_voices_write_admin_manager'),
      ('public', 'voice_consent_audits',  'voice_consent_audits_select_admin_manager'),
      ('public', 'voice_consent_audits',  'voice_consent_audits_insert_admin_manager')
    )
  loop
    execute format('drop policy if exists %I on %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
end $$;

-- 1. workspace_voices ---------------------------------------------------------

create table if not exists public.workspace_voices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id text,
  created_by_profile_id uuid references auth.users(id) on delete set null,

  provider text not null check (provider in ('gemini', 'elevenlabs')),
  -- Provider-side identifier:
  --   * gemini       → prebuilt voice name (e.g. 'Aoede')
  --   * elevenlabs   → ElevenLabs voice_id (24-char alphanumeric)
  provider_voice_id text not null,

  display_name text not null,
  voice_type text not null check (voice_type in (
    'prebuilt',          -- vendor-shipped (Gemini Aoede, ElevenLabs library)
    'instant_clone',     -- ElevenLabs IVC
    'professional_clone',-- ElevenLabs PVC (future)
    'designed',          -- ElevenLabs Voice Design
    'library'            -- ElevenLabs community voice imported by voice_id
  )),

  language_code text not null default 'en',
  model_preference text,            -- e.g. 'eleven_multilingual_v2', 'eleven_v3'

  -- Consent fields (denormalized for fast reads; full audit lives in
  -- voice_consent_audits).
  consent_status text not null default 'pending' check (consent_status in (
    'pending', 'granted', 'revoked', 'not_required'
  )),
  consent_captured_at timestamptz,
  consent_actor_name text,
  consent_source text,              -- e.g. 'self_upload', 'verified_third_party'

  sample_retention_policy text not null default 'discard_after_clone'
    check (sample_retention_policy in ('discard_after_clone', 'retained_with_consent')),

  -- Provider-side state for async flows (PVC verification, training, etc).
  provider_status text not null default 'ready' check (provider_status in (
    'pending', 'training', 'ready', 'failed', 'archived'
  )),
  provider_metadata jsonb not null default '{}'::jsonb,

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, provider, provider_voice_id)
);

create index if not exists workspace_voices_workspace_idx
  on public.workspace_voices (workspace_id, archived_at, created_at desc);

create index if not exists workspace_voices_provider_idx
  on public.workspace_voices (workspace_id, provider)
  where archived_at is null;

alter table public.workspace_voices enable row level security;

create policy "workspace_voices_select_member"
  on public.workspace_voices for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_voices_write_admin_manager"
  on public.workspace_voices for all
  using (public.is_workspace_admin_or_manager(workspace_id))
  with check (public.is_workspace_admin_or_manager(workspace_id));

-- 2. voice_consent_audits — append-only --------------------------------------

create table if not exists public.voice_consent_audits (
  id uuid primary key default gen_random_uuid(),
  voice_id uuid not null references public.workspace_voices(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_profile_id uuid references auth.users(id) on delete set null,
  event text not null check (event in (
    'consent_granted', 'consent_revoked', 'voice_archived', 'sample_uploaded', 'clone_created'
  )),
  consent_text text,                -- the exact wording the actor agreed to
  ip_hash text,                     -- SHA-256 of client IP at capture time
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists voice_consent_audits_voice_idx
  on public.voice_consent_audits (voice_id, created_at desc);

alter table public.voice_consent_audits enable row level security;

create policy "voice_consent_audits_select_admin_manager"
  on public.voice_consent_audits for select
  using (public.is_workspace_admin_or_manager(workspace_id));

create policy "voice_consent_audits_insert_admin_manager"
  on public.voice_consent_audits for insert
  with check (public.is_workspace_admin_or_manager(workspace_id));

-- 3. Wire voices into podcast_episodes ---------------------------------------

alter table public.podcast_episodes
  add column if not exists host_voice_id uuid references public.workspace_voices(id) on delete set null,
  add column if not exists guest_voice_id uuid references public.workspace_voices(id) on delete set null;

create index if not exists podcast_episodes_host_voice_idx
  on public.podcast_episodes (host_voice_id) where host_voice_id is not null;

create index if not exists podcast_episodes_guest_voice_idx
  on public.podcast_episodes (guest_voice_id) where guest_voice_id is not null;

-- 4. updated_at trigger -------------------------------------------------------

drop trigger if exists set_updated_at_workspace_voices on public.workspace_voices;
create trigger set_updated_at_workspace_voices
  before update on public.workspace_voices
  for each row execute function public.set_updated_at_now();

commit;
