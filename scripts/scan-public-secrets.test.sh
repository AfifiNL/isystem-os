#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
scanner="$repo_root/scripts/scan-public-secrets.sh"
require_independent_scanners="${1:-}"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/isystem-secret-scan.XXXXXX")"
trap 'rm -rf -- "$fixture_root"' EXIT INT TERM

mkdir -p \
  "$fixture_root/custom-safe" \
  "$fixture_root/generated-safe/.next/server/app/api/health" \
  "$fixture_root/generated-safe/.next/server" \
  "$fixture_root/generated-safe/.next/standalone/.next/server" \
  "$fixture_root/generated-safe/.next/standalone/node_modules/example" \
  "$fixture_root/generated-unsafe/.next/server/app/api/health" \
  "$fixture_root/independent-safe" \
  "$fixture_root/private-key"

# Construct the defensive example at runtime so the regression source itself
# never contains a private-key marker that independent scanners must flag.
pem_label="$(printf '\120\122\111\126\101\124\105\040\113\105\131')"
printf '.replace(/-----%s %s-----[\\s\\S]*?-----%s %s-----/g, "[redacted]")\n' \
  'BEGIN' "$pem_label" 'END' "$pem_label" > "$fixture_root/custom-safe/sanitizer.ts"

printf '%s\n' 'api_key=replace-with-a-local-development-value' \
  > "$fixture_root/independent-safe/example.env"

printf '%s\n' 'export const health = { status: "ok" };' \
  > "$fixture_root/generated-safe/.next/server/app/api/health/route.js"
printf '%s\n' 'third-party fixture excluded from generated application scan' \
  > "$fixture_root/generated-safe/.next/standalone/node_modules/example/fixture.js"

# Next can emit a hex or unpadded URL-safe server-action key. Keep this fixture
# generated at runtime so the scanner source never contains credential-shaped
# material while the generated-output allowlist is covered by regression tests.
hex_key="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
url_safe_key="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')"
printf '{"encryptionKey":"%s"}\n' "$hex_key" \
  > "$fixture_root/generated-safe/.next/server/server-reference-manifest.json"
printf '{"encryptionKey":"%s"}\n' "$url_safe_key" \
  > "$fixture_root/generated-safe/.next/standalone/.next/server/server-reference-manifest.json"

generic_key_name="$(printf '\141\160\151\137\153\145\171')"
printf 'export const %s = "%s%s";\n' \
  "$generic_key_name" \
  'C0d3xPubl1cR3l34s3' \
  'F1xtur3Q7v9Lm2Np8Rs5Wx' \
  > "$fixture_root/generated-unsafe/.next/server/app/api/health/route.js"

if ! bash "$scanner" "$fixture_root/custom-safe" >/dev/null 2>&1; then
  echo "Secret scanner regression: a defensive PEM sanitizer was rejected." >&2
  exit 1
fi

{
  printf '%s %s\n' '-----BEGIN' "$pem_label-----"
  printf '%s\n' 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo9PQ=='
  printf '%s %s\n' '-----END' "$pem_label-----"
} > "$fixture_root/private-key/credential.pem"

if bash "$scanner" "$fixture_root/private-key" >/dev/null 2>&1; then
  echo "Secret scanner regression: PEM private-key material was not rejected." >&2
  exit 1
fi

if [[ "$require_independent_scanners" == "--require-independent" ]]; then
  for scanner_command in gitleaks trufflehog; do
    command -v "$scanner_command" >/dev/null 2>&1 || {
      echo "Secret scanner regression requires '$scanner_command'." >&2
      exit 2
    }
  done
  gitleaks dir --no-banner --redact --exit-code 1 "$fixture_root/independent-safe"
  trufflehog filesystem --no-update --no-verification --fail --fail-on-scan-errors "$fixture_root/independent-safe"

  if ! bash "$repo_root/scripts/scan-generated-output.sh" \
    "$fixture_root/generated-safe/.next" >/dev/null 2>&1; then
    echo "Generated-output regression: safe application output was rejected." >&2
    exit 1
  fi
  if bash "$repo_root/scripts/scan-generated-output.sh" \
    "$fixture_root/generated-unsafe/.next" >/dev/null 2>&1; then
    echo "Generated-output regression: an injected application secret was not rejected." >&2
    exit 1
  fi
elif [[ -n "$require_independent_scanners" ]]; then
  echo "Usage: $0 [--require-independent]" >&2
  exit 2
fi

echo "Public secret-scanner regression fixtures passed."
