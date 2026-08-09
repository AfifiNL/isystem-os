
alter table public.content_items
add column if not exists visual_layout jsonb;

comment on column public.content_items.visual_layout is 'Puck visual page builder layout payload for public pages.';
