--
-- Author profile fields. Currently public.profiles only carries id/email/role
-- and the public blog renders the bare email when it shows the author at all.
-- This migration adds display fields (name, avatar, bio, role title, social
-- links) so blog post pages and the blog index can surface a proper byline +
-- bio card. The same row continues to power authentication; only the
-- presentation surface changes.
--
-- New columns on profiles:
--   display_name   text  - what to render in the byline
--   avatar_url     text  - public URL of headshot (stored in author-avatars bucket)
--   bio            text  - short bio for the end-of-post card
--   role_title     text  - role / title shown next to the display name
--   social_links   jsonb - { linkedin, x, github, website }
--
-- New storage bucket author-avatars (public read, authenticated write).

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url   text,
  ADD COLUMN IF NOT EXISTS bio          text,
  ADD COLUMN IF NOT EXISTS role_title   text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill display_name from the email local-part for any row that doesn't
-- have one, so existing posts immediately get a readable byline. Operators
-- replace this with the real name in the new admin Authors tab.
UPDATE public.profiles
SET display_name = initcap(split_part(email, '@', 1))
WHERE display_name IS NULL OR display_name = '';

-- Storage bucket for author headshots. Public read so the blog list can hot-
-- link the URL without signed-URL gymnastics.
INSERT INTO storage.buckets (id, name, public)
VALUES ('author-avatars', 'author-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies - public read, authenticated workspace members write.
DROP POLICY IF EXISTS "author_avatars_public_read" ON storage.objects;
CREATE POLICY "author_avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'author-avatars');

DROP POLICY IF EXISTS "author_avatars_auth_write" ON storage.objects;
CREATE POLICY "author_avatars_auth_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'author-avatars');

DROP POLICY IF EXISTS "author_avatars_auth_update" ON storage.objects;
CREATE POLICY "author_avatars_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'author-avatars');

DROP POLICY IF EXISTS "author_avatars_auth_delete" ON storage.objects;
CREATE POLICY "author_avatars_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'author-avatars');

COMMENT ON COLUMN public.profiles.display_name IS 'Public author display name shown in blog bylines and bio cards.';
COMMENT ON COLUMN public.profiles.avatar_url   IS 'Public URL of the author headshot (typically in storage bucket author-avatars).';
COMMENT ON COLUMN public.profiles.bio          IS 'Short author bio shown beneath blog posts.';
COMMENT ON COLUMN public.profiles.role_title   IS 'Author role / title shown next to display_name.';
COMMENT ON COLUMN public.profiles.social_links IS 'JSON object with optional linkedin / x / github / website URLs.';

COMMIT;
