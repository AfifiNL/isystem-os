-- Universal booking/accounting linkage. A verified booking payment owns at
-- most one VAT invoice draft; manual Legal Vault invoices remain unlinked.

ALTER TABLE public.legal_invoices
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS booking_payment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_invoices_workspace_id_id_key'
      AND conrelid = 'public.legal_invoices'::regclass
  ) THEN
    ALTER TABLE public.legal_invoices
      ADD CONSTRAINT legal_invoices_workspace_id_id_key
      UNIQUE (workspace_id, id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legal_invoices invoice
    LEFT JOIN public.booking_reservations reservation
      ON reservation.workspace_id = invoice.workspace_id
     AND reservation.id = invoice.booking_id
    WHERE invoice.booking_id IS NOT NULL
      AND reservation.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot tenant-bind legal_invoices.booking_id: at least one invoice references a missing or cross-workspace reservation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legal_invoices invoice
    LEFT JOIN public.booking_payments payment
      ON payment.workspace_id = invoice.workspace_id
     AND payment.id = invoice.booking_payment_id
    WHERE invoice.booking_payment_id IS NOT NULL
      AND payment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot tenant-bind legal_invoices.booking_payment_id: at least one invoice references a missing or cross-workspace payment.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legal_invoice_lines line
    LEFT JOIN public.legal_invoices invoice
      ON invoice.workspace_id = line.workspace_id
     AND invoice.id = line.invoice_id
    WHERE invoice.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot tenant-bind legal_invoice_lines.invoice_id: at least one line references a missing or cross-workspace invoice.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.legal_invoice_lines
    GROUP BY workspace_id, invoice_id, sort_order
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce legal invoice line ordering: duplicate (workspace_id, invoice_id, sort_order) values require an explicit financial-data repair.';
  END IF;

  ALTER TABLE public.legal_invoices
    DROP CONSTRAINT IF EXISTS legal_invoices_workspace_booking_fk,
    DROP CONSTRAINT IF EXISTS legal_invoices_workspace_booking_payment_fk;

  ALTER TABLE public.legal_invoices
    ADD CONSTRAINT legal_invoices_workspace_booking_fk
    FOREIGN KEY (workspace_id, booking_id)
    REFERENCES public.booking_reservations(workspace_id, id)
    ON DELETE SET NULL (booking_id)
    NOT VALID;

  ALTER TABLE public.legal_invoices
    ADD CONSTRAINT legal_invoices_workspace_booking_payment_fk
    FOREIGN KEY (workspace_id, booking_payment_id)
    REFERENCES public.booking_payments(workspace_id, id)
    ON DELETE SET NULL (booking_payment_id)
    NOT VALID;

  ALTER TABLE public.legal_invoices
    VALIDATE CONSTRAINT legal_invoices_workspace_booking_fk;
  ALTER TABLE public.legal_invoices
    VALIDATE CONSTRAINT legal_invoices_workspace_booking_payment_fk;

  ALTER TABLE public.legal_invoice_lines
    DROP CONSTRAINT IF EXISTS legal_invoice_lines_invoice_id_fkey,
    DROP CONSTRAINT IF EXISTS legal_invoice_lines_workspace_invoice_fk;

  ALTER TABLE public.legal_invoice_lines
    ADD CONSTRAINT legal_invoice_lines_workspace_invoice_fk
    FOREIGN KEY (workspace_id, invoice_id)
    REFERENCES public.legal_invoices(workspace_id, id)
    ON DELETE CASCADE
    NOT VALID;

  ALTER TABLE public.legal_invoice_lines
    VALIDATE CONSTRAINT legal_invoice_lines_workspace_invoice_fk;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_invoices_workspace_booking_payment_key'
      AND conrelid = 'public.legal_invoices'::regclass
  ) THEN
    ALTER TABLE public.legal_invoices
      ADD CONSTRAINT legal_invoices_workspace_booking_payment_key
      UNIQUE (workspace_id, booking_payment_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'legal_invoice_lines_workspace_invoice_sort_key'
      AND conrelid = 'public.legal_invoice_lines'::regclass
  ) THEN
    ALTER TABLE public.legal_invoice_lines
      ADD CONSTRAINT legal_invoice_lines_workspace_invoice_sort_key
      UNIQUE (workspace_id, invoice_id, sort_order);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS legal_invoices_workspace_booking_idx
  ON public.legal_invoices (workspace_id, booking_id)
  WHERE booking_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_legal_invoice_booking_payment_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  payment_booking_id uuid;
BEGIN
  IF NEW.booking_payment_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.booking_id IS NULL THEN
    -- Deleting a reservation can execute its invoice SET NULL action before
    -- the cascaded booking-payment delete detaches booking_payment_id. Permit
    -- only that FK-driven transient state; the payment action will complete in
    -- the same transaction and ordinary invoice updates remain rejected.
    IF TG_OP = 'UPDATE'
       AND OLD.booking_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.booking_reservations AS reservation
         WHERE reservation.workspace_id = OLD.workspace_id
           AND reservation.id = OLD.booking_id
       ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A booking-linked payment invoice requires booking_id.' USING ERRCODE = '23514';
  END IF;

  SELECT payment.reservation_id INTO payment_booking_id
  FROM public.booking_payments AS payment
  WHERE payment.workspace_id = NEW.workspace_id
    AND payment.id = NEW.booking_payment_id;

  IF payment_booking_id IS NULL OR payment_booking_id IS DISTINCT FROM NEW.booking_id THEN
    RAISE EXCEPTION 'Invoice booking_payment_id does not belong to booking_id.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_legal_invoice_booking_payment_consistency ON public.legal_invoices;
CREATE TRIGGER tg_legal_invoice_booking_payment_consistency
BEFORE INSERT OR UPDATE OF workspace_id, booking_id, booking_payment_id
ON public.legal_invoices
FOR EACH ROW
EXECUTE FUNCTION public.tg_legal_invoice_booking_payment_consistency();

REVOKE ALL ON FUNCTION public.tg_legal_invoice_booking_payment_consistency() FROM PUBLIC;
