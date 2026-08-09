import fs from "fs";
import path from "path";
import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/newsletter/dispatch";

type CronOptions = {
    help: boolean;
    dryRun: boolean;
    url: string | null;
};

type ApiSummary = {
    ok?: boolean;
    automationJobs?: number;
    campaignJobs?: number;
    error?: string;
};

function loadEnv() {
    for (const file of [".env.local", ".env.local-isystem", ".env.production"]) {
        const envPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(envPath)) continue;

        const envContent = fs.readFileSync(envPath, "utf8");
        envContent.split("\n").forEach((line) => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (!match) return;
            const key = match[1];
            if (process.env[key]) return;
            let value = match[2] || "";
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        });
    }
}

function parseArgs(argv: string[]): CronOptions {
    const options: CronOptions = {
        help: false,
        dryRun: false,
        url: process.env.NEWSLETTER_DISPATCH_CRON_URL?.trim() || null,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];

        if (arg === "--help" || arg === "-h") options.help = true;
        else if (arg === "--dry-run") options.dryRun = true;
        else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Newsletter dispatch Coolify cron trigger

Usage:
  npm run cron:newsletter-dispatch -- [--dry-run] [--url <app-url-or-endpoint>]

Environment:
  NEWSLETTER_DISPATCH_SECRET      Required bearer secret for real runs.
  NEWSLETTER_DISPATCH_CRON_URL    Optional app base URL or full dispatch endpoint.
  NEXT_PUBLIC_SITE_URL            Fallback app base URL.
  APP_URL                         Fallback app base URL.

Examples:
  npm run cron:newsletter-dispatch
  npm run cron:newsletter-dispatch -- --dry-run
  npm run cron:newsletter-dispatch -- --url https://client.example
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
        event: "newsletter_dispatch_cron_trigger",
        ok: response.ok === true,
        status,
        timestamp: new Date().toISOString(),
        automation_jobs: numberSummary(response.automationJobs),
        campaign_jobs: numberSummary(response.campaignJobs),
        error: response.error ?? null,
    };
}

async function main() {
    loadEnv();
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const endpoint = resolveEndpoint(options);
    const secret = process.env.NEWSLETTER_DISPATCH_SECRET?.trim() || process.env.CRON_SECRET?.trim();
    const startedAt = Date.now();

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "newsletter_dispatch_cron_trigger_dry_run",
            ok: true,
            timestamp: new Date().toISOString(),
            endpoint,
            has_secret: Boolean(secret),
        }));
        return;
    }

    if (!secret) {
        await recordCronWrapperHealth({
            integrationKey: "newsletter-dispatch",
            status: "failing",
            message: "Newsletter dispatch cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            details: { endpoint },
        });
        console.error(JSON.stringify({
            event: "newsletter_dispatch_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "NEWSLETTER_DISPATCH_SECRET is required.",
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
                "user-agent": "platform-newsletter-dispatch-cron/1.0",
            },
        });
    } catch (error) {
        console.error(JSON.stringify({
            event: "newsletter_dispatch_cron_trigger",
            ok: false,
            status: 0,
            timestamp: new Date().toISOString(),
            endpoint,
            error: error instanceof Error ? error.message : "Network failure",
        }));
        await recordCronWrapperHealth({
            integrationKey: "newsletter-dispatch",
            status: "failing",
            message: error instanceof Error ? error.message : "Newsletter dispatch cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
            details: { endpoint },
        });
        process.exitCode = 1;
        return;
    }

    const text = await response.text();
    let body: ApiSummary = {};
    try {
        body = text ? JSON.parse(text) as ApiSummary : {};
    } catch {
        body = { ok: false, error: text || "Non-JSON response from dispatch endpoint" };
    }

    const summary = operatorSummary(body, response.status);
    await recordCronWrapperHealth({
        integrationKey: "newsletter-dispatch",
        status: response.ok && body.ok !== false ? "healthy" : "failing",
        message: response.ok && body.ok !== false
            ? `Newsletter dispatch cron completed with ${summary.automation_jobs + summary.campaign_jobs} job(s).`
            : body.error ?? `Newsletter dispatch cron returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: response.ok && body.ok !== false ? null : "dispatch_failed",
        details: {
            endpoint,
            automation_jobs: summary.automation_jobs,
            campaign_jobs: summary.campaign_jobs,
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
        event: "newsletter_dispatch_cron_trigger",
        ok: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unexpected failure",
    }));
    process.exitCode = 1;
});
