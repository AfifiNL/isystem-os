-- Ensure invited/auth-created users always get a profile row without requiring optional metadata.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(trim(NEW.email));

  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, v_email, 'user')
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created_profile_sync'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created_profile_sync
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_auth_user_profile_sync();
  END IF;
END $$;

COMMIT;
