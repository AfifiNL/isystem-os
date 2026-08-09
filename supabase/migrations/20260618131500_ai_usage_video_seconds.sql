BEGIN;

ALTER TABLE public.ai_usage_events
    ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.ai_usage_events
    DROP CONSTRAINT IF EXISTS ai_usage_events_duration_seconds_check;

ALTER TABLE public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_duration_seconds_check
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0);

ALTER TABLE public.ai_usage_events
    DROP CONSTRAINT IF EXISTS ai_usage_events_unit_type_check;

ALTER TABLE public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_unit_type_check
    CHECK (unit_type IN ('tokens', 'image', 'tts_char', 'music_seconds', 'speech_seconds', 'video_seconds'));

COMMENT ON COLUMN public.ai_usage_events.unit_type IS
    'Billable unit for AI usage. Includes tokens, image, tts_char, music_seconds, speech_seconds, and video_seconds.';

COMMENT ON COLUMN public.ai_usage_events.duration_seconds IS
    'Billable media duration for music_seconds, speech_seconds, and video_seconds usage rows.';

DROP FUNCTION IF EXISTS public.charge_ai_usage(
    uuid,
    uuid,
    text,
    text,
    text,
    integer,
    integer,
    integer,
    integer,
    bigint,
    bigint,
    text,
    jsonb
);

CREATE OR REPLACE FUNCTION public.charge_ai_usage(
  p_workspace_id              UUID,
  p_profile_id                UUID,
  p_route                     TEXT,
  p_model                     TEXT,
  p_unit_type                 TEXT,
  p_tokens_in                 INTEGER,
  p_tokens_out                INTEGER,
  p_image_count               INTEGER,
  p_char_count                INTEGER,
  p_duration_seconds          INTEGER,
  p_base_cost_millicents      BIGINT,
  p_platform_fee_millicents   BIGINT,
  p_status                    TEXT,
  p_metadata                  JSONB
)
RETURNS public.ai_usage_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event     public.ai_usage_events;
  v_charged   BIGINT;
BEGIN
  v_charged := COALESCE(p_base_cost_millicents, 0) + COALESCE(p_platform_fee_millicents, 0);

  INSERT INTO public.ai_usage_events (
    workspace_id, profile_id, route, model, unit_type,
    tokens_in, tokens_out, image_count, char_count, duration_seconds,
    base_cost_millicents, platform_fee_millicents, charged_millicents,
    status, metadata
  ) VALUES (
    p_workspace_id, p_profile_id, p_route, p_model, p_unit_type,
    p_tokens_in, p_tokens_out, p_image_count, p_char_count, p_duration_seconds,
    p_base_cost_millicents, p_platform_fee_millicents, v_charged,
    COALESCE(p_status, 'succeeded'), COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_event;

  INSERT INTO public.ai_credit_ledger (
    workspace_id, delta_millicents, reason, actor_profile_id, usage_event_id
  ) VALUES (
    p_workspace_id, -v_charged, 'ai_usage', p_profile_id, v_event.id
  );

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_ai_usage FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.charge_ai_usage TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
