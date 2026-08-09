-- ============================================================================
-- Newsletter compliance + deliverability hardening
-- ============================================================================
-- Adds the schema required for:
--   • CAN-SPAM / GDPR-compliant unsubscribe (token + endpoint + List-Unsubscribe)
--   • Double opt-in (pending status + verification token + confirmed_at)
--   • Bounce/complaint suppression (status extension, no separate suppression table)
--   • Partial-send honesty (campaign status enum extension)
--   • Webhook delay tracking (recipient send_status extension)
--
-- This is a CORE migration. It is universal across all client forks; safe to
-- merge down into every client/* branch. Per-client DBs apply it independently
-- via supabase db push; no data loss for existing rows because:
--   • new columns are nullable / token-defaulted
--   • CHECK constraints extend the allowed set, never shrink it
--   • backfill targets existing rows so they pass the new constraint
-- ============================================================================

BEGIN;

-- 1) newsletter_contacts: add `pending` status + verification + unsubscribe tokens
ALTER TABLE public.newsletter_contacts
  DROP CONSTRAINT IF EXISTS newsletter_contacts_status_check;

ALTER TABLE public.newsletter_contacts
  ADD CONSTRAINT newsletter_contacts_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'subscribed'::text,
    'unsubscribed'::text,
    'bounced'::text,
    'complained'::text
  ]));

ALTER TABLE public.newsletter_contacts
  ADD COLUMN IF NOT EXISTS verification_token text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS complained_at timestamptz;

-- Backfill: every existing subscriber already opted-in implicitly, mark
-- verified_at so the new double-opt-in path doesn't re-prompt them.
UPDATE public.newsletter_contacts
SET verified_at = COALESCE(verified_at, subscribed_at, created_at, now())
WHERE status = 'subscribed' AND verified_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_contacts_unsubscribe_token_idx
  ON public.newsletter_contacts (unsubscribe_token);

CREATE INDEX IF NOT EXISTS newsletter_contacts_verification_token_idx
  ON public.newsletter_contacts (verification_token)
  WHERE verification_token IS NOT NULL;

-- 2) newsletter_campaigns: add partial_sent so the dispatcher can honestly
-- record a campaign that timed out mid-send instead of flipping straight
-- to "sent". `failed` and the existing terminals stay valid.
ALTER TABLE public.newsletter_campaigns
  DROP CONSTRAINT IF EXISTS newsletter_campaigns_status_check;

ALTER TABLE public.newsletter_campaigns
  ADD CONSTRAINT newsletter_campaigns_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'scheduled'::text,
    'sending'::text,
    'partial_sent'::text,
    'sent'::text,
    'paused'::text,
    'failed'::text,
    'cancelled'::text
  ]));

-- 3) newsletter_campaign_recipients: add `delayed` for email.delivery_delayed
-- webhook events so the operator dashboard can distinguish in-flight from
-- terminal states. `last_error` stays for failed/bounced detail.
ALTER TABLE public.newsletter_campaign_recipients
  DROP CONSTRAINT IF EXISTS newsletter_campaign_recipients_send_status_check;

ALTER TABLE public.newsletter_campaign_recipients
  ADD CONSTRAINT newsletter_campaign_recipients_send_status_check
  CHECK (send_status = ANY (ARRAY[
    'pending'::text,
    'sent'::text,
    'delivered'::text,
    'opened'::text,
    'clicked'::text,
    'delayed'::text,
    'bounced'::text,
    'complained'::text,
    'unsubscribed'::text,
    'failed'::text
  ]));

COMMIT;
