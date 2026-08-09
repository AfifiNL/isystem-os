#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"
# shellcheck source=public-tool-versions.sh
source scripts/public-tool-versions.sh

for required_command in docker psql supabase; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Database release contracts require '$required_command'." >&2
    exit 2
  }
done
if [[ "$(supabase --version)" != "$PUBLIC_SUPABASE_CLI_VERSION" ]]; then
  echo "Database release contracts require Supabase CLI $PUBLIC_SUPABASE_CLI_VERSION." >&2
  exit 2
fi

required_paths=(
  supabase/config.toml
  supabase/tests/00_release_schema_contracts.sql
  supabase/tests/10_release_runtime_invariants.sql
  supabase/tests/20_contact_submission_atomic.sql
  supabase/tests/30_privileged_identity_and_content_security.sql
  supabase/tests/booking_capacity_concurrency.sh
)
for required_path in "${required_paths[@]}"; do
  if [[ ! -s "$required_path" ]]; then
    echo "Database release contract is missing: $required_path" >&2
    exit 1
  fi
done

artifacts_root="$repo_root/artifacts"
if [[ -L "$artifacts_root" || ( -e "$artifacts_root" && ! -d "$artifacts_root" ) ]]; then
  echo "Database evidence requires a real artifacts directory." >&2
  exit 2
fi
mkdir -p "$artifacts_root"

requested_evidence_directory="${1:-}"
if [[ -n "$requested_evidence_directory" ]]; then
  if [[ ! "$requested_evidence_directory" =~ ^artifacts/[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    echo "Database evidence path must be a new, simple directory directly under artifacts/." >&2
    exit 2
  fi
  evidence_directory="$repo_root/$requested_evidence_directory"
  if ! mkdir -m 700 -- "$evidence_directory" 2>/dev/null; then
    echo "Database evidence path must not already exist: $requested_evidence_directory" >&2
    exit 2
  fi
else
  evidence_directory="$(mktemp -d "$artifacts_root/supabase-local-gate.XXXXXX")"
fi
printf 'Disposable public database release evidence.\n' > "$evidence_directory/run.txt"

cleanup_required=0
finish() {
  primary_status=$?
  cleanup_status=0
  trap - EXIT INT TERM

  docker ps -a \
    --filter 'name=supabase_' \
    --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' \
    > "$evidence_directory/docker-containers.txt" 2>&1 || true
  docker logs supabase_db_isystem-os-public-ci \
    > "$evidence_directory/postgres.log" 2>&1 || true

  if ((cleanup_required != 0)); then
    if supabase stop --no-backup --project-id isystem-os-public-ci \
      > "$evidence_directory/cleanup.log" 2>&1; then
      :
    else
      cleanup_status=$?
      echo "Database cleanup failed; inspect $evidence_directory/cleanup.log" >&2
    fi
  else
    printf '%s\n' 'Local stack startup was not attempted.' > "$evidence_directory/cleanup.log"
  fi

  if ((primary_status != 0)); then
    exit "$primary_status"
  fi
  if ((cleanup_status != 0)); then
    exit "$cleanup_status"
  fi
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

set -o pipefail
cleanup_required=1
supabase start >/dev/null 2>&1
printf '%s\n' 'Disposable local Supabase stack started.' > "$evidence_directory/start.log"
supabase db reset --no-seed 2>&1 | tee "$evidence_directory/reset.log"
supabase test db supabase/tests 2>&1 | tee "$evidence_directory/pgtap.log"
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  bash supabase/tests/booking_capacity_concurrency.sh 2>&1 |
  tee "$evidence_directory/concurrency.log"

echo "Disposable migration replay, pgTAP, and capacity concurrency checks passed."
echo "Run-specific database evidence: ${evidence_directory#"$repo_root"/}"
