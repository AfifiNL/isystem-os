-- Phase 6: Video Render Jobs & Storage Migrations

-- 1. Create storage bucket for batch queues
INSERT INTO storage.buckets (id, name, public) 
VALUES ('batch-queues', 'batch-queues', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the new bucket
CREATE POLICY "Allow authenticated users to insert to batch-queues"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'batch-queues');

CREATE POLICY "Allow authenticated users to select from batch-queues"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'batch-queues');

-- 2. Create the video_render_jobs table
CREATE TABLE IF NOT EXISTS public.video_render_jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    content_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
    status text DEFAULT 'pending' NOT NULL,
    storage_path text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_render_jobs;

-- 3. RLS for video_render_jobs
ALTER TABLE public.video_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_render_jobs_select_policy"
ON public.video_render_jobs
FOR SELECT
TO authenticated
USING (
  public.is_workspace_owner(workspace_id)
  OR public.is_manager_assigned_workspace(workspace_id)
  OR public.is_workspace_member(workspace_id)
);

CREATE POLICY "video_render_jobs_insert_policy"
ON public.video_render_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_owner(workspace_id)
  OR public.is_manager_assigned_workspace(workspace_id)
  OR public.is_workspace_member(workspace_id)
);

CREATE POLICY "video_render_jobs_update_policy"
ON public.video_render_jobs
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_owner(workspace_id)
  OR public.is_manager_assigned_workspace(workspace_id)
  OR public.is_workspace_member(workspace_id)
)
WITH CHECK (
  public.is_workspace_owner(workspace_id)
  OR public.is_manager_assigned_workspace(workspace_id)
  OR public.is_workspace_member(workspace_id)
);
