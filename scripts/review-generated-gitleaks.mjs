#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const [reportPath, scanRoot] = process.argv.slice(2);
if (!reportPath || !scanRoot) {
  console.error("Usage: review-generated-gitleaks.mjs <report.json> <scan-root>");
  process.exit(2);
}

let findings;
try {
  findings = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Generated-output scan blocked: invalid Gitleaks report: ${error.message}`);
  process.exit(1);
}
if (!Array.isArray(findings)) {
  console.error("Generated-output scan blocked: Gitleaks report must be an array.");
  process.exit(1);
}

const root = resolve(scanRoot);
const hexKey = /^[a-f0-9]{64}$/u;
const base64Key = /^[A-Za-z0-9+/]{43}=$/u;
const manifestAllowlist = [
  {
    path: /(?:^|\/)prerender-manifest\.json$/u,
    fields: new Set(["previewModeSigningKey", "previewModeEncryptionKey"]),
    secret: hexKey,
  },
  {
    path: /(?:^|\/)server\/middleware-manifest\.json$/u,
    fields: new Set([
      "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
      "__NEXT_PREVIEW_MODE_SIGNING_KEY",
      "__NEXT_PREVIEW_MODE_ENCRYPTION_KEY",
    ]),
    secret: /^(?:[a-f0-9]{64}|[A-Za-z0-9+/]{43}=)$/u,
  },
  {
    path: /(?:^|\/)server\/server-reference-manifest\.json$/u,
    fields: new Set(["encryptionKey"]),
    secret: base64Key,
  },
];

const unexpected = [];
for (const finding of findings) {
  const absoluteFile = resolve(String(finding.File ?? ""));
  const relativeFile = relative(root, absoluteFile).split(sep).join("/");
  if (!relativeFile || relativeFile === ".." || relativeFile.startsWith("../")) {
    unexpected.push({ rule: finding.RuleID ?? "unknown", file: "outside-scan-root" });
    continue;
  }

  const secret = String(finding.Secret ?? "");
  const match = String(finding.Match ?? "");
  const manifestRule = manifestAllowlist.find((entry) => entry.path.test(relativeFile));
  if (finding.RuleID === "generic-api-key" && manifestRule) {
    const field = [...manifestRule.fields].find((candidate) =>
      match.includes(`${candidate}\"`) || match.includes(`${candidate}:`),
    );
    if (field && manifestRule.secret.test(secret)) continue;
  }

  const minifiedIdentifier = match.match(
    /^(?:[A-Za-z_$][A-Za-z0-9_$]*\.)?keyCount,([A-Za-z_$][A-Za-z0-9_$]{0,31}(?:=[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)?)*);$/u,
  );
  if (
    finding.RuleID === "generic-api-key" &&
    /(?:^|\/)server\/chunks\/[A-Za-z0-9_-]+\.js$/u.test(relativeFile) &&
    minifiedIdentifier?.[1] === secret
  ) {
    continue;
  }

  unexpected.push({ rule: finding.RuleID ?? "unknown", file: relativeFile });
}

if (unexpected.length > 0) {
  for (const finding of unexpected) {
    console.error(`Unexpected generated-output finding: ${finding.rule} in ${finding.file}`);
  }
  process.exit(1);
}

console.log(`Generated-output Gitleaks review passed (${findings.length} reviewed findings).`);
