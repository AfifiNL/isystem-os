#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const execFileAsync = promisify(execFile);

const skippedDirectories = new Set([
  '.git',
  '.next',
  '.vercel',
  'node_modules',
  'coverage',
  'playwright-report',
  'test-results',
]);

const skippedExtensions = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.ttf',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
]);

const allowedValuePatterns = [
  /<[^>]*(?:redacted|placeholder|example|secret|token|key)[^>]*>/i,
  /^(?:placeholder|redacted|dummy|your[-_](?:api[-_]?key|secret|token|password|credentials?)|example[-_](?:api[-_]?key|secret|token|password|credentials?))$/i,
  /^(?:replace[-_]with|replace[-_]me[-_]with)[-_][a-z0-9_-]+$/i,
  /^(?:[A-Z][A-Z0-9_]*_)?(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS)$/,
  /^\$\{(?:[A-Z][A-Z0-9_]*_)?(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS)\}$/,
  /^process\.env\.(?:[A-Z][A-Z0-9_]*_)?(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS)$/,
];

const detectors = [
  {
    name: 'PEM private key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----(?:\r?\n|\\n)(?:[A-Za-z0-9+/=]{16,}(?:\r?\n|\\n))+-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    valueGroup: 0,
    allowFullMatch: true,
  },
  {
    name: 'Google service-account JSON',
    regex: /"type"\s*:\s*"service_account"[\s\S]{0,20000}"private_key_id"\s*:\s*"([0-9a-f]{16,})"/gi,
    valueGroup: 1,
  },
  {
    name: 'Supabase personal access token',
    regex: /\b(sbp_[A-Za-z0-9]{32,})\b/g,
    valueGroup: 1,
  },
  {
    name: 'authorization bearer literal',
    regex: /Authorization["'`]?\s*[:=]\s*["'`][^"'`]*\bBearer\s+([A-Za-z0-9+/=_-]{24,})[^"'`]*["'`]/gi,
    valueGroup: 1,
  },
  {
    name: 'bearer token literal',
    regex: /\bBearer\s+([A-Za-z0-9+/=_-]{32,})\b/g,
    valueGroup: 1,
  },
  {
    name: 'JWT literal',
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    valueGroup: 1,
  },
  {
    name: 'API key assignment literal',
    regex: /\b(?:[A-Za-z][A-Za-z0-9]*[_-])*(?:api[_-]?key|secret|token|password|client[_-]?secret)["'`]?\s*[:=]\s*["'`]([A-Za-z0-9+/=_-]{24,})["'`]/gi,
    valueGroup: 1,
  },
  {
    name: 'environment secret assignment literal',
    regex: /^(?:export[ \t]+)?[A-Z][A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIALS)[ \t]*=[ \t]*([A-Za-z0-9+/=_-]{24,})[ \t]*$/gm,
    valueGroup: 1,
  },
];

function isAllowed(value) {
  return allowedValuePatterns.some((pattern) => pattern.test(value));
}

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();

  return (
    skippedExtensions.has(extension) ||
    basename.endsWith('.log') ||
    basename === 'package-lock.json'
  );
}

async function* walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath);

    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) {
        yield* walk(absolutePath);
      }
      continue;
    }

    if (entry.isFile() && !shouldSkipFile(relativePath)) {
      yield { absolutePath, relativePath };
    }
  }
}

async function listRepoFiles() {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '-co', '--exclude-standard'], {
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
    });

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((relativePath) => !shouldSkipFile(relativePath))
      .map((relativePath) => ({ absolutePath: path.join(root, relativePath), relativePath }));
  } catch {
    const files = [];
    for await (const file of walk(root)) {
      files.push(file);
    }
    return files;
  }
}

export function scanContent(relativePath, content) {
  const findings = [];

  for (const detector of detectors) {
    for (const match of content.matchAll(detector.regex)) {
      const value = match[detector.valueGroup] ?? match[0];

      if (isAllowed(value) || (detector.allowFullMatch && isAllowed(match[0]))) {
        continue;
      }

      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ detector: detector.name, line, relativePath });
    }
  }

  return findings;
}

export async function main() {
  const findings = [];

  for (const file of await listRepoFiles()) {
    try {
      const content = await readFile(file.absolutePath, 'utf8');
      findings.push(...scanContent(file.relativePath, content));
    } catch {
      // Non-UTF8 files are treated as binary and skipped.
    }
  }

  if (findings.length > 0) {
    console.error('Potential secret literals found:');
    for (const finding of findings) {
      console.error(`- ${finding.relativePath}:${finding.line} (${finding.detector})`);
    }
    console.error('Replace literals with env/config references or documentation-safe placeholders.');
    process.exitCode = 1;
    return;
  }

  console.log('Secret scan passed: no raw-looking credentials or private keys found.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
