#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
scan_target="${1:-$repo_root/.next}"

for required_command in find gitleaks node rg trufflehog; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Generated-output scan blocked: '$required_command' is required." >&2
    exit 1
  }
done

if [[ ! -d "$scan_target" || -L "$scan_target" ]]; then
  echo "Generated-output scan blocked: target must be a real directory." >&2
  exit 1
fi
scan_target="$(cd "$scan_target" && pwd -P)"

unsafe_object="$(find "$scan_target" \( -type l -o \( ! -type d ! -type f \) \) -print -quit)"
if [[ -n "$unsafe_object" ]]; then
  echo "Generated-output scan blocked: unsafe object detected: $unsafe_object" >&2
  exit 1
fi

# Third-party dependencies are independently audited from package-lock.json and
# the installed source tree. Scan only text-bearing application output here so
# native libraries and public dependency fixtures cannot make the build gate
# non-deterministic. Cache entries and static media are generated or copied
# artifacts, not executable application bundles. Next also inlines the tracked
# PNG bytes for the two App Router icon handlers into generated JavaScript;
# those exact handlers are treated as binary asset output, while every other
# JavaScript route remains in the scan surface.
scan_surface="$(mktemp -d "${TMPDIR:-/tmp}/isystem-generated-scan.XXXXXX")"
cleanup() {
  rm -rf -- "$scan_surface"
}
trap cleanup EXIT INT TERM

copied_files=0
while IFS= read -r -d '' generated_file; do
  relative_path="${generated_file#"$scan_target"/}"
  destination="$scan_surface/$relative_path"
  mkdir -p "$(dirname "$destination")"
  cp "$generated_file" "$destination"
  copied_files=$((copied_files + 1))
done < <(
  find "$scan_target" -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/cache/*' \
    ! -path '*/static/media/*' \
    ! -path '*/server/app/icon.png/route.js' \
    ! -path '*/server/app/apple-icon.png/route.js' \
    \( \
      -name '*.cjs' -o \
      -name '*.css' -o \
      -name '*.html' -o \
      -name '*.js' -o \
      -name '*.json' -o \
      -name '*.map' -o \
      -name '*.mjs' -o \
      -name '*.txt' -o \
      -name '*.xml' \
    \) \
    -print0
)

if ((copied_files == 0)); then
  echo "Generated-output scan blocked: no text-bearing build artifacts were found." >&2
  exit 1
fi

bash "$repo_root/scripts/scan-public-secrets.sh" "$scan_surface"

# Next generates per-build preview/server-action keys in a small set of
# manifests. Gitleaks correctly recognizes their shape, so capture its report
# privately and allow only those exact Next-owned fields plus one proven
# minifier identifier false-positive. Every other finding remains fatal.
gitleaks_report="$scan_surface/.gitleaks-generated-report.json"
set +e
gitleaks dir \
  --no-banner \
  --exit-code 1 \
  --report-format json \
  --report-path "$gitleaks_report" \
  "$scan_surface"
gitleaks_status=$?
set -e
if ((gitleaks_status != 0 && gitleaks_status != 1)); then
  echo "Generated-output scan blocked: Gitleaks failed with status $gitleaks_status." >&2
  exit "$gitleaks_status"
fi
node "$repo_root/scripts/review-generated-gitleaks.mjs" \
  "$gitleaks_report" \
  "$scan_surface"
rm -f -- "$gitleaks_report"

trufflehog filesystem \
  --no-update \
  --no-verification \
  --fail \
  --fail-on-scan-errors \
  --force-skip-binaries \
  "$scan_surface"

echo "Generated-output secret scan passed ($copied_files text artifacts)."
