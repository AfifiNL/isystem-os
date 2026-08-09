import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "..");

const TARGET_DIRS = [
  path.join(WORKSPACE_ROOT, "src/features/templates/pages"),
  path.join(WORKSPACE_ROOT, "src/app/(public)"),
];

const LOCALIZED_PAGES = ["blog", "contact", "podcast", "services", "booking", "projects", "about", "videos", "portal"];

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) values.set(rawKey, inlineValue);
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) values.set(rawKey, argv[++index]);
    else flags.add(rawKey);
  }
  return { flags, values };
}

function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(getFilesRecursively(filePath));
    else if (file.endsWith(".tsx") || file.endsWith(".ts")) results.push(filePath);
  }
  return results;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split("\n").length;
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const errors = [];
  const pagesPattern = LOCALIZED_PAGES.join("|");
  const regexes = [
    new RegExp(`href\\s*=\\s*["']\\/(${pagesPattern})(?![a-zA-Z0-9])([^"']*)["']`, "g"),
    new RegExp(`href\\s*=\\s*\\{\\s*["'\`]\\/(${pagesPattern})(?![a-zA-Z0-9])([^"'\`]*?)["'\`]\\s*\\}`, "g"),
    new RegExp(`href\\s*=\\s*\\{\\s*\`\\/(${pagesPattern})(?![a-zA-Z0-9])`, "g"),
  ];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      errors.push({
        line: getLineNumber(content, match.index),
        match: match[0],
        message: `Raw href "${match[0]}" points to a localized route. Wrap it with localizeHref(locale, ...).`,
      });
    }
  }
  const seen = new Set();
  return errors.filter((err) => {
    const key = `${err.line}:${err.match}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.line - b.line);
}

function htmlDecode(value) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function normalizeHref(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value, "https://example.test");
    return `${parsed.pathname.replace(/\/$/, "")}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function stripTags(value) {
  return htmlDecode(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function expectedHrefCandidates(targetSlug, targetType, locale) {
  const clean = String(targetSlug ?? "").replace(/^\/+|\/+$/g, "");
  if (!clean) return [];
  const route = targetType === "blog" || targetType === "blog_post" || targetType === "newsletter_issue"
    ? `/blog/${clean}`
    : clean === "home" ? "/" : `/${clean}`;
  const loc = locale === "nl" || locale === "ar" ? locale : "en";
  return Array.from(new Set([route, `/${loc}${route === "/" ? "" : route}`])).map(normalizeHref);
}

function extractAnchorsFromMarkdown(markdown) {
  const anchors = [];
  const regex = /\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = regex.exec(markdown ?? "")) !== null) anchors.push({ text: match[1], href: normalizeHref(match[2]), rel: "" });
  return anchors;
}

function extractAnchorsFromHtml(html) {
  const anchors = [];
  const regex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html ?? "")) !== null) {
    const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[1] ?? "");
    const rel = /rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[1] ?? "");
    anchors.push({
      text: stripTags(match[2] ?? ""),
      href: normalizeHref(htmlDecode(href?.[1] ?? href?.[2] ?? href?.[3] ?? "")),
      rel: (rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? "").toLowerCase(),
    });
  }
  return anchors;
}

function getPathValue(value, pathSegments) {
  let current = value;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = current[segment];
  }
  return typeof current === "string" ? current : null;
}

function extractAnchorsFromVisualLayout(layout, fieldPath) {
  const anchors = [];
  if (!layout || typeof layout !== "object") return anchors;
  if (fieldPath) {
    for (const block of Array.isArray(layout.content) ? layout.content : []) {
      anchors.push(...extractAnchorsFromHtml(getPathValue(block, fieldPath.split(".")) ?? ""));
    }
    return anchors;
  }
  const visit = (node) => {
    if (typeof node === "string" && /<a\b/i.test(node)) anchors.push(...extractAnchorsFromHtml(node));
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") Object.values(node).forEach(visit);
  };
  visit(layout);
  return anchors;
}

function appliedLinkVisibility(row) {
  const locale = row.event_locale ?? row.content_locale ?? row.opportunity_locale ?? "en";
  const expectedHrefs = expectedHrefCandidates(row.target_slug ?? row.target_content_slug, row.target_type, locale);
  const targetAnchor = String(row.anchor_text ?? "").trim().toLowerCase();
  const isMarkdown = row.content_field_mutated === "content_markdown" || row.content_format === "markdown";
  const anchors = isMarkdown ? extractAnchorsFromMarkdown(row.content_markdown ?? "") : extractAnchorsFromVisualLayout(row.visual_layout, row.field_path);
  const match = anchors.find((anchor) => {
    const hrefMatches = expectedHrefs.length === 0 || expectedHrefs.includes(anchor.href);
    const text = anchor.text.trim().toLowerCase();
    return hrefMatches && (!targetAnchor || text === targetAnchor || text.includes(targetAnchor));
  });
  return { ok: Boolean(match), expectedHrefs, anchors, nofollow: match?.rel?.split(/\s+/).includes("nofollow") ?? false };
}

async function validateAppliedLinksFromSupabase({ url, key, workspaceId, limit }) {
  const endpoint = new URL("/rest/v1/seo_internal_link_opportunities", url);
  endpoint.searchParams.set("select", [
    "id,status,workspace_id,locale,anchor_text,target_slug,source_content_id,target_content_id,last_execution_event_id,applied_at",
    "source:content_items!seo_internal_link_opportunities_source_content_id_fkey(id,slug,type,locale,content_markdown,visual_layout,updated_at)",
    "target:content_items!seo_internal_link_opportunities_target_content_id_fkey(id,slug,type,locale)",
    "event:seo_execution_events!seo_internal_link_opportunities_last_execution_event_id_fkey(id,execution_status,content_field_mutated,content_format,field_path,locale,target_slug,updated_content_snapshot,applied_at)",
  ].join(","));
  endpoint.searchParams.set("status", "eq.applied");
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("order", "applied_at.desc.nullslast");
  if (workspaceId) endpoint.searchParams.set("workspace_id", `eq.${workspaceId}`);

  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase validation query failed: ${response.status} ${await response.text()}`);

  const rows = await response.json();
  const failures = [];
  const warnings = [];
  for (const row of rows) {
    const source = Array.isArray(row.source) ? row.source[0] : row.source;
    const target = Array.isArray(row.target) ? row.target[0] : row.target;
    const event = Array.isArray(row.event) ? row.event[0] : row.event;
    const flattened = {
      ...row,
      content_markdown: source?.content_markdown ?? null,
      visual_layout: source?.visual_layout ?? null,
      content_locale: source?.locale ?? null,
      opportunity_locale: row.locale ?? null,
      event_locale: event?.locale ?? null,
      target_content_slug: target?.slug ?? null,
      target_type: target?.type ?? null,
      target_slug: event?.target_slug ?? row.target_slug ?? target?.slug ?? null,
      content_field_mutated: event?.content_field_mutated ?? null,
      content_format: event?.content_format ?? null,
      field_path: event?.field_path ?? null,
    };
    const visibility = appliedLinkVisibility(flattened);
    if (!event || event.execution_status !== "applied") {
      failures.push({ id: row.id, reason: "Opportunity is applied but last execution event is missing or not applied." });
    } else if (!visibility.ok) {
      failures.push({ id: row.id, source: source?.slug, target: flattened.target_slug, reason: "Applied row drift: expected anchor/href is not visible in current source content.", expectedHrefs: visibility.expectedHrefs, visibleAnchors: visibility.anchors.slice(0, 5) });
    } else if (visibility.nofollow) {
      warnings.push({ id: row.id, reason: "Visible internal anchor carries rel=nofollow." });
    }
  }
  return { scanned: rows.length, failures, warnings };
}

function validateSourceLinks() {
  const files = TARGET_DIRS.flatMap((dir) => getFilesRecursively(dir));
  let totalErrors = 0;
  console.log(`Scanning ${files.length} files under target directories for SEO link issues...`);
  for (const file of files) {
    const errors = validateFile(file);
    if (errors.length > 0) {
      console.error(`\n❌ Error(s) in ${path.relative(WORKSPACE_ROOT, file)}:`);
      for (const err of errors) {
        console.error(`  Line ${err.line}: ${err.message}`);
        totalErrors += 1;
      }
    }
  }
  if (totalErrors > 0) console.error(`\nSource validation FAILED: ${totalErrors} issue(s) found.`);
  else console.log("\n✅ Source validation PASSED: template internal links are properly localized.");
  return totalErrors === 0;
}

async function main() {
  const args = parseArgs(process.argv);
  const sourceOk = args.flags.has("applied-only") ? true : validateSourceLinks();
  let appliedOk = true;
  if (args.flags.has("applied") || args.flags.has("applied-only")) {
    const url = args.values.get("supabase-url") ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = args.values.get("supabase-key") ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Applied-link validation requires --supabase-url and --supabase-key, or matching environment variables.");
    const result = await validateAppliedLinksFromSupabase({
      url,
      key,
      workspaceId: args.values.get("workspace-id") ?? process.env.SEO_VALIDATE_WORKSPACE_ID ?? null,
      limit: Number(args.values.get("limit") ?? 100),
    });
    for (const warning of result.warnings) console.warn(`⚠️  ${warning.id}: ${warning.reason}`);
    for (const failure of result.failures) console.error(`❌ ${failure.id}: ${failure.reason} ${JSON.stringify(failure)}`);
    appliedOk = result.failures.length === 0;
    console.log(`\nApplied-link validation scanned ${result.scanned} applied row(s), ${result.failures.length} failure(s), ${result.warnings.length} warning(s).`);
  }
  process.exit(sourceOk && appliedOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
