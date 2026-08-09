-- Durable linkage from generated workspace notes back to their source voice memo.
-- Columns are nullable so existing notes remain valid and Agent 2 can add the
-- idempotent generation flow without a blocking backfill.

ALTER TABLE public.workspace_notes
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_voice_memo_id uuid,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_notes_source_type_check'
      AND conrelid = 'public.workspace_notes'::regclass
  ) THEN
    ALTER TABLE public.workspace_notes
      ADD CONSTRAINT workspace_notes_source_type_check
      CHECK (
        source_type IS NULL
        OR source_type IN ('voice_memo')
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.workspace_notes
  VALIDATE CONSTRAINT workspace_notes_source_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_notes_source_metadata_object_check'
      AND conrelid = 'public.workspace_notes'::regclass
  ) THEN
    ALTER TABLE public.workspace_notes
      ADD CONSTRAINT workspace_notes_source_metadata_object_check
      CHECK (
        source_metadata IS NULL
        OR jsonb_typeof(source_metadata) = 'object'
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.workspace_notes
  VALIDATE CONSTRAINT workspace_notes_source_metadata_object_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_notes_source_voice_memo_type_check'
      AND conrelid = 'public.workspace_notes'::regclass
  ) THEN
    ALTER TABLE public.workspace_notes
      ADD CONSTRAINT workspace_notes_source_voice_memo_type_check
      CHECK (
        source_voice_memo_id IS NULL
        OR source_type = 'voice_memo'
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.workspace_notes
  VALIDATE CONSTRAINT workspace_notes_source_voice_memo_type_check;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_voice_memos_id_workspace_profile_idx
  ON public.workspace_voice_memos (id, workspace_id, profile_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_notes_source_voice_memo_scope_fkey'
      AND conrelid = 'public.workspace_notes'::regclass
  ) THEN
    ALTER TABLE public.workspace_notes
      ADD CONSTRAINT workspace_notes_source_voice_memo_scope_fkey
      FOREIGN KEY (source_voice_memo_id, workspace_id, profile_id)
      REFERENCES public.workspace_voice_memos(id, workspace_id, profile_id)
      ON DELETE SET NULL (source_voice_memo_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS workspace_notes_source_voice_memo_idx
  ON public.workspace_notes (source_voice_memo_id)
  WHERE source_voice_memo_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_notes_one_generated_note_per_voice_memo_idx
  ON public.workspace_notes (workspace_id, profile_id, source_voice_memo_id)
  WHERE source_voice_memo_id IS NOT NULL;
