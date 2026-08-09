-- Adds paid-booking primitives so workspaces can charge for consultations via
-- an external Revolut Pro payment link while the slot is held in
-- pending_confirmation until an operator verifies payment manually.
-- Provider-agnostic so we can swap in Stripe / Mollie / Revolut Business
-- Merchant later without touching the booking flow.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Pricing + payment-link fields on booking_services.
-- ---------------------------------------------------------------------------

ALTER TABLE public.booking_services
  ADD COLUMN IF NOT EXISTS payment_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_amount_cents integer,
  ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'manual_revolut_pro',
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS payment_instructions text,
  ADD COLUMN IF NOT EXISTS payment_deadline_minutes integer NOT NULL DEFAULT 1440;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_price_amount_positive'
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_price_amount_positive
      CHECK (price_amount_cents IS NULL OR price_amount_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_currency_iso'
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_currency_iso
      CHECK (price_currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_payment_required_has_amount'
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_payment_required_has_amount
      CHECK (
        payment_required = false
        OR (price_amount_cents IS NOT NULL AND price_amount_cents > 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_services_payment_deadline_positive'
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT booking_services_payment_deadline_positive
      CHECK (payment_deadline_minutes BETWEEN 15 AND 20160);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) payment_deadline_at on reservations so abandoned paid holds expire.
-- ---------------------------------------------------------------------------

ALTER TABLE public.booking_reservations
  ADD COLUMN IF NOT EXISTS payment_deadline_at timestamptz;

CREATE INDEX IF NOT EXISTS booking_reservations_payment_deadline_idx
  ON public.booking_reservations (workspace_id, status, payment_deadline_at)
  WHERE payment_deadline_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) booking_payments table — provider-agnostic, audit-ready.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_payment_status') THEN
    CREATE TYPE public.booking_payment_status AS ENUM (
      'requested',
      'verified',
      'failed',
      'expired',
      'refunded'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.booking_reservations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual_revolut_pro',
  status public.booking_payment_status NOT NULL DEFAULT 'requested',
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_url text,
  payment_reference text NOT NULL,
  customer_instructions text,
  deadline_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_note text,
  failure_reason text,
  refund_amount_cents integer CHECK (refund_amount_cents IS NULL OR refund_amount_cents >= 0),
  refunded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Exactly one live payment record per reservation. Refunds/failed retries
-- live in the same row; we do not chain multiple attempts for the manual
-- workflow since the reconciliation handle (payment_reference) must match
-- the reservation one-to-one.
CREATE UNIQUE INDEX IF NOT EXISTS booking_payments_reservation_unique
  ON public.booking_payments (reservation_id);

CREATE INDEX IF NOT EXISTS booking_payments_workspace_status_idx
  ON public.booking_payments (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_payments_workspace_deadline_idx
  ON public.booking_payments (workspace_id, status, deadline_at)
  WHERE deadline_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_booking_payments'
      AND tgrelid = 'public.booking_payments'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_booking_payments
      BEFORE UPDATE ON public.booking_payments
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_payments_select_policy ON public.booking_payments;
DROP POLICY IF EXISTS booking_payments_insert_policy ON public.booking_payments;
DROP POLICY IF EXISTS booking_payments_update_policy ON public.booking_payments;
DROP POLICY IF EXISTS booking_payments_delete_policy ON public.booking_payments;

CREATE POLICY booking_payments_select_policy
  ON public.booking_payments
  FOR SELECT
  USING (public.can_access_booking_workspace(workspace_id, 'booking.read'));

CREATE POLICY booking_payments_insert_policy
  ON public.booking_payments
  FOR INSERT
  WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY booking_payments_update_policy
  ON public.booking_payments
  FOR UPDATE
  USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'))
  WITH CHECK (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY booking_payments_delete_policy
  ON public.booking_payments
  FOR DELETE
  USING (public.can_access_booking_workspace(workspace_id, 'booking.manage'));

-- ---------------------------------------------------------------------------
-- 4) Lazy expiry helper — server actions/cron call this to release slots
--    held by abandoned paid bookings. Returns the count of expired rows so
--    operators can confirm sweep activity.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.booking_expire_unpaid_reservations(p_workspace_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expired_count integer := 0;
  v_now timestamptz := now();
BEGIN
  WITH expiring AS (
    SELECT r.id
    FROM public.booking_reservations r
    JOIN public.booking_payments p ON p.reservation_id = r.id
    WHERE r.status = 'pending_confirmation'
      AND r.payment_deadline_at IS NOT NULL
      AND r.payment_deadline_at < v_now
      AND p.status = 'requested'
      AND (p_workspace_id IS NULL OR r.workspace_id = p_workspace_id)
  ),
  expired_reservations AS (
    UPDATE public.booking_reservations r
    SET status = 'expired',
        updated_at = v_now
    FROM expiring e
    WHERE r.id = e.id
    RETURNING r.id, r.workspace_id, r.status
  ),
  expired_payments AS (
    UPDATE public.booking_payments p
    SET status = 'expired',
        failure_reason = COALESCE(p.failure_reason, 'Payment deadline passed without verification.'),
        updated_at = v_now
    FROM expired_reservations er
    WHERE p.reservation_id = er.id
    RETURNING p.id
  ),
  history_writes AS (
    INSERT INTO public.booking_status_history
      (workspace_id, reservation_id, from_status, to_status, trigger_source, actor_type, reason, payload_json)
    SELECT
      er.workspace_id,
      er.id,
      'pending_confirmation'::public.booking_reservation_status,
      'expired'::public.booking_reservation_status,
      'system'::public.booking_trigger_source,
      'system'::public.booking_actor_type,
      'Reservation expired: payment deadline passed without verification.',
      '{}'::jsonb
    FROM expired_reservations er
    RETURNING 1
  )
  SELECT count(*) INTO v_expired_count FROM expired_reservations;

  RETURN v_expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.booking_expire_unpaid_reservations(uuid) TO authenticated;

COMMIT;
