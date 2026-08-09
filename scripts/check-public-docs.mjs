#!/usr/bin/env node

import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".next", "node_modules"]);
const requiredPublicDocs = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/README.md",
  "docs/getting-started.md",
  "docs/configuration.md",
  "docs/public-release-checklist.md",
];
const prohibitedPublicReferences = [
  ["", "Users", ""].join("/"),
  ["", "home", ""].join("/"),
  `npm run ${["docs", "check"].join(":")}`,
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      if (entry.isDirectory()) {
        return ignoredDirectories.has(entry.name) ? [] : walk(join(directory, entry.name));
      }
      return extname(entry.name).toLowerCase() === ".md" ? [join(directory, entry.name)] : [];
    });
}

function normalizeDestination(rawDestination) {
  let destination = rawDestination.trim();
  if (destination.startsWith("<") && destination.endsWith(">")) {
    destination = destination.slice(1, -1).trim();
  }
  if (destination.includes(" ") && !destination.startsWith("#")) {
    destination = destination.split(/\s+['"]/u, 1)[0];
  }
  return destination;
}

function isExternal(destination) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(destination);
}

function localPathFor(sourceFile, rawDestination) {
  const destination = normalizeDestination(rawDestination);
  if (!destination || destination.startsWith("#") || isExternal(destination)) return null;

  let pathPart = destination.split("#", 1)[0].split("?", 1)[0];
  try {
    pathPart = decodeURIComponent(pathPart);
  } catch {
    return { error: `has an invalid percent-encoded link: ${destination}` };
  }

  const resolvedPath = normalize(resolve(dirname(sourceFile), pathPart));
  const relativePath = relative(repoRoot, resolvedPath);
  if (relativePath === ".." || relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(relativePath)) {
    return { error: `links outside the repository: ${destination}` };
  }
  return { destination, resolvedPath };
}

const failures = [];

for (const requiredPath of requiredPublicDocs) {
  const absolutePath = join(repoRoot, requiredPath);
  if (!existsSync(absolutePath) || lstatSync(absolutePath).size === 0) {
    failures.push(`${requiredPath}: missing or empty required public document`);
  }
}

for (const markdownFile of walk(repoRoot)) {
  const displayPath = relative(repoRoot, markdownFile);
  const contents = readFileSync(markdownFile, "utf8");

  for (const prohibitedReference of prohibitedPublicReferences) {
    if (contents.includes(prohibitedReference)) {
      failures.push(`${displayPath}: contains prohibited private or obsolete reference: ${prohibitedReference}`);
    }
  }

  const definitions = new Map();
  const definitionPattern = /^\s{0,3}\[([^\]]+)\]:\s*(\S+)(?:\s+.*)?$/gmu;
  for (const match of contents.matchAll(definitionPattern)) {
    definitions.set(match[1].trim().toLowerCase(), match[2]);
  }

  const destinations = [];
  const inlinePattern = /!?(?:\[[^\]]*\])\(([^)]+)\)/gu;
  for (const match of contents.matchAll(inlinePattern)) destinations.push(match[1]);

  const referencePattern = /(?<!!)\[([^\]]+)\]\[([^\]]*)\]/gu;
  for (const match of contents.matchAll(referencePattern)) {
    const referenceName = (match[2] || match[1]).trim().toLowerCase();
    if (!definitions.has(referenceName)) {
      failures.push(`${displayPath}: uses undefined Markdown reference [${referenceName}]`);
    }
  }
  destinations.push(...definitions.values());

  for (const rawDestination of destinations) {
    const result = localPathFor(markdownFile, rawDestination);
    if (!result) continue;
    if (result.error) {
      failures.push(`${displayPath}: ${result.error}`);
      continue;
    }
    if (!existsSync(result.resolvedPath)) {
      failures.push(`${displayPath}: broken local link: ${result.destination}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  console.error(`Public documentation check failed with ${failures.length} error(s).`);
  process.exit(1);
}

console.log("Public documentation links and references passed.");
