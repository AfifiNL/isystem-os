#!/usr/bin/env bash
set -euo pipefail

# iSystem OS dependency and local-configuration bootstrap.
# This does not provision providers, migrate a database, or start the app.

echo "=== iSystem OS bootstrap (public beta v0.1.1) ==="

if [[ ! -f package.json || ! -f package-lock.json ]]; then
  echo "Error: the public application source and npm lockfile are not present."
  echo "Clone a complete iSystem OS release instead of copying a packaging overlay."
  exit 1
fi

command -v node >/dev/null 2>&1 || {
  echo "Error: Node.js is required. Check the version declared by the public source snapshot."
  exit 1
}
command -v npm >/dev/null 2>&1 || {
  echo "Error: npm is required. Other package managers are not supported."
  exit 1
}

node_version="$(node --version)"
if ! node -e '
  const version = process.versions.node.split(".").map(Number);
  const supported = version[0] === 22 && (version[1] > 13 || (version[1] === 13 && version[2] >= 0));
  process.exit(supported ? 0 : 1);
'; then
  echo "Error: Node.js >=22.13.0 and <23 is required; found $node_version."
  exit 1
fi

npm_version="$(npm --version)"
if ! node -e '
  const version = process.argv[1].split(".").map(Number);
  process.exit(version[0] >= 10 ? 0 : 1);
' "$npm_version"; then
  echo "Error: npm >=10 is required; found $npm_version."
  exit 1
fi

echo "Installing locked dependencies..."
npm ci

echo "Preparing the safe local configuration..."
npm run setup

echo
echo "=== Local bootstrap complete ==="
echo "Next: edit isystem.config.ts and .env.local, then run npm run doctor."
echo "This command did not apply migrations or start the application."
