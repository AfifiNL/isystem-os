-- Preserve canonical Business Spine lifecycle writes while the legacy
-- workspace customer columns remain available during the core promotion.

DO $guard$
BEGIN
  IF to_regtype('public.workspace_customer_status') IS NOT NULL
     AND (
       SELECT count(*) = 8
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'workspace_customers'
         AND column_name IN (
           'name',
           'customer_type',
           'status',
           'source',
           'display_name',
           'customer_kind',
           'lifecycle_status',
           'source_module'
         )
     ) THEN
    EXECUTE $ddl$
CREATE OR REPLACE FUNCTION public.sync_workspace_customer_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_canonical_write boolean;
BEGIN
  v_canonical_write := CASE
    WHEN TG_OP = 'INSERT' THEN NEW.display_name IS NOT NULL AND NEW.name IS NULL
    ELSE
      NEW.display_name IS DISTINCT FROM OLD.display_name
      OR NEW.customer_kind IS DISTINCT FROM OLD.customer_kind
      OR NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
      OR NEW.source_module IS DISTINCT FROM OLD.source_module
      OR (
        NEW.name IS NOT DISTINCT FROM OLD.name
        AND NEW.customer_type IS NOT DISTINCT FROM OLD.customer_type
        AND NEW.status IS NOT DISTINCT FROM OLD.status
        AND NEW.source IS NOT DISTINCT FROM OLD.source
      )
  END;

  IF v_canonical_write THEN
    NEW.display_name := COALESCE(NULLIF(btrim(NEW.display_name), ''), 'Unknown customer');
    NEW.name := NEW.display_name;
    NEW.customer_kind := COALESCE(NULLIF(NEW.customer_kind, ''), 'organization');
    NEW.customer_type := NEW.customer_kind;
    NEW.source := COALESCE(NEW.source_module, NEW.source);
    NEW.status := CASE NEW.lifecycle_status::text
      WHEN 'active' THEN 'active'::public.workspace_customer_status
      WHEN 'paused' THEN 'paused'::public.workspace_customer_status
      WHEN 'churned' THEN 'churned'::public.workspace_customer_status
      WHEN 'qualified' THEN 'lead'::public.workspace_customer_status
      WHEN 'customer' THEN 'lead'::public.workspace_customer_status
      ELSE 'lead'::public.workspace_customer_status
    END;
  ELSE
    NEW.name := COALESCE(NULLIF(btrim(NEW.name), ''), NULLIF(btrim(NEW.display_name), ''), 'Unknown customer');
    NEW.display_name := NEW.name;
    NEW.customer_type := COALESCE(NULLIF(NEW.customer_type, ''), NULLIF(NEW.customer_kind, ''), 'organization');
    NEW.customer_kind := NEW.customer_type;
    NEW.source_module := COALESCE(NEW.source, NEW.source_module);
    NEW.lifecycle_status := CASE NEW.status::text
      WHEN 'active' THEN 'active'::public.business_lifecycle_status
      WHEN 'paused' THEN 'paused'::public.business_lifecycle_status
      WHEN 'churned' THEN 'churned'::public.business_lifecycle_status
      WHEN 'archived' THEN 'churned'::public.business_lifecycle_status
      ELSE 'lead'::public.business_lifecycle_status
    END;
  END IF;

  RETURN NEW;
END;
$fn$;
$ddl$;
  END IF;
END;
$guard$;

-- The client migration also reconciled named offer keys. Core deliberately
-- omits that tenant data backfill; adopters can repair their own historical
-- lifecycle values from neutral, workspace-owned facts after auditing them.

NOTIFY pgrst, 'reload schema';
