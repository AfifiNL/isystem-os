-- Extend booking_notification_delivery_status enum type to support full delivery status lifecycle.
-- PostgreSQL enum values cannot be altered within transaction blocks (BEGIN/COMMIT).
-- Therefore, this migration must be run outside a transaction block.

ALTER TYPE public.booking_notification_delivery_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE public.booking_notification_delivery_status ADD VALUE IF NOT EXISTS 'delayed';
ALTER TYPE public.booking_notification_delivery_status ADD VALUE IF NOT EXISTS 'bounced';
ALTER TYPE public.booking_notification_delivery_status ADD VALUE IF NOT EXISTS 'complained';
