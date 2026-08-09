insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-videos',
  'public-videos',
  true,
  524288000, -- 500 MB in bytes
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

-- Helper: parse the workspace UUID from public video object paths.
-- Path convention is `videos/{workspace_id}/{timestamp}-{filename}`.
-- Invalid or tampered paths return NULL and are denied by write policies.
create or replace function public.public_video_storage_workspace_uuid(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_workspace text;
begin
  if (storage.foldername(p_name))[1] <> 'videos' then
    return null;
  end if;

  v_workspace := (storage.foldername(p_name))[2];
  if v_workspace is null or v_workspace = '' then
    return null;
  end if;

  begin
    return v_workspace::uuid;
  exception when others then
    return null;
  end;
end;
$$;

drop policy if exists "Public Access for public-videos" on storage.objects;
create policy "Public Access for public-videos"
on storage.objects for select
using (bucket_id = 'public-videos');

drop policy if exists "Authenticated managers can upload to public-videos" on storage.objects;
create policy "Authenticated managers can upload to public-videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public-videos'
  and public.is_workspace_admin_or_manager(public.public_video_storage_workspace_uuid(name))
);

drop policy if exists "Authenticated managers can update public-videos" on storage.objects;
create policy "Authenticated managers can update public-videos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'public-videos'
  and public.is_workspace_admin_or_manager(public.public_video_storage_workspace_uuid(name))
)
with check (
  bucket_id = 'public-videos'
  and public.is_workspace_admin_or_manager(public.public_video_storage_workspace_uuid(name))
);

drop policy if exists "Authenticated managers can delete public-videos" on storage.objects;
create policy "Authenticated managers can delete public-videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'public-videos'
  and public.is_workspace_admin_or_manager(public.public_video_storage_workspace_uuid(name))
);
