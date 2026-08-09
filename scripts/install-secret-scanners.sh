#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
# shellcheck source=public-tool-versions.sh
source "$repo_root/scripts/public-tool-versions.sh"

destination="${1:-}"
if [[ -z "$destination" ]]; then
  echo "Usage: $0 <existing-bin-directory>" >&2
  exit 2
fi
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "Pinned scanner installer currently supports Linux x86_64 only." >&2
  exit 2
fi
if [[ ! -d "$destination" || -L "$destination" ]]; then
  echo "Scanner destination must be an existing, non-symlink directory." >&2
  exit 2
fi
for required_command in curl tar; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Scanner installation requires '$required_command'." >&2
    exit 2
  }
done

scanner_tmp="$(mktemp -d "${TMPDIR:-/tmp}/isystem-public-scanners.XXXXXX")"
trap 'rm -rf -- "$scanner_tmp"' EXIT INT TERM

verify_sha256() {
  local expected="$1"
  local file="$2"
  local actual
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  else
    echo "Scanner installation requires sha256sum or shasum." >&2
    exit 2
  fi
  if [[ "$actual" != "$expected" ]]; then
    echo "Scanner archive SHA-256 mismatch: $(basename "$file")" >&2
    exit 1
  fi
}

gitleaks_archive="$scanner_tmp/gitleaks.tar.gz"
curl --fail --location --retry 3 --silent --show-error \
  "https://github.com/gitleaks/gitleaks/releases/download/v${PUBLIC_GITLEAKS_VERSION}/gitleaks_${PUBLIC_GITLEAKS_VERSION}_linux_x64.tar.gz" \
  --output "$gitleaks_archive"
verify_sha256 "$PUBLIC_GITLEAKS_LINUX_X64_SHA256" "$gitleaks_archive"
tar -xzf "$gitleaks_archive" -C "$scanner_tmp" gitleaks
if [[ ! -f "$scanner_tmp/gitleaks" || -L "$scanner_tmp/gitleaks" ]]; then
  echo "Pinned Gitleaks archive did not contain a regular executable." >&2
  exit 1
fi
install -m 0755 "$scanner_tmp/gitleaks" "$destination/gitleaks"

trufflehog_archive="$scanner_tmp/trufflehog.tar.gz"
curl --fail --location --retry 3 --silent --show-error \
  "https://github.com/trufflesecurity/trufflehog/releases/download/v${PUBLIC_TRUFFLEHOG_VERSION}/trufflehog_${PUBLIC_TRUFFLEHOG_VERSION}_linux_amd64.tar.gz" \
  --output "$trufflehog_archive"
verify_sha256 "$PUBLIC_TRUFFLEHOG_LINUX_AMD64_SHA256" "$trufflehog_archive"
tar -xzf "$trufflehog_archive" -C "$scanner_tmp" trufflehog
if [[ ! -f "$scanner_tmp/trufflehog" || -L "$scanner_tmp/trufflehog" ]]; then
  echo "Pinned TruffleHog archive did not contain a regular executable." >&2
  exit 1
fi
install -m 0755 "$scanner_tmp/trufflehog" "$destination/trufflehog"

if [[ "$("$destination/gitleaks" version)" != "$PUBLIC_GITLEAKS_VERSION" ]]; then
  echo "Installed Gitleaks version does not match the pin." >&2
  exit 1
fi
if [[ "$("$destination/trufflehog" --version)" != "trufflehog $PUBLIC_TRUFFLEHOG_VERSION" ]]; then
  echo "Installed TruffleHog version does not match the pin." >&2
  exit 1
fi

echo "Installed pinned Gitleaks and TruffleHog binaries in $destination"
