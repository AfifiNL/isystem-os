
insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true)
on conflict (id) do nothing;

drop policy if exists "Public Access for public-media" on storage.objects;
create policy "Public Access for public-media"
on storage.objects for select
using (bucket_id = 'public-media');

drop policy if exists "Authenticated users can upload to public-media" on storage.objects;
create policy "Authenticated users can upload to public-media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'public-media');

drop policy if exists "Users can update their own media" on storage.objects;
create policy "Users can update their own media"
on storage.objects for update
to authenticated
using (bucket_id = 'public-media' and auth.uid() = owner)
with check (bucket_id = 'public-media' and auth.uid() = owner);

drop policy if exists "Users can delete their own media" on storage.objects;
create policy "Users can delete their own media"
on storage.objects for delete
to authenticated
using (bucket_id = 'public-media' and auth.uid() = owner);
