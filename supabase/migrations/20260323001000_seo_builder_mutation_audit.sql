
ALTER TABLE public.seo_execution_events
  ADD COLUMN IF NOT EXISTS block_id text,
  ADD COLUMN IF NOT EXISTS field_path text,
  ADD COLUMN IF NOT EXISTS locale text,
  ADD COLUMN IF NOT EXISTS original_field_value text,
  ADD COLUMN IF NOT EXISTS updated_field_value text;

CREATE INDEX IF NOT EXISTS seo_execution_events_workspace_block_idx
  ON public.seo_execution_events (workspace_id, block_id, created_at DESC);
