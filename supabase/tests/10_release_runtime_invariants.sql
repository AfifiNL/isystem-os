BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(30);

CREATE OR REPLACE FUNCTION pg_temp.release_sql_raises(
  statement_sql text,
  expected_state text,
  expected_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  caught_state text;
  caught_message text;
BEGIN
  EXECUTE statement_sql;
  RETURN false;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      caught_state = RETURNED_SQLSTATE,
      caught_message = MESSAGE_TEXT;
    RETURN caught_state = expected_state
      AND (expected_message IS NULL OR caught_message = expected_message);
END;
$$;

-- Catalog assertions in 00_release_schema_contracts.sql prevent privilege and
-- policy drift. These probes additionally execute real SELECT statements as
-- each public API role and require PostgreSQL's permission-denied SQLSTATE.
-- The grants below expose only the rollback-local test helper and pgTAP
-- assertion function; they do not grant access to any application table.
-- Temporary schemas are session-owned and cannot be granted as `pg_temp`.
-- Temporary functions retain PUBLIC EXECUTE for this rollback-only probe.
GRANT EXECUTE ON FUNCTION extensions.ok(boolean, text)
  TO anon, authenticated;

SET LOCAL ROLE anon;

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.contact_inquiries LIMIT 1',
    '42501'
  ),
  'anon receives permission denied for contact inquiry PII'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.transactional_email_jobs LIMIT 1',
    '42501'
  ),
  'anon receives permission denied for transactional email bodies'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.payment_webhook_events LIMIT 1',
    '42501'
  ),
  'anon receives permission denied for canonical webhook evidence'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.payment_webhook_delivery_attempts LIMIT 1',
    '42501'
  ),
  'anon receives permission denied for webhook delivery evidence'
);

RESET ROLE;
SET LOCAL ROLE authenticated;

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.contact_inquiries LIMIT 1',
    '42501'
  ),
  'authenticated receives permission denied for contact inquiry PII'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.transactional_email_jobs LIMIT 1',
    '42501'
  ),
  'authenticated receives permission denied for transactional email bodies'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.payment_webhook_events LIMIT 1',
    '42501'
  ),
  'authenticated receives permission denied for canonical webhook evidence'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    'SELECT 1 FROM public.payment_webhook_delivery_attempts LIMIT 1',
    '42501'
  ),
  'authenticated receives permission denied for webhook delivery evidence'
);

RESET ROLE;

INSERT INTO public.workspaces (id, slug, name, legacy_template_id)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'release-sql-test-a', 'Release SQL Test A', 'facility-services'),
  ('10000000-0000-4000-8000-000000000002', 'release-sql-test-b', 'Release SQL Test B', 'creative-agency');

INSERT INTO public.booking_template_profiles (
  id,
  workspace_id,
  profile_key,
  template_key,
  status
)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'release-test',
  'consultation',
  'active'
);

INSERT INTO public.booking_services (
  id,
  workspace_id,
  template_profile_id,
  service_key,
  service_type,
  title,
  duration_minutes,
  capacity_mode,
  capacity_value,
  location_mode,
  visibility_status,
  virtual_meeting_provider,
  auto_create_virtual_meeting
)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'release-test-service',
  'consultation',
  'Release test service',
  60,
  'group',
  3,
  'remote',
  'published',
  'google_meet',
  true
);

-- Workspace-scoped idempotency must support the same logical delivery key in
-- two tenants while rejecting a replay inside one tenant.
INSERT INTO public.transactional_email_jobs (
  id,
  workspace_id,
  aggregate_type,
  event_type,
  recipient_role,
  recipient_email,
  from_email,
  subject,
  html_body,
  idempotency_key
)
VALUES
  (
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'release_test',
    'created',
    'customer',
    'customer@example.invalid',
    'sender@example.invalid',
    'Release test',
    '<p>Release test</p>',
    'shared-logical-key'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'release_test',
    'created',
    'customer',
    'customer@example.invalid',
    'sender@example.invalid',
    'Release test',
    '<p>Release test</p>',
    'shared-logical-key'
  );

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 2
    FROM public.transactional_email_jobs
    WHERE idempotency_key = 'shared-logical-key'
  ),
  'the same transactional-email key is accepted in two workspaces'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      INSERT INTO public.transactional_email_jobs (
        workspace_id,
        aggregate_type,
        event_type,
        recipient_role,
        recipient_email,
        from_email,
        subject,
        html_body,
        idempotency_key
      ) VALUES (
        '10000000-0000-4000-8000-000000000001',
        'release_test',
        'created',
        'customer',
        'duplicate@example.invalid',
        'sender@example.invalid',
        'Duplicate',
        '<p>Duplicate</p>',
        'shared-logical-key'
      )
    $test$,
    '23505'
  ),
  'a transactional-email replay inside one workspace is rejected'
);

INSERT INTO public.booking_reservations (
  id,
  workspace_id,
  template_profile_id,
  service_id,
  public_reference,
  customer_full_name,
  customer_email,
  reservation_timezone,
  scheduled_start,
  scheduled_end,
  status,
  capacity_mode_snapshot,
  capacity_value_snapshot
)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'REL-FK-0001',
  'Release Test Customer',
  'customer@example.invalid',
  'UTC',
  '2030-01-01 09:00:00+00',
  '2030-01-01 10:00:00+00',
  'pending_confirmation',
  'group',
  3
);

INSERT INTO public.booking_payments (
  id,
  workspace_id,
  reservation_id,
  provider,
  status,
  amount_cents,
  currency,
  payment_reference,
  pricing_version
)
VALUES (
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'release_test',
  'requested',
  10000,
  'EUR',
  'REL-PAY-0001',
  'release-test-v1'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      INSERT INTO public.payment_webhook_events (
        workspace_id,
        booking_payment_id,
        reservation_id,
        provider,
        provider_event_id,
        provider_event_type
      ) VALUES (
        '10000000-0000-4000-8000-000000000002',
        '60000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001',
        'release_test',
        'cross-tenant-event',
        'payment.created'
      )
    $test$,
    '23503'
  ),
  'canonical webhook evidence rejects cross-workspace booking parents'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      INSERT INTO public.payment_webhook_delivery_attempts (
        workspace_id,
        booking_payment_id,
        reservation_id,
        provider,
        provider_event_id,
        provider_event_type,
        verification_status,
        verification_mode
      ) VALUES (
        '10000000-0000-4000-8000-000000000002',
        '60000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001',
        'release_test',
        'cross-tenant-attempt',
        'payment.created',
        'verified',
        'postback'
      )
    $test$,
    '23503'
  ),
  'webhook delivery evidence rejects cross-workspace booking parents'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      INSERT INTO public.legal_invoices (
        workspace_id,
        client_name,
        booking_id
      ) VALUES (
        '10000000-0000-4000-8000-000000000002',
        'Cross-tenant release test',
        '50000000-0000-4000-8000-000000000001'
      )
    $test$,
    '23503'
  ),
  'legal invoices reject a cross-workspace booking parent'
);

INSERT INTO public.payment_webhook_events (
  id,
  workspace_id,
  booking_payment_id,
  reservation_id,
  provider,
  provider_event_id,
  provider_event_type,
  verification_status,
  verification_mode
)
VALUES (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'release_test',
  'release-event-0001',
  'payment.created',
  'verified',
  'postback'
);

INSERT INTO public.payment_webhook_delivery_attempts (
  id,
  workspace_id,
  booking_payment_id,
  reservation_id,
  provider,
  provider_event_id,
  provider_event_type,
  verification_status,
  verification_mode
)
VALUES (
  '71000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'release_test',
  'release-event-0001',
  'payment.created',
  'verified',
  'postback'
);

INSERT INTO public.legal_invoices (
  id,
  workspace_id,
  client_name,
  currency,
  subtotal_cents,
  btw_total_cents,
  total_cents,
  booking_id,
  booking_payment_id
)
VALUES (
  '72000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Release Test Customer',
  'EUR',
  10000,
  0,
  10000,
  '50000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      UPDATE public.payment_webhook_events
      SET booking_payment_id = NULL
      WHERE id = '70000000-0000-4000-8000-000000000001'
    $test$,
    'P0001'
  ),
  'canonical webhook relationships cannot be detached manually'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      UPDATE public.payment_webhook_delivery_attempts
      SET booking_payment_id = NULL
      WHERE id = '71000000-0000-4000-8000-000000000001'
    $test$,
    'P0001'
  ),
  'webhook attempt relationships cannot be detached manually'
);

-- This single delete exercises both direct reservation SET NULL and the
-- cascaded payment delete. The invoice trigger must accept only the transient
-- FK action order while preserving the financial record.
DELETE FROM public.booking_reservations
WHERE id = '50000000-0000-4000-8000-000000000001';

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.booking_payments
    WHERE id = '60000000-0000-4000-8000-000000000001'
  ),
  'reservation deletion cascades to its payment'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.legal_invoices
    WHERE id = '72000000-0000-4000-8000-000000000001'
      AND booking_id IS NULL
      AND booking_payment_id IS NULL
  ),
  'reservation/payment deletion preserves and detaches the invoice'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.payment_webhook_events
    WHERE id = '70000000-0000-4000-8000-000000000001'
      AND workspace_id = '10000000-0000-4000-8000-000000000001'
      AND booking_payment_id IS NULL
      AND reservation_id IS NULL
  ),
  'reservation/payment deletion preserves and detaches canonical webhook evidence'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.payment_webhook_delivery_attempts
    WHERE id = '71000000-0000-4000-8000-000000000001'
      AND workspace_id = '10000000-0000-4000-8000-000000000001'
      AND booking_payment_id IS NULL
      AND reservation_id IS NULL
  ),
  'reservation/payment deletion preserves and detaches webhook attempt evidence'
);

-- A confirmed remote booking must have a ready HTTPS meeting for the service's
-- configured provider, and that contract must survive meeting/service edits.
INSERT INTO public.booking_reservations (
  id,
  workspace_id,
  template_profile_id,
  service_id,
  public_reference,
  customer_full_name,
  customer_email,
  reservation_timezone,
  scheduled_start,
  scheduled_end,
  status,
  capacity_mode_snapshot,
  capacity_value_snapshot
)
VALUES
  (
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'REL-MEET-NO-ROOM',
    'No Room Customer',
    'no-room@example.invalid',
    'UTC',
    '2030-01-02 09:00:00+00',
    '2030-01-02 10:00:00+00',
    'pending_confirmation',
    'group',
    3
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'REL-MEET-READY',
    'Ready Room Customer',
    'ready-room@example.invalid',
    'UTC',
    '2030-01-02 11:00:00+00',
    '2030-01-02 12:00:00+00',
    'pending_confirmation',
    'group',
    3
  );

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      UPDATE public.booking_reservations
      SET status = 'confirmed'
      WHERE id = '50000000-0000-4000-8000-000000000002'
    $test$,
    '23514',
    'Remote reservation cannot be confirmed before its customer meeting is ready.'
  ),
  'confirmation is rejected without a ready configured-provider meeting'
);

INSERT INTO public.booking_meetings (
  id,
  workspace_id,
  reservation_id,
  provider,
  provider_meeting_id,
  join_url,
  status,
  scheduled_start,
  scheduled_end
)
VALUES (
  '80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000003',
  'google_meet',
  'release-meeting-0001',
  'https://meet.example.invalid/release-test',
  'ready',
  '2030-01-02 11:00:00+00',
  '2030-01-02 12:00:00+00'
);

UPDATE public.booking_reservations
SET status = 'confirmed'
WHERE id = '50000000-0000-4000-8000-000000000003';

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.booking_reservations
    WHERE id = '50000000-0000-4000-8000-000000000003'
      AND status = 'confirmed'
  ),
  'confirmation succeeds with a ready configured-provider meeting'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      DELETE FROM public.booking_meetings
      WHERE id = '80000000-0000-4000-8000-000000000001'
    $test$,
    '23514',
    'A confirmed remote reservation must retain its ready customer meeting.'
  ),
  'the last ready meeting cannot be removed from a confirmed remote booking'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      UPDATE public.booking_services
      SET virtual_meeting_provider = 'zoom'
      WHERE id = '30000000-0000-4000-8000-000000000001'
    $test$,
    '23514',
    'Meeting-provider changes require every confirmed reservation to retain a ready room for the new provider.'
  ),
  'service provider cannot change while confirmed bookings lack the new room'
);

UPDATE public.booking_services
SET auto_create_virtual_meeting = false
WHERE id = '30000000-0000-4000-8000-000000000001';

DELETE FROM public.booking_meetings
WHERE id = '80000000-0000-4000-8000-000000000001';

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM public.booking_meetings
    WHERE id = '80000000-0000-4000-8000-000000000001'
  ),
  'meeting removal is allowed after automatic provisioning is disabled'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      UPDATE public.booking_services
      SET auto_create_virtual_meeting = true
      WHERE id = '30000000-0000-4000-8000-000000000001'
    $test$,
    '23514',
    'Meeting-provider changes require every confirmed reservation to retain a ready room for the new provider.'
  ),
  'automatic provisioning cannot be re-enabled over a confirmed booking without a ready room'
);

-- Group capacity allows total party size up to the snapshotted limit. The
-- half-open time range also allows an adjacent booking at the exact boundary.
INSERT INTO public.booking_reservations (
  id,
  workspace_id,
  template_profile_id,
  service_id,
  public_reference,
  customer_full_name,
  customer_email,
  party_size,
  reservation_timezone,
  scheduled_start,
  scheduled_end,
  status,
  capacity_mode_snapshot,
  capacity_value_snapshot
)
VALUES
  (
    '90000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'REL-CAPACITY-1',
    'Capacity Customer One',
    'capacity-one@example.invalid',
    2,
    'UTC',
    '2030-01-03 09:00:00+00',
    '2030-01-03 10:00:00+00',
    'pending_confirmation',
    'group',
    3
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'REL-CAPACITY-2',
    'Capacity Customer Two',
    'capacity-two@example.invalid',
    1,
    'UTC',
    '2030-01-03 09:00:00+00',
    '2030-01-03 10:00:00+00',
    'pending_confirmation',
    'group',
    3
  );

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(*) = 2
    FROM public.booking_reservations
    WHERE id = ANY (ARRAY[
      '90000000-0000-4000-8000-000000000001'::uuid,
      '90000000-0000-4000-8000-000000000002'::uuid
    ])
  ),
  'overlapping group reservations are accepted exactly up to capacity'
);

SELECT extensions.ok(
  pg_temp.release_sql_raises(
    $test$
      INSERT INTO public.booking_reservations (
        id,
        workspace_id,
        template_profile_id,
        service_id,
        public_reference,
        customer_full_name,
        customer_email,
        party_size,
        reservation_timezone,
        scheduled_start,
        scheduled_end,
        status,
        capacity_mode_snapshot,
        capacity_value_snapshot
      ) VALUES (
        '90000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
        'REL-CAPACITY-3',
        'Capacity Customer Three',
        'capacity-three@example.invalid',
        1,
        'UTC',
        '2030-01-03 09:00:00+00',
        '2030-01-03 10:00:00+00',
        'pending_confirmation',
        'group',
        3
      )
    $test$,
    '23P01',
    'The booking service has no remaining capacity for this slot.'
  ),
  'an overlapping reservation above group capacity is rejected'
);

INSERT INTO public.booking_reservations (
  id,
  workspace_id,
  template_profile_id,
  service_id,
  public_reference,
  customer_full_name,
  customer_email,
  party_size,
  reservation_timezone,
  scheduled_start,
  scheduled_end,
  status,
  capacity_mode_snapshot,
  capacity_value_snapshot
)
VALUES (
  '90000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'REL-CAPACITY-3',
  'Capacity Customer Three',
  'capacity-three@example.invalid',
  1,
  'UTC',
  '2030-01-03 10:00:00+00',
  '2030-01-03 11:00:00+00',
  'pending_confirmation',
  'group',
  3
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.booking_reservations
    WHERE id = '90000000-0000-4000-8000-000000000003'
  ),
  'an adjacent half-open slot is accepted at the capacity boundary'
);

DELETE FROM public.workspaces
WHERE id = '10000000-0000-4000-8000-000000000001';

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.payment_webhook_events
    WHERE id = '70000000-0000-4000-8000-000000000001'
      AND workspace_id IS NULL
      AND booking_payment_id IS NULL
      AND reservation_id IS NULL
  ),
  'workspace deletion preserves canonical webhook evidence and detaches all parents'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM public.payment_webhook_delivery_attempts
    WHERE id = '71000000-0000-4000-8000-000000000001'
      AND workspace_id IS NULL
      AND booking_payment_id IS NULL
      AND reservation_id IS NULL
  ),
  'workspace deletion preserves webhook attempt evidence and detaches all parents'
);

SELECT * FROM extensions.finish();

ROLLBACK;
