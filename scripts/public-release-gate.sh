#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_root"
# shellcheck source=public-tool-versions.sh
source scripts/public-tool-versions.sh

bash scripts/validate-public-packaging.sh

if [[ ! -f package.json || ! -f package-lock.json || ! -f PUBLIC_SNAPSHOT_MANIFEST.sha256 ]]; then
  echo "Release blocked: the sanitized source, lockfile, and snapshot manifest are not present."
  exit 1
fi

for required_command in docker gitleaks node npm psql rg supabase trivy trufflehog; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Release blocked: required command '$required_command' is unavailable."
    exit 1
  }
done
if ! docker compose version >/dev/null 2>&1; then
  echo "Release blocked: the Docker Compose plugin is unavailable."
  exit 1
fi

if [[ "$(gitleaks version)" != "$PUBLIC_GITLEAKS_VERSION" ]]; then
  echo "Release blocked: Gitleaks $PUBLIC_GITLEAKS_VERSION is required."
  exit 1
fi
if [[ "$(trufflehog --version)" != "trufflehog $PUBLIC_TRUFFLEHOG_VERSION" ]]; then
  echo "Release blocked: TruffleHog $PUBLIC_TRUFFLEHOG_VERSION is required."
  exit 1
fi
installed_trivy_version="$(trivy --version | awk '/^Version:/{print $2; exit}')"
if [[ "$installed_trivy_version" != "$PUBLIC_TRIVY_VERSION" ]]; then
  echo "Release blocked: Trivy $PUBLIC_TRIVY_VERSION is required."
  exit 1
fi
if [[ "$(supabase --version)" != "$PUBLIC_SUPABASE_CLI_VERSION" ]]; then
  echo "Release blocked: Supabase CLI $PUBLIC_SUPABASE_CLI_VERSION is required."
  exit 1
fi

has_script() {
  node -e 'const p=require("./package.json"); process.exit(p.scripts?.[process.argv[1]] ? 0 : 1)' "$1"
}

required_scripts=(
  build
  docs:public-check
  imports:verify
  license:inventory
  lint
  secret-scan
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
)

for script_name in "${required_scripts[@]}"; do
  if ! has_script "$script_name"; then
    echo "Release blocked: npm script '$script_name' is missing."
    exit 1
  fi
done

echo "Scanning the final source tree with pinned independent scanners..."
bash scripts/scan-public-secrets.test.sh --require-independent
bash scripts/scan-public-secrets.sh "$repo_root"
gitleaks dir --no-banner --redact --exit-code 1 "$repo_root"
trufflehog filesystem --no-update --no-verification --fail --fail-on-scan-errors "$repo_root"

echo "Installing locked dependencies..."
npm ci

inventory_one="$(mktemp)"
inventory_two="$(mktemp)"
trap 'rm -f -- "$inventory_one" "$inventory_two"' EXIT
echo "Verifying deterministic third-party dependency inventory..."
npm run --silent license:inventory > "$inventory_one"
npm run --silent license:inventory > "$inventory_two"
if [[ ! -s "$inventory_one" ]] || ! cmp -s "$inventory_one" "$inventory_two"; then
  echo "Release blocked: the third-party dependency inventory is empty or non-deterministic."
  exit 1
fi

if rg --fixed-strings --quiet 'THIRD_PARTY_NOTICES_RELEASE_BLOCKER' THIRD_PARTY_NOTICES.md; then
  echo "Release blocked: THIRD_PARTY_NOTICES.md is still a placeholder."
  echo "Audit the generated dependency inventory, assets, copied code, and required upstream notices before replacing the placeholder."
  exit 1
fi

echo "Running the public documentation contract..."
npm run docs:public-check

for script_name in \
  test:bootstrap \
  test:branding \
  test:client-config \
  test:secret-scan \
  secret-scan \
  test:ai-contracts \
  test:ffmpeg \
  test:public-quality \
  test:dashboard-navigation \
  test:release-contracts; do
  echo "Running npm run $script_name..."
  npm run "$script_name"
done

echo "Auditing production dependencies..."
npm audit --omit=dev

echo "Running strict TypeScript validation..."
npm run typecheck

echo "Running lint..."
npm run lint

echo "Running production build..."
npm run build

if [[ ! -d .next ]]; then
  echo "Release blocked: the production build did not create .next output."
  exit 1
fi

echo "Scanning generated .next output..."
bash scripts/scan-generated-output.sh "$repo_root/.next"
npm run secret-scan

echo "Running disposable database release contracts..."
bash scripts/run-public-database-tests.sh

echo "Validating the hardened Compose model..."
docker compose --env-file .env.example config --quiet

echo "Building the final runtime image with synthetic public configuration..."
mkdir -p artifacts/container-local-gate
docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://public-build.supabase.invalid \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-public-anon-key \
  --tag isystem-os:release-gate .

bash scripts/verify-public-container.sh \
  isystem-os:release-gate artifacts/container-local-gate

echo "Scanning the final runtime image..."
trivy image \
  --exit-code 1 \
  --format json \
  --output artifacts/container-local-gate/trivy.json \
  --scanners vuln \
  --severity HIGH,CRITICAL \
  isystem-os:release-gate

echo
echo "Automated release checks passed."
echo "Human privacy, licensing, security, migration, backup, and feature-evidence review is still required."
