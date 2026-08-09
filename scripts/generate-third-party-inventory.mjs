#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockfilePath = join(repoRoot, "package-lock.json");

if (!existsSync(lockfilePath)) {
  console.error("License inventory blocked: package-lock.json is missing.");
  process.exit(1);
}

const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
if (!lockfile.packages || typeof lockfile.packages !== "object") {
  console.error("License inventory blocked: package-lock.json has no packages inventory.");
  process.exit(1);
}

const dependencies = [];
const unresolved = [];
const reviewedLicenseOverrides = new Map([
  ["async@0.2.10", "MIT"],
  ["khroma@2.1.0", "MIT"],
  ["parse-cache-control@1.0.1", "BSD-3-Clause"],
  ["webgl-constants@1.1.1", "MIT"],
]);

function packageNameFromPath(packagePath) {
  return packagePath.slice(packagePath.lastIndexOf("node_modules/") + "node_modules/".length);
}

for (const packagePath of Object.keys(lockfile.packages).sort()) {
  if (!packagePath || !packagePath.includes("node_modules/")) continue;

  const lockedPackage = lockfile.packages[packagePath];
  const name = packageNameFromPath(packagePath);
  const manifestPath = join(repoRoot, packagePath, "package.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : null;
  const manifestLicense = typeof manifest?.license === "string"
    ? manifest.license
    : manifest?.license?.type;
  const license = lockedPackage.license
    ?? manifestLicense
    ?? reviewedLicenseOverrides.get(`${name}@${lockedPackage.version}`);

  if (!name || !lockedPackage.version || !license) {
    unresolved.push(`${packagePath}: name, locked version, or reviewed license metadata is missing`);
    continue;
  }

  dependencies.push({
    license,
    name,
    packagePath,
    version: lockedPackage.version,
  });
}

if (unresolved.length > 0) {
  for (const issue of unresolved) console.error(`- ${issue}`);
  console.error("License inventory is incomplete; refusing to emit a partial inventory.");
  process.exit(1);
}

dependencies.sort((left, right) =>
  left.name.localeCompare(right.name) ||
  left.version.localeCompare(right.version) ||
  left.packagePath.localeCompare(right.packagePath),
);

process.stdout.write(`${JSON.stringify({ dependencies, formatVersion: 1 }, null, 2)}\n`);
