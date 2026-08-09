-- Universal booking payments, meeting lifecycle, tenant-bound relationships, and public rate limits.
-- Client identity, offer keys, pricing seeds, and workspace data deliberately do not belong here.

ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'meeting_ready';

BEGIN;

ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS vat_rate_basis_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS virtual_meeting_provider text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auto_create_virtual_meeting boolean NOT NULL DEFAULT true;

ALTER TABLE public.booking_reservations
  ADD COLUMN IF NOT EXISTS business_timezone text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS submission_fingerprint text,
  ADD COLUMN IF NOT EXISTS capacity_mode_snapshot text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS capacity_value_snapshot integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submission_lease_id uuid,
  ADD COLUMN IF NOT EXISTS submission_lease_expires_at timestamptz;

-- Preserve a business-timezone snapshot for historical reservations without
-- rewriting the visitor timezone that was used for customer-facing times.
UPDATE public.booking_reservations
SET business_timezone = reservation_timezone
WHERE business_timezone IS NULL;

-- Snapshot capacity semantics at reservation time so later service edits do
-- not change the capacity contract of an existing booking.
UPDATE public.booking_reservations r
SET capacity_mode_snapshot = COALESCE(s.capacity_mode::text, 'single')
FROM public.booking_services s
WHERE r.service_id = s.id
  AND (r.capacity_mode_snapshot IS NULL OR r.capacity_mode_snapshot = 'single');

UPDATE public.booking_reservations r
SET capacity_value_snapshot = GREATEST(COALESCE(s.capacity_value, 1), 1)
FROM public.booking_services s
WHERE r.service_id = s.id
  AND (r.capacity_value_snapshot IS NULL OR r.capacity_value_snapshot = 1);

DROP INDEX IF EXISTS public.booking_reservations_workspace_idempotency_unique;
CREATE UNIQUE INDEX booking_reservations_workspace_idempotency_unique
  ON public.booking_reservations (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status IN (
      'pending_review'::public.booking_reservation_status,
      'pending_confirmation'::public.booking_reservation_status,
      'confirmed'::public.booking_reservation_status
    );

-- The fingerprint is server-derived from the service, slot, party size, and
-- normalized customer email. It closes the gap where an older browser sends a
-- fresh random idempotency key after a reload or in a second tab.
CREATE UNIQUE INDEX IF NOT EXISTS booking_reservations_workspace_submission_fingerprint_unique
  ON public.booking_reservations (workspace_id, submission_fingerprint)
  WHERE submission_fingerprint IS NOT NULL
    AND status IN (
      'pending_review'::public.booking_reservation_status,
      'pending_confirmation'::public.booking_reservation_status,
      'confirmed'::public.booking_reservation_status
    );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_services_vat_rate_basis_points_valid'
      AND conrelid = 'public.booking_services'::regclass
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_vat_rate_basis_points_valid
      CHECK (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 100000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_services_virtual_meeting_provider_valid'
      AND conrelid = 'public.booking_services'::regclass
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_virtual_meeting_provider_valid
      CHECK (virtual_meeting_provider IN ('none', 'google_meet', 'zoom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_reservations_capacity_mode_snapshot_valid'
      AND conrelid = 'public.booking_reservations'::regclass
  ) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_capacity_mode_snapshot_valid
      CHECK (capacity_mode_snapshot IN ('single', 'group', 'pooled', 'capacity'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_reservations_capacity_value_snapshot_valid'
      AND conrelid = 'public.booking_reservations'::regclass
  ) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_capacity_value_snapshot_valid
      CHECK (capacity_value_snapshot >= 1);
  END IF;
END $$;

-- Existing historical rows may contain overlaps from before this fence was
-- introduced, so an exclusion constraint would validate old data and make the
-- rollout fail. A transaction-scoped advisory lock plus trigger enforces the
-- invariant for every new write without rewriting history.
-- The foundation exclusion constraint rejected every overlapping reservation
-- for a resource and therefore made group/capacity services behave as single
-- capacity. This capacity-aware trigger is its forward replacement.
ALTER TABLE public.booking_reservations
  DROP CONSTRAINT IF EXISTS booking_reservations_resource_no_overlap;

CREATE OR REPLACE FUNCTION public.prevent_booking_single_service_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_capacity bigint;
BEGIN
  IF NEW.status = ANY (ARRAY[
       'pending_review'::public.booking_reservation_status,
       'pending_confirmation'::public.booking_reservation_status,
       'confirmed'::public.booking_reservation_status
     ]) THEN
    -- Availability is shared across services when they use the same resource
    -- or location. Lock the workspace rather than only the service so two
    -- concurrent bookings from different services cannot both pass the same
    -- capacity fence.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text || ':booking-capacity', 0));
    SELECT COALESCE(SUM(
      CASE
        WHEN r.capacity_mode_snapshot IN ('group', 'pooled', 'capacity')
          THEN GREATEST(COALESCE(r.party_size, 1), 1)
        ELSE 1
      END
    ), 0)
    INTO v_existing_capacity
    FROM public.booking_reservations r
        JOIN public.booking_services existing_service ON existing_service.id = r.service_id
        JOIN public.booking_services requested_service ON requested_service.id = NEW.service_id
        WHERE r.workspace_id = NEW.workspace_id
          AND r.id <> NEW.id
          -- A service-wide booking (NEW.resource_id IS NULL) consumes the
          -- same pool as every resource assignment. A resource-specific
          -- booking shares only the workspace pool and that concrete resource.
          AND (NEW.resource_id IS NULL OR r.resource_id IS NULL OR r.resource_id = NEW.resource_id)
          -- A NULL location is a workspace-wide service pool; a concrete
          -- location has its own capacity pool and is not blocked by another
          -- concrete location. This mirrors the slot walker semantics.
          AND (NEW.location_id IS NULL OR r.location_id IS NULL OR r.location_id = NEW.location_id)
          AND r.status = ANY (ARRAY[
            'pending_review'::public.booking_reservation_status,
            'pending_confirmation'::public.booking_reservation_status,
            'confirmed'::public.booking_reservation_status
          ])
          -- The database fence must use the same buffer semantics as the
          -- public slot walker. This protects direct/API inserts as well as
          -- concurrent public submissions.
          AND tstzrange(
            r.scheduled_start - make_interval(mins => COALESCE(existing_service.buffer_before_minutes, 0)),
            r.scheduled_end + make_interval(mins => COALESCE(existing_service.buffer_after_minutes, 0)),
            '[)'
          ) && tstzrange(
            NEW.scheduled_start - make_interval(mins => COALESCE(requested_service.buffer_before_minutes, 0)),
            NEW.scheduled_end + make_interval(mins => COALESCE(requested_service.buffer_after_minutes, 0)),
            '[)'
          );

    IF v_existing_capacity + (
        CASE
          WHEN NEW.capacity_mode_snapshot IN ('group', 'pooled', 'capacity')
            THEN GREATEST(COALESCE(NEW.party_size, 1), 1)
          ELSE 1
        END
      ) > (
        CASE WHEN NEW.capacity_mode_snapshot = 'single' THEN 1 ELSE NEW.capacity_value_snapshot END
      ) THEN
      RAISE EXCEPTION 'The booking service has no remaining capacity for this slot.'
        USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_booking_single_service_overlap ON public.booking_reservations;
CREATE TRIGGER prevent_booking_single_service_overlap
  BEFORE INSERT OR UPDATE OF workspace_id, service_id, resource_id, location_id, party_size, capacity_mode_snapshot, capacity_value_snapshot, scheduled_start, scheduled_end, status
  ON public.booking_reservations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_single_service_overlap();

ALTER TABLE public.booking_payments
  ADD COLUMN IF NOT EXISTS net_amount_cents integer,
  ADD COLUMN IF NOT EXISTS vat_rate_basis_points integer,
  ADD COLUMN IF NOT EXISTS vat_amount_cents integer,
  ADD COLUMN IF NOT EXISTS gross_amount_cents integer,
  ADD COLUMN IF NOT EXISTS pricing_version text,
  ADD COLUMN IF NOT EXISTS commercial_reconciliation_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_artifacts_reconciled_at timestamptz;

CREATE INDEX IF NOT EXISTS booking_payments_commercial_reconciliation_queue_idx
  ON public.booking_payments (
    commercial_reconciliation_attempted_at ASC NULLS FIRST,
    verified_at,
    id
  )
  WHERE status = 'verified'
    AND commercial_artifacts_reconciled_at IS NULL;

-- Existing rows are immutable financial records. Mark their pricing lineage
-- without recomputing or changing the provider-charged amount.
UPDATE public.booking_payments
SET pricing_version = 'legacy-pre-vat-v1'
WHERE pricing_version IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_payments_pricing_snapshot_non_negative'
      AND conrelid = 'public.booking_payments'::regclass
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_pricing_snapshot_non_negative
      CHECK (
        (net_amount_cents IS NULL OR net_amount_cents >= 0)
        AND (vat_rate_basis_points IS NULL OR (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 100000))
        AND (vat_amount_cents IS NULL OR vat_amount_cents >= 0)
        AND (gross_amount_cents IS NULL OR gross_amount_cents >= 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_payments_pricing_snapshot_reconciles'
      AND conrelid = 'public.booking_payments'::regclass
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_pricing_snapshot_reconciles
      CHECK (
        net_amount_cents IS NULL
        OR (
          vat_rate_basis_points IS NOT NULL
          AND vat_amount_cents IS NOT NULL
          AND gross_amount_cents IS NOT NULL
          AND pricing_version IS NOT NULL
          AND gross_amount_cents = net_amount_cents + vat_amount_cents
          AND amount_cents = gross_amount_cents
        )
      );
  END IF;
END $$;

-- Pricing snapshots describe the commercial terms that were presented to the
-- customer and charged by the provider. Status, refund, and provider metadata
-- may change later, but the snapshot itself must never be rewritten.
CREATE OR REPLACE FUNCTION public.prevent_booking_payment_pricing_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
    OR NEW.net_amount_cents IS DISTINCT FROM OLD.net_amount_cents
    OR NEW.vat_rate_basis_points IS DISTINCT FROM OLD.vat_rate_basis_points
    OR NEW.vat_amount_cents IS DISTINCT FROM OLD.vat_amount_cents
    OR NEW.gross_amount_cents IS DISTINCT FROM OLD.gross_amount_cents
    OR NEW.pricing_version IS DISTINCT FROM OLD.pricing_version
  ) THEN
    RAISE EXCEPTION 'Booking payment pricing snapshots are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_booking_payment_pricing_snapshot_mutation ON public.booking_payments;
CREATE TRIGGER prevent_booking_payment_pricing_snapshot_mutation
  BEFORE UPDATE ON public.booking_payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_payment_pricing_snapshot_mutation();

CREATE TABLE IF NOT EXISTS public.booking_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google_meet', 'zoom')),
  provider_meeting_id text,
  calendar_event_id text,
  join_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'cancelled')),
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_meetings_valid_window CHECK (scheduled_end > scheduled_start),
  CONSTRAINT booking_meetings_provider_identifier CHECK (
    provider_meeting_id IS NOT NULL OR calendar_event_id IS NOT NULL OR status IN ('pending', 'failed', 'cancelled')
  ),
  CONSTRAINT booking_meetings_workspace_reservation_unique UNIQUE (workspace_id, reservation_id)
);

ALTER TABLE public.booking_meetings
  ADD COLUMN IF NOT EXISTS calendar_connection_id uuid,
  ADD COLUMN IF NOT EXISTS provisioning_token text,
  ADD COLUMN IF NOT EXISTS provisioning_expires_at timestamptz;

-- Email dispatches need an atomic claim. A read-then-insert check allows two
-- webhook/cron workers to send the same customer message concurrently.
ALTER TABLE public.booking_notification_events
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS booking_notification_events_idempotency_idx
  ON public.booking_notification_events (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_notification_events_email_pending_claim_idx
  ON public.booking_notification_events (delivery_status, claim_expires_at)
  WHERE channel = 'email' AND delivery_status = 'pending';

-- Calendar-only services do not get a booking_meetings row, but a remote
-- event can still be created before the mapping write succeeds. Keep a small
-- durable cleanup task so a failed DELETE remains addressable after a
-- connection is retried or disconnected.
CREATE TABLE IF NOT EXISTS public.booking_calendar_cleanup_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.workspace_calendar_connections(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_calendar_cleanup_task_unique UNIQUE (workspace_id, reservation_id, connection_id, external_event_id)
);

-- The table is tenant scoped. Replace the legacy single-column foreign keys
-- with composite references so a UUID from another workspace can never be
-- paired with this row's workspace_id. Connection deletion is deliberately
-- restrictive: an unresolved cleanup task must be retried before the OAuth
-- connection can be removed.
ALTER TABLE public.booking_calendar_cleanup_tasks
  DROP CONSTRAINT IF EXISTS booking_calendar_cleanup_tasks_reservation_id_fkey,
  DROP CONSTRAINT IF EXISTS booking_calendar_cleanup_tasks_connection_id_fkey;

ALTER TABLE public.booking_calendar_cleanup_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_calendar_cleanup_tasks_select_policy ON public.booking_calendar_cleanup_tasks;
CREATE POLICY booking_calendar_cleanup_tasks_select_policy ON public.booking_calendar_cleanup_tasks
  FOR SELECT USING (public.can_access_booking_workspace(workspace_id, 'booking.read'));
DROP POLICY IF EXISTS booking_calendar_cleanup_tasks_manage_policy ON public.booking_calendar_cleanup_tasks;
CREATE POLICY booking_calendar_cleanup_tasks_manage_policy ON public.booking_calendar_cleanup_tasks
  FOR ALL USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'))
  WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));
CREATE INDEX IF NOT EXISTS booking_calendar_cleanup_tasks_connection_idx
  ON public.booking_calendar_cleanup_tasks (connection_id, status, updated_at);

-- Keep the reservation/workspace pair tenant-bound even when a caller knows a
-- reservation UUID from another workspace. NOT VALID preserves any legacy
-- rows for a later data-quality cleanup while enforcing all new writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_reservations_workspace_id_id_key'
      AND conrelid = 'public.booking_reservations'::regclass
  ) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_calendar_connections_workspace_id_id_key'
      AND conrelid = 'public.workspace_calendar_connections'::regclass
  ) THEN
    ALTER TABLE public.workspace_calendar_connections
      ADD CONSTRAINT workspace_calendar_connections_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_meetings_workspace_reservation_fk'
      AND conrelid = 'public.booking_meetings'::regclass
  ) THEN
    ALTER TABLE public.booking_meetings
      ADD CONSTRAINT booking_meetings_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  -- Recreate this constraint even if an earlier deploy used SET NULL. A
  -- composite SET NULL action would null the NOT NULL workspace_id column
  -- when a connection is deleted, making disconnect fail after cleanup.
  ALTER TABLE public.booking_meetings
    DROP CONSTRAINT IF EXISTS booking_meetings_workspace_calendar_connection_fk;
  ALTER TABLE public.booking_meetings
    ADD CONSTRAINT booking_meetings_workspace_calendar_connection_fk
    FOREIGN KEY (workspace_id, calendar_connection_id)
    REFERENCES public.workspace_calendar_connections (workspace_id, id)
    ON DELETE RESTRICT
    NOT VALID;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_calendar_cleanup_tasks_workspace_reservation_fk'
      AND conrelid = 'public.booking_calendar_cleanup_tasks'::regclass
  ) THEN
    ALTER TABLE public.booking_calendar_cleanup_tasks
      ADD CONSTRAINT booking_calendar_cleanup_tasks_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_calendar_cleanup_tasks_workspace_connection_fk'
      AND conrelid = 'public.booking_calendar_cleanup_tasks'::regclass
  ) THEN
    ALTER TABLE public.booking_calendar_cleanup_tasks
      ADD CONSTRAINT booking_calendar_cleanup_tasks_workspace_connection_fk
      FOREIGN KEY (workspace_id, connection_id)
      REFERENCES public.workspace_calendar_connections (workspace_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS booking_meetings_workspace_status_idx
  ON public.booking_meetings (workspace_id, status, scheduled_start);

CREATE INDEX IF NOT EXISTS booking_meetings_provider_id_idx
  ON public.booking_meetings (provider, provider_meeting_id)
  WHERE provider_meeting_id IS NOT NULL;

ALTER TABLE public.booking_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_meetings_select_policy ON public.booking_meetings;
CREATE POLICY booking_meetings_select_policy ON public.booking_meetings
  FOR SELECT USING (public.can_access_booking_workspace(workspace_id, 'booking.read'));

DROP POLICY IF EXISTS booking_meetings_insert_policy ON public.booking_meetings;
CREATE POLICY booking_meetings_insert_policy ON public.booking_meetings
  FOR INSERT WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

DROP POLICY IF EXISTS booking_meetings_update_policy ON public.booking_meetings;
CREATE POLICY booking_meetings_update_policy ON public.booking_meetings
  FOR UPDATE USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'))
  WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

DROP POLICY IF EXISTS booking_meetings_delete_policy ON public.booking_meetings;
CREATE POLICY booking_meetings_delete_policy ON public.booking_meetings
  FOR DELETE USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

DROP TRIGGER IF EXISTS set_updated_at_booking_meetings ON public.booking_meetings;
CREATE TRIGGER set_updated_at_booking_meetings
  BEFORE UPDATE ON public.booking_meetings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.workspace_commercial_links
  DROP CONSTRAINT IF EXISTS workspace_commercial_links_known_link_type_check;

ALTER TABLE public.workspace_commercial_links
  ADD CONSTRAINT workspace_commercial_links_known_link_type_check
  CHECK (
    link_type IN (
      'booking_quote',
      'booking_agreement',
      'agreement_invoice',
      'invoice_payment',
      'booking_payment',
      'payment_accounting_entry',
      'quote_credit_note',
      'quote_adjustment'
    )
  );

UPDATE public.workspace_commercial_links
SET link_type = 'booking_payment'
WHERE linked_record_type = 'booking_payment'
  AND link_type = 'invoice_payment';

-- PayPal cancel returns keep the payment row requested for auditability but
-- mark paypal_status=CUSTOMER_CANCELLED. The expiry RPC only expires active
-- holds (or a browser capture failure that still needs local hold cleanup);
-- completed, expired, and cancelled provider states remain available for
-- reconciliation.
CREATE OR REPLACE FUNCTION public.booking_expire_unpaid_reservations(p_workspace_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count integer := 0;
  v_now timestamptz := now();
  v_row record;
BEGIN
  -- Lock both rows before changing either one. This prevents a PayPal return
  -- or webhook from verifying a payment between reservation expiry and the
  -- payment update, and lets us restore the payment if the reservation CAS
  -- loses to a confirmation/reschedule.
  FOR v_row IN
    SELECT
      r.id AS reservation_id,
      r.workspace_id,
      p.id AS payment_id,
      p.provider AS original_provider,
      p.paypal_status AS original_paypal_status,
      p.payment_url AS original_payment_url,
      p.failure_reason AS original_failure_reason
    FROM public.booking_reservations r
    JOIN public.booking_payments p ON p.reservation_id = r.id
    WHERE r.status = 'pending_confirmation'
      AND r.payment_deadline_at IS NOT NULL
      AND r.payment_deadline_at < v_now
      AND p.status = 'requested'
      AND (
        p.provider NOT IN ('paypal', 'paypal_checkout')
        OR p.paypal_status IS NULL
        OR p.paypal_status IN ('CREATED', 'PAYER_ACTION_REQUIRED', 'APPROVED', 'RETURN_CAPTURE_FAILED')
      )
      AND (p_workspace_id IS NULL OR r.workspace_id = p_workspace_id)
    FOR UPDATE OF r, p
  LOOP
    UPDATE public.booking_payments
    SET status = 'expired',
        payment_url = NULL,
        paypal_status = CASE
          WHEN provider IN ('paypal', 'paypal_checkout') THEN 'EXPIRED'
          ELSE paypal_status
        END,
        provider_synced_at = CASE
          WHEN provider IN ('paypal', 'paypal_checkout') THEN v_now
          ELSE provider_synced_at
        END,
        failure_reason = COALESCE(failure_reason, 'Payment deadline passed without verification.'),
        updated_at = v_now
    WHERE id = v_row.payment_id
      AND workspace_id = v_row.workspace_id
      AND status = 'requested'
      AND (
        provider NOT IN ('paypal', 'paypal_checkout')
        OR paypal_status IS NULL
        OR paypal_status IN ('CREATED', 'PAYER_ACTION_REQUIRED', 'APPROVED', 'RETURN_CAPTURE_FAILED')
      );

    IF FOUND THEN
      UPDATE public.booking_reservations
      SET status = 'expired',
          updated_at = v_now
      WHERE id = v_row.reservation_id
        AND workspace_id = v_row.workspace_id
        AND status = 'pending_confirmation';

      IF FOUND THEN
        INSERT INTO public.booking_status_history
          (workspace_id, reservation_id, from_status, to_status, trigger_source, actor_type, reason, payload_json)
        VALUES (
          v_row.workspace_id,
          v_row.reservation_id,
          'pending_confirmation'::public.booking_reservation_status,
          'expired'::public.booking_reservation_status,
          'system'::public.booking_trigger_source,
          'system'::public.booking_actor_type,
          'Reservation expired: payment deadline passed without verification.',
          '{}'::jsonb
        );
        INSERT INTO public.booking_notification_events
          (workspace_id, reservation_id, event_type, channel, delivery_status, payload_json)
        VALUES (
          v_row.workspace_id,
          v_row.reservation_id,
          'payment_expired'::public.booking_notification_event_type,
          'internal_dashboard'::public.booking_notification_channel,
          'pending'::public.booking_notification_delivery_status,
          jsonb_build_object(
            'source', 'booking_expire_unpaid_reservations_rpc',
            'paymentId', v_row.payment_id,
            'emailDispatchRequired', true
          )
        );
        v_expired_count := v_expired_count + 1;
      ELSE
        -- The reservation moved while the payment row was locked. Restore
        -- the requested payment so an active booking can still be completed.
        UPDATE public.booking_payments
        SET status = 'requested',
            payment_url = v_row.original_payment_url,
            paypal_status = v_row.original_paypal_status,
            failure_reason = v_row.original_failure_reason,
            updated_at = v_now
        WHERE id = v_row.payment_id
          AND workspace_id = v_row.workspace_id
          AND status = 'expired';
      END IF;
    END IF;
  END LOOP;

  RETURN v_expired_count;
END;
$$;

-- Expiry is a privileged cross-workspace maintenance operation. The server
-- actions invoke it with the service-role client; exposing the SECURITY
-- DEFINER function to arbitrary authenticated users would let any portal
-- account expire another workspace's payment holds (or pass NULL to sweep all
-- workspaces).
-- PostgreSQL grants EXECUTE on newly-created functions to PUBLIC by default;
-- revoking only the Supabase role names would still leave anonymous callers
-- able to invoke this SECURITY DEFINER cross-workspace sweep.
REVOKE EXECUTE ON FUNCTION public.booking_expire_unpaid_reservations(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.booking_expire_unpaid_reservations(uuid) TO service_role;

-- Keep every provider delivery attempt as immutable evidence. The canonical
-- payment_webhook_events row remains the idempotency aggregate, while this
-- append-only table preserves a valid retry even when an earlier delivery
-- failed signature verification and its canonical evidence cannot be edited.
CREATE TABLE IF NOT EXISTS public.payment_webhook_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  booking_payment_id uuid REFERENCES public.booking_payments(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.booking_reservations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  provider_event_type text NOT NULL,
  verification_status text NOT NULL,
  verification_mode text NOT NULL,
  raw_body_sha256 text,
  headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT payment_webhook_attempts_provider_non_empty CHECK (btrim(provider) <> ''),
  CONSTRAINT payment_webhook_attempts_event_id_non_empty CHECK (btrim(provider_event_id) <> ''),
  CONSTRAINT payment_webhook_attempts_event_type_non_empty CHECK (btrim(provider_event_type) <> ''),
  CONSTRAINT payment_webhook_attempts_verification_status_check CHECK (verification_status IN ('verified', 'unverified', 'failed', 'skipped')),
  CONSTRAINT payment_webhook_attempts_verification_mode_check CHECK (verification_mode IN ('postback', 'self_crypto', 'disabled')),
  CONSTRAINT payment_webhook_attempts_raw_body_sha256_hex CHECK (raw_body_sha256 IS NULL OR raw_body_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS payment_webhook_attempts_event_idx
  ON public.payment_webhook_delivery_attempts (provider, provider_event_id, received_at DESC);
CREATE INDEX IF NOT EXISTS payment_webhook_attempts_workspace_received_idx
  ON public.payment_webhook_delivery_attempts (workspace_id, received_at DESC)
  WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_webhook_attempts_payment_idx
  ON public.payment_webhook_delivery_attempts (booking_payment_id, received_at DESC)
  WHERE booking_payment_id IS NOT NULL;

-- A small global bucket makes webhook throttling work across all application
-- instances. The route still keeps a process-local fast path, but never
-- trusts client-supplied proxy headers for the bucket key.
CREATE TABLE IF NOT EXISTS public.payment_webhook_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_webhook_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_webhook_rate_limits_service_policy ON public.payment_webhook_rate_limits;
CREATE POLICY payment_webhook_rate_limits_service_policy
  ON public.payment_webhook_rate_limits
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.allow_payment_webhook_request(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.payment_webhook_rate_limits%ROWTYPE;
BEGIN
  IF p_bucket_key IS NULL OR btrim(p_bucket_key) = '' OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.payment_webhook_rate_limits (bucket_key, window_started_at, request_count, updated_at)
  VALUES (left(p_bucket_key, 160), v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET window_started_at = CASE
        WHEN public.payment_webhook_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          THEN v_now
        ELSE public.payment_webhook_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN public.payment_webhook_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE public.payment_webhook_rate_limits.request_count + 1
      END,
      updated_at = v_now
  RETURNING * INTO v_row;

  RETURN v_row.request_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.allow_payment_webhook_request(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allow_payment_webhook_request(text, integer, integer) TO service_role;

-- Public availability is expensive when a workspace has Google FreeBusy
-- enabled. Keep its throttle state separate from payment callbacks so a
-- public bot cannot consume the payment webhook budget (or vice versa).
CREATE TABLE IF NOT EXISTS public.booking_availability_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_availability_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_availability_rate_limits_service_policy ON public.booking_availability_rate_limits;
CREATE POLICY booking_availability_rate_limits_service_policy
  ON public.booking_availability_rate_limits
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.allow_booking_availability_request(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_row public.booking_availability_rate_limits%ROWTYPE;
BEGIN
  IF p_bucket_key IS NULL OR btrim(p_bucket_key) = '' OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.booking_availability_rate_limits (bucket_key, window_started_at, request_count, updated_at)
  VALUES (left(p_bucket_key, 160), v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE
  SET window_started_at = CASE
        WHEN public.booking_availability_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          THEN v_now
        ELSE public.booking_availability_rate_limits.window_started_at
      END,
      request_count = CASE
        WHEN public.booking_availability_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE public.booking_availability_rate_limits.request_count + 1
      END,
      updated_at = v_now
  RETURNING * INTO v_row;

  RETURN v_row.request_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.allow_booking_availability_request(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allow_booking_availability_request(text, integer, integer) TO service_role;

-- The booking foundation predates workspace-aware composite relationships and
-- used globally unique UUID FKs. Add tenant-bound keys for the mutable
-- configuration and reservation graph. Legacy rows are left intact, while
-- every new insert/update is rejected if it crosses a workspace boundary.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_template_profiles_workspace_id_id_key' AND conrelid = 'public.booking_template_profiles'::regclass) THEN
    ALTER TABLE public.booking_template_profiles
      ADD CONSTRAINT booking_template_profiles_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_workspace_id_id_key' AND conrelid = 'public.booking_services'::regclass) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_form_definitions_workspace_id_id_key' AND conrelid = 'public.booking_form_definitions'::regclass) THEN
    ALTER TABLE public.booking_form_definitions
      ADD CONSTRAINT booking_form_definitions_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_resources_workspace_id_id_key' AND conrelid = 'public.booking_resources'::regclass) THEN
    ALTER TABLE public.booking_resources
      ADD CONSTRAINT booking_resources_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_locations_workspace_id_id_key' AND conrelid = 'public.booking_locations'::regclass) THEN
    ALTER TABLE public.booking_locations
      ADD CONSTRAINT booking_locations_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;

  ALTER TABLE public.booking_services DROP CONSTRAINT IF EXISTS booking_services_template_profile_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_workspace_profile_fk' AND conrelid = 'public.booking_services'::regclass) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_workspace_profile_fk
      FOREIGN KEY (workspace_id, template_profile_id)
      REFERENCES public.booking_template_profiles (workspace_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  ALTER TABLE public.booking_form_definitions DROP CONSTRAINT IF EXISTS booking_form_definitions_template_profile_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_forms_workspace_profile_fk' AND conrelid = 'public.booking_form_definitions'::regclass) THEN
    ALTER TABLE public.booking_form_definitions
      ADD CONSTRAINT booking_forms_workspace_profile_fk
      FOREIGN KEY (workspace_id, template_profile_id)
      REFERENCES public.booking_template_profiles (workspace_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  ALTER TABLE public.booking_reservations DROP CONSTRAINT IF EXISTS booking_reservations_template_profile_id_fkey;
  ALTER TABLE public.booking_reservations DROP CONSTRAINT IF EXISTS booking_reservations_service_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_reservations_workspace_profile_fk' AND conrelid = 'public.booking_reservations'::regclass) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_workspace_profile_fk
      FOREIGN KEY (workspace_id, template_profile_id)
      REFERENCES public.booking_template_profiles (workspace_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_reservations_workspace_service_fk' AND conrelid = 'public.booking_reservations'::regclass) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_workspace_service_fk
      FOREIGN KEY (workspace_id, service_id)
      REFERENCES public.booking_services (workspace_id, id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_reservations_workspace_resource_fk'
      AND conrelid = 'public.booking_reservations'::regclass
  ) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_workspace_resource_fk
      FOREIGN KEY (workspace_id, resource_id)
      REFERENCES public.booking_resources (workspace_id, id)
      ON DELETE SET NULL (resource_id) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_reservations_workspace_location_fk'
      AND conrelid = 'public.booking_reservations'::regclass
  ) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_workspace_location_fk
      FOREIGN KEY (workspace_id, location_id)
      REFERENCES public.booking_locations (workspace_id, id)
      ON DELETE SET NULL (location_id) NOT VALID;
  END IF;

  ALTER TABLE public.booking_service_resources DROP CONSTRAINT IF EXISTS booking_service_resources_service_id_fkey;
  ALTER TABLE public.booking_service_resources DROP CONSTRAINT IF EXISTS booking_service_resources_resource_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_service_resources_workspace_service_fk' AND conrelid = 'public.booking_service_resources'::regclass) THEN
    ALTER TABLE public.booking_service_resources
      ADD CONSTRAINT booking_service_resources_workspace_service_fk
      FOREIGN KEY (workspace_id, service_id)
      REFERENCES public.booking_services (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_service_resources_workspace_resource_fk' AND conrelid = 'public.booking_service_resources'::regclass) THEN
    ALTER TABLE public.booking_service_resources
      ADD CONSTRAINT booking_service_resources_workspace_resource_fk
      FOREIGN KEY (workspace_id, resource_id)
      REFERENCES public.booking_resources (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  ALTER TABLE public.booking_service_locations DROP CONSTRAINT IF EXISTS booking_service_locations_service_id_fkey;
  ALTER TABLE public.booking_service_locations DROP CONSTRAINT IF EXISTS booking_service_locations_location_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_service_locations_workspace_service_fk' AND conrelid = 'public.booking_service_locations'::regclass) THEN
    ALTER TABLE public.booking_service_locations
      ADD CONSTRAINT booking_service_locations_workspace_service_fk
      FOREIGN KEY (workspace_id, service_id)
      REFERENCES public.booking_services (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_service_locations_workspace_location_fk' AND conrelid = 'public.booking_service_locations'::regclass) THEN
    ALTER TABLE public.booking_service_locations
      ADD CONSTRAINT booking_service_locations_workspace_location_fk
      FOREIGN KEY (workspace_id, location_id)
      REFERENCES public.booking_locations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- Keep every workspace-scoped booking relation tenant-bound at the database
-- boundary. The legacy tables already had single-column foreign keys, which
-- still allowed a caller to pair a workspace UUID with another workspace's
-- reservation/payment/connection UUID. NOT VALID preserves legacy rows while
-- enforcing the composite relationship for every new write.
DO $$
BEGIN
  -- Replace the legacy single-column relationships rather than keeping two
  -- PostgREST embeddings to the same parent (which is ambiguous at runtime).
  ALTER TABLE public.booking_calendar_events DROP CONSTRAINT IF EXISTS booking_calendar_events_reservation_id_fkey;
  ALTER TABLE public.booking_calendar_events DROP CONSTRAINT IF EXISTS booking_calendar_events_connection_id_fkey;
  ALTER TABLE public.booking_payments DROP CONSTRAINT IF EXISTS booking_payments_reservation_id_fkey;
  ALTER TABLE public.booking_meetings DROP CONSTRAINT IF EXISTS booking_meetings_reservation_id_fkey;
  ALTER TABLE public.payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_booking_payment_id_fkey;
  ALTER TABLE public.payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_reservation_id_fkey;
  ALTER TABLE public.payment_webhook_delivery_attempts DROP CONSTRAINT IF EXISTS payment_webhook_attempts_booking_payment_id_fkey;
  ALTER TABLE public.payment_webhook_delivery_attempts DROP CONSTRAINT IF EXISTS payment_webhook_attempts_reservation_id_fkey;
  ALTER TABLE public.payment_webhook_delivery_attempts DROP CONSTRAINT IF EXISTS payment_webhook_delivery_attempts_booking_payment_id_fkey;
  ALTER TABLE public.payment_webhook_delivery_attempts DROP CONSTRAINT IF EXISTS payment_webhook_delivery_attempts_reservation_id_fkey;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_calendar_connections_workspace_id_id_key'
      AND conrelid = 'public.workspace_calendar_connections'::regclass
  ) THEN
    ALTER TABLE public.workspace_calendar_connections
      ADD CONSTRAINT workspace_calendar_connections_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_payments_workspace_id_id_key'
      AND conrelid = 'public.booking_payments'::regclass
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_calendar_events_workspace_reservation_fk'
      AND conrelid = 'public.booking_calendar_events'::regclass
  ) THEN
    ALTER TABLE public.booking_calendar_events
      ADD CONSTRAINT booking_calendar_events_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_calendar_events_workspace_connection_fk'
      AND conrelid = 'public.booking_calendar_events'::regclass
  ) THEN
    ALTER TABLE public.booking_calendar_events
      ADD CONSTRAINT booking_calendar_events_workspace_connection_fk
      FOREIGN KEY (workspace_id, connection_id)
      REFERENCES public.workspace_calendar_connections (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_payments_workspace_reservation_fk'
      AND conrelid = 'public.booking_payments'::regclass
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_events_workspace_payment_fk'
      AND conrelid = 'public.payment_webhook_events'::regclass
  ) THEN
    ALTER TABLE public.payment_webhook_events
      ADD CONSTRAINT payment_webhook_events_workspace_payment_fk
      FOREIGN KEY (workspace_id, booking_payment_id)
      REFERENCES public.booking_payments (workspace_id, id)
      ON DELETE SET NULL (booking_payment_id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_events_workspace_reservation_fk'
      AND conrelid = 'public.payment_webhook_events'::regclass
  ) THEN
    ALTER TABLE public.payment_webhook_events
      ADD CONSTRAINT payment_webhook_events_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE SET NULL (reservation_id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_attempts_workspace_payment_fk'
      AND conrelid = 'public.payment_webhook_delivery_attempts'::regclass
  ) THEN
    ALTER TABLE public.payment_webhook_delivery_attempts
      ADD CONSTRAINT payment_webhook_attempts_workspace_payment_fk
      FOREIGN KEY (workspace_id, booking_payment_id)
      REFERENCES public.booking_payments (workspace_id, id)
      ON DELETE SET NULL (booking_payment_id) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_webhook_attempts_workspace_reservation_fk'
      AND conrelid = 'public.payment_webhook_delivery_attempts'::regclass
  ) THEN
    ALTER TABLE public.payment_webhook_delivery_attempts
      ADD CONSTRAINT payment_webhook_attempts_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE SET NULL (reservation_id) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.payment_webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_webhook_attempts_service_policy ON public.payment_webhook_delivery_attempts;
CREATE POLICY payment_webhook_attempts_service_policy
  ON public.payment_webhook_delivery_attempts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
REVOKE ALL ON TABLE public.payment_webhook_delivery_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.payment_webhook_delivery_attempts TO service_role;

-- Keep canonical webhook evidence immutable without defeating the declared
-- SET NULL referential actions. A parent deletion may detach only the three
-- relationship columns, and only after the referenced parent is gone; normal
-- processing-status transitions remain service-role-only.
CREATE OR REPLACE FUNCTION public.prevent_payment_webhook_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payment_webhook_events is append-only';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      OLD.id,
      OLD.provider,
      OLD.provider_event_id,
      OLD.provider_event_type,
      OLD.verification_status,
      OLD.verification_mode,
      OLD.raw_body_sha256,
      OLD.headers_json,
      OLD.payload_json,
      OLD.resource_json,
      OLD.delivery_attempt,
      OLD.received_at,
      OLD.metadata,
      OLD.created_at
    ) IS NOT DISTINCT FROM ROW(
      NEW.id,
      NEW.provider,
      NEW.provider_event_id,
      NEW.provider_event_type,
      NEW.verification_status,
      NEW.verification_mode,
      NEW.raw_body_sha256,
      NEW.headers_json,
      NEW.payload_json,
      NEW.resource_json,
      NEW.delivery_attempt,
      NEW.received_at,
      NEW.metadata,
      NEW.created_at
    )
    AND (
      NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
      OR (
        NEW.workspace_id IS NULL
        AND OLD.workspace_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.workspaces workspace
          WHERE workspace.id = OLD.workspace_id
        )
      )
    )
    AND (
      NEW.booking_payment_id IS NOT DISTINCT FROM OLD.booking_payment_id
      OR (
        NEW.booking_payment_id IS NULL
        AND OLD.booking_payment_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.booking_payments payment
          WHERE payment.id = OLD.booking_payment_id
        )
      )
    )
    AND (
      NEW.reservation_id IS NOT DISTINCT FROM OLD.reservation_id
      OR (
        NEW.reservation_id IS NULL
        AND OLD.reservation_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.booking_reservations reservation
          WHERE reservation.id = OLD.reservation_id
        )
      )
    ) THEN
      RETURN NEW;
    END IF;

    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'payment_webhook_events can only be transitioned by service role';
    END IF;

    IF ROW(
      OLD.id,
      OLD.workspace_id,
      OLD.booking_payment_id,
      OLD.reservation_id,
      OLD.provider,
      OLD.provider_event_id,
      OLD.provider_event_type,
      OLD.verification_status,
      OLD.verification_mode,
      OLD.raw_body_sha256,
      OLD.headers_json,
      OLD.payload_json,
      OLD.resource_json,
      OLD.delivery_attempt,
      OLD.received_at,
      OLD.metadata,
      OLD.created_at
    ) IS DISTINCT FROM ROW(
      NEW.id,
      NEW.workspace_id,
      NEW.booking_payment_id,
      NEW.reservation_id,
      NEW.provider,
      NEW.provider_event_id,
      NEW.provider_event_type,
      NEW.verification_status,
      NEW.verification_mode,
      NEW.raw_body_sha256,
      NEW.headers_json,
      NEW.payload_json,
      NEW.resource_json,
      NEW.delivery_attempt,
      NEW.received_at,
      NEW.metadata,
      NEW.created_at
    ) THEN
      RAISE EXCEPTION 'payment_webhook_events evidence columns are immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_payment_webhook_attempt_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND ROW(
       OLD.id,
       OLD.provider,
       OLD.provider_event_id,
       OLD.provider_event_type,
       OLD.verification_status,
       OLD.verification_mode,
       OLD.raw_body_sha256,
       OLD.headers_json,
       OLD.payload_json,
       OLD.resource_json,
       OLD.received_at,
       OLD.metadata
     ) IS NOT DISTINCT FROM ROW(
       NEW.id,
       NEW.provider,
       NEW.provider_event_id,
       NEW.provider_event_type,
       NEW.verification_status,
       NEW.verification_mode,
       NEW.raw_body_sha256,
       NEW.headers_json,
       NEW.payload_json,
       NEW.resource_json,
       NEW.received_at,
       NEW.metadata
     )
     AND (
       NEW.workspace_id IS NOT DISTINCT FROM OLD.workspace_id
       OR (
         NEW.workspace_id IS NULL
         AND OLD.workspace_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.workspaces workspace
           WHERE workspace.id = OLD.workspace_id
         )
       )
     )
     AND (
       NEW.booking_payment_id IS NOT DISTINCT FROM OLD.booking_payment_id
       OR (
         NEW.booking_payment_id IS NULL
         AND OLD.booking_payment_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.booking_payments payment
           WHERE payment.id = OLD.booking_payment_id
         )
       )
     )
     AND (
       NEW.reservation_id IS NOT DISTINCT FROM OLD.reservation_id
       OR (
         NEW.reservation_id IS NULL
         AND OLD.reservation_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.booking_reservations reservation
           WHERE reservation.id = OLD.reservation_id
         )
       )
     ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'payment_webhook_delivery_attempts is append-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_payment_webhook_attempt_mutation ON public.payment_webhook_delivery_attempts;
CREATE TRIGGER prevent_payment_webhook_attempt_mutation
  BEFORE UPDATE OR DELETE ON public.payment_webhook_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_webhook_attempt_mutation();

-- Webhook payloads can contain payer identity and provider headers. They are
-- immutable provider evidence, not a dashboard read model, and must never be
-- visible or writable through the anonymous/authenticated roles (including
-- legacy rows whose composite tenant relationship remains NOT VALID).
DROP POLICY IF EXISTS payment_webhook_events_select_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_insert_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_update_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_delete_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_workspace_select_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_service_policy ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_service_policy
  ON public.payment_webhook_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
REVOKE ALL ON TABLE public.payment_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_webhook_events TO service_role;

-- Complete the tenant-bound relationship graph for the legacy booking tables.
-- RLS scopes each child row, but a single-column UUID foreign key could still
-- pair that row with another workspace's service/resource/profile when a UUID
-- is known. Composite references reject that cross-workspace pairing while
-- NOT VALID keeps historical data available for a later quality sweep.
DO $$
BEGIN
  ALTER TABLE public.booking_reservations
    DROP CONSTRAINT IF EXISTS booking_reservations_form_definition_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_reservations_workspace_form_fk' AND conrelid = 'public.booking_reservations'::regclass) THEN
    ALTER TABLE public.booking_reservations
      ADD CONSTRAINT booking_reservations_workspace_form_fk
      FOREIGN KEY (workspace_id, form_definition_id)
      REFERENCES public.booking_form_definitions (workspace_id, id)
      ON DELETE SET NULL (form_definition_id) NOT VALID;
  END IF;

  ALTER TABLE public.booking_staff_profiles
    DROP CONSTRAINT IF EXISTS booking_staff_profiles_resource_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_staff_profiles_workspace_resource_fk' AND conrelid = 'public.booking_staff_profiles'::regclass) THEN
    ALTER TABLE public.booking_staff_profiles
      ADD CONSTRAINT booking_staff_profiles_workspace_resource_fk
      FOREIGN KEY (workspace_id, resource_id)
      REFERENCES public.booking_resources (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  ALTER TABLE public.booking_availability_rules
    DROP CONSTRAINT IF EXISTS booking_availability_rules_template_profile_id_fkey,
    DROP CONSTRAINT IF EXISTS booking_availability_rules_service_id_fkey,
    DROP CONSTRAINT IF EXISTS booking_availability_rules_resource_id_fkey,
    DROP CONSTRAINT IF EXISTS booking_availability_rules_location_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_availability_rules_workspace_profile_fk' AND conrelid = 'public.booking_availability_rules'::regclass) THEN
    ALTER TABLE public.booking_availability_rules
      ADD CONSTRAINT booking_availability_rules_workspace_profile_fk
      FOREIGN KEY (workspace_id, template_profile_id)
      REFERENCES public.booking_template_profiles (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_availability_rules_workspace_service_fk' AND conrelid = 'public.booking_availability_rules'::regclass) THEN
    ALTER TABLE public.booking_availability_rules
      ADD CONSTRAINT booking_availability_rules_workspace_service_fk
      FOREIGN KEY (workspace_id, service_id)
      REFERENCES public.booking_services (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_availability_rules_workspace_resource_fk' AND conrelid = 'public.booking_availability_rules'::regclass) THEN
    ALTER TABLE public.booking_availability_rules
      ADD CONSTRAINT booking_availability_rules_workspace_resource_fk
      FOREIGN KEY (workspace_id, resource_id)
      REFERENCES public.booking_resources (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_availability_rules_workspace_location_fk' AND conrelid = 'public.booking_availability_rules'::regclass) THEN
    ALTER TABLE public.booking_availability_rules
      ADD CONSTRAINT booking_availability_rules_workspace_location_fk
      FOREIGN KEY (workspace_id, location_id)
      REFERENCES public.booking_locations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  ALTER TABLE public.booking_blackout_windows
    DROP CONSTRAINT IF EXISTS booking_blackout_windows_service_id_fkey,
    DROP CONSTRAINT IF EXISTS booking_blackout_windows_resource_id_fkey,
    DROP CONSTRAINT IF EXISTS booking_blackout_windows_location_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_blackout_windows_workspace_service_fk' AND conrelid = 'public.booking_blackout_windows'::regclass) THEN
    ALTER TABLE public.booking_blackout_windows
      ADD CONSTRAINT booking_blackout_windows_workspace_service_fk
      FOREIGN KEY (workspace_id, service_id)
      REFERENCES public.booking_services (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_blackout_windows_workspace_resource_fk' AND conrelid = 'public.booking_blackout_windows'::regclass) THEN
    ALTER TABLE public.booking_blackout_windows
      ADD CONSTRAINT booking_blackout_windows_workspace_resource_fk
      FOREIGN KEY (workspace_id, resource_id)
      REFERENCES public.booking_resources (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_blackout_windows_workspace_location_fk' AND conrelid = 'public.booking_blackout_windows'::regclass) THEN
    ALTER TABLE public.booking_blackout_windows
      ADD CONSTRAINT booking_blackout_windows_workspace_location_fk
      FOREIGN KEY (workspace_id, location_id)
      REFERENCES public.booking_locations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  ALTER TABLE public.booking_rule_definitions
    DROP CONSTRAINT IF EXISTS booking_rule_definitions_service_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_rule_definitions_workspace_service_fk' AND conrelid = 'public.booking_rule_definitions'::regclass) THEN
    ALTER TABLE public.booking_rule_definitions
      ADD CONSTRAINT booking_rule_definitions_workspace_service_fk
      FOREIGN KEY (workspace_id, service_id)
      REFERENCES public.booking_services (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  ALTER TABLE public.booking_reservation_intake
    DROP CONSTRAINT IF EXISTS booking_reservation_intake_reservation_id_fkey,
    DROP CONSTRAINT IF EXISTS booking_reservation_intake_form_definition_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_reservation_intake_workspace_reservation_fk' AND conrelid = 'public.booking_reservation_intake'::regclass) THEN
    ALTER TABLE public.booking_reservation_intake
      ADD CONSTRAINT booking_reservation_intake_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_reservation_intake_workspace_form_fk' AND conrelid = 'public.booking_reservation_intake'::regclass) THEN
    ALTER TABLE public.booking_reservation_intake
      ADD CONSTRAINT booking_reservation_intake_workspace_form_fk
      FOREIGN KEY (workspace_id, form_definition_id)
      REFERENCES public.booking_form_definitions (workspace_id, id)
      ON DELETE SET NULL (form_definition_id) NOT VALID;
  END IF;

  ALTER TABLE public.booking_status_history
    DROP CONSTRAINT IF EXISTS booking_status_history_reservation_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_status_history_workspace_reservation_fk' AND conrelid = 'public.booking_status_history'::regclass) THEN
    ALTER TABLE public.booking_status_history
      ADD CONSTRAINT booking_status_history_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  ALTER TABLE public.booking_notification_events
    DROP CONSTRAINT IF EXISTS booking_notification_events_reservation_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_notification_events_workspace_reservation_fk' AND conrelid = 'public.booking_notification_events'::regclass) THEN
    ALTER TABLE public.booking_notification_events
      ADD CONSTRAINT booking_notification_events_workspace_reservation_fk
      FOREIGN KEY (workspace_id, reservation_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  -- A confirmed booking may be observed concurrently by a PayPal return,
  -- webhook, and operator action. Preserve any pre-existing duplicate draft
  -- rows but detach later copies before enforcing the booking-level
  -- idempotency invariant for future DVO creation.
  WITH ranked AS (
    SELECT id,
           workspace_id,
           booking_id,
           row_number() OVER (
             PARTITION BY workspace_id, booking_id
             ORDER BY created_at ASC, id ASC
           ) AS row_number
    FROM public.legal_agreements
    WHERE booking_id IS NOT NULL
  ), duplicates AS (
    SELECT duplicate.id,
           winner.id AS winner_id,
           duplicate.booking_id
    FROM ranked duplicate
    JOIN ranked winner
      ON winner.workspace_id = duplicate.workspace_id
     AND winner.booking_id = duplicate.booking_id
     AND winner.row_number = 1
    WHERE duplicate.row_number > 1
  )
  UPDATE public.legal_agreements agreement
  SET booking_id = NULL,
      payload = COALESCE(agreement.payload, '{}'::jsonb) || jsonb_build_object(
        'deduplicatedBookingId', duplicates.booking_id,
        'deduplicatedIntoAgreementId', duplicates.winner_id,
        'deduplicatedAt', now()
      ),
      updated_at = now()
  FROM duplicates
  WHERE agreement.id = duplicates.id;

  CREATE UNIQUE INDEX IF NOT EXISTS legal_agreements_workspace_booking_unique
    ON public.legal_agreements (workspace_id, booking_id)
    WHERE booking_id IS NOT NULL;

  ALTER TABLE public.legal_agreements
    DROP CONSTRAINT IF EXISTS legal_agreements_booking_id_fkey;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_agreements_workspace_booking_fk' AND conrelid = 'public.legal_agreements'::regclass) THEN
    ALTER TABLE public.legal_agreements
      ADD CONSTRAINT legal_agreements_workspace_booking_fk
      FOREIGN KEY (workspace_id, booking_id)
      REFERENCES public.booking_reservations (workspace_id, id)
      ON DELETE SET NULL (booking_id) NOT VALID;
  END IF;
END $$;

-- Supporting indexes for composite tenant foreign keys. PostgreSQL does not
-- create indexes on referencing columns automatically; these keep cascades,
-- tenant joins, and integrity checks bounded as adopters add workspaces.
CREATE INDEX IF NOT EXISTS booking_meetings_workspace_calendar_connection_idx
  ON public.booking_meetings (workspace_id, calendar_connection_id)
  WHERE calendar_connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_calendar_cleanup_workspace_connection_idx
  ON public.booking_calendar_cleanup_tasks (workspace_id, connection_id);
CREATE INDEX IF NOT EXISTS booking_services_workspace_profile_idx
  ON public.booking_services (workspace_id, template_profile_id);
CREATE INDEX IF NOT EXISTS booking_forms_workspace_profile_idx
  ON public.booking_form_definitions (workspace_id, template_profile_id);
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_profile_idx
  ON public.booking_reservations (workspace_id, template_profile_id);
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_service_idx
  ON public.booking_reservations (workspace_id, service_id);
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_resource_idx
  ON public.booking_reservations (workspace_id, resource_id)
  WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_location_idx
  ON public.booking_reservations (workspace_id, location_id)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_reservations_workspace_form_idx
  ON public.booking_reservations (workspace_id, form_definition_id)
  WHERE form_definition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_service_resources_workspace_resource_idx
  ON public.booking_service_resources (workspace_id, resource_id);
CREATE INDEX IF NOT EXISTS booking_service_locations_workspace_location_idx
  ON public.booking_service_locations (workspace_id, location_id);
CREATE INDEX IF NOT EXISTS booking_calendar_events_workspace_reservation_idx
  ON public.booking_calendar_events (workspace_id, reservation_id);
CREATE INDEX IF NOT EXISTS booking_calendar_events_workspace_connection_idx
  ON public.booking_calendar_events (workspace_id, connection_id);
CREATE INDEX IF NOT EXISTS booking_payments_workspace_reservation_idx
  ON public.booking_payments (workspace_id, reservation_id);
CREATE INDEX IF NOT EXISTS payment_webhook_events_workspace_payment_idx
  ON public.payment_webhook_events (workspace_id, booking_payment_id)
  WHERE booking_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_webhook_events_workspace_reservation_idx
  ON public.payment_webhook_events (workspace_id, reservation_id)
  WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_webhook_attempts_workspace_payment_idx
  ON public.payment_webhook_delivery_attempts (workspace_id, booking_payment_id)
  WHERE booking_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_webhook_attempts_workspace_reservation_idx
  ON public.payment_webhook_delivery_attempts (workspace_id, reservation_id)
  WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_staff_profiles_workspace_resource_idx
  ON public.booking_staff_profiles (workspace_id, resource_id);
CREATE INDEX IF NOT EXISTS booking_availability_workspace_profile_idx
  ON public.booking_availability_rules (workspace_id, template_profile_id);
CREATE INDEX IF NOT EXISTS booking_availability_workspace_service_idx
  ON public.booking_availability_rules (workspace_id, service_id)
  WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_availability_workspace_resource_idx
  ON public.booking_availability_rules (workspace_id, resource_id)
  WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_availability_workspace_location_idx
  ON public.booking_availability_rules (workspace_id, location_id)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_blackouts_workspace_service_idx
  ON public.booking_blackout_windows (workspace_id, service_id)
  WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_blackouts_workspace_resource_idx
  ON public.booking_blackout_windows (workspace_id, resource_id)
  WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_blackouts_workspace_location_idx
  ON public.booking_blackout_windows (workspace_id, location_id)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_rules_workspace_service_idx
  ON public.booking_rule_definitions (workspace_id, service_id)
  WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_intake_workspace_reservation_idx
  ON public.booking_reservation_intake (workspace_id, reservation_id);
CREATE INDEX IF NOT EXISTS booking_intake_workspace_form_idx
  ON public.booking_reservation_intake (workspace_id, form_definition_id);
CREATE INDEX IF NOT EXISTS booking_history_workspace_reservation_idx
  ON public.booking_status_history (workspace_id, reservation_id);
CREATE INDEX IF NOT EXISTS booking_notifications_workspace_reservation_idx
  ON public.booking_notification_events (workspace_id, reservation_id);

-- These relations are created by this migration, so their composite tenant
-- constraints can be validated immediately. Legacy booking relations remain
-- NOT VALID until an adopter audits and repairs any historical cross-tenant
-- rows; all new writes are still protected from this migration onward.
ALTER TABLE public.booking_meetings
  VALIDATE CONSTRAINT booking_meetings_workspace_reservation_fk;
ALTER TABLE public.booking_meetings
  VALIDATE CONSTRAINT booking_meetings_workspace_calendar_connection_fk;
ALTER TABLE public.booking_calendar_cleanup_tasks
  VALIDATE CONSTRAINT booking_calendar_cleanup_tasks_workspace_reservation_fk;
ALTER TABLE public.booking_calendar_cleanup_tasks
  VALIDATE CONSTRAINT booking_calendar_cleanup_tasks_workspace_connection_fk;
ALTER TABLE public.payment_webhook_delivery_attempts
  VALIDATE CONSTRAINT payment_webhook_attempts_workspace_payment_fk;
ALTER TABLE public.payment_webhook_delivery_attempts
  VALIDATE CONSTRAINT payment_webhook_attempts_workspace_reservation_fk;

COMMIT;
