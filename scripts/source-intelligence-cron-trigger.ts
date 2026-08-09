import { assertSourceIntelligenceSupabaseTarget, loadSourceIntelligenceEnv } from "./source-intelligence-env";
import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/source-intelligence/run";

type CronOptions = {
    help: boolean;
    dryRun: boolean;
    drain: boolean;
    limit: number;
    workspace: string | null;
    url: string | null;
};

type ApiSummary = {
    ok?: boolean;
    timestamp?: string;
    requestedAt?: string;
    trigger?: string;
    reason?: string;
    runId?: string | null;
    enqueued?: number;
    processed?: number;
    failed?: number;
    skipped?: number;
    existingQueued?: number;
    existingRunning?: number;
    queuedJobsWaiting?: boolean;
    workerLikelyIdle?: boolean;
    error?: string;
};

function envBoolean(name: string, fallback: boolean): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    if (!raw) return fallback;
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envInteger(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(argv: string[]): CronOptions {
    const options: CronOptions = {
        help: false,
        dryRun: false,
        drain: envBoolean("SOURCE_INTELLIGENCE_CRON_DRAIN", false),
        limit: envInteger("SOURCE_INTELLIGENCE_CRON_LIMIT", 0),
        workspace: process.env.SOURCE_INTELLIGENCE_CRON_WORKSPACE?.trim() || null,
        url: process.env.SOURCE_INTELLIGENCE_CRON_URL?.trim() || null,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];

        if (arg === "--help" || arg === "-h") options.help = true;
        else if (arg === "--dry-run") options.dryRun = true;
        else if (arg === "--drain") {
            options.drain = true;
            if (inlineValue) options.limit = parseInteger(inlineValue, options.limit || 3);
        } else if (flag === "--drain") {
            options.drain = true;
            options.limit = parseInteger(inlineValue, options.limit || 3);
        } else if (flag === "--limit") {
            options.limit = parseInteger(nextValue, options.limit);
            if (!inlineValue) index += 1;
        } else if (flag === "--workspace" || flag === "--workspace-id") {
            options.workspace = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        } else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        }
    }

    if (options.drain && options.limit === 0) options.limit = 3;
    options.limit = Math.max(0, Math.min(options.limit, 10));
    return options;
}

function printHelp() {
    console.log(`Source Intelligence Coolify cron trigger

Usage:
  npm run cron:source-intelligence -- [--drain] [--limit 3] [--workspace <workspace-id>] [--dry-run]

Environment:
  SOURCE_INTELLIGENCE_CRON_SECRET   Required bearer secret for real runs.
  SOURCE_INTELLIGENCE_CRON_URL      Optional app base URL or full run endpoint.
  NEXT_PUBLIC_SITE_URL              Fallback app base URL.
  APP_URL                           Fallback app base URL.
  SOURCE_INTELLIGENCE_CRON_DRAIN    Optional boolean default for --drain.
  SOURCE_INTELLIGENCE_CRON_LIMIT    Optional default drain limit, capped at 10.
  SOURCE_INTELLIGENCE_CRON_WORKSPACE Optional workspace filter.

Examples:
  npm run cron:source-intelligence
  npm run cron:source-intelligence -- --drain --limit 3
  npm run cron:source-intelligence -- --workspace 00000000-0000-0000-0000-000000000000
  npm run cron:source-intelligence -- --dry-run
`);
}

function resolveEndpoint(options: CronOptions): string {
    const configured = options.url
        || process.env.NEXT_PUBLIC_SITE_URL?.trim()
        || process.env.APP_URL?.trim()
        || process.env.NEXT_PUBLIC_APP_URL?.trim()
        || getSiteUrl();
    const url = new URL(configured);
    if (!url.pathname.endsWith(ENDPOINT_PATH)) {
        url.pathname = `${url.pathname.replace(/\/$/, "")}${ENDPOINT_PATH}`;
    }
    url.search = "";
    url.hash = "";
    return url.toString();
}

function numberSummary(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function operatorSummary(response: ApiSummary, status: number) {
    return {
        event: "source_intelligence_cron_trigger",
        ok: response.ok === true,
        status,
        timestamp: response.timestamp ?? new Date().toISOString(),
        requested_at: response.requestedAt ?? null,
        trigger: response.trigger ?? "cron",
        reason: response.reason ?? "scheduled",
        run_id: response.runId ?? null,
        enqueued_count: numberSummary(response.enqueued),
        processed_count: numberSummary(response.processed),
        failed_count: numberSummary(response.failed),
        skipped_count: numberSummary(response.skipped),
        existing_queued_count: numberSummary(response.existingQueued),
        existing_running_count: numberSummary(response.existingRunning),
        queued_jobs_waiting: Boolean(response.queuedJobsWaiting),
        worker_likely_idle: Boolean(response.workerLikelyIdle),
        error: response.error ?? null,
    };
}

async function main() {
    loadSourceIntelligenceEnv();
    assertSourceIntelligenceSupabaseTarget();
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const endpoint = resolveEndpoint(options);
    const secret = process.env.SOURCE_INTELLIGENCE_CRON_SECRET?.trim();
    const startedAt = Date.now();
    const payload = {
        reason: "scheduled",
        trigger: "cron",
        drain: options.drain ? options.limit : 0,
        limit: options.drain ? options.limit : 0,
        workspace_id: options.workspace,
    };

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "source_intelligence_cron_trigger_dry_run",
            ok: true,
            timestamp: new Date().toISOString(),
            endpoint,
            has_secret: Boolean(secret),
            payload,
        }));
        return;
    }

    if (!secret) {
        await recordCronWrapperHealth({
            integrationKey: "source-intelligence-run",
            status: "failing",
            message: "Source Intelligence cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            workspaceIds: [options.workspace],
            details: { endpoint, payload },
        });
        console.error(JSON.stringify({
            event: "source_intelligence_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "SOURCE_INTELLIGENCE_CRON_SECRET is required.",
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
                "user-agent": "platform-source-intelligence-cron/1.0",
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error(JSON.stringify({
            event: "source_intelligence_cron_trigger",
            ok: false,
            status: 0,
            timestamp: new Date().toISOString(),
            endpoint,
            error: error instanceof Error ? error.message : "Network failure",
        }));
        await recordCronWrapperHealth({
            integrationKey: "source-intelligence-run",
            status: "failing",
            message: error instanceof Error ? error.message : "Source Intelligence cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
            workspaceIds: [options.workspace],
            details: { endpoint, payload },
        });
        process.exitCode = 1;
        return;
    }

    const text = await response.text();
    let body: ApiSummary = {};
    try {
        body = text ? JSON.parse(text) as ApiSummary : {};
    } catch {
        body = { ok: false, error: text || "Non-JSON response from cron endpoint" };
    }

    const summary = operatorSummary(body, response.status);
    await recordCronWrapperHealth({
        integrationKey: "source-intelligence-run",
        status: response.ok && body.ok !== false ? "healthy" : "failing",
        message: response.ok && body.ok !== false
            ? `Source Intelligence cron processed ${summary.processed_count} and enqueued ${summary.enqueued_count}.`
            : body.error ?? `Source Intelligence cron returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: response.ok && body.ok !== false ? null : "source_intelligence_failed",
        workspaceIds: [options.workspace],
        details: {
            endpoint,
            payload,
            enqueued_count: summary.enqueued_count,
            processed_count: summary.processed_count,
            failed_count: summary.failed_count,
            skipped_count: summary.skipped_count,
            queued_jobs_waiting: summary.queued_jobs_waiting,
            worker_likely_idle: summary.worker_likely_idle,
        },
    });
    const serialized = JSON.stringify(summary);
    if (!response.ok || body.ok === false) {
        console.error(serialized);
        process.exitCode = 1;
        return;
    }

    console.log(serialized);
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "source_intelligence_cron_trigger",
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unexpected cron trigger failure",
    }));
    process.exitCode = 1;
});
