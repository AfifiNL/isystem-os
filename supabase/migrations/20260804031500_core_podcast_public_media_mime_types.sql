-- The public podcast bucket stores the published audio plus its generated
-- cover, captions, and optional video export. A prior hardening migration
-- narrowed this bucket to audio-only MIME types, which made those companion
-- uploads fail even though their routes intentionally target this bucket.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/vtt',
  'video/mp4'
]
WHERE id = 'audio-episodes';
