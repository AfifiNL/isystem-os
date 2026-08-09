BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(47);

-- PII/evidence tables are service-only. Test both the table ACL and the
-- absence of an RLS policy that could accidentally become reachable if a
-- future grant is broadened.
SELECT extensions.ok(
  COALESCE(
    NOT pg_catalog.has_table_privilege(
      protected_table.role_name,
      pg_catalog.format('public.%I', protected_table.table_name),
      'SELECT'
    ),
    false
  ),
  pg_catalog.format(
    '%s cannot SELECT public.%I',
    protected_table.role_name,
    protected_table.table_name
  )
)
FROM (
  VALUES
    ('anon', 'contact_inquiries'),
    ('authenticated', 'contact_inquiries'),
    ('anon', 'transactional_email_jobs'),
    ('authenticated', 'transactional_email_jobs'),
    ('anon', 'payment_webhook_events'),
    ('authenticated', 'payment_webhook_events'),
    ('anon', 'payment_webhook_delivery_attempts'),
    ('authenticated', 'payment_webhook_delivery_attempts')
) AS protected_table(role_name, table_name);

SELECT extensions.ok(
  COALESCE(
    pg_catalog.has_table_privilege(
      'service_role',
      pg_catalog.format('public.%I', service_privilege.table_name),
      service_privilege.required_privilege
    ),
    false
  ),
  pg_catalog.format(
    'service_role retains %s on public.%I',
    service_privilege.required_privilege,
    service_privilege.table_name
  )
)
FROM (
  VALUES
    ('contact_inquiries', 'SELECT'),
    ('contact_inquiries', 'INSERT'),
    ('contact_inquiries', 'UPDATE'),
    ('contact_inquiries', 'DELETE'),
    ('transactional_email_jobs', 'SELECT'),
    ('transactional_email_jobs', 'INSERT'),
    ('transactional_email_jobs', 'UPDATE'),
    ('transactional_email_jobs', 'DELETE'),
    ('payment_webhook_events', 'SELECT'),
    ('payment_webhook_events', 'INSERT'),
    ('payment_webhook_events', 'UPDATE'),
    ('payment_webhook_delivery_attempts', 'SELECT'),
    ('payment_webhook_delivery_attempts', 'INSERT')
) AS service_privilege(table_name, required_privilege);

SELECT extensions.ok(
  COALESCE((
    SELECT relation.relrowsecurity
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = protected_table.table_name
  ), false),
  pg_catalog.format(
    'RLS is enabled on public.%I',
    protected_table.table_name
  )
)
FROM (
  VALUES
    ('contact_inquiries'),
    ('transactional_email_jobs'),
    ('payment_webhook_events'),
    ('payment_webhook_delivery_attempts')
) AS protected_table(table_name);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = protected_table.table_name
      AND (
        0::oid = ANY (policy.polroles)
        OR (
          SELECT role_row.oid
          FROM pg_catalog.pg_roles AS role_row
          WHERE role_row.rolname = 'anon'
        ) = ANY (policy.polroles)
        OR (
          SELECT role_row.oid
          FROM pg_catalog.pg_roles AS role_row
          WHERE role_row.rolname = 'authenticated'
        ) = ANY (policy.polroles)
      )
  ),
  pg_catalog.format(
    'public.%I has no anon, authenticated, or PUBLIC policy',
    protected_table.table_name
  )
)
FROM (
  VALUES
    ('contact_inquiries'),
    ('transactional_email_jobs'),
    ('payment_webhook_events'),
    ('payment_webhook_delivery_attempts')
) AS protected_table(table_name);

-- PostgreSQL 15+ column-target SET NULL is essential here: workspace_id stays
-- populated when a booking/payment is removed, and is detached separately
-- only when its workspace parent is removed.
SELECT extensions.ok(
  COALESCE((
    SELECT
      constraint_row.contype = 'f'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
        LIKE pg_catalog.format(
          '%%ON DELETE SET NULL (%s)%%',
          tenant_fk.nullable_column
        )
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = pg_catalog.to_regclass(
      pg_catalog.format('public.%I', tenant_fk.table_name)
    )
      AND constraint_row.conname = tenant_fk.constraint_name
  ), false),
  pg_catalog.format(
    '%s uses column-target SET NULL for %s',
    tenant_fk.constraint_name,
    tenant_fk.nullable_column
  )
)
FROM (
  VALUES
    ('payment_webhook_events', 'payment_webhook_events_workspace_payment_fk', 'booking_payment_id'),
    ('payment_webhook_events', 'payment_webhook_events_workspace_reservation_fk', 'reservation_id'),
    ('payment_webhook_delivery_attempts', 'payment_webhook_attempts_workspace_payment_fk', 'booking_payment_id'),
    ('payment_webhook_delivery_attempts', 'payment_webhook_attempts_workspace_reservation_fk', 'reservation_id'),
    ('legal_invoices', 'legal_invoices_workspace_booking_fk', 'booking_id'),
    ('legal_invoices', 'legal_invoices_workspace_booking_payment_fk', 'booking_payment_id')
) AS tenant_fk(table_name, constraint_name, nullable_column);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.transactional_email_jobs'::regclass
      AND constraint_row.contype = 'u'
      AND constraint_row.conkey = ARRAY[(
        SELECT attribute.attnum
        FROM pg_catalog.pg_attribute AS attribute
        WHERE attribute.attrelid = 'public.transactional_email_jobs'::regclass
          AND attribute.attname = 'idempotency_key'
      )]::smallint[]
  ),
  'legacy global transactional-email idempotency uniqueness is absent'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.transactional_email_jobs'::regclass
      AND constraint_row.contype = 'u'
      AND constraint_row.conkey = ARRAY[
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.transactional_email_jobs'::regclass
            AND attribute.attname = 'workspace_id'
        ),
        (
          SELECT attribute.attnum
          FROM pg_catalog.pg_attribute AS attribute
          WHERE attribute.attrelid = 'public.transactional_email_jobs'::regclass
            AND attribute.attname = 'idempotency_key'
        )
      ]::smallint[]
  ),
  'transactional-email idempotency is workspace scoped'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_row
    JOIN pg_catalog.pg_class AS index_relation
      ON index_relation.oid = index_row.indexrelid
    WHERE index_relation.relname = 'workspace_workflow_runs_idempotency_unique'
      AND index_row.indrelid = 'public.workspace_workflow_runs'::regclass
      AND index_row.indisunique
      AND index_row.indpred IS NULL
  ),
  'workflow-run idempotency index is unique and inferable by PostgREST'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.booking_reservations'::regclass
      AND constraint_row.conname = 'booking_reservations_resource_no_overlap'
  ),
  'legacy single-capacity exclusion constraint is absent'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.booking_reservations'::regclass
      AND trigger_row.tgname = 'prevent_booking_single_service_overlap'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  ),
  'capacity-aware reservation trigger is enabled'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = pg_catalog.to_regclass(
      pg_catalog.format('public.%I', meeting_trigger.table_name)
    )
      AND trigger_row.tgname = meeting_trigger.trigger_name
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  ),
  pg_catalog.format('%s is enabled', meeting_trigger.trigger_name)
)
FROM (
  VALUES
    ('booking_reservations', 'booking_reservations_confirmed_meeting_ready'),
    ('booking_meetings', 'booking_meetings_preserve_confirmed_ready'),
    ('booking_services', 'booking_services_preserve_confirmed_meetings')
) AS meeting_trigger(table_name, trigger_name);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.legal_invoices'::regclass
      AND trigger_row.tgname = 'tg_legal_invoice_booking_payment_consistency'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  ),
  'booking-payment invoice consistency trigger is enabled'
);

SELECT extensions.ok(
  (
    SELECT pg_catalog.count(DISTINCT migration.version) = 13
    FROM supabase_migrations.schema_migrations AS migration
    WHERE migration.version::text = ANY (ARRAY[
      '20260727223000',
      '20260729120000',
      '20260729123000',
      '20260729133000',
      '20260729134000',
      '20260804031500',
      '20260804120000',
      '20260806110000',
      '20260806130000',
      '20260806160000',
      '20260806170000',
      '20260809120000',
      '20260809150000'
    ])
  ),
  'all public-candidate migrations are present in the migration ledger'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type AS type_row
    JOIN pg_catalog.pg_enum AS enum_row
      ON enum_row.enumtypid = type_row.oid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = type_row.typnamespace
    WHERE namespace.nspname = 'public'
      AND type_row.typname = 'booking_notification_event_type'
      AND enum_row.enumlabel = required_enum.enum_label
  ),
  pg_catalog.format(
    'booking notification enum contains %s',
    required_enum.enum_label
  )
)
FROM (
  VALUES
    ('payment_expired'),
    ('meeting_ready')
) AS required_enum(enum_label);

SELECT * FROM extensions.finish();

ROLLBACK;
