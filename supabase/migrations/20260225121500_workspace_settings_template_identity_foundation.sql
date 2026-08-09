BEGIN;

-- -----------------------------------------------------------------------------
-- Workspace-scoped branding/settings foundation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  site_name text,
  site_description text,
  site_domain text,
  contact_email text,
  contact_phone text,
  locale_override text,
  template_override text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_settings_locale_override_check
    CHECK (locale_override IS NULL OR locale_override = ANY (ARRAY['en'::text, 'nl'::text])),
  CONSTRAINT workspace_settings_template_override_check
    CHECK (
      template_override IS NULL
      OR template_override = ANY (
        ARRAY[
          'personal-brand'::text,
          'facility-services'::text,
          'creative-agency'::text,
          'saas-product'::text,
          'restaurant'::text,
          'ecommerce'::text,
          'nonprofit'::text
        ]
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_settings_site_domain_unique_idx
  ON public.workspace_settings ((lower(btrim(site_domain))))
  WHERE site_domain IS NOT NULL
    AND btrim(site_domain) <> '';

CREATE INDEX IF NOT EXISTS workspace_settings_template_override_idx
  ON public.workspace_settings (template_override)
  WHERE template_override IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_workspace_settings'
      AND tgrelid = 'public.workspace_settings'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_workspace_settings
    BEFORE UPDATE ON public.workspace_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Seed one settings row per workspace with current global defaults.
WITH global_defaults AS (
  SELECT
    max(CASE WHEN key = 'site_name' THEN NULLIF(btrim(trim(both '"' from value::text)), '') END) AS site_name,
    max(CASE WHEN key = 'site_description' THEN NULLIF(btrim(trim(both '"' from value::text)), '') END) AS site_description
  FROM public.site_settings
)
INSERT INTO public.workspace_settings (workspace_id, site_name, site_description)
SELECT
  w.id,
  gd.site_name,
  gd.site_description
FROM public.workspaces w
CROSS JOIN global_defaults gd
ON CONFLICT (workspace_id) DO NOTHING;

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_settings_select_policy" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_insert_policy" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_update_policy" ON public.workspace_settings;
DROP POLICY IF EXISTS "workspace_settings_delete_policy" ON public.workspace_settings;

CREATE POLICY "workspace_settings_select_policy"
ON public.workspace_settings
FOR SELECT
USING (public.can_access_workspace(workspace_id, NULL));

CREATE POLICY "workspace_settings_insert_policy"
ON public.workspace_settings
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'theme.manage'));

CREATE POLICY "workspace_settings_update_policy"
ON public.workspace_settings
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'theme.manage'))
WITH CHECK (public.can_access_workspace(workspace_id, 'theme.manage'));

CREATE POLICY "workspace_settings_delete_policy"
ON public.workspace_settings
FOR DELETE
USING (public.can_access_workspace(workspace_id, 'theme.manage'));

-- -----------------------------------------------------------------------------
-- Deterministic workspace template identity
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_global_template text;
  v_workspace_id uuid;
  v_selected_template text;
BEGIN
  SELECT NULLIF(btrim(trim(both '"' from ss.value::text)), '')
  INTO v_global_template
  FROM public.site_settings ss
  WHERE ss.key = 'active_template'
  LIMIT 1;

  FOR v_workspace_id IN
    SELECT w.id
    FROM public.workspaces w
    WHERE w.legacy_template_id IS NULL
       OR btrim(w.legacy_template_id) = ''
    ORDER BY w.created_at ASC, w.id ASC
  LOOP
    SELECT candidate.template_id
    INTO v_selected_template
    FROM (
      VALUES
        ('personal-brand'::text, 1),
        ('facility-services'::text, 2),
        ('creative-agency'::text, 3),
        ('saas-product'::text, 4),
        ('restaurant'::text, 5),
        ('ecommerce'::text, 6),
        ('nonprofit'::text, 7)
    ) AS candidate(template_id, ord)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.workspaces used_w
      WHERE used_w.id <> v_workspace_id
        AND used_w.legacy_template_id = candidate.template_id
    )
    ORDER BY
      CASE WHEN candidate.template_id = v_global_template THEN 0 ELSE 1 END,
      candidate.ord
    LIMIT 1;

    IF v_selected_template IS NULL THEN
      RAISE EXCEPTION
        'Unable to assign deterministic legacy_template_id for workspace % (template pool exhausted).',
        v_workspace_id;
    END IF;

    UPDATE public.workspaces
    SET legacy_template_id = v_selected_template,
        updated_at = now()
    WHERE id = v_workspace_id;
  END LOOP;
END $$;

ALTER TABLE public.workspaces
  ALTER COLUMN legacy_template_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspaces_legacy_template_id_allowed_check'
      AND conrelid = 'public.workspaces'::regclass
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_legacy_template_id_allowed_check
      CHECK (
        legacy_template_id = ANY (
          ARRAY[
            'personal-brand'::text,
            'facility-services'::text,
            'creative-agency'::text,
            'saas-product'::text,
            'restaurant'::text,
            'ecommerce'::text,
            'nonprofit'::text
          ]
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_workspace_id_from_template(p_template_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.id
  FROM public.workspaces w
  WHERE w.legacy_template_id = NULLIF(btrim(p_template_id), '')
    AND w.is_active = true
  ORDER BY w.created_at ASC, w.id ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_workspace(
  p_name text,
  p_slug text,
  p_legacy_template_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_template_id text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_role := public.get_my_role();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'Workspace slug is required';
  END IF;

  v_template_id := NULLIF(btrim(p_legacy_template_id), '');

  IF v_template_id IS NULL THEN
    SELECT candidate.template_id
    INTO v_template_id
    FROM (
      VALUES
        ('personal-brand'::text, 1),
        ('facility-services'::text, 2),
        ('creative-agency'::text, 3),
        ('saas-product'::text, 4),
        ('restaurant'::text, 5),
        ('ecommerce'::text, 6),
        ('nonprofit'::text, 7)
    ) AS candidate(template_id, ord)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.workspaces w
      WHERE w.legacy_template_id = candidate.template_id
    )
    ORDER BY candidate.ord
    LIMIT 1;
  END IF;

  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Unable to assign legacy_template_id; template pool exhausted.';
  END IF;

  IF v_template_id <> ALL (
    ARRAY[
      'personal-brand'::text,
      'facility-services'::text,
      'creative-agency'::text,
      'saas-product'::text,
      'restaurant'::text,
      'ecommerce'::text,
      'nonprofit'::text
    ]
  ) THEN
    RAISE EXCEPTION 'Invalid legacy template id: %', v_template_id;
  END IF;

  RETURN QUERY
  WITH inserted_workspace AS (
    INSERT INTO public.workspaces (
      name,
      slug,
      owner_profile_id,
      legacy_template_id,
      is_active
    )
    VALUES (
      btrim(p_name),
      btrim(p_slug),
      v_user_id,
      v_template_id,
      true
    )
    RETURNING workspaces.id, workspaces.name, workspaces.slug, workspaces.created_at
  ), inserted_membership AS (
    INSERT INTO public.workspace_memberships (workspace_id, profile_id, membership_role, created_by_profile_id)
    SELECT iw.id, v_user_id, 'owner', v_user_id
    FROM inserted_workspace iw
    ON CONFLICT (workspace_id, profile_id)
    DO UPDATE SET
      membership_role = EXCLUDED.membership_role,
      updated_at = now()
  ), inserted_settings AS (
    INSERT INTO public.workspace_settings (workspace_id, site_name, site_description)
    SELECT
      iw.id,
      (SELECT NULLIF(btrim(trim(both '"' from ss.value::text)), '') FROM public.site_settings ss WHERE ss.key = 'site_name' LIMIT 1),
      (SELECT NULLIF(btrim(trim(both '"' from ss.value::text)), '') FROM public.site_settings ss WHERE ss.key = 'site_description' LIMIT 1)
    FROM inserted_workspace iw
    ON CONFLICT (workspace_id) DO NOTHING
  )
  SELECT iw.id, iw.name, iw.slug, iw.created_at
  FROM inserted_workspace iw;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_workspace(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_workspace(text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Rollout safety checks (non-destructive; run manually after deploy)
-- -----------------------------------------------------------------------------
-- 1) No missing template identity:
--    SELECT count(*) AS null_template_identity_count
--    FROM public.workspaces
--    WHERE legacy_template_id IS NULL OR btrim(legacy_template_id) = '';
--
-- 2) No duplicate template identity:
--    SELECT legacy_template_id, count(*)
--    FROM public.workspaces
--    GROUP BY legacy_template_id
--    HAVING count(*) > 1;
--
-- 3) One workspace_settings row per workspace:
--    SELECT
--      (SELECT count(*) FROM public.workspaces) AS workspace_count,
--      (SELECT count(*) FROM public.workspace_settings) AS workspace_settings_count;
--
-- 4) Check effective workspace-scoped overrides:
--    SELECT w.slug, ws.site_name, ws.template_override, ws.locale_override
--    FROM public.workspaces w
--    LEFT JOIN public.workspace_settings ws ON ws.workspace_id = w.id
--    ORDER BY w.created_at;

COMMIT;
