
-- Fix RLS visibility in the manager assignment trigger
-- The trigger runs as the invoking user (Admin) which is blocked from seeing the manager's profile row.
-- Using SECURITY DEFINER allows it to bypass RLS and correctly verify the manager role.

CREATE OR REPLACE FUNCTION public.enforce_manager_assignment_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
