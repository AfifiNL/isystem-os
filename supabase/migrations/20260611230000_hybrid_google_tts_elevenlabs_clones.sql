-- Hybrid voice-provider migration:
--   * Google/Gemini remains the default prebuilt TTS provider.
--   * ElevenLabs remains available only for cloned/custom workspace voices.
--   * Existing ElevenLabs preset references are moved to Google presets.
--   * Existing ElevenLabs cloned/custom voices remain usable.

begin;

-- 1. Provider/state constraints for the hybrid model.
alter table public.workspace_voices
  drop constraint if exists workspace_voices_provider_check;

alter table public.workspace_voices
  add constraint workspace_voices_provider_check
  check (provider in ('gemini', 'vertex', 'elevenlabs'));

alter table public.workspace_voices
  drop constraint if exists workspace_voices_provider_status_check;

-- Normalize statuses left by the abandoned full-GCP custom-voice plan before
-- recreating the narrower hybrid constraint. ElevenLabs cloned/custom voices
-- stay usable; old preset/library voices are archived below.
update public.workspace_voices
set provider_status = case
    when provider_status = 'migration_required'
      and provider = 'elevenlabs'
      and voice_type in ('instant_clone', 'professional_clone', 'designed')
      and provider_voice_id is not null
      then 'ready'
    when provider_status = 'migration_required'
      then 'archived'
    else 'failed'
  end,
  archived_at = case
    when provider_status = 'migration_required'
      and provider = 'elevenlabs'
      and voice_type in ('instant_clone', 'professional_clone', 'designed')
      and provider_voice_id is not null
      then archived_at
    else coalesce(archived_at, now())
  end,
  updated_at = now()
where provider_status is null
   or provider_status not in ('pending', 'training', 'ready', 'failed', 'archived');

alter table public.workspace_voices
  add constraint workspace_voices_provider_status_check
  check (provider_status in ('pending', 'training', 'ready', 'failed', 'archived'));

-- Obsolete Google Instant Custom Voice key storage from the abandoned full-GCP
-- clone path. ElevenLabs cloned voices store only provider_voice_id.
alter table public.workspace_voices
  drop column if exists encrypted_voice_cloning_key;

-- 2. Consent audits should survive workspace_voice deletion.
alter table public.voice_consent_audits
  drop constraint if exists voice_consent_audits_voice_id_fkey;

alter table public.voice_consent_audits
  alter column voice_id drop not null;

alter table public.voice_consent_audits
  add constraint voice_consent_audits_voice_id_fkey
  foreign key (voice_id)
  references public.workspace_voices(id)
  on delete set null;

-- 3. Seed Google/Gemini prebuilt voices for every workspace.
create or replace function public._seed_google_preset_voices(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_voices (
    workspace_id,
    provider,
    provider_voice_id,
    display_name,
    voice_type,
    language_code,
    model_preference,
    consent_status,
    sample_retention_policy,
    provider_status
  )
  values
    (p_workspace_id, 'gemini', 'Aoede', 'Aoede - calm narrator (EN)', 'prebuilt', 'en', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'gemini', 'Charon', 'Charon - deep host (EN)', 'prebuilt', 'en', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'gemini', 'Fenrir', 'Fenrir - warm host (EN)', 'prebuilt', 'en', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'gemini', 'Kore', 'Kore - clear narrator (EN)', 'prebuilt', 'en', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'gemini', 'Puck', 'Puck - bright host (EN/NL)', 'prebuilt', 'nl', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'vertex', 'nl-NL-Studio-W', 'Studio W - Dutch voice (NL)', 'prebuilt', 'nl', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'vertex', 'nl-NL-Studio-Y', 'Studio Y - Dutch voice (NL)', 'prebuilt', 'nl', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'vertex', 'ar-XA-Wavenet-A', 'Wavenet A - Arabic voice (AR)', 'prebuilt', 'ar', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'vertex', 'ar-XA-Wavenet-B', 'Wavenet B - Arabic voice (AR)', 'prebuilt', 'ar', null, 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'vertex', 'ar-XA-Wavenet-C', 'Wavenet C - Arabic voice (AR)', 'prebuilt', 'ar', null, 'not_required', 'discard_after_clone', 'ready')
  on conflict (workspace_id, provider, provider_voice_id) do nothing;
end;
$$;

do $$
declare
  ws record;
begin
  for ws in select id from public.workspaces loop
    perform public._seed_google_preset_voices(ws.id);
  end loop;
end;
$$;

create or replace function public._seed_google_preset_voices_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._seed_google_preset_voices(new.id);
  return new;
end;
$$;

drop trigger if exists seed_google_presets_after_workspace_insert on public.workspaces;
create trigger seed_google_presets_after_workspace_insert
  after insert on public.workspaces
  for each row execute function public._seed_google_preset_voices_trg();

-- Stop seeding ElevenLabs prebuilt voices for new workspaces. ElevenLabs remains
-- available through cloned/custom voices created in the app.
drop trigger if exists seed_elevenlabs_presets_after_workspace_insert on public.workspaces;
drop function if exists public._seed_elevenlabs_preset_voices_trg();
drop function if exists public._seed_elevenlabs_preset_voices(uuid);

-- 4. Move active episode refs from old ElevenLabs presets to Google presets.
with voice_preset_map (old_provider_voice_id, new_provider, new_provider_voice_id) as (
  values
    ('21m00Tcm4TlvDq8ikWAM', 'gemini', 'Aoede'),
    ('pNInz6obpgDQGcFmaJgB', 'gemini', 'Charon'),
    ('EXAVITQu4vr4xnSDxMaL', 'gemini', 'Kore'),
    ('ErXwobaYiN019PkySvjV', 'gemini', 'Fenrir'),
    ('onwK4e9ZLuTAKqWW03F9', 'vertex', 'nl-NL-Studio-W'),
    ('XB0fDUnXU5powFXDhCwa', 'vertex', 'nl-NL-Studio-Y'),
    ('TX3LPaxmHKxFdv7VOQHJ', 'vertex', 'nl-NL-Studio-W'),
    ('pFZP5JQG7iQjIQuC4Bku', 'gemini', 'Puck'),
    ('nPczCjzI2devNBz1zQrb', 'vertex', 'ar-XA-Wavenet-B'),
    ('AZnzlk1XvdvUeBnXmlld', 'vertex', 'ar-XA-Wavenet-A'),
    ('TxGEqnHWrfWFTfGW9XjX', 'vertex', 'ar-XA-Wavenet-B'),
    ('MF3mGyEYCl7XYWbV9V6O', 'vertex', 'ar-XA-Wavenet-A')
)
update public.podcast_episodes e
set host_voice_id = replacement.id
from public.workspace_voices old_voice
join voice_preset_map map
  on map.old_provider_voice_id = old_voice.provider_voice_id
join public.workspace_voices replacement
  on replacement.workspace_id = old_voice.workspace_id
  and replacement.provider = map.new_provider
  and replacement.provider_voice_id = map.new_provider_voice_id
where e.host_voice_id = old_voice.id
  and old_voice.provider = 'elevenlabs'
  and old_voice.voice_type = 'prebuilt';

with voice_preset_map (old_provider_voice_id, new_provider, new_provider_voice_id) as (
  values
    ('21m00Tcm4TlvDq8ikWAM', 'gemini', 'Aoede'),
    ('pNInz6obpgDQGcFmaJgB', 'gemini', 'Charon'),
    ('EXAVITQu4vr4xnSDxMaL', 'gemini', 'Kore'),
    ('ErXwobaYiN019PkySvjV', 'gemini', 'Fenrir'),
    ('onwK4e9ZLuTAKqWW03F9', 'vertex', 'nl-NL-Studio-W'),
    ('XB0fDUnXU5powFXDhCwa', 'vertex', 'nl-NL-Studio-Y'),
    ('TX3LPaxmHKxFdv7VOQHJ', 'vertex', 'nl-NL-Studio-W'),
    ('pFZP5JQG7iQjIQuC4Bku', 'gemini', 'Puck'),
    ('nPczCjzI2devNBz1zQrb', 'vertex', 'ar-XA-Wavenet-B'),
    ('AZnzlk1XvdvUeBnXmlld', 'vertex', 'ar-XA-Wavenet-A'),
    ('TxGEqnHWrfWFTfGW9XjX', 'vertex', 'ar-XA-Wavenet-B'),
    ('MF3mGyEYCl7XYWbV9V6O', 'vertex', 'ar-XA-Wavenet-A')
)
update public.podcast_episodes e
set guest_voice_id = replacement.id
from public.workspace_voices old_voice
join voice_preset_map map
  on map.old_provider_voice_id = old_voice.provider_voice_id
join public.workspace_voices replacement
  on replacement.workspace_id = old_voice.workspace_id
  and replacement.provider = map.new_provider
  and replacement.provider_voice_id = map.new_provider_voice_id
where e.guest_voice_id = old_voice.id
  and old_voice.provider = 'elevenlabs'
  and old_voice.voice_type = 'prebuilt';

-- Hide old ElevenLabs preset/library rows after references are moved. Keep
-- cloned/custom rows active.
update public.workspace_voices
set archived_at = coalesce(archived_at, now()),
    provider_status = 'archived',
    updated_at = now()
where provider = 'elevenlabs'
  and voice_type in ('prebuilt', 'library')
  and archived_at is null;

commit;
