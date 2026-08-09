BEGIN;

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
      NULLIF(btrim(p_legacy_template_id), ''),
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
  )
  SELECT iw.id, iw.name, iw.slug, iw.created_at
  FROM inserted_workspace iw;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_workspace(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_workspace(text, text, text) TO authenticated;

COMMIT;

