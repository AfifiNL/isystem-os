import { parseArgs } from "node:util";
import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const args = parseArgs({
  options: {
    limit: { type: "string" },
    "dry-run": { type: "boolean" },
  },
});

async function main() {
  const secret = process.env.SEO_INDEXING_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  const siteUrl = getSiteUrl();
  const endpoint = `${siteUrl}/api/seo/indexing/drain`;
  const limit = Number.parseInt(args.values.limit || "5", 10);
  const startedAt = Date.now();

  if (args.values["dry-run"]) {
    console.log(JSON.stringify({
      event: "seo_indexing_cron_trigger_dry_run",
      ok: true,
      endpoint,
      limit,
      has_secret: Boolean(secret),
    }));
    return;
  }

  if (!secret) {
    await recordCronWrapperHealth({
      integrationKey: "seo-indexing",
      status: "failing",
      message: "SEO indexing cron wrapper is missing its bearer secret.",
      errorCode: "missing_secret",
      details: { endpoint, limit },
    });
    console.error(JSON.stringify({ event: "seo_indexing_cron_trigger", ok: false, error: "Missing SEO_INDEXING_SECRET or CRON_SECRET" }));
    process.exit(1);
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit }),
    });
  } catch (error) {
    await recordCronWrapperHealth({
      integrationKey: "seo-indexing",
      status: "failing",
      message: error instanceof Error ? error.message : "SEO indexing cron network failure.",
      latencyMs: Date.now() - startedAt,
      statusCode: 0,
      errorCode: "network_failure",
      details: { endpoint, limit },
    });
    console.error(JSON.stringify({
      event: "seo_indexing_cron_trigger",
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : "Network failure",
    }));
    process.exit(1);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  const ok = res.ok && json?.ok !== false;
  await recordCronWrapperHealth({
    integrationKey: "seo-indexing",
    status: ok ? "healthy" : "failing",
    message: ok
      ? `SEO indexing cron processed ${json?.processed ?? 0} job(s).`
      : typeof json?.error === "string" ? json.error : `SEO indexing cron returned HTTP ${res.status}.`,
    latencyMs: Date.now() - startedAt,
    statusCode: res.status,
    errorCode: ok ? null : "seo_indexing_failed",
    details: { endpoint, limit, processed: json?.processed ?? null },
  });

  console.log(JSON.stringify({
    event: "seo_indexing_cron_trigger",
    status: res.status,
    ok,
    response: json,
  }));

  if (!ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    event: "seo_indexing_cron_trigger",
    ok: false,
    error: error instanceof Error ? error.message : "Fatal error in SEO indexing trigger",
  }));
  process.exit(1);
});
