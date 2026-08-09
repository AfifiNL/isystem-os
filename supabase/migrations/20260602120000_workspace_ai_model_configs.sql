-- Create migration to add ai_model_configs JSONB column to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS ai_model_configs JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workspaces.ai_model_configs IS
  'Chosen model configurations per AI service (copywriting, reasoning, structuring, legal, transcription). Keys map to publisher/model identifiers.';
