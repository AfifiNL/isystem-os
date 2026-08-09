-- Phase 6 Pivot: Admin-in-the-Loop
ALTER TABLE public.video_render_jobs 
ADD COLUMN result_video_url text;

-- Create protected-videos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('protected-videos', 'protected-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for protected-videos bucket
CREATE POLICY "Allow admins to insert to protected-videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'protected-videos' AND public.get_my_role() = 'admin');

CREATE POLICY "Allow workspace members to select from protected-videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'protected-videos'
  AND (
    -- The path format will be workspace_id/job_id_final.mp4
    public.is_workspace_owner((string_to_array(name, '/'))[1]::uuid)
    OR public.is_manager_assigned_workspace((string_to_array(name, '/'))[1]::uuid)
    OR public.is_workspace_member((string_to_array(name, '/'))[1]::uuid)
  )
);
