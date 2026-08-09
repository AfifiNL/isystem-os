import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/outreach/dispatch";

function parseArgs(argv: string[]) {
    const options = {
        dryRun: false,
        url: process.env.OUTREACH_DISPATCH_CRON_URL?.trim() || null as string | null,
        limit: Number.parseInt(process.env.OUTREACH_DISPATCH_CRON_LIMIT || "10", 10),
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];
        if (arg === "--dry-run") options.dryRun = true;
        else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        } else if (flag === "--limit") {
            options.limit = Number.parseInt(nextValue ?? "10", 10);
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
    const secret = process.env.OUTREACH_DISPATCH_SECRET?.trim() || process.env.CRON_SECRET?.trim();
    const startedAt = Date.now();

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "outreach_dispatch_cron_trigger_dry_run",
            ok: true,
            timestamp: new Date().toISOString(),
            endpoint,
            has_secret: Boolean(secret),
            limit: options.limit,
        }));
        return;
    }

    if (!secret) {
        await recordCronWrapperHealth({
            integrationKey: "outreach-dispatch",
            status: "failing",
            message: "Outreach dispatch cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            details: { endpoint, limit: options.limit },
        });
        console.error(JSON.stringify({
            event: "outreach_dispatch_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "OUTREACH_DISPATCH_SECRET is required.",
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
                "user-agent": "platform-outreach-dispatch-cron/1.0",
            },
            body: JSON.stringify({ limit: options.limit }),
        });
    } catch (error) {
        await recordCronWrapperHealth({
            integrationKey: "outreach-dispatch",
            status: "failing",
            message: error instanceof Error ? error.message : "Outreach dispatch cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
            details: { endpoint, limit: options.limit },
        });
        console.error(JSON.stringify({
            event: "outreach_dispatch_cron_trigger",
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
    const summary = {
        event: "outreach_dispatch_cron_trigger",
        ok: response.ok && body.ok === true,
        status: response.status,
        timestamp: new Date().toISOString(),
        processed: typeof body.processed === "number" ? body.processed : 0,
        failed: typeof body.failed === "number" ? body.failed : 0,
        error: typeof body.error === "string" ? body.error : null,
    };
    await recordCronWrapperHealth({
        integrationKey: "outreach-dispatch",
        status: summary.ok ? "healthy" : "failing",
        message: summary.ok
            ? `Outreach dispatch cron processed ${summary.processed} job(s).`
            : summary.error ?? `Outreach dispatch cron returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: summary.ok ? null : "outreach_dispatch_failed",
        details: { endpoint, limit: options.limit, processed: summary.processed, failed: summary.failed },
    });
    const line = JSON.stringify(summary);
    if (!summary.ok) {
        console.error(line);
        process.exitCode = 1;
        return;
    }
    console.log(line);
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "outreach_dispatch_cron_trigger",
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unexpected failure",
    }));
    process.exitCode = 1;
});
