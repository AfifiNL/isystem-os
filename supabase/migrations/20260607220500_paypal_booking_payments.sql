BEGIN;

-- ---------------------------------------------------------------------------
-- 1) First-class PayPal tracking fields on the one-payment-per-reservation row.
-- ---------------------------------------------------------------------------

ALTER TABLE public.booking_payments
  ADD COLUMN IF NOT EXISTS paypal_order_id text,
  ADD COLUMN IF NOT EXISTS paypal_capture_id text,
  ADD COLUMN IF NOT EXISTS paypal_payer_id text,
  ADD COLUMN IF NOT EXISTS paypal_payer_email text,
  ADD COLUMN IF NOT EXISTS paypal_status text,
  ADD COLUMN IF NOT EXISTS paypal_fee_cents integer,
  ADD COLUMN IF NOT EXISTS paypal_net_cents integer,
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS provider_event_type text,
  ADD COLUMN IF NOT EXISTS provider_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_payments_paypal_fee_non_negative'
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_paypal_fee_non_negative
      CHECK (paypal_fee_cents IS NULL OR paypal_fee_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_payments_paypal_net_non_negative'
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_paypal_net_non_negative
      CHECK (paypal_net_cents IS NULL OR paypal_net_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_payments_paypal_payer_email_format'
  ) THEN
    ALTER TABLE public.booking_payments
      ADD CONSTRAINT booking_payments_paypal_payer_email_format
      CHECK (paypal_payer_email IS NULL OR paypal_payer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS booking_payments_paypal_order_id_unique
  ON public.booking_payments (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS booking_payments_paypal_capture_id_unique
  ON public.booking_payments (paypal_capture_id)
  WHERE paypal_capture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS booking_payments_provider_event_idx
  ON public.booking_payments (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Payment webhook event ledger for provider-level idempotency and audits.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  booking_payment_id uuid REFERENCES public.booking_payments(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.booking_reservations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  provider_event_type text NOT NULL,
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_mode text NOT NULL DEFAULT 'postback',
  processing_status text NOT NULL DEFAULT 'received',
  raw_body_sha256 text,
  headers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_attempt integer NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_events_provider_non_empty CHECK (btrim(provider) <> ''),
  CONSTRAINT payment_webhook_events_provider_event_id_non_empty CHECK (btrim(provider_event_id) <> ''),
  CONSTRAINT payment_webhook_events_provider_event_type_non_empty CHECK (btrim(provider_event_type) <> ''),
  CONSTRAINT payment_webhook_events_verification_status_check CHECK (verification_status IN ('verified', 'unverified', 'failed', 'skipped')),
  CONSTRAINT payment_webhook_events_verification_mode_check CHECK (verification_mode IN ('postback', 'self_crypto', 'disabled')),
  CONSTRAINT payment_webhook_events_processing_status_check CHECK (processing_status IN ('received', 'processing', 'processed', 'duplicate', 'ignored', 'failed')),
  CONSTRAINT payment_webhook_events_delivery_attempt_positive CHECK (delivery_attempt >= 1),
  CONSTRAINT payment_webhook_events_raw_body_sha256_hex CHECK (raw_body_sha256 IS NULL OR raw_body_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_event_unique
  ON public.payment_webhook_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS payment_webhook_events_workspace_received_idx
  ON public.payment_webhook_events (workspace_id, received_at DESC);

CREATE INDEX IF NOT EXISTS payment_webhook_events_booking_payment_idx
  ON public.payment_webhook_events (booking_payment_id, received_at DESC)
  WHERE booking_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_webhook_events_reservation_idx
  ON public.payment_webhook_events (reservation_id, received_at DESC)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_webhook_events_processing_status_idx
  ON public.payment_webhook_events (provider, processing_status, received_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_payment_webhook_events'
      AND tgrelid = 'public.payment_webhook_events'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_payment_webhook_events
      BEFORE UPDATE ON public.payment_webhook_events
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_webhook_events_select_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_insert_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_update_policy ON public.payment_webhook_events;
DROP POLICY IF EXISTS payment_webhook_events_delete_policy ON public.payment_webhook_events;

CREATE POLICY payment_webhook_events_select_policy
  ON public.payment_webhook_events
  FOR SELECT
  USING (workspace_id IS NULL OR public.can_access_booking_workspace(workspace_id, 'booking.read'));

CREATE POLICY payment_webhook_events_insert_policy
  ON public.payment_webhook_events
  FOR INSERT
  WITH CHECK (workspace_id IS NULL OR public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY payment_webhook_events_update_policy
  ON public.payment_webhook_events
  FOR UPDATE
  USING (workspace_id IS NULL OR public.can_access_booking_workspace(workspace_id, 'booking.manage'))
  WITH CHECK (workspace_id IS NULL OR public.can_access_booking_workspace(workspace_id, 'booking.manage'));

CREATE POLICY payment_webhook_events_delete_policy
  ON public.payment_webhook_events
  FOR DELETE
  USING (workspace_id IS NULL OR public.can_access_booking_workspace(workspace_id, 'booking.manage'));

COMMIT;
