
alter table public.workspaces
drop constraint if exists workspaces_legacy_template_id_allowed_check;

alter table public.workspaces
add constraint workspaces_legacy_template_id_allowed_check
check (
  legacy_template_id = any (
    array[
      'personal-brand'::text,
      'facility-services'::text,
      'creative-agency'::text,
      'saas-product'::text,
      'restaurant'::text,
      'ecommerce'::text,
      'nonprofit'::text,
      'isystem-agency'::text
    ]
  )
);

alter table public.workspace_settings
drop constraint if exists workspace_settings_template_override_check;

alter table public.workspace_settings
add constraint workspace_settings_template_override_check
check (
  template_override is null
  or template_override = any (
    array[
      'personal-brand'::text,
      'facility-services'::text,
      'creative-agency'::text,
      'saas-product'::text,
      'restaurant'::text,
      'ecommerce'::text,
      'nonprofit'::text,
      'isystem-agency'::text
    ]
  )
);
