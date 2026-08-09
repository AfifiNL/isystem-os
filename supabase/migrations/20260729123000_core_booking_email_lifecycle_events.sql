-- Universal booking communication events used by customer and manager email workflows.

ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'reservation_rescheduled';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'reservation_reschedule_requested';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'reservation_no_show';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'payment_refunded';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'appointment_reminder';
ALTER TYPE public.booking_notification_event_type ADD VALUE IF NOT EXISTS 'post_session_followup';
