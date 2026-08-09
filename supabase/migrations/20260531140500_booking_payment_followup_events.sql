-- Adds explicit paid-booking notification lifecycle events so Revolut Pro
-- payment requests/reminders/cancellations are auditable separately from real
-- booking confirmations.

BEGIN;

ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'payment_requested';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'payment_reminder';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'payment_expired';

COMMIT;
