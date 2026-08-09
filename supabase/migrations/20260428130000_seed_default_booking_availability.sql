--
-- Backfill a default Mon–Fri 09:00–17:00 recurring availability rule for any
-- workspace that has at least one published booking service but no rows in
-- booking_availability_rules. Without this, the public picker correctly
-- reports "No availability rules configured" but operators of pre-existing
-- workspaces have no on-ramp to the new rule-driven walker.
--
-- Idempotency: only inserts when the workspace has zero existing rules.
-- Re-applying is a no-op once any operator has saved a rule (the count
-- check fails) or once this migration has already inserted (same reason).
--
-- New service creation in the application layer (upsertBookingService)
-- handles fresh workspaces directly; this migration only covers the
-- transitional set.

begin;

insert into public.booking_availability_rules (
  workspace_id,
  scope_type,
  rule_type,
  timezone,
  weekday_json,
  date_json,
  time_windows_json,
  priority,
  is_active,
  metadata
)
select
  w.id,
  'workspace',
  'recurring',
  'Europe/Amsterdam',
  '[1,2,3,4,5]'::jsonb,
  '{}'::jsonb,
  '[{"start":"09:00","end":"17:00"}]'::jsonb,
  100,
  true,
  jsonb_build_object('seeded_by', 'migration_20260428130000', 'seeded_at', now())
from public.workspaces w
where exists (
  select 1
  from public.booking_services s
  where s.workspace_id = w.id
)
and not exists (
  select 1
  from public.booking_availability_rules r
  where r.workspace_id = w.id
);

commit;
