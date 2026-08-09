--
-- Seed curated ElevenLabs "premade" library voices into every workspace as
-- prebuilt rows, so workspace managers can pick predefined hosts/guests in
-- the Podcast Studio in addition to cloning their own.
--
-- Coverage: 4 voices per locale (en, nl, ar) × mixed gender. All entries use
-- `eleven_multilingual_v2`, which handles all 29 ElevenLabs languages and
-- routes language detection from the input text. The `language_code` column
-- is the *recommended* locale for the host UI grouping; the same voice can
-- be reused across locales because the model is multilingual.
--
-- Idempotency: backfill uses ON CONFLICT (workspace_id, provider,
-- provider_voice_id) DO NOTHING. The after-insert trigger fires once per
-- new workspace and is also idempotent.
--
-- Operator note: voice IDs are public ElevenLabs premade voices. Workspace
-- managers may archive any preset they don't want surfaced; this migration
-- never touches archived rows on re-apply.

begin;

-- 1. Seed function ------------------------------------------------------------
create or replace function public._seed_elevenlabs_preset_voices(p_workspace_id uuid)
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
    -- English presets
    (p_workspace_id, 'elevenlabs', '21m00Tcm4TlvDq8ikWAM', 'Rachel — calm narrator (EN)',     'prebuilt', 'en', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'pNInz6obpgDQGcFmaJgB', 'Adam — deep male host (EN)',      'prebuilt', 'en', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'EXAVITQu4vr4xnSDxMaL', 'Bella — warm female host (EN)',   'prebuilt', 'en', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'ErXwobaYiN019PkySvjV', 'Antoni — well-rounded male (EN)', 'prebuilt', 'en', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),

    -- Dutch presets (multilingual_v2 supports nl; voices are tone choices)
    (p_workspace_id, 'elevenlabs', 'onwK4e9ZLuTAKqWW03F9', 'Daniel — authoritative male (NL)','prebuilt', 'nl', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'XB0fDUnXU5powFXDhCwa', 'Charlotte — measured female (NL)','prebuilt', 'nl', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'TX3LPaxmHKxFdv7VOQHJ', 'Liam — narrative male (NL)',      'prebuilt', 'nl', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'pFZP5JQG7iQjIQuC4Bku', 'Lily — clear female (NL)',        'prebuilt', 'nl', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),

    -- Arabic presets (multilingual_v2 supports ar; voices are tone choices)
    (p_workspace_id, 'elevenlabs', 'nPczCjzI2devNBz1zQrb', 'Brian — narrative male (AR)',     'prebuilt', 'ar', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'AZnzlk1XvdvUeBnXmlld', 'Domi — strong female (AR)',       'prebuilt', 'ar', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'TxGEqnHWrfWFTfGW9XjX', 'Josh — deep male (AR)',           'prebuilt', 'ar', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready'),
    (p_workspace_id, 'elevenlabs', 'MF3mGyEYCl7XYWbV9V6O', 'Elli — emotive female (AR)',      'prebuilt', 'ar', 'eleven_multilingual_v2', 'not_required', 'discard_after_clone', 'ready')
  on conflict (workspace_id, provider, provider_voice_id) do nothing;
end;
$$;

-- 2. Backfill all existing workspaces ----------------------------------------
do $$
declare
  ws record;
begin
  for ws in select id from public.workspaces loop
    perform public._seed_elevenlabs_preset_voices(ws.id);
  end loop;
end;
$$;

-- 3. Trigger for newly created workspaces ------------------------------------
create or replace function public._seed_elevenlabs_preset_voices_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._seed_elevenlabs_preset_voices(new.id);
  return new;
end;
$$;

drop trigger if exists seed_elevenlabs_presets_after_workspace_insert on public.workspaces;
create trigger seed_elevenlabs_presets_after_workspace_insert
  after insert on public.workspaces
  for each row execute function public._seed_elevenlabs_preset_voices_trg();

commit;
