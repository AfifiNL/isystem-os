import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/market-monitor/run";

function parseArgs(argv: string[]) {
    const options = {
        dryRun: false,
        url: process.env.MARKET_MONITOR_CRON_URL?.trim() || null as string | null,
        workspaceId: process.env.MARKET_MONITOR_WORKSPACE_ID?.trim() || null as string | null,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];
        if (arg === "--dry-run") options.dryRun = true;
        else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        } else if (flag === "--workspace" || flag === "--workspace-id") {
            options.workspaceId = nextValue?.trim() || null;
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
    const secret = process.env.MARKET_MONITOR_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim();
    const startedAt = Date.now();

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "market_monitor_cron_trigger_dry_run",
            ok: true,
            timestamp: new Date().toISOString(),
            endpoint,
            has_secret: Boolean(secret),
            workspace_id: options.workspaceId,
        }));
        return;
    }

    if (!secret) {
        await recordCronWrapperHealth({
            integrationKey: "market-monitor-run",
            status: "failing",
            message: "Market monitor cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            workspaceIds: [options.workspaceId],
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "market_monitor_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "MARKET_MONITOR_CRON_SECRET is required.",
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
                "user-agent": "platform-market-monitor-cron/1.0",
            },
            body: JSON.stringify(options.workspaceId ? { workspace_id: options.workspaceId } : {}),
        });
    } catch (error) {
        await recordCronWrapperHealth({
            integrationKey: "market-monitor-run",
            status: "failing",
            message: error instanceof Error ? error.message : "Market monitor cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
            workspaceIds: [options.workspaceId],
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "market_monitor_cron_trigger",
            ok: false,
            status: 0,
            timestamp: new Date().toISOString(),
            endpoint,
            error: error instanceof Error ? error.message : "Network failure",
        }));
        process.exitCode = 1;
        return;
    }

    const body = await response.json().catch(() => ({ error: "Non-JSON response" })) as Record<string, unknown>;
    const ok = response.ok && typeof body.error !== "string";
    const summary = {
        event: "market_monitor_cron_trigger",
        ok,
        status: response.status,
        timestamp: new Date().toISOString(),
        scanned: typeof body.scanned === "number" ? body.scanned : null,
        error: typeof body.error === "string" ? body.error : null,
    };

    await recordCronWrapperHealth({
        integrationKey: "market-monitor-run",
        status: ok ? "healthy" : "failing",
        message: ok
            ? `Market monitor cron completed${summary.scanned === null ? "." : ` for ${summary.scanned} workspace(s).`}`
            : summary.error ?? `Market monitor cron returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: ok ? null : "market_monitor_failed",
        workspaceIds: [options.workspaceId],
        details: { endpoint, workspace_id: options.workspaceId, scanned: summary.scanned },
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
        event: "market_monitor_cron_trigger",
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unexpected failure",
    }));
    process.exitCode = 1;
});
