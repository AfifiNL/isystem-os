#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootOverride = process.argv[2] === "--root" ? process.argv[3] : null;
if (process.argv[2] === "--root" && !rootOverride) {
  console.error("Usage: verify-public-script-imports.mjs [--root <repository> [entry ...]]");
  process.exit(2);
}
const repoRoot = rootOverride
  ? resolve(rootOverride)
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const explicitEntrypoints = rootOverride ? process.argv.slice(4) : [];
const scriptsRoot = join(repoRoot, "scripts");
const sourceExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"];
const inspectableExtensions = new Set(sourceExtensions.filter((extension) => extension !== ".json"));
const importPatterns = [
  /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']/gu,
  /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/gu,
  /\brequire\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/gu,
];

if (!existsSync(scriptsRoot) || !lstatSync(scriptsRoot).isDirectory() || lstatSync(scriptsRoot).isSymbolicLink()) {
  console.error("Script import closure check requires a real scripts directory.");
  process.exit(1);
}

function collectScriptEntrypoints(directory, entries = []) {
  for (const directoryEntry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, directoryEntry.name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`Symlink in scripts tree: ${relative(repoRoot, path)}`);
    }
    if (stat.isDirectory()) {
      collectScriptEntrypoints(path, entries);
    } else if (stat.isFile() && inspectableExtensions.has(extname(path))) {
      entries.push(path);
    } else if (!stat.isFile()) {
      throw new Error(`Non-regular object in scripts tree: ${relative(repoRoot, path)}`);
    }
  }
  return entries;
}

function candidatePaths(importer, specifier) {
  const base = resolve(dirname(importer), specifier);
  const candidates = [base];
  const hasSourceExtension = sourceExtensions.some((extension) => base.endsWith(extension));
  if (!hasSourceExtension) {
    for (const extension of sourceExtensions) candidates.push(`${base}${extension}`);
    for (const extension of sourceExtensions) candidates.push(join(base, `index${extension}`));
  } else if (base.endsWith(".js")) {
    candidates.push(base.slice(0, -3) + ".ts", base.slice(0, -3) + ".tsx");
  }
  return candidates;
}

function resolveRelativeImport(importer, specifier) {
  for (const candidate of candidatePaths(importer, specifier)) {
    const relativeCandidate = relative(repoRoot, candidate);
    if (relativeCandidate === ".." || relativeCandidate.startsWith(`..${sep}`) || resolve(candidate) === repoRoot) {
      continue;
    }
    if (!existsSync(candidate)) continue;
    const stat = lstatSync(candidate);
    if (stat.isFile() && !stat.isSymbolicLink()) return candidate;
  }
  return null;
}

const pending = explicitEntrypoints.length > 0
  ? explicitEntrypoints.map((entry) => {
      const absoluteEntry = resolve(repoRoot, entry);
      const relativeEntry = relative(repoRoot, absoluteEntry);
      if (
        entry.startsWith("/") ||
        relativeEntry === ".." ||
        relativeEntry.startsWith(`..${sep}`) ||
        !existsSync(absoluteEntry) ||
        !lstatSync(absoluteEntry).isFile() ||
        lstatSync(absoluteEntry).isSymbolicLink()
      ) {
        throw new Error(`Unsafe or missing script entrypoint: ${entry}`);
      }
      return absoluteEntry;
    })
  : collectScriptEntrypoints(scriptsRoot);
const visited = new Set();
const failures = [];

while (pending.length > 0) {
  const importer = pending.pop();
  if (visited.has(importer)) continue;
  visited.add(importer);

  const contents = readFileSync(importer, "utf8");
  const specifiers = new Set();
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    for (const match of contents.matchAll(pattern)) specifiers.add(match[1]);
  }

  for (const specifier of specifiers) {
    const imported = resolveRelativeImport(importer, specifier);
    if (!imported) {
      failures.push(`${relative(repoRoot, importer)} -> ${specifier}`);
      continue;
    }
    if (inspectableExtensions.has(extname(imported))) pending.push(imported);
  }
}

if (failures.length > 0) {
  for (const failure of failures.sort()) console.error(`Missing relative import: ${failure}`);
  console.error(`Public script import closure failed with ${failures.length} missing import(s).`);
  process.exit(1);
}

console.log(`Public script relative import closure passed: ${visited.size} files.`);
