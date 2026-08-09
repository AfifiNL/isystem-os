-- Business OS acceptance hardening: accounting and AI ledger immutability.

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_ai_credit_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ai_credit_ledger is append-only; create a refund or adjustment row instead.';
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.ai_credit_ledger') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS prevent_ai_credit_ledger_mutation ON public.ai_credit_ledger;
    CREATE TRIGGER prevent_ai_credit_ledger_mutation
      BEFORE UPDATE OR DELETE ON public.ai_credit_ledger
      FOR EACH ROW EXECUTE FUNCTION public.prevent_ai_credit_ledger_mutation();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_finalized_accounting_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_closed boolean;
BEGIN
  SELECT p.closed_at IS NOT NULL INTO v_period_closed
  FROM public.accounting_periods p
  WHERE p.id = OLD.period_id;

  IF COALESCE(OLD.reconciled, false) OR COALESCE(v_period_closed, false) THEN
    RAISE EXCEPTION 'Finalized accounting entries are immutable; create an adjustment or credit entry instead.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.accounting_entries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS prevent_finalized_accounting_entry_mutation ON public.accounting_entries;
    CREATE TRIGGER prevent_finalized_accounting_entry_mutation
      BEFORE UPDATE OR DELETE ON public.accounting_entries
      FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_accounting_entry_mutation();
  END IF;
END $$;

COMMIT;
