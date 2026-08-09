-- Workspace-centric tenancy + manager/theme/capability model
-- Safe, additive migration with backward compatibility for content_items.template_id

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helper (already used by existing schema; keep idempotent)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Profiles role extension (non-breaking for existing users)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'manager'::text]));

-- -----------------------------------------------------------------------------
-- Workspace model
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  legacy_template_id text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  is_system_generated boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  membership_role text NOT NULL DEFAULT 'member'
    CHECK (membership_role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'member'::text, 'viewer'::text])),
  created_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assigned_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manager_assignments_valid_window CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS manager_assignments_single_active_per_manager_idx
  ON public.manager_assignments (manager_profile_id)
  WHERE is_active = true AND ends_at IS NULL;

-- -----------------------------------------------------------------------------
-- Operational themes (separate from presentation templates)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.theme_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.theme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES public.theme_catalog(id) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text, 'archived'::text])),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (theme_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS theme_versions_one_default_per_theme_idx
  ON public.theme_versions (theme_id)
  WHERE is_default = true AND status = 'active';

CREATE TABLE IF NOT EXISTS public.workspace_theme_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  theme_version_id uuid NOT NULL REFERENCES public.theme_versions(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  bound_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_theme_bindings_valid_window CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_theme_bindings_one_active_per_workspace_idx
  ON public.workspace_theme_bindings (workspace_id)
  WHERE is_active = true AND effective_to IS NULL;

-- -----------------------------------------------------------------------------
-- Capability model
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_capability_grants (
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'admin'::text, 'manager'::text])),
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  is_allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, capability_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_capability_overrides (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES public.capabilities(id) ON DELETE CASCADE,
  is_allowed boolean NOT NULL,
  reason text,
  updated_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, capability_id)
);

-- -----------------------------------------------------------------------------
-- Content evolution: workspace_id transition support (keep template_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'content_items_workspace_id_fkey'
      AND conrelid = 'public.content_items'::regclass
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS content_items_workspace_id_idx
  ON public.content_items (workspace_id);

CREATE INDEX IF NOT EXISTS content_items_template_id_idx
  ON public.content_items (template_id);

-- Backfill workspaces from legacy template scopes
INSERT INTO public.workspaces (
  slug,
  name,
  owner_profile_id,
  legacy_template_id,
  is_system_generated,
  metadata
)
SELECT DISTINCT
  ('legacy-' || regexp_replace(lower(ci.template_id), '[^a-z0-9-]+', '-', 'g'))::text,
  (initcap(replace(ci.template_id, '-', ' ')) || ' Workspace')::text,
  (
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = 'admin'
    ORDER BY p.created_at NULLS LAST
    LIMIT 1
  ) AS owner_profile_id,
  ci.template_id,
  true,
  jsonb_build_object('seeded_by', 'workspace_tenancy_refactor', 'legacy_template_id', ci.template_id)
FROM public.content_items ci
WHERE ci.template_id IS NOT NULL
  AND btrim(ci.template_id) <> ''
ON CONFLICT (legacy_template_id) DO NOTHING;

UPDATE public.content_items ci
SET workspace_id = w.id
FROM public.workspaces w
WHERE ci.workspace_id IS NULL
  AND ci.template_id IS NOT NULL
  AND ci.template_id = w.legacy_template_id;

-- Ensure owner membership exists
INSERT INTO public.workspace_memberships (workspace_id, profile_id, membership_role, created_by_profile_id)
SELECT w.id, w.owner_profile_id, 'owner', w.owner_profile_id
FROM public.workspaces w
WHERE w.owner_profile_id IS NOT NULL
ON CONFLICT (workspace_id, profile_id)
DO UPDATE SET
  membership_role = EXCLUDED.membership_role,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- Helper auth/compatibility functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'user');
$$;

CREATE OR REPLACE FUNCTION public.resolve_workspace_id_from_template(p_template_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT w.id
  FROM public.workspaces w
  WHERE w.legacy_template_id = p_template_id
    AND w.is_active = true
  ORDER BY w.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_content_workspace_id(p_workspace_id uuid, p_template_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(p_workspace_id, public.resolve_workspace_id_from_template(p_template_id));
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.owner_profile_id = auth.uid()
      AND w.is_active = true
      AND public.get_my_role() = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_assigned_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.manager_assignments ma
    WHERE ma.manager_profile_id = auth.uid()
      AND ma.workspace_id = p_workspace_id
      AND ma.is_active = true
      AND ma.starts_at <= now()
      AND (ma.ends_at IS NULL OR ma.ends_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wm
    WHERE wm.workspace_id = p_workspace_id
      AND wm.profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_capability(p_workspace_id uuid, p_capability_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_capability_id uuid;
  v_role_allowed boolean;
  v_override_allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR p_workspace_id IS NULL OR p_capability_key IS NULL THEN
    RETURN false;
  END IF;

  -- Admin owners have full control on owned workspaces.
  IF public.is_workspace_owner(p_workspace_id) THEN
    RETURN true;
  END IF;

  v_role := public.get_my_role();

  -- Managers must be actively assigned to the workspace.
  IF v_role = 'manager' AND NOT public.is_manager_assigned_workspace(p_workspace_id) THEN
    RETURN false;
  END IF;

  SELECT c.id
  INTO v_capability_id
  FROM public.capabilities c
  WHERE c.capability_key = p_capability_key
    AND c.is_active = true
  LIMIT 1;

  IF v_capability_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT rcg.is_allowed
  INTO v_role_allowed
  FROM public.role_capability_grants rcg
  WHERE rcg.role = v_role
    AND rcg.capability_id = v_capability_id
  LIMIT 1;

  SELECT wco.is_allowed
  INTO v_override_allowed
  FROM public.workspace_capability_overrides wco
  WHERE wco.workspace_id = p_workspace_id
    AND wco.capability_id = v_capability_id
  LIMIT 1;

  IF v_override_allowed IS NOT NULL THEN
    RETURN v_override_allowed;
  END IF;

  RETURN COALESCE(v_role_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_workspace(p_workspace_id uuid, p_capability_key text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_workspace_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_workspace_owner(p_workspace_id) THEN
    RETURN true;
  END IF;

  IF public.is_manager_assigned_workspace(p_workspace_id) THEN
    IF p_capability_key IS NULL THEN
      RETURN true;
    END IF;
    RETURN public.has_workspace_capability(p_workspace_id, p_capability_key);
  END IF;

  IF public.is_workspace_member(p_workspace_id) THEN
    IF p_capability_key IS NULL THEN
      RETURN true;
    END IF;
    RETURN public.has_workspace_capability(p_workspace_id, p_capability_key);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_manager_assignment_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = NEW.manager_profile_id;

  IF v_role IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'manager_profile_id % must reference a profile with role=manager', NEW.manager_profile_id;
  END IF;

  IF NEW.is_active = true AND NEW.ends_at IS NOT NULL THEN
    RAISE EXCEPTION 'active assignment cannot have ends_at set';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_content_item_workspace_template()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_legacy_template_id text;
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.template_id IS NOT NULL THEN
    NEW.workspace_id := public.resolve_workspace_id_from_template(NEW.template_id);
  END IF;

  IF NEW.template_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
    SELECT w.legacy_template_id
      INTO NEW.template_id
    FROM public.workspaces w
    WHERE w.id = NEW.workspace_id;
  END IF;

  IF NEW.workspace_id IS NOT NULL AND NEW.template_id IS NOT NULL THEN
    SELECT w.legacy_template_id
      INTO v_legacy_template_id
    FROM public.workspaces w
    WHERE w.id = NEW.workspace_id;

    IF v_legacy_template_id IS NOT NULL AND v_legacy_template_id <> NEW.template_id THEN
      RAISE EXCEPTION 'content_items workspace/template mismatch (workspace=% template_id=% expected=%)',
        NEW.workspace_id, NEW.template_id, v_legacy_template_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Triggers (idempotent)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_workspaces'
      AND tgrelid = 'public.workspaces'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_workspaces
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_workspace_memberships'
      AND tgrelid = 'public.workspace_memberships'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_workspace_memberships
    BEFORE UPDATE ON public.workspace_memberships
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_manager_assignments'
      AND tgrelid = 'public.manager_assignments'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_manager_assignments
    BEFORE UPDATE ON public.manager_assignments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'enforce_manager_assignment_role_trigger'
      AND tgrelid = 'public.manager_assignments'::regclass
  ) THEN
    CREATE TRIGGER enforce_manager_assignment_role_trigger
    BEFORE INSERT OR UPDATE ON public.manager_assignments
    FOR EACH ROW EXECUTE FUNCTION public.enforce_manager_assignment_role();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_theme_catalog'
      AND tgrelid = 'public.theme_catalog'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_theme_catalog
    BEFORE UPDATE ON public.theme_catalog
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_theme_versions'
      AND tgrelid = 'public.theme_versions'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_theme_versions
    BEFORE UPDATE ON public.theme_versions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_workspace_theme_bindings'
      AND tgrelid = 'public.workspace_theme_bindings'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_workspace_theme_bindings
    BEFORE UPDATE ON public.workspace_theme_bindings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_capabilities'
      AND tgrelid = 'public.capabilities'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_capabilities
    BEFORE UPDATE ON public.capabilities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_role_capability_grants'
      AND tgrelid = 'public.role_capability_grants'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_role_capability_grants
    BEFORE UPDATE ON public.role_capability_grants
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_workspace_capability_overrides'
      AND tgrelid = 'public.workspace_capability_overrides'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_workspace_capability_overrides
    BEFORE UPDATE ON public.workspace_capability_overrides
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_content_item_workspace_template_trigger'
      AND tgrelid = 'public.content_items'::regclass
  ) THEN
    CREATE TRIGGER sync_content_item_workspace_template_trigger
    BEFORE INSERT OR UPDATE OF workspace_id, template_id
    ON public.content_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_content_item_workspace_template();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- RLS enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_theme_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_capability_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_capability_overrides ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS policies: content_items (replace permissive legacy policies)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view all content items" ON public.content_items;
DROP POLICY IF EXISTS "Users can insert their own content items" ON public.content_items;
DROP POLICY IF EXISTS "Users can update their own content items" ON public.content_items;
DROP POLICY IF EXISTS "Users can delete their own content items" ON public.content_items;
DROP POLICY IF EXISTS "Anyone can read published content" ON public.content_items;
DROP POLICY IF EXISTS "Admins can manage content" ON public.content_items;

CREATE POLICY "content_items_select_policy"
ON public.content_items
FOR SELECT
USING (
  status = 'published'
  OR auth.uid() = author_id
  OR public.can_access_workspace(
    public.get_effective_content_workspace_id(workspace_id, template_id),
    'content.read'
  )
);

CREATE POLICY "content_items_insert_policy"
ON public.content_items
FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND public.can_access_workspace(
    public.get_effective_content_workspace_id(workspace_id, template_id),
    'content.write'
  )
);

CREATE POLICY "content_items_update_policy"
ON public.content_items
FOR UPDATE
USING (
  auth.uid() = author_id
  OR public.can_access_workspace(
    public.get_effective_content_workspace_id(workspace_id, template_id),
    'content.write'
  )
)
WITH CHECK (
  auth.uid() = author_id
  OR public.can_access_workspace(
    public.get_effective_content_workspace_id(workspace_id, template_id),
    'content.write'
  )
);

CREATE POLICY "content_items_delete_policy"
ON public.content_items
FOR DELETE
USING (
  auth.uid() = author_id
  OR public.can_access_workspace(
    public.get_effective_content_workspace_id(workspace_id, template_id),
    'content.delete'
  )
);

-- -----------------------------------------------------------------------------
-- RLS policies: workspace tenancy and manager model
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_policy" ON public.workspaces;

CREATE POLICY "workspaces_select_policy"
ON public.workspaces
FOR SELECT
USING (
  public.is_workspace_owner(id)
  OR public.is_manager_assigned_workspace(id)
  OR public.is_workspace_member(id)
);

CREATE POLICY "workspaces_insert_policy"
ON public.workspaces
FOR INSERT
WITH CHECK (
  public.get_my_role() = 'admin'
  AND owner_profile_id = auth.uid()
);

CREATE POLICY "workspaces_update_policy"
ON public.workspaces
FOR UPDATE
USING (public.is_workspace_owner(id))
WITH CHECK (public.is_workspace_owner(id));

CREATE POLICY "workspaces_delete_policy"
ON public.workspaces
FOR DELETE
USING (public.is_workspace_owner(id));

DROP POLICY IF EXISTS "workspace_memberships_select_policy" ON public.workspace_memberships;
DROP POLICY IF EXISTS "workspace_memberships_insert_policy" ON public.workspace_memberships;
DROP POLICY IF EXISTS "workspace_memberships_update_policy" ON public.workspace_memberships;
DROP POLICY IF EXISTS "workspace_memberships_delete_policy" ON public.workspace_memberships;

CREATE POLICY "workspace_memberships_select_policy"
ON public.workspace_memberships
FOR SELECT
USING (
  profile_id = auth.uid()
  OR public.is_workspace_owner(workspace_id)
  OR public.is_manager_assigned_workspace(workspace_id)
);

CREATE POLICY "workspace_memberships_insert_policy"
ON public.workspace_memberships
FOR INSERT
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_memberships_update_policy"
ON public.workspace_memberships
FOR UPDATE
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "workspace_memberships_delete_policy"
ON public.workspace_memberships
FOR DELETE
USING (public.is_workspace_owner(workspace_id));

DROP POLICY IF EXISTS "manager_assignments_select_policy" ON public.manager_assignments;
DROP POLICY IF EXISTS "manager_assignments_insert_policy" ON public.manager_assignments;
DROP POLICY IF EXISTS "manager_assignments_update_policy" ON public.manager_assignments;
DROP POLICY IF EXISTS "manager_assignments_delete_policy" ON public.manager_assignments;

CREATE POLICY "manager_assignments_select_policy"
ON public.manager_assignments
FOR SELECT
USING (
  manager_profile_id = auth.uid()
  OR public.is_workspace_owner(workspace_id)
);

CREATE POLICY "manager_assignments_insert_policy"
ON public.manager_assignments
FOR INSERT
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "manager_assignments_update_policy"
ON public.manager_assignments
FOR UPDATE
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "manager_assignments_delete_policy"
ON public.manager_assignments
FOR DELETE
USING (public.is_workspace_owner(workspace_id));

-- -----------------------------------------------------------------------------
-- RLS policies: theme + capability catalogs and workspace-level overrides
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "theme_catalog_read_policy" ON public.theme_catalog;
CREATE POLICY "theme_catalog_read_policy"
ON public.theme_catalog
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "theme_versions_read_policy" ON public.theme_versions;
CREATE POLICY "theme_versions_read_policy"
ON public.theme_versions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "workspace_theme_bindings_select_policy" ON public.workspace_theme_bindings;
DROP POLICY IF EXISTS "workspace_theme_bindings_insert_policy" ON public.workspace_theme_bindings;
DROP POLICY IF EXISTS "workspace_theme_bindings_update_policy" ON public.workspace_theme_bindings;
DROP POLICY IF EXISTS "workspace_theme_bindings_delete_policy" ON public.workspace_theme_bindings;

CREATE POLICY "workspace_theme_bindings_select_policy"
ON public.workspace_theme_bindings
FOR SELECT
USING (
  public.can_access_workspace(workspace_id, 'theme.read')
  OR public.can_access_workspace(workspace_id, NULL)
);

CREATE POLICY "workspace_theme_bindings_insert_policy"
ON public.workspace_theme_bindings
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'theme.manage'));

CREATE POLICY "workspace_theme_bindings_update_policy"
ON public.workspace_theme_bindings
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'theme.manage'))
WITH CHECK (public.can_access_workspace(workspace_id, 'theme.manage'));

CREATE POLICY "workspace_theme_bindings_delete_policy"
ON public.workspace_theme_bindings
FOR DELETE
USING (public.can_access_workspace(workspace_id, 'theme.manage'));

DROP POLICY IF EXISTS "capabilities_read_policy" ON public.capabilities;
CREATE POLICY "capabilities_read_policy"
ON public.capabilities
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "role_capability_grants_read_policy" ON public.role_capability_grants;
CREATE POLICY "role_capability_grants_read_policy"
ON public.role_capability_grants
FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "workspace_capability_overrides_select_policy" ON public.workspace_capability_overrides;
DROP POLICY IF EXISTS "workspace_capability_overrides_insert_policy" ON public.workspace_capability_overrides;
DROP POLICY IF EXISTS "workspace_capability_overrides_update_policy" ON public.workspace_capability_overrides;
DROP POLICY IF EXISTS "workspace_capability_overrides_delete_policy" ON public.workspace_capability_overrides;

CREATE POLICY "workspace_capability_overrides_select_policy"
ON public.workspace_capability_overrides
FOR SELECT
USING (
  public.can_access_workspace(workspace_id, 'capability.read')
  OR public.can_access_workspace(workspace_id, NULL)
);

CREATE POLICY "workspace_capability_overrides_insert_policy"
ON public.workspace_capability_overrides
FOR INSERT
WITH CHECK (public.can_access_workspace(workspace_id, 'capability.manage'));

CREATE POLICY "workspace_capability_overrides_update_policy"
ON public.workspace_capability_overrides
FOR UPDATE
USING (public.can_access_workspace(workspace_id, 'capability.manage'))
WITH CHECK (public.can_access_workspace(workspace_id, 'capability.manage'));

CREATE POLICY "workspace_capability_overrides_delete_policy"
ON public.workspace_capability_overrides
FOR DELETE
USING (public.can_access_workspace(workspace_id, 'capability.manage'));

-- -----------------------------------------------------------------------------
-- Seed data (safe/idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO public.theme_catalog (theme_key, name, description, metadata)
VALUES (
  'core-operational-default',
  'Core Operational Theme',
  'Baseline operational theme for admin/manager dashboard tenancy model.',
  jsonb_build_object('seed', true, 'source', 'workspace_tenancy_refactor')
)
ON CONFLICT (theme_key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = public.theme_catalog.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.theme_versions (theme_id, version, status, is_default, released_at, config)
SELECT tc.id,
       '1.0.0',
       'active',
       true,
       now(),
       jsonb_build_object(
         'tokens', jsonb_build_object('spacing', 'base', 'radius', 'md'),
         'dashboard', jsonb_build_object('layout', 'default', 'nav', 'sidebar')
       )
FROM public.theme_catalog tc
WHERE tc.theme_key = 'core-operational-default'
ON CONFLICT (theme_id, version)
DO UPDATE SET
  status = EXCLUDED.status,
  is_default = EXCLUDED.is_default,
  config = EXCLUDED.config,
  updated_at = now();

INSERT INTO public.capabilities (capability_key, name, description, metadata)
VALUES
  ('content.read', 'Content Read', 'Read content in workspace scope.', jsonb_build_object('domain', 'content')),
  ('content.write', 'Content Write', 'Create/update content in workspace scope.', jsonb_build_object('domain', 'content')),
  ('content.delete', 'Content Delete', 'Delete content in workspace scope.', jsonb_build_object('domain', 'content')),
  ('content.publish', 'Content Publish', 'Publish content in workspace scope.', jsonb_build_object('domain', 'content')),
  ('assets.read', 'Assets Read', 'Read generated assets in workspace scope.', jsonb_build_object('domain', 'assets')),
  ('assets.write', 'Assets Write', 'Create/update generated assets in workspace scope.', jsonb_build_object('domain', 'assets')),
  ('theme.read', 'Theme Read', 'Read workspace operational theme bindings.', jsonb_build_object('domain', 'theme')),
  ('theme.manage', 'Theme Manage', 'Manage workspace operational theme bindings.', jsonb_build_object('domain', 'theme')),
  ('capability.read', 'Capability Read', 'Read workspace capability overrides.', jsonb_build_object('domain', 'capability')),
  ('capability.manage', 'Capability Manage', 'Manage workspace capability overrides.', jsonb_build_object('domain', 'capability'))
ON CONFLICT (capability_key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  metadata = public.capabilities.metadata || EXCLUDED.metadata,
  is_active = true,
  updated_at = now();

-- Role grants (admin broad, manager scoped, user minimal)
INSERT INTO public.role_capability_grants (role, capability_id, is_allowed)
SELECT
  r.role_name,
  c.id,
  CASE
    WHEN r.role_name = 'admin' THEN true
    WHEN r.role_name = 'manager' AND c.capability_key IN (
      'content.read', 'content.write', 'content.publish',
      'assets.read', 'assets.write',
      'theme.read',
      'capability.read'
    ) THEN true
    WHEN r.role_name = 'user' AND c.capability_key IN ('content.read') THEN true
    ELSE false
  END AS is_allowed
FROM (VALUES ('admin'::text), ('manager'::text), ('user'::text)) AS r(role_name)
CROSS JOIN public.capabilities c
ON CONFLICT (role, capability_id)
DO UPDATE SET
  is_allowed = EXCLUDED.is_allowed,
  updated_at = now();

-- Apply default operational theme to workspaces that have none active yet.
INSERT INTO public.workspace_theme_bindings (workspace_id, theme_version_id, is_active, effective_from, bound_by_profile_id)
SELECT
  w.id,
  tv.id,
  true,
  now(),
  w.owner_profile_id
FROM public.workspaces w
JOIN public.theme_catalog tc ON tc.theme_key = 'core-operational-default'
JOIN public.theme_versions tv ON tv.theme_id = tc.id AND tv.version = '1.0.0'
LEFT JOIN public.workspace_theme_bindings existing
  ON existing.workspace_id = w.id
 AND existing.is_active = true
 AND existing.effective_to IS NULL
WHERE existing.workspace_id IS NULL
ON CONFLICT DO NOTHING;

COMMIT;

