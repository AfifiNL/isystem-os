#!/usr/bin/env bash

set -euo pipefail

release_db_url="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
case "${release_db_url}" in
  postgresql://*@127.0.0.1:*/* | postgresql://*@localhost:*/* | postgres://*@127.0.0.1:*/* | postgres://*@localhost:*/*)
    ;;
  *)
    echo "Refusing to run the disposable concurrency test against a non-local database URL." >&2
    exit 2
    ;;
esac

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for the two-session capacity test." >&2
  exit 2
fi

release_tmp_dir="$(mktemp -d)"
release_marker="${release_tmp_dir}/first-insert-complete"
release_first_log="${release_tmp_dir}/first-session.log"
release_second_log="${release_tmp_dir}/second-session.log"
release_workspace_id="a0000000-0000-4000-8000-000000000001"
release_first_pid=""

cleanup_release_fixture() {
  if [[ -n "${release_first_pid}" ]] && kill -0 "${release_first_pid}" 2>/dev/null; then
    kill "${release_first_pid}" 2>/dev/null || true
    wait "${release_first_pid}" 2>/dev/null || true
  fi
  psql "${release_db_url}" -X -v ON_ERROR_STOP=1 \
    -c "DELETE FROM public.workspaces WHERE id = '${release_workspace_id}'::uuid" \
    >/dev/null 2>&1 || true
  rm -r -- "${release_tmp_dir}"
}
trap cleanup_release_fixture EXIT

psql "${release_db_url}" -X -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM public.workspaces
WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid;

INSERT INTO public.workspaces (id, slug, name, legacy_template_id)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'release-concurrency-test',
  'Release Concurrency Test',
  'facility-services'
);

INSERT INTO public.booking_template_profiles (
  id,
  workspace_id,
  profile_key,
  template_key,
  status
)
VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'release-concurrency-test',
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
  'a2000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'release-concurrency-test',
  'consultation',
  'Release concurrency test',
  60,
  'group',
  1,
  'onsite',
  'published',
  'none',
  false
);
SQL

(
  psql "${release_db_url}" -X -v ON_ERROR_STOP=1 <<SQL
BEGIN;
SET LOCAL statement_timeout = '15s';
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
  'a3000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'REL-CONCURRENCY-1',
  'Concurrency Customer One',
  'concurrency-one@example.invalid',
  1,
  'UTC',
  '2030-02-01 09:00:00+00',
  '2030-02-01 10:00:00+00',
  'pending_confirmation',
  'group',
  1
);
\! touch "${release_marker}"
SELECT pg_catalog.pg_sleep(3);
COMMIT;
SQL
) >"${release_first_log}" 2>&1 &
release_first_pid=$!

release_wait_attempt=0
until [[ -f "${release_marker}" ]]; do
  if ! kill -0 "${release_first_pid}" 2>/dev/null; then
    wait "${release_first_pid}" || true
    echo "The first booking session exited before it acquired the capacity lock." >&2
    sed -n '1,120p' "${release_first_log}" >&2
    exit 1
  fi
  release_wait_attempt=$((release_wait_attempt + 1))
  if (( release_wait_attempt > 200 )); then
    echo "Timed out waiting for the first booking session." >&2
    exit 1
  fi
  sleep 0.05
done

set +e
psql "${release_db_url}" -X -v ON_ERROR_STOP=1 <<'SQL' >"${release_second_log}" 2>&1
\set VERBOSITY verbose
SET statement_timeout = '15s';
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
  'a3000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'REL-CONCURRENCY-2',
  'Concurrency Customer Two',
  'concurrency-two@example.invalid',
  1,
  'UTC',
  '2030-02-01 09:00:00+00',
  '2030-02-01 10:00:00+00',
  'pending_confirmation',
  'group',
  1
);
SQL
release_second_status=$?
set -e

if ! wait "${release_first_pid}"; then
  echo "The first booking session failed." >&2
  sed -n '1,120p' "${release_first_log}" >&2
  exit 1
fi

if (( release_second_status == 0 )); then
  echo "Concurrent over-capacity booking unexpectedly succeeded." >&2
  exit 1
fi

if ! grep -Eq "23P01|The booking service has no remaining capacity for this slot" "${release_second_log}"; then
  echo "The competing booking failed for an unexpected reason." >&2
  sed -n '1,120p' "${release_second_log}" >&2
  exit 1
fi

release_booking_count="$(
  psql "${release_db_url}" -X -v ON_ERROR_STOP=1 -Atc \
    "SELECT count(*) FROM public.booking_reservations WHERE workspace_id = '${release_workspace_id}'::uuid"
)"

if [[ "${release_booking_count}" != "1" ]]; then
  echo "Expected exactly one committed booking; found ${release_booking_count}." >&2
  exit 1
fi

echo "ok - advisory locking serialized competing bookings and rejected the over-capacity insert"
