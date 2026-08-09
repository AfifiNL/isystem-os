-- Hardening: Apply bucket-level size and MIME constraints to public buckets
UPDATE storage.buckets
SET
  allowed_mime_types = '{image/png,image/jpeg,image/gif,image/webp}',
  file_size_limit = 5242880
WHERE id = 'public-media';

UPDATE storage.buckets
SET
  allowed_mime_types = '{image/png,image/jpeg,image/webp}',
  file_size_limit = 5242880
WHERE id = 'author-avatars';

UPDATE storage.buckets
SET
  allowed_mime_types = '{audio/mpeg,audio/mp4,audio/aac,audio/wav}',
  file_size_limit = 104857600
WHERE id = 'audio-episodes';

-- Hardening: Drop broad authenticated direct-write policies on public buckets
DROP POLICY IF EXISTS "Authenticated users can upload to public-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;

DROP POLICY IF EXISTS "author_avatars_auth_write" ON storage.objects;
DROP POLICY IF EXISTS "author_avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "author_avatars_auth_delete" ON storage.objects;
