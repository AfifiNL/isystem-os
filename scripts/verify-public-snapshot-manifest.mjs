#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestName = "PUBLIC_SNAPSHOT_MANIFEST.sha256";
const manifestPath = join(repoRoot, manifestName);
const ignoredTopLevelPaths = new Set([
  ".git",
  ".next",
  "artifacts",
  "build",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const ignoredTopLevelFiles = new Set([".env.local"]);
const mode = process.argv[2] ?? "--verify";

if (mode !== "--verify" && mode !== "--write") {
  console.error(`Usage: ${process.argv[1]} [--verify|--write]`);
  process.exit(2);
}
if (mode === "--verify" && (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile())) {
  console.error(`Snapshot verification blocked: ${manifestName} is missing or non-regular.`);
  process.exit(1);
}

const actualEntries = [];
const failures = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    const displayPath = relative(repoRoot, absolutePath).split(sep).join("/");
    const topLevelPath = displayPath.split("/", 1)[0];
    if (ignoredTopLevelPaths.has(topLevelPath)) continue;
    if (!displayPath.includes("/") && ignoredTopLevelFiles.has(displayPath)) continue;
    if (displayPath === manifestName) continue;

    const stat = lstatSync(absolutePath);
    if (stat.isDirectory()) {
      walk(absolutePath);
      continue;
    }
    if (!stat.isFile()) {
      failures.push(`${displayPath}: snapshot source contains a symlink or non-regular object`);
      continue;
    }
    if (/[\\\t\r\n]/u.test(displayPath)) {
      failures.push(`${displayPath}: snapshot source contains unsafe path characters`);
      continue;
    }
    actualEntries.push({
      digest: createHash("sha256").update(readFileSync(absolutePath)).digest("hex"),
      path: displayPath,
    });
  }
}

walk(repoRoot);
actualEntries.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));

if (failures.length > 0) {
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  console.error(`Snapshot source inspection failed with ${failures.length} error(s).`);
  process.exit(1);
}

if (mode === "--write") {
  if (existsSync(manifestPath) && !lstatSync(manifestPath).isFile()) {
    console.error(`Snapshot generation blocked: ${manifestName} is non-regular.`);
    process.exit(1);
  }
  const contents = `${actualEntries.map(({ digest, path }) => `${digest}  ${path}`).join("\n")}\n`;
  const temporaryPath = `${manifestPath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaryPath, contents, { flag: "wx", mode: 0o644 });
    renameSync(temporaryPath, manifestPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  const digest = createHash("sha256").update(contents).digest("hex");
  console.log(`Public snapshot manifest written: ${actualEntries.length} files, ${digest}`);
  process.exit(0);
}

const manifestContents = readFileSync(manifestPath, "utf8");
if (!manifestContents.endsWith("\n")) {
  failures.push(`${manifestName}: must end with a newline`);
}

const expectedEntries = [];
const seenPaths = new Set();
for (const [index, line] of manifestContents.trimEnd().split("\n").entries()) {
  const match = /^([0-9a-f]{64})  (.+)$/u.exec(line);
  if (!match) {
    failures.push(`${manifestName}:${index + 1}: invalid SHA-256 manifest entry`);
    continue;
  }
  const [, digest, path] = match;
  if (path === manifestName || path.startsWith("/") || path.includes("../") || /[\\\t\r\n]/u.test(path)) {
    failures.push(`${manifestName}:${index + 1}: unsafe manifest path`);
    continue;
  }
  if (seenPaths.has(path)) {
    failures.push(`${manifestName}:${index + 1}: duplicate manifest path`);
    continue;
  }
  seenPaths.add(path);
  expectedEntries.push({ digest, path });
}

const sortedExpectedEntries = [...expectedEntries].sort((left, right) =>
  Buffer.from(left.path).compare(Buffer.from(right.path)),
);
if (JSON.stringify(expectedEntries) !== JSON.stringify(sortedExpectedEntries)) {
  failures.push(`${manifestName}: entries are not bytewise path-sorted`);
}

const expectedByPath = new Map(expectedEntries.map((entry) => [entry.path, entry.digest]));
const actualByPath = new Map(actualEntries.map((entry) => [entry.path, entry.digest]));

for (const [path, digest] of expectedByPath) {
  if (!actualByPath.has(path)) {
    failures.push(`${path}: listed in the snapshot manifest but missing from the source tree`);
  } else if (actualByPath.get(path) !== digest) {
    failures.push(`${path}: SHA-256 does not match the exported snapshot`);
  }
}
for (const path of actualByPath.keys()) {
  if (!expectedByPath.has(path)) {
    failures.push(`${path}: source file is absent from the snapshot manifest`);
  }
}

if (failures.length > 0) {
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  console.error(`Snapshot manifest verification failed with ${failures.length} error(s).`);
  process.exit(1);
}

const manifestDigest = createHash("sha256").update(manifestContents).digest("hex");
console.log(`Public snapshot manifest passed: ${actualEntries.length} files, ${manifestDigest}`);
