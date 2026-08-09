-- SLA refactoring and Legibility Hub vector database setup.
-- Idempotent because this migration may be replayed against client databases
-- where the legacy client-specific SLA tables were already renamed manually.
BEGIN;

-- =============================================================================
-- 1. Refactor public.facility_locations to public.workspace_client_projects
-- =============================================================================

DO $$
BEGIN
    -- Drop legacy policies only if the legacy relation still exists. Plain
    -- DROP POLICY fails before IF EXISTS can help when the table is missing.
    IF to_regclass('public.facility_locations') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Portal clients can view own locations" ON public.facility_locations;
        DROP POLICY IF EXISTS "Workspace owners can manage locations" ON public.facility_locations;
    END IF;
END $$;

-- Rename table when replaying from the original client-specific naming.
DO $$
BEGIN
    IF to_regclass('public.facility_locations') IS NOT NULL
       AND to_regclass('public.workspace_client_projects') IS NULL THEN
        ALTER TABLE public.facility_locations RENAME TO workspace_client_projects;
    END IF;
END $$;

ALTER TABLE IF EXISTS public.workspace_client_projects ADD COLUMN IF NOT EXISTS description text;

-- Recreate policies on workspace_client_projects
DROP POLICY IF EXISTS "Portal clients can view own projects" ON public.workspace_client_projects;
DROP POLICY IF EXISTS "Workspace owners can manage projects" ON public.workspace_client_projects;

CREATE POLICY "Portal clients can view own projects"
    ON public.workspace_client_projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.client_portal_users cpu
            WHERE cpu.id = workspace_client_projects.client_id
              AND cpu.profile_id = auth.uid()
              AND cpu.workspace_id = workspace_client_projects.workspace_id
        )
    );

CREATE POLICY "Workspace owners can manage projects"
    ON public.workspace_client_projects
    FOR ALL
    USING (public.can_access_workspace(workspace_id))
    WITH CHECK (public.can_access_workspace(workspace_id));

-- =============================================================================
-- 2. Refactor public.cleaning_schedules to public.workspace_sla_tasks
-- =============================================================================

-- Rename frequency kind enum only when the new name does not already exist.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cleaning_schedule_frequency_kind')
       AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_sla_task_frequency_kind') THEN
        ALTER TYPE public.cleaning_schedule_frequency_kind RENAME TO workspace_sla_task_frequency_kind;
    END IF;
END $$;

-- Drop legacy policies
DO $$
BEGIN
    IF to_regclass('public.cleaning_schedules') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Portal clients can view own schedules" ON public.cleaning_schedules;
        DROP POLICY IF EXISTS "Workspace owners can manage schedules" ON public.cleaning_schedules;
    END IF;
END $$;

-- Rename table
DO $$
BEGIN
    IF to_regclass('public.cleaning_schedules') IS NOT NULL
       AND to_regclass('public.workspace_sla_tasks') IS NULL THEN
        ALTER TABLE public.cleaning_schedules RENAME TO workspace_sla_tasks;
    END IF;
END $$;

-- Rename location_id -> project_id
DO $$
BEGIN
    IF to_regclass('public.workspace_sla_tasks') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'workspace_sla_tasks' AND column_name = 'location_id'
       )
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'workspace_sla_tasks' AND column_name = 'project_id'
       ) THEN
        ALTER TABLE public.workspace_sla_tasks RENAME COLUMN location_id TO project_id;
    END IF;
END $$;

-- Drop legacy check constraints
ALTER TABLE public.workspace_sla_tasks DROP CONSTRAINT IF EXISTS cleaning_schedules_status_check;
ALTER TABLE public.workspace_sla_tasks DROP CONSTRAINT IF EXISTS cleaning_schedules_grace_nonnegative;
ALTER TABLE public.workspace_sla_tasks DROP CONSTRAINT IF EXISTS cleaning_schedules_value_positive;
ALTER TABLE public.workspace_sla_tasks DROP CONSTRAINT IF EXISTS workspace_sla_tasks_status_check;
ALTER TABLE public.workspace_sla_tasks DROP CONSTRAINT IF EXISTS workspace_sla_tasks_grace_nonnegative;
ALTER TABLE public.workspace_sla_tasks DROP CONSTRAINT IF EXISTS workspace_sla_tasks_value_positive;

-- Migrate 'compliant' status to 'completed' before adding the new constraint.
UPDATE public.workspace_sla_tasks SET status = 'completed' WHERE status = 'compliant';

-- Re-apply constraints under new names
ALTER TABLE public.workspace_sla_tasks ADD CONSTRAINT workspace_sla_tasks_status_check CHECK (status IN ('completed', 'pending', 'issue'));
ALTER TABLE public.workspace_sla_tasks ADD CONSTRAINT workspace_sla_tasks_grace_nonnegative CHECK (grace_period_days >= 0);
ALTER TABLE public.workspace_sla_tasks ADD CONSTRAINT workspace_sla_tasks_value_positive CHECK (frequency_value_days IS NULL OR frequency_value_days > 0);

ALTER TABLE IF EXISTS public.workspace_sla_tasks ADD COLUMN IF NOT EXISTS category text;

-- Recreate policies on workspace_sla_tasks
DROP POLICY IF EXISTS "Portal clients can view own SLA tasks" ON public.workspace_sla_tasks;
DROP POLICY IF EXISTS "Workspace owners can manage SLA tasks" ON public.workspace_sla_tasks;

CREATE POLICY "Portal clients can view own SLA tasks"
    ON public.workspace_sla_tasks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.workspace_client_projects wcp
            JOIN public.client_portal_users cpu ON cpu.id = wcp.client_id
            WHERE wcp.id = workspace_sla_tasks.project_id
              AND cpu.profile_id = auth.uid()
        )
    );

CREATE POLICY "Workspace owners can manage SLA tasks"
    ON public.workspace_sla_tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.workspace_client_projects wcp
            WHERE wcp.id = workspace_sla_tasks.project_id
              AND public.can_access_workspace(wcp.workspace_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workspace_client_projects wcp
            WHERE wcp.id = workspace_sla_tasks.project_id
              AND public.can_access_workspace(wcp.workspace_id)
        )
    );

-- =============================================================================
-- 3. Refactor public.cleaning_schedule_notes to public.workspace_sla_task_notes
-- =============================================================================

-- Drop legacy policies
DO $$
BEGIN
    IF to_regclass('public.cleaning_schedule_notes') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Portal clients can view own notes" ON public.cleaning_schedule_notes;
        DROP POLICY IF EXISTS "Portal clients can add notes on own schedules" ON public.cleaning_schedule_notes;
        DROP POLICY IF EXISTS "Workspace owners can manage notes" ON public.cleaning_schedule_notes;
    END IF;
END $$;

-- Rename table
DO $$
BEGIN
    IF to_regclass('public.cleaning_schedule_notes') IS NOT NULL
       AND to_regclass('public.workspace_sla_task_notes') IS NULL THEN
        ALTER TABLE public.cleaning_schedule_notes RENAME TO workspace_sla_task_notes;
    END IF;
END $$;

-- Rename cleaning_schedule_id -> sla_task_id
DO $$
BEGIN
    IF to_regclass('public.workspace_sla_task_notes') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'workspace_sla_task_notes' AND column_name = 'cleaning_schedule_id'
       )
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'workspace_sla_task_notes' AND column_name = 'sla_task_id'
       ) THEN
        ALTER TABLE public.workspace_sla_task_notes RENAME COLUMN cleaning_schedule_id TO sla_task_id;
    END IF;
END $$;

-- Drop legacy check constraint
ALTER TABLE public.workspace_sla_task_notes DROP CONSTRAINT IF EXISTS cleaning_schedule_notes_resolution_only_by_manager;
ALTER TABLE public.workspace_sla_task_notes DROP CONSTRAINT IF EXISTS workspace_sla_task_notes_resolution_only_by_manager;
ALTER TABLE public.workspace_sla_task_notes ADD CONSTRAINT workspace_sla_task_notes_resolution_only_by_manager CHECK (NOT is_resolution OR author_kind = 'workspace_manager');

-- Recreate policies on workspace_sla_task_notes
DROP POLICY IF EXISTS "Portal clients can view own task notes" ON public.workspace_sla_task_notes;
DROP POLICY IF EXISTS "Portal clients can add notes on own SLA tasks" ON public.workspace_sla_task_notes;
DROP POLICY IF EXISTS "Workspace owners can manage SLA task notes" ON public.workspace_sla_task_notes;

CREATE POLICY "Portal clients can view own task notes"
    ON public.workspace_sla_task_notes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.workspace_sla_tasks wst
            JOIN public.workspace_client_projects wcp ON wcp.id = wst.project_id
            JOIN public.client_portal_users cpu ON cpu.id = wcp.client_id
            WHERE wst.id = workspace_sla_task_notes.sla_task_id
              AND cpu.profile_id = auth.uid()
        )
    );

CREATE POLICY "Portal clients can add notes on own SLA tasks"
    ON public.workspace_sla_task_notes
    FOR INSERT
    WITH CHECK (
        author_kind = 'portal_client'
        AND is_resolution = false
        AND EXISTS (
            SELECT 1
            FROM public.workspace_sla_tasks wst
            JOIN public.workspace_client_projects wcp ON wcp.id = wst.project_id
            JOIN public.client_portal_users cpu ON cpu.id = wcp.client_id
            WHERE wst.id = workspace_sla_task_notes.sla_task_id
              AND cpu.profile_id = auth.uid()
              AND cpu.workspace_id = workspace_sla_task_notes.workspace_id
        )
    );

CREATE POLICY "Workspace owners can manage SLA task notes"
    ON public.workspace_sla_task_notes
    FOR ALL
    USING (public.can_access_workspace(workspace_id))
    WITH CHECK (public.can_access_workspace(workspace_id));

-- =============================================================================
-- 4. Extend public.workspace_voice_memos with Transcription Columns
-- =============================================================================
ALTER TABLE public.workspace_voice_memos ADD COLUMN IF NOT EXISTS transcript text;
ALTER TABLE public.workspace_voice_memos ADD COLUMN IF NOT EXISTS summary_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.workspace_voice_memos ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- =============================================================================
-- 5. Create Legibility Hub Vector Nodes and Semantic Search RPC
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_semantic_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_type text NOT NULL, -- 'note', 'voice_memo', 'sla_task', 'client_portal_user', 'content_item'
    entity_id uuid NOT NULL,
    title text,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    embedding public.vector(768), -- gemini-embedding-001 reduced via outputDimensionality
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.workspace_semantic_nodes ENABLE ROW LEVEL SECURITY;

-- Workspace semantic index policies
DROP POLICY IF EXISTS "Users can query workspace semantic nodes" ON public.workspace_semantic_nodes;
DROP POLICY IF EXISTS "Users can manage workspace semantic nodes" ON public.workspace_semantic_nodes;

CREATE POLICY "Users can query workspace semantic nodes" ON public.workspace_semantic_nodes
    FOR SELECT USING (
        public.can_access_workspace(workspace_id)
    );

CREATE POLICY "Users can manage workspace semantic nodes" ON public.workspace_semantic_nodes
    FOR ALL USING (
        public.can_access_workspace(workspace_id)
    );

CREATE UNIQUE INDEX IF NOT EXISTS workspace_semantic_nodes_entity_unique
    ON public.workspace_semantic_nodes (workspace_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS workspace_semantic_nodes_embedding_idx
    ON public.workspace_semantic_nodes USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RPC search function using cosine distance (<=> operator is 1 - cosine similarity)
CREATE OR REPLACE FUNCTION public.search_semantic_nodes(
    p_workspace_id uuid,
    p_query_embedding public.vector,
    p_match_threshold float,
    p_match_count int,
    p_entity_types text[] DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    entity_type text,
    entity_id uuid,
    title text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        wsn.id,
        wsn.entity_type,
        wsn.entity_id,
        wsn.title,
        wsn.content,
        wsn.metadata,
        (1 - (wsn.embedding <=> p_query_embedding))::float AS similarity
    FROM public.workspace_semantic_nodes wsn
    WHERE (p_workspace_id IS NULL OR wsn.workspace_id = p_workspace_id)
      AND (p_entity_types IS NULL OR wsn.entity_type = ANY(p_entity_types))
      AND wsn.embedding IS NOT NULL
      AND (1 - (wsn.embedding <=> p_query_embedding)) > p_match_threshold
    ORDER BY wsn.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

COMMIT;
