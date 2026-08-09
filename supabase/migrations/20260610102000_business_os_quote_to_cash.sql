-- Business OS quote-to-cash bridge hardening.

BEGIN;

ALTER TABLE public.workspace_commercial_links
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS correction_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_commercial_links_correction_kind_check'
      AND conrelid = 'public.workspace_commercial_links'::regclass
  ) THEN
    ALTER TABLE public.workspace_commercial_links
      ADD CONSTRAINT workspace_commercial_links_correction_kind_check
      CHECK (correction_kind IS NULL OR correction_kind IN ('credit_note', 'adjustment'));
  END IF;
END $$;

UPDATE public.workspace_commercial_links
SET idempotency_key = concat_ws(
  ':',
  'commercial-link',
  link_type,
  COALESCE(quote_id::text, 'no-quote'),
  linked_record_type,
  COALESCE(linked_record_id::text, linked_record_ref, id::text)
)
WHERE idempotency_key IS NULL;

ALTER TABLE public.workspace_commercial_links
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_commercial_links_idempotency_unique
  ON public.workspace_commercial_links (workspace_id, idempotency_key);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_commercial_links_known_link_type_check'
      AND conrelid = 'public.workspace_commercial_links'::regclass
  ) THEN
    ALTER TABLE public.workspace_commercial_links
      ADD CONSTRAINT workspace_commercial_links_known_link_type_check
      CHECK (
        link_type IN (
          'booking_quote',
          'booking_agreement',
          'agreement_invoice',
          'invoice_payment',
          'payment_accounting_entry',
          'quote_credit_note',
          'quote_adjustment'
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_finalized_quote_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('accepted', 'converted', 'void') THEN
      RAISE EXCEPTION 'Finalized quotes are immutable; create a credit note or adjustment link instead.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('accepted', 'converted', 'void') THEN
    IF ROW(
      OLD.workspace_id,
      OLD.customer_id,
      OLD.portal_client_id,
      OLD.quote_number,
      OLD.title,
      OLD.issue_date,
      OLD.expiry_date,
      OLD.currency,
      OLD.subtotal_cents,
      OLD.btw_cents,
      OLD.total_cents,
      OLD.accepted_at,
      OLD.converted_invoice_id
    ) IS DISTINCT FROM ROW(
      NEW.workspace_id,
      NEW.customer_id,
      NEW.portal_client_id,
      NEW.quote_number,
      NEW.title,
      NEW.issue_date,
      NEW.expiry_date,
      NEW.currency,
      NEW.subtotal_cents,
      NEW.btw_cents,
      NEW.total_cents,
      NEW.accepted_at,
      NEW.converted_invoice_id
    ) THEN
      RAISE EXCEPTION 'Finalized quote commercial fields are immutable; create a credit note or adjustment link instead.';
    END IF;

    IF NOT (
      OLD.status = NEW.status
      OR (OLD.status = 'accepted' AND NEW.status IN ('converted', 'void'))
      OR (OLD.status = 'converted' AND NEW.status = 'void')
    ) THEN
      RAISE EXCEPTION 'Unsupported finalized quote status transition from % to %.', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_finalized_quote_mutation ON public.workspace_quotes;
CREATE TRIGGER prevent_finalized_quote_mutation
  BEFORE UPDATE OR DELETE ON public.workspace_quotes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_quote_mutation();

COMMIT;
