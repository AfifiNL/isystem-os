-- SLA overdue engine — structured frequency for read-time overdue computation.
--
-- Before this migration, cleaning_schedules.frequency was a free-text label
-- like "Monthly" and there was no concept of "due date" or "overdue". A task
-- with status='compliant' from 18 months ago still counted as compliant. The
-- SLA percentage was a manual hygiene number, not a meaningful health metric.
--
-- Design: we add **structured** frequency fields and compute `due_at` and
-- `is_overdue` at READ time in the application layer — no cron, no triggers,
-- no persisted-then-stale "is_overdue" column. Status drift is impossible
-- because nothing is persisted that can drift.
--
-- - `frequency_kind`: enumerated cadence with a defined interval-in-days
-- - `frequency_value_days`: optional override for custom intervals (used when
--   kind = 'custom'; allows e.g. 45-day intervals without polluting the enum)
-- - `grace_period_days`: buffer before a task transitions from "due" to
--   "overdue" in the UI. Defaults to 0 so existing tasks behave strictly.
--
-- The legacy free-text `frequency` column is **kept** for display and to
-- preserve manager-entered labels, but it is no longer used for computation.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cleaning_schedule_frequency_kind') THEN
        CREATE TYPE public.cleaning_schedule_frequency_kind AS ENUM (
            'daily',
            'weekly',
            'biweekly',
            'monthly',
            'quarterly',
            'yearly',
            'on_demand',
            'custom'
        );
    END IF;
END $$;

ALTER TABLE public.cleaning_schedules
    ADD COLUMN IF NOT EXISTS frequency_kind public.cleaning_schedule_frequency_kind,
    ADD COLUMN IF NOT EXISTS frequency_value_days integer,
    ADD COLUMN IF NOT EXISTS grace_period_days integer NOT NULL DEFAULT 0;

ALTER TABLE public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_grace_nonnegative
        CHECK (grace_period_days >= 0);

ALTER TABLE public.cleaning_schedules
    ADD CONSTRAINT cleaning_schedules_value_positive
        CHECK (frequency_value_days IS NULL OR frequency_value_days > 0);

-- Backfill from the existing free-text frequency. Case-insensitive match on
-- the values surfaced by the AddTaskForm dropdown plus a few common variants
-- so manager-entered labels don't lose meaning on upgrade. Anything that
-- doesn't match falls through to 'on_demand' (i.e. no due date) — better to
-- be silent than to invent a deadline that wasn't there before.
UPDATE public.cleaning_schedules
SET frequency_kind = CASE
    WHEN frequency IS NULL THEN 'on_demand'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('daily', 'every day', 'each day') THEN 'daily'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('weekly', 'every week') THEN 'weekly'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('bi-weekly', 'biweekly', 'fortnightly', 'every two weeks') THEN 'biweekly'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('monthly', 'every month') THEN 'monthly'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('quarterly', 'every quarter') THEN 'quarterly'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('yearly', 'annually', 'every year') THEN 'yearly'::public.cleaning_schedule_frequency_kind
    WHEN lower(trim(frequency)) IN ('on-demand', 'on demand', 'as needed', 'ad-hoc', 'ad hoc') THEN 'on_demand'::public.cleaning_schedule_frequency_kind
    ELSE 'on_demand'::public.cleaning_schedule_frequency_kind
END
WHERE frequency_kind IS NULL;

-- Once backfilled, enforce on new rows. Default new rows to on_demand so a
-- careless insert never accidentally creates an overdue task.
ALTER TABLE public.cleaning_schedules
    ALTER COLUMN frequency_kind SET DEFAULT 'on_demand',
    ALTER COLUMN frequency_kind SET NOT NULL;

COMMENT ON COLUMN public.cleaning_schedules.frequency IS
    'Free-text label shown to the user. Not used for due-date computation — see frequency_kind.';
COMMENT ON COLUMN public.cleaning_schedules.frequency_kind IS
    'Structured cadence. Application derives due_at = last_completed_at + interval at read time.';
COMMENT ON COLUMN public.cleaning_schedules.frequency_value_days IS
    'Custom interval in days. Required when frequency_kind = custom, otherwise ignored.';
COMMENT ON COLUMN public.cleaning_schedules.grace_period_days IS
    'Days past due before the UI flags a task as overdue.';
