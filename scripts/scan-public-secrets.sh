#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scan_target="${1:-$repo_root}"

command -v rg >/dev/null 2>&1 || {
  echo "Secret scan blocked: ripgrep (rg) is required." >&2
  exit 1
}

if [[ ! -d "$scan_target" || -L "$scan_target" ]]; then
  echo "Secret scan blocked: target must be a real directory." >&2
  exit 1
fi
scan_target="$(cd "$scan_target" && pwd -P)"

# Keep this detector self-contained so it can inspect an extracted tree before
# npm dependencies are installed. The scanner source itself is excluded because
# it necessarily contains the detection expressions.
secret_pattern='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-(proj|svcacct)-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[sr]k_live_[0-9A-Za-z]{16,}|re_[0-9A-Za-z]{20,}|xox[baprs]-[0-9A-Za-z-]{20,}|sb_secret_[0-9A-Za-z_-]{20,}|whsec_[0-9A-Za-z]{20,}'
# A PEM detector must require an encoded body and matching footer. Matching a
# header alone flags defensive sanitizer expressions that contain no key data.
pem_pattern='-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----((\r?\n|\\n)[A-Za-z0-9+/=]{16,})+(\r?\n|\\n)-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'

rg_args=(
  --quiet
  --hidden
  --no-ignore
  --text
  --glob '!.git/**'
  --glob '!**/node_modules/**'
  --glob '!scripts/scan-public-secrets.sh'
)

if rg "${rg_args[@]}" --regexp "$secret_pattern" -- "$scan_target"; then
  echo "Secret scan failed: potential credential material detected." >&2
  exit 1
else
  scan_status=$?
  if ((scan_status != 1)); then
    echo "Secret scan blocked: ripgrep failed with status $scan_status." >&2
    exit "$scan_status"
  fi
fi

if rg "${rg_args[@]}" --multiline --regexp "$pem_pattern" -- "$scan_target"; then
  echo "Secret scan failed: potential PEM private-key material detected." >&2
  exit 1
else
  scan_status=$?
  if ((scan_status != 1)); then
    echo "Secret scan blocked: PEM detector failed with status $scan_status." >&2
    exit "$scan_status"
  fi
fi

echo "Public secret-pattern scan passed."
