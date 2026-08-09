import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/cron/stale-content-scanner";

function parseArgs(argv: string[]) {
    const options = {
        dryRun: false,
        url: process.env.CONTENT_FRESHNESS_CRON_URL?.trim() || null as string | null,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];
        if (arg === "--dry-run") options.dryRun = true;
        else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        }
    }
    return options;
}

function resolveEndpoint(configured: string | null) {
    const base = configured
        || process.env.NEXT_PUBLIC_SITE_URL?.trim()
        || process.env.APP_URL?.trim()
        || getSiteUrl();
    const url = new URL(base);
    if (!url.pathname.endsWith(ENDPOINT_PATH)) {
        url.pathname = `${url.pathname.replace(/\/$/, "")}${ENDPOINT_PATH}`;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const endpoint = resolveEndpoint(options.url);
    const secret = process.env.CONTENT_FRESHNESS_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
    const startedAt = Date.now();

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "content_freshness_cron_trigger_dry_run",
            ok: true,
            timestamp: new Date().toISOString(),
            endpoint,
            has_secret: Boolean(secret),
        }));
        return;
    }

    if (!secret) {
        await recordCronWrapperHealth({
            integrationKey: "stale-content-scanner",
            status: "failing",
            message: "Content freshness cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "content_freshness_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "CONTENT_FRESHNESS_CRON_SECRET or CRON_SECRET is required.",
        }));
        process.exitCode = 1;
        return;
    }

    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                authorization: `Bearer ${secret}`,
                "content-type": "application/json",
                "user-agent": "platform-content-freshness-cron/1.0",
            },
        });
    } catch (error) {
        await recordCronWrapperHealth({
            integrationKey: "stale-content-scanner",
            status: "failing",
            message: error instanceof Error ? error.message : "Content freshness cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "content_freshness_cron_trigger",
            ok: false,
            status: 0,
            timestamp: new Date().toISOString(),
            endpoint,
            error: error instanceof Error ? error.message : "Network failure",
        }));
        process.exitCode = 1;
        return;
    }

    const body = await response.json().catch(() => ({ ok: false, error: "Non-JSON response" })) as Record<string, unknown>;
    const ok = response.ok && body.ok !== false;
    const scanned = typeof body.scanned === "number" ? body.scanned : 0;
    const stale = typeof body.stale === "number" ? body.stale : 0;
    const summary = {
        event: "content_freshness_cron_trigger",
        ok,
        status: response.status,
        timestamp: new Date().toISOString(),
        scanned,
        stale,
        error: typeof body.error === "string" ? body.error : null,
    };

    await recordCronWrapperHealth({
        integrationKey: "stale-content-scanner",
        status: ok ? (stale > 0 ? "degraded" : "healthy") : "failing",
        message: ok
            ? `Content freshness cron scanned ${scanned} item(s) and found ${stale} stale item(s).`
            : (summary.error ?? `Content freshness cron returned HTTP ${response.status}.`),
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: ok ? (stale > 0 ? "stale_content_detected" : null) : "content_freshness_failed",
        details: { endpoint, ...summary },
    });

    const line = JSON.stringify(summary);
    if (!ok) {
        console.error(line);
        process.exitCode = 1;
        return;
    }
    console.log(line);
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "content_freshness_cron_trigger",
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unexpected failure",
    }));
    process.exitCode = 1;
});
