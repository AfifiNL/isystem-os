-- Universal, forward-only reconciliation for databases where the legacy
-- Business OS tables already existed when 20260609170000 ran with
-- CREATE TABLE IF NOT EXISTS. The canonical columns are added alongside the
-- legacy columns and small compatibility triggers keep both shapes coherent.

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

ALTER TABLE public.workspace_customers
  ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.workspace_customers
  ADD COLUMN IF NOT EXISTS customer_kind text DEFAULT 'organization';
ALTER TABLE public.workspace_customers
  ADD COLUMN IF NOT EXISTS lifecycle_status public.business_lifecycle_status DEFAULT 'lead';
ALTER TABLE public.workspace_customers
  ADD COLUMN IF NOT EXISTS portal_client_id uuid;
ALTER TABLE public.workspace_customers
  ADD COLUMN IF NOT EXISTS source_module text;
ALTER TABLE public.workspace_customers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DO $$
BEGIN
  IF (
    SELECT count(*) = 4
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspace_customers'
      AND column_name IN ('name', 'customer_type', 'status', 'source')
  ) THEN
    UPDATE public.workspace_customers
    SET
      display_name = COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(name), ''), 'Unknown customer'),
      customer_kind = COALESCE(NULLIF(customer_kind, ''), NULLIF(customer_type, ''), 'organization'),
      lifecycle_status = CASE
        WHEN display_name IS NULL
          OR btrim(display_name) = ''
          OR lifecycle_status IS NULL
        THEN CASE status::text
          WHEN 'active' THEN 'active'::public.business_lifecycle_status
          WHEN 'paused' THEN 'paused'::public.business_lifecycle_status
          WHEN 'churned' THEN 'churned'::public.business_lifecycle_status
          WHEN 'archived' THEN 'churned'::public.business_lifecycle_status
          ELSE 'lead'::public.business_lifecycle_status
        END
        ELSE lifecycle_status
      END,
      source_module = COALESCE(NULLIF(source_module, ''), NULLIF(source, ''))
    WHERE display_name IS NULL
       OR btrim(display_name) = ''
       OR customer_kind IS NULL
       OR btrim(customer_kind) = ''
       OR lifecycle_status IS NULL
       OR (
         (source_module IS NULL OR btrim(source_module) = '')
         AND NULLIF(btrim(source), '') IS NOT NULL
       );

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
          ELSE NEW.display_name IS DISTINCT FROM OLD.display_name
        END;

        IF v_canonical_write THEN
          NEW.display_name := COALESCE(NULLIF(btrim(NEW.display_name), ''), 'Unknown customer');
          NEW.name := NEW.display_name;
          NEW.customer_kind := COALESCE(NULLIF(NEW.customer_kind, ''), 'organization');
          NEW.customer_type := NEW.customer_kind;
          NEW.source := COALESCE(NEW.source, NEW.source_module);
          NEW.status := CASE NEW.lifecycle_status::text
            WHEN 'active' THEN 'active'::public.workspace_customer_status
            WHEN 'paused' THEN 'paused'::public.workspace_customer_status
            WHEN 'churned' THEN 'churned'::public.workspace_customer_status
            ELSE 'lead'::public.workspace_customer_status
          END;
        ELSE
          NEW.name := COALESCE(NULLIF(btrim(NEW.name), ''), NULLIF(btrim(NEW.display_name), ''), 'Unknown customer');
          NEW.display_name := NEW.name;
          NEW.customer_type := COALESCE(NULLIF(NEW.customer_type, ''), NULLIF(NEW.customer_kind, ''), 'organization');
          NEW.customer_kind := NEW.customer_type;
          NEW.source_module := COALESCE(NEW.source_module, NEW.source);
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
      $fn$
    $ddl$;

    DROP TRIGGER IF EXISTS sync_workspace_customer_compatibility ON public.workspace_customers;
    CREATE TRIGGER sync_workspace_customer_compatibility
      BEFORE INSERT OR UPDATE ON public.workspace_customers
      FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_customer_compatibility();
  END IF;
END $$;

UPDATE public.workspace_customers
SET
  display_name = COALESCE(NULLIF(btrim(display_name), ''), 'Unknown customer'),
  customer_kind = COALESCE(NULLIF(customer_kind, ''), 'organization'),
  lifecycle_status = COALESCE(lifecycle_status, 'lead'::public.business_lifecycle_status)
WHERE display_name IS NULL
   OR btrim(display_name) = ''
   OR customer_kind IS NULL
   OR btrim(customer_kind) = ''
   OR lifecycle_status IS NULL;

ALTER TABLE public.workspace_customers
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN customer_kind SET DEFAULT 'organization',
  ALTER COLUMN customer_kind SET NOT NULL,
  ALTER COLUMN lifecycle_status SET DEFAULT 'lead',
  ALTER COLUMN lifecycle_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.client_portal_users'::regclass
      AND conname = 'client_portal_users_workspace_id_id_key'
  ) THEN
    ALTER TABLE public.client_portal_users
      ADD CONSTRAINT client_portal_users_workspace_id_id_key
      UNIQUE (workspace_id, id);
  END IF;

  ALTER TABLE public.workspace_customers
    DROP CONSTRAINT IF EXISTS workspace_customers_portal_client_id_fkey;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workspace_customers'::regclass
      AND conname = 'workspace_customers_workspace_portal_client_fk'
  ) THEN
    ALTER TABLE public.workspace_customers
      ADD CONSTRAINT workspace_customers_workspace_portal_client_fk
      FOREIGN KEY (workspace_id, portal_client_id)
      REFERENCES public.client_portal_users(workspace_id, id)
      ON DELETE SET NULL (portal_client_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_customers customer
    LEFT JOIN public.client_portal_users portal_client
      ON portal_client.workspace_id = customer.workspace_id
     AND portal_client.id = customer.portal_client_id
    WHERE customer.portal_client_id IS NOT NULL
      AND portal_client.id IS NULL
  ) THEN
    ALTER TABLE public.workspace_customers
      VALIDATE CONSTRAINT workspace_customers_workspace_portal_client_fk;
  ELSE
    RAISE WARNING 'workspace_customers contains cross-workspace portal_client_id values; new writes are protected but the composite foreign key remains NOT VALID pending repair.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_customers_portal_client_unique
  ON public.workspace_customers (workspace_id, portal_client_id)
  WHERE portal_client_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS workspace_customers_workspace_portal_client_idx
  ON public.workspace_customers (workspace_id, portal_client_id)
  WHERE portal_client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_customers_primary_email_unique
  ON public.workspace_customers (workspace_id, lower(primary_email))
  WHERE primary_email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS workspace_customers_workspace_status_idx
  ON public.workspace_customers (workspace_id, lifecycle_status, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Customer timeline
-- ---------------------------------------------------------------------------

ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS actor_type text DEFAULT 'system';
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS source_module text;
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS source_table text;
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'internal';
ALTER TABLE public.workspace_customer_timeline_events
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$
BEGIN
  IF (
    SELECT count(*) = 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspace_customer_timeline_events'
      AND column_name = 'event_summary'
  ) THEN
    UPDATE public.workspace_customer_timeline_events
    SET
      summary = COALESCE(NULLIF(btrim(summary), ''), NULLIF(btrim(event_summary), ''), 'Timeline event'),
      actor_type = COALESCE(NULLIF(actor_type, ''), 'system'),
      source_module = COALESCE(NULLIF(source_module, ''), 'legacy'),
      visibility = COALESCE(NULLIF(visibility, ''), 'internal'),
      idempotency_key = COALESCE(NULLIF(idempotency_key, ''), 'legacy-timeline:' || id::text)
    WHERE summary IS NULL
       OR btrim(summary) = ''
       OR actor_type IS NULL
       OR btrim(actor_type) = ''
       OR source_module IS NULL
       OR btrim(source_module) = ''
       OR visibility IS NULL
       OR btrim(visibility) = ''
       OR idempotency_key IS NULL
       OR btrim(idempotency_key) = '';

    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.sync_workspace_timeline_compatibility()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $fn$
      DECLARE
        v_canonical_write boolean;
      BEGIN
        v_canonical_write := CASE
          WHEN TG_OP = 'INSERT' THEN NEW.idempotency_key IS NOT NULL
          ELSE NEW.summary IS DISTINCT FROM OLD.summary
            OR NEW.source_module IS DISTINCT FROM OLD.source_module
            OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
        END;

        IF v_canonical_write THEN
          NEW.summary := COALESCE(NULLIF(btrim(NEW.summary), ''), 'Timeline event');
          NEW.event_summary := NEW.summary;
        ELSE
          NEW.event_summary := COALESCE(NULLIF(btrim(NEW.event_summary), ''), 'Timeline event');
          NEW.summary := NEW.event_summary;
        END IF;

        NEW.actor_type := COALESCE(NULLIF(NEW.actor_type, ''), 'system');
        NEW.source_module := COALESCE(NULLIF(NEW.source_module, ''), 'legacy');
        NEW.visibility := COALESCE(NULLIF(NEW.visibility, ''), 'internal');
        NEW.idempotency_key := COALESCE(
          NULLIF(NEW.idempotency_key, ''),
          'legacy-timeline:' || NEW.id::text
        );
        RETURN NEW;
      END;
      $fn$
    $ddl$;

    DROP TRIGGER IF EXISTS sync_workspace_timeline_compatibility
      ON public.workspace_customer_timeline_events;
    CREATE TRIGGER sync_workspace_timeline_compatibility
      BEFORE INSERT OR UPDATE ON public.workspace_customer_timeline_events
      FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_timeline_compatibility();
  END IF;
END $$;

UPDATE public.workspace_customer_timeline_events
SET
  summary = COALESCE(NULLIF(btrim(summary), ''), 'Timeline event'),
  actor_type = COALESCE(NULLIF(actor_type, ''), 'system'),
  source_module = COALESCE(NULLIF(source_module, ''), 'legacy'),
  visibility = COALESCE(NULLIF(visibility, ''), 'internal'),
  idempotency_key = COALESCE(NULLIF(idempotency_key, ''), 'legacy-timeline:' || id::text)
WHERE summary IS NULL
   OR btrim(summary) = ''
   OR actor_type IS NULL
   OR btrim(actor_type) = ''
   OR source_module IS NULL
   OR btrim(source_module) = ''
   OR visibility IS NULL
   OR btrim(visibility) = ''
   OR idempotency_key IS NULL
   OR btrim(idempotency_key) = '';

ALTER TABLE public.workspace_customer_timeline_events
  ALTER COLUMN summary SET NOT NULL,
  ALTER COLUMN actor_type SET DEFAULT 'system',
  ALTER COLUMN actor_type SET NOT NULL,
  ALTER COLUMN source_module SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'internal',
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_customer_timeline_idempotency_unique
  ON public.workspace_customer_timeline_events (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS workspace_customer_timeline_customer_idx
  ON public.workspace_customer_timeline_events (workspace_id, customer_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Work items
-- ---------------------------------------------------------------------------

ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS assigned_to_profile_id uuid;
ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS source_module text;
ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS source_entity_type text;
ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS source_entity_id uuid;
ALTER TABLE public.workspace_work_items
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$
BEGIN
  IF (
    SELECT count(*) = 4
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspace_work_items'
      AND column_name IN ('work_item_type', 'assigned_profile_id', 'source', 'external_ref')
  ) THEN
    UPDATE public.workspace_work_items
    SET
      kind = COALESCE(NULLIF(kind, ''), NULLIF(work_item_type, ''), 'task'),
      assigned_to_profile_id = COALESCE(assigned_to_profile_id, assigned_profile_id),
      source_module = COALESCE(NULLIF(source_module, ''), NULLIF(source, ''), 'legacy'),
      idempotency_key = COALESCE(
        NULLIF(idempotency_key, ''),
        NULLIF(external_ref, ''),
        'legacy-work-item:' || id::text
      )
    WHERE kind IS NULL
       OR btrim(kind) = ''
       OR (assigned_to_profile_id IS NULL AND assigned_profile_id IS NOT NULL)
       OR (
         (source_module IS NULL OR btrim(source_module) = '')
         AND NULLIF(btrim(source), '') IS NOT NULL
       )
       OR idempotency_key IS NULL
       OR btrim(idempotency_key) = '';

    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.sync_workspace_work_item_compatibility()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $fn$
      DECLARE
        v_canonical_write boolean;
      BEGIN
        v_canonical_write := CASE
          WHEN TG_OP = 'INSERT' THEN NEW.idempotency_key IS NOT NULL
          ELSE NEW.kind IS DISTINCT FROM OLD.kind
            OR NEW.assigned_to_profile_id IS DISTINCT FROM OLD.assigned_to_profile_id
            OR NEW.source_module IS DISTINCT FROM OLD.source_module
            OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
        END;

        IF v_canonical_write THEN
          NEW.kind := COALESCE(NULLIF(NEW.kind, ''), 'task');
          NEW.work_item_type := NEW.kind;
          NEW.assigned_profile_id := NEW.assigned_to_profile_id;
          NEW.source := COALESCE(NEW.source, NEW.source_module);
        ELSE
          NEW.work_item_type := COALESCE(NULLIF(NEW.work_item_type, ''), 'task');
          NEW.kind := NEW.work_item_type;
          NEW.assigned_to_profile_id := NEW.assigned_profile_id;
          NEW.source_module := COALESCE(NEW.source_module, NEW.source);
        END IF;

        NEW.idempotency_key := COALESCE(
          NULLIF(NEW.idempotency_key, ''),
          NULLIF(NEW.external_ref, ''),
          'legacy-work-item:' || NEW.id::text
        );
        RETURN NEW;
      END;
      $fn$
    $ddl$;

    DROP TRIGGER IF EXISTS sync_workspace_work_item_compatibility
      ON public.workspace_work_items;
    CREATE TRIGGER sync_workspace_work_item_compatibility
      BEFORE INSERT OR UPDATE ON public.workspace_work_items
      FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_work_item_compatibility();
  END IF;
END $$;

UPDATE public.workspace_work_items
SET
  kind = COALESCE(NULLIF(kind, ''), 'task'),
  idempotency_key = COALESCE(NULLIF(idempotency_key, ''), 'legacy-work-item:' || id::text)
WHERE kind IS NULL
   OR btrim(kind) = ''
   OR idempotency_key IS NULL
   OR btrim(idempotency_key) = '';

ALTER TABLE public.workspace_work_items
  ALTER COLUMN kind SET DEFAULT 'task',
  ALTER COLUMN kind SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workspace_work_items'::regclass
      AND conname = 'workspace_work_items_assigned_to_profile_id_fkey'
  ) THEN
    ALTER TABLE public.workspace_work_items
      ADD CONSTRAINT workspace_work_items_assigned_to_profile_id_fkey
      FOREIGN KEY (assigned_to_profile_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_workspace_work_item_assignee_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.assigned_to_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_memberships membership
    WHERE membership.workspace_id = NEW.workspace_id
      AND membership.profile_id = NEW.assigned_to_profile_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.manager_assignments assignment
    WHERE assignment.workspace_id = NEW.workspace_id
      AND assignment.manager_profile_id = NEW.assigned_to_profile_id
      AND assignment.is_active = true
      AND assignment.starts_at <= now()
      AND (assignment.ends_at IS NULL OR assignment.ends_at > now())
  ) THEN
    RAISE EXCEPTION 'Work-item assignee must belong to the work item workspace.'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_workspace_work_item_assignee_scope
  ON public.workspace_work_items;
CREATE TRIGGER enforce_workspace_work_item_assignee_scope
  BEFORE INSERT OR UPDATE OF workspace_id, assigned_to_profile_id
  ON public.workspace_work_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_work_item_assignee_scope();

REVOKE ALL ON FUNCTION public.enforce_workspace_work_item_assignee_scope() FROM PUBLIC;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_work_items_idempotency_unique
  ON public.workspace_work_items (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS workspace_work_items_assignee_idx
  ON public.workspace_work_items (workspace_id, assigned_to_profile_id, status, due_at)
  WHERE assigned_to_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_work_items_assigned_profile_fk_idx
  ON public.workspace_work_items (assigned_to_profile_id)
  WHERE assigned_to_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS workspace_work_items_source_idx
  ON public.workspace_work_items (workspace_id, source_module, source_entity_type, source_entity_id)
  WHERE source_entity_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Workflow events and runs
-- ---------------------------------------------------------------------------

ALTER TABLE public.workspace_workflow_events
  ADD COLUMN IF NOT EXISTS event_key text;
ALTER TABLE public.workspace_workflow_events
  ADD COLUMN IF NOT EXISTS source_module text;
ALTER TABLE public.workspace_workflow_events
  ADD COLUMN IF NOT EXISTS source_entity_type text;
ALTER TABLE public.workspace_workflow_events
  ADD COLUMN IF NOT EXISTS source_entity_id uuid;
ALTER TABLE public.workspace_workflow_events
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DO $$
BEGIN
  IF (
    SELECT count(*) = 2
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workspace_workflow_events'
      AND column_name IN ('event_type', 'event_summary')
  ) THEN
    UPDATE public.workspace_workflow_events
    SET
      event_key = COALESCE(NULLIF(event_key, ''), NULLIF(event_type, ''), 'workflow.legacy'),
      source_module = COALESCE(NULLIF(source_module, ''), 'legacy'),
      idempotency_key = COALESCE(NULLIF(idempotency_key, ''), 'legacy-workflow-event:' || id::text)
    WHERE event_key IS NULL
       OR btrim(event_key) = ''
       OR source_module IS NULL
       OR btrim(source_module) = ''
       OR idempotency_key IS NULL
       OR btrim(idempotency_key) = '';

    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION public.sync_workspace_workflow_event_compatibility()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public, pg_temp
      AS $fn$
      DECLARE
        v_canonical_write boolean;
      BEGIN
        v_canonical_write := CASE
          WHEN TG_OP = 'INSERT' THEN NEW.idempotency_key IS NOT NULL
          ELSE NEW.event_key IS DISTINCT FROM OLD.event_key
            OR NEW.source_module IS DISTINCT FROM OLD.source_module
            OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
        END;

        IF v_canonical_write THEN
          NEW.event_key := COALESCE(NULLIF(NEW.event_key, ''), 'workflow.event');
          NEW.event_type := NEW.event_key;
        ELSE
          NEW.event_type := COALESCE(NULLIF(NEW.event_type, ''), 'workflow.legacy');
          NEW.event_key := NEW.event_type;
        END IF;

        NEW.event_summary := COALESCE(NEW.event_summary, NEW.event_key);
        NEW.source_module := COALESCE(NULLIF(NEW.source_module, ''), 'legacy');
        NEW.idempotency_key := COALESCE(
          NULLIF(NEW.idempotency_key, ''),
          'legacy-workflow-event:' || NEW.id::text
        );
        RETURN NEW;
      END;
      $fn$
    $ddl$;

    DROP TRIGGER IF EXISTS sync_workspace_workflow_event_compatibility
      ON public.workspace_workflow_events;
    CREATE TRIGGER sync_workspace_workflow_event_compatibility
      BEFORE INSERT OR UPDATE ON public.workspace_workflow_events
      FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_workflow_event_compatibility();
  END IF;
END $$;

UPDATE public.workspace_workflow_events
SET
  event_key = COALESCE(NULLIF(event_key, ''), 'workflow.legacy'),
  source_module = COALESCE(NULLIF(source_module, ''), 'legacy'),
  idempotency_key = COALESCE(NULLIF(idempotency_key, ''), 'legacy-workflow-event:' || id::text)
WHERE event_key IS NULL
   OR btrim(event_key) = ''
   OR source_module IS NULL
   OR btrim(source_module) = ''
   OR idempotency_key IS NULL
   OR btrim(idempotency_key) = '';

ALTER TABLE public.workspace_workflow_events
  ALTER COLUMN event_key SET NOT NULL,
  ALTER COLUMN source_module SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_workflow_events_idempotency_unique
  ON public.workspace_workflow_events (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS workspace_workflow_events_workspace_idx
  ON public.workspace_workflow_events (workspace_id, event_key, created_at DESC);

ALTER TABLE public.workspace_workflow_runs
  ADD COLUMN IF NOT EXISTS event_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workspace_workflow_events'::regclass
      AND conname = 'workspace_workflow_events_workspace_id_id_key'
  ) THEN
    ALTER TABLE public.workspace_workflow_events
      ADD CONSTRAINT workspace_workflow_events_workspace_id_id_key
      UNIQUE (workspace_id, id);
  END IF;

  ALTER TABLE public.workspace_workflow_runs
    DROP CONSTRAINT IF EXISTS workspace_workflow_runs_event_id_fkey;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workspace_workflow_runs'::regclass
      AND conname = 'workspace_workflow_runs_workspace_event_fk'
  ) THEN
    ALTER TABLE public.workspace_workflow_runs
      ADD CONSTRAINT workspace_workflow_runs_workspace_event_fk
      FOREIGN KEY (workspace_id, event_id)
      REFERENCES public.workspace_workflow_events(workspace_id, id)
      ON DELETE SET NULL (event_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_workflow_runs run
    LEFT JOIN public.workspace_workflow_events event
      ON event.workspace_id = run.workspace_id
     AND event.id = run.event_id
    WHERE run.event_id IS NOT NULL
      AND event.id IS NULL
  ) THEN
    ALTER TABLE public.workspace_workflow_runs
      VALIDATE CONSTRAINT workspace_workflow_runs_workspace_event_fk;
  ELSE
    RAISE WARNING 'workspace_workflow_runs contains cross-workspace event_id values; new writes are protected but the composite foreign key remains NOT VALID pending repair.';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS workspace_workflow_runs_workspace_event_idx
  ON public.workspace_workflow_runs (workspace_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_workflow_runs_idempotency_unique
  ON public.workspace_workflow_runs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
