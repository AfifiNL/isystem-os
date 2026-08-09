--
-- Podcast feature polish pass. Non-destructive — adds columns + comments only.
--
-- 1. Mark legacy `podcast_episodes.voice_id` (text) as deprecated. New code
--    writes only `host_voice_id` / `guest_voice_id` (uuid FK to
--    workspace_voices). Column kept for back-compat / historical rows.
-- 2. Document `narration_only_url` as a storage path (not a URL) to match
--    runtime usage.
-- 3. Document the public-read RLS posture on podcast_shows / podcast_episodes
--    so future readers understand isolation depends on the application-level
--    workspace/template scoping in src/features/podcast/public-actions.ts.

comment on column public.podcast_episodes.voice_id is
    'DEPRECATED: legacy provider voice name (e.g. "Aoede") from before workspace_voices existed. New code writes host_voice_id / guest_voice_id instead. Column is preserved for historical rows; no new writes go here.';

comment on column public.podcast_episodes.narration_only_url is
    'Storage PATH inside the podcast-drafts bucket (not an HTTP URL). Format: {workspace_id}/{episode_id}/narration.{wav|mp3}. Sign with createSignedUrl() before serving.';

comment on policy "podcast_shows_select_public_published" on public.podcast_shows is
    'Allows anon + authenticated to read any published show. Intended for public RSS feeds and the marketing /podcast pages. Tenant isolation is enforced by application-level workspace/template scoping in src/features/podcast/public-actions.ts. A direct REST caller using the anon key can list every published show across tenants — by design for the public surface, but be aware when adding new client integrations.';

comment on policy "podcast_episodes_select_public_published" on public.podcast_episodes is
    'Allows anon + authenticated to read any published episode whose parent show is published. Same caveat as podcast_shows_select_public_published — application-level scoping is the floor, RLS is the ceiling.';
