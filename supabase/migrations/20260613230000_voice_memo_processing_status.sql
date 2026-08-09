ALTER TABLE public.workspace_voice_memos
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS target_project_id uuid;

ALTER TABLE public.workspace_voice_memos
  DROP CONSTRAINT IF EXISTS workspace_voice_memos_processing_status_check;

ALTER TABLE public.workspace_voice_memos
  ADD CONSTRAINT workspace_voice_memos_processing_status_check
  CHECK (processing_status IS NULL OR processing_status IN ('pending', 'processing', 'processed', 'error'));

ALTER TABLE public.workspace_voice_memos
  DROP CONSTRAINT IF EXISTS workspace_voice_memos_attempt_count_nonnegative;

ALTER TABLE public.workspace_voice_memos
  ADD CONSTRAINT workspace_voice_memos_attempt_count_nonnegative
  CHECK (attempt_count >= 0);

CREATE INDEX IF NOT EXISTS workspace_voice_memos_processing_queue_idx
  ON public.workspace_voice_memos (workspace_id, processing_status, next_retry_at, created_at)
  WHERE processing_status IN ('pending', 'error');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_voice_memos_target_project_id_fkey'
      AND conrelid = 'public.workspace_voice_memos'::regclass
  ) THEN
    ALTER TABLE public.workspace_voice_memos
      ADD CONSTRAINT workspace_voice_memos_target_project_id_fkey
      FOREIGN KEY (target_project_id)
      REFERENCES public.workspace_client_projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.workspace_sla_tasks
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_voice_memo_id uuid,
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_sla_tasks_voice_memo_source_unique_idx
  ON public.workspace_sla_tasks (project_id, source_kind, source_voice_memo_id, source_fingerprint)
  WHERE source_kind = 'voice_memo_transcription'
    AND source_voice_memo_id IS NOT NULL
    AND source_fingerprint IS NOT NULL;
