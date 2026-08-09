--
-- Per-workspace desktop wallpaper. Nullable — workspaces without a value
-- fall back to a hardcoded default in the shell. Asset delivery is up to
-- the caller (public /isystem-assets path, Supabase Storage URL, external
-- CDN) — the column stores the URL verbatim.
--
-- Applied out-of-band in production on 2026-04-22 via MCP. This file exists
-- so fresh installs receive the same schema without requiring manual SQL.

alter table public.workspaces
    add column if not exists wallpaper_url text;

-- Seed the iSystem workspace with the generated wallpaper.
update public.workspaces
   set wallpaper_url = '/isystem-assets/isystem_desktop_wallpaper.webp'
 where slug = 'isystem-ai'
   and wallpaper_url is null;
