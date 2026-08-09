BEGIN;

ALTER TABLE public.ai_usage_events
    DROP CONSTRAINT IF EXISTS ai_usage_events_unit_type_check;

ALTER TABLE public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_unit_type_check
    CHECK (unit_type IN ('tokens', 'image', 'tts_char', 'music_seconds', 'speech_seconds'));

COMMENT ON COLUMN public.ai_usage_events.unit_type IS
    'Billable unit for AI usage. Includes tokens, image, tts_char, music_seconds, and speech_seconds; media durations are stored in metadata until the base table gains dedicated duration columns.';

COMMIT;
