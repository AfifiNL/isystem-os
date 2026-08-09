#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"

required_packaging_files=(
  .dockerignore
  .env.example
  .github/CODEOWNERS
  .github/ISSUE_TEMPLATE/bug_report.yml
  .github/ISSUE_TEMPLATE/config.yml
  .github/ISSUE_TEMPLATE/feature_request.yml
  .github/dependabot.yml
  .github/pull_request_template.md
  .github/release.yml
  .github/workflows/ci.yml
  .github/workflows/security.yml
  .gitignore
  .vercelignore
  AGENTS.md
  AUTHORS.md
  CHANGELOG.md
  CODE_OF_CONDUCT.md
  CONTRIBUTING.md
  Dockerfile
  GOVERNANCE.md
  LICENSE
  NOTICE
  README.md
  ROADMAP.md
  SECURITY.md
  SUPPORT.md
  THIRD_PARTY_NOTICES.md
  TRADEMARKS.md
  compose.yaml
  docs/README.md
  docs/architecture.md
  docs/asset-provenance.md
  docs/backups.md
  docs/configuration.md
  docs/demo-data.md
  docs/deployment/README.md
  docs/deployment/managed-supabase.md
  docs/deployment/self-hosted.md
  docs/features-and-maturity.md
  docs/getting-started.md
  docs/providers.md
  docs/public-assets-manifest.txt
  docs/public-release-checklist.md
  docs/security-model.md
  docs/third-party-inventory.json
  docs/troubleshooting.md
  docs/upgrading.md
  public/brand/github-social-preview.jpg
  public/fonts/OFL.txt
  public/stealth-cto-hero.png
  public/themes/facility-services/hero.jpg
  public/themes/facility-services/logo.svg
  scripts/check-public-docs.mjs
  scripts/generate-third-party-inventory.mjs
  scripts/install-secret-scanners.sh
  scripts/public-release-gate.sh
  scripts/public-tool-versions.sh
  scripts/review-generated-gitleaks.mjs
  scripts/run-public-database-tests.sh
  scripts/scan-generated-output.sh
  scripts/scan-public-secrets.sh
  scripts/scan-public-secrets.test.sh
  scripts/validate-public-packaging.sh
  scripts/verify-public-container.sh
  scripts/verify-public-script-imports.mjs
  scripts/verify-public-snapshot-manifest.mjs
  setup.sh
  supabase/tests/README.md
)

candidate_required_files=(
  .npmrc
  .vercelignore
  PUBLIC_SNAPSHOT_MANIFEST.sha256
  components.json
  eslint.config.mjs
  isystem.config.ts
  next.config.ts
  nixpacks.toml
  package-lock.json
  package.json
  playwright.config.ts
  postcss.config.mjs
  scripts/lib/cron-health.ts
  src/app/media/public/[...path]/cache-policy.test.ts
  src/features/booking/lib/booking-email-delivery-outcome.test.ts
  src/features/contact/public-submission.test.ts
  src/features/seo/lib/google-search-console/sync-outcome.test.ts
  supabase/config.toml
  supabase/tests/00_release_schema_contracts.sql
  supabase/tests/10_release_runtime_invariants.sql
  supabase/tests/20_contact_submission_atomic.sql
  supabase/tests/30_privileged_identity_and_content_security.sql
  supabase/tests/booking_capacity_concurrency.sh
  tests/a11y/public-pages.a11y.spec.ts
  tests/smoke/dashboard-mobile-source.spec.ts
  tests/smoke/public-copy-quality.smoke.spec.ts
  tests/smoke/public-pages.smoke.spec.ts
  tsconfig.json
  vercel.json
)

candidate_required_directories=(
  src
  supabase/migrations
  tests
)

failure=0
for path in "${required_packaging_files[@]}"; do
  if [[ ! -f "$path" || -L "$path" || ! -s "$path" ]]; then
    echo "Missing, empty, or non-regular required public file: $path"
    failure=1
  fi
done

combined_candidate=0
if [[ -f package.json || -f package-lock.json || -d src ]]; then
  combined_candidate=1
  for path in "${candidate_required_files[@]}"; do
    if [[ ! -f "$path" || -L "$path" || ! -s "$path" ]]; then
      echo "Missing, empty, or non-regular candidate file: $path"
      failure=1
    fi
  done
  for path in "${candidate_required_directories[@]}"; do
    if [[ ! -d "$path" || -L "$path" ]]; then
      echo "Missing or unsafe candidate directory: $path"
      failure=1
    fi
  done
  if ! find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print -quit |
    grep -q .; then
    echo "The candidate must include at least one regular SQL migration."
    failure=1
  fi
fi

if [[ ! -x setup.sh ]]; then
  echo "setup.sh must be executable"
  failure=1
fi

for executable_script in \
  scripts/review-generated-gitleaks.mjs \
  scripts/scan-generated-output.sh \
  scripts/scan-public-secrets.sh; do
  if [[ ! -x "$executable_script" ]]; then
    echo "$executable_script must be executable"
    failure=1
  fi
done

if ((combined_candidate != 0)) && [[ ! -x supabase/tests/booking_capacity_concurrency.sh ]]; then
  echo "supabase/tests/booking_capacity_concurrency.sh must be executable"
  failure=1
fi

if ! grep -q "Apache License" LICENSE; then
  echo "LICENSE does not contain the Apache License heading"
  failure=1
fi

if ! grep -q "public beta" README.md; then
  echo "README.md must retain the public beta notice"
  failure=1
fi

if ! grep -Eq "verification-required|supported first-run path" README.md; then
  echo "README.md must document the supported bootstrap path or an explicit verification gate"
  failure=1
fi

if ! node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";

const env = readFileSync(".env.example", "utf8");
const entries = new Map(
  env
    .split(/\r?\n/u)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
const current = entries.get("BOOKING_MANAGEMENT_SECRET");
const previous = entries.get("BOOKING_MANAGEMENT_SECRET_PREVIOUS");
if (
  typeof current !== "string" ||
  Buffer.byteLength(current.trim(), "utf8") < 32 ||
  !current.includes("replace-me") ||
  previous !== ""
) {
  process.exitCode = 1;
}
NODE
then
  echo ".env.example must contain a scanner-safe booking secret placeholder of at least 32 UTF-8 bytes and a blank previous-secret rotation slot."
  failure=1
fi

for booking_secret_name in BOOKING_MANAGEMENT_SECRET BOOKING_MANAGEMENT_SECRET_PREVIOUS; do
  if ! grep -qF "\`$booking_secret_name\`" docs/configuration.md ||
    ! grep -qF "\`$booking_secret_name\`" docs/getting-started.md; then
    echo "Public configuration guidance is missing $booking_secret_name."
    failure=1
  fi
done
if ! grep -qF 'at least 32 UTF-8 bytes' docs/configuration.md ||
  ! grep -qF 'after every link signed with it has expired' docs/configuration.md; then
  echo "Booking-secret length or rotation guidance is incomplete."
  failure=1
fi

node_base='node:22.13.1-bookworm-slim@sha256:83fdfa2a4de32d7f8d79829ea259bd6a4821f8b2d123204ac467fbe3966450fc'
if [[ "$(grep -cF "FROM $node_base" Dockerfile)" -ne 2 ]]; then
  echo "Dockerfile must use the verified Node base digest in both image stages."
  failure=1
fi
if ! grep -qF 'read_only: true' compose.yaml ||
  ! grep -qF 'no-new-privileges:true' compose.yaml ||
  ! grep -qF 'pids_limit:' compose.yaml ||
  ! grep -qF 'TRUSTED_CLIENT_IP_HEADER:' compose.yaml ||
  ! grep -qF 'size=${ISYSTEM_SCRATCH_SIZE:-1g}' compose.yaml; then
  echo "compose.yaml is missing a required runtime security control."
  failure=1
fi
if ! grep -qF 'ISYSTEM_SCRATCH_SIZE=1g' .env.example ||
  ! grep -qF '`ISYSTEM_SCRATCH_SIZE`' docs/configuration.md ||
  ! grep -qF 'at least 1 GiB' docs/deployment/managed-supabase.md ||
  ! grep -qF 'ffmpeg -nostdin' scripts/verify-public-container.sh; then
  echo "The configurable media scratch contract or FFmpeg container smoke is incomplete."
  failure=1
fi
if ! grep -qF 'supabase-local-gate.XXXXXX' scripts/run-public-database-tests.sh ||
  ! grep -qF 'Database evidence path must not already exist' scripts/run-public-database-tests.sh ||
  ! grep -qF 'Database cleanup failed' scripts/run-public-database-tests.sh; then
  echo "The local database gate must use fresh evidence and propagate cleanup failures."
  failure=1
fi

command -v rg >/dev/null 2>&1 || {
  echo "Public packaging validation blocked: ripgrep (rg) is required."
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "Public packaging validation blocked: Node.js is required."
  exit 1
}

unsafe_object="$(find . \
  \( -path './.git' -o -path './node_modules' -o -path './.next' -o -path './artifacts' \) -prune -o \
  \( -type l -o \( ! -type d ! -type f \) \) -print -quit)"
if [[ -n "$unsafe_object" ]]; then
  echo "Symlink or non-regular object detected in public source: $unsafe_object"
  failure=1
fi

for forbidden_name in .agents .claude .codex .gemini .roo .opencode; do
  if find . \
    \( -path './.git' -o -path './node_modules' -o -path './.next' \) -prune -o \
    -name "$forbidden_name" -print -quit | grep -q .; then
    echo "Private-only agent path detected: $forbidden_name"
    failure=1
  fi
done

if ((combined_candidate != 0)); then
  developer_home_pattern='/'"(Users|home)/[[:alnum:]_.-]+/"
  if rg --quiet --hidden --no-ignore --text \
    --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' \
    --regexp "$developer_home_pattern" .; then
    echo "Machine-specific absolute home path detected in public source."
    failure=1
  else
    path_scan_status=$?
    if ((path_scan_status != 1)); then
      echo "Absolute-path scan failed with status $path_scan_status"
      failure=1
    fi
  fi

  required_scripts=(
    build
    docs:public-check
    imports:verify
    license:inventory
    lint
    secret-scan
    snapshot:manifest
    snapshot:verify
    test:ai-contracts
    test:bootstrap
    test:branding
    test:booking-management
    test:client-config
    test:dashboard-navigation
    test:ffmpeg
    test:public-quality
    test:release-contracts
    test:secret-scan
    test:outreach
    typecheck
    verify
  )
  for script_name in "${required_scripts[@]}"; do
    if ! node -e 'const p=require("./package.json"); process.exit(p.scripts?.[process.argv[1]] ? 0 : 1)' "$script_name"; then
      echo "Required npm script is missing: $script_name"
      failure=1
    fi
  done
  if ! node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {};
const releaseCommand = scripts["test:release-contracts"] ?? "";
const requiredFragments = [
  "src/features/contact/public-submission.test.ts",
  "src/app/media/public/[...path]/cache-policy.test.ts",
  "src/features/seo/lib/google-search-console/sync-outcome.test.ts",
  "src/features/booking/lib/booking-email-delivery-outcome.test.ts",
  "npm run test:booking-management",
  "npm run test:outreach",
];
if (
  scripts["imports:verify"] !== "node scripts/verify-public-script-imports.mjs" ||
  requiredFragments.some((fragment) => !releaseCommand.includes(fragment))
) process.exitCode = 1;
NODE
  then
    echo "The import-closure or release-contract npm command is incomplete."
    failure=1
  fi
  if ! node --input-type=module <<'NODE'
import { existsSync, lstatSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
let invalid = false;
for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
  for (const match of String(command).matchAll(/(?:^|\s)(scripts\/[A-Za-z0-9._/-]+)/gu)) {
    const path = match[1];
    if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
      console.error(`npm script ${scriptName} references a missing or unsafe file: ${path}`);
      invalid = true;
    }
  }
}
if (invalid) process.exitCode = 1;
NODE
  then
    failure=1
  fi
  for verify_command in \
    'npm run snapshot:verify' \
    'npm run imports:verify' \
    'npm run test:branding' \
    'npm run test:release-contracts' \
    'npm run typecheck' \
    'npm run lint' \
    'npm run build'; do
    if ! node -e 'const p=require("./package.json"); process.exit(p.scripts.verify.includes(process.argv[1]) ? 0 : 1)' "$verify_command"; then
      echo "The verify script must include: $verify_command"
      failure=1
    fi
  done

  asset_expected="$(mktemp "${TMPDIR:-/tmp}/isystem-assets-expected.XXXXXX")"
  asset_actual="$(mktemp "${TMPDIR:-/tmp}/isystem-assets-actual.XXXXXX")"
  trap 'rm -f -- "$asset_expected" "$asset_actual"' EXIT INT TERM
  LC_ALL=C sort docs/public-assets-manifest.txt > "$asset_expected"
  find public -type f -print | LC_ALL=C sort > "$asset_actual"
  if ! cmp -s "$asset_expected" "$asset_actual"; then
    echo "The public asset tree does not match docs/public-assets-manifest.txt:"
    comm -3 "$asset_expected" "$asset_actual" || true
    failure=1
  fi

  if ! node scripts/verify-public-snapshot-manifest.mjs; then
    failure=1
  fi
  if ! node scripts/verify-public-script-imports.mjs; then
    failure=1
  fi
fi

if ! bash scripts/scan-public-secrets.sh "$repo_root"; then
  failure=1
fi

if ! bash scripts/scan-public-secrets.test.sh; then
  failure=1
fi

if ! node scripts/check-public-docs.mjs; then
  failure=1
fi

if ((failure != 0)); then
  exit 1
fi

echo "Public packaging checks passed."
echo "This check does not replace application, license, or deployment release gates."
