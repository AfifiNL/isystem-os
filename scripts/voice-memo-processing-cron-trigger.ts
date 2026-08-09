import fs from "fs";
import path from "path";
import { recordCronWrapperHealth } from "./lib/cron-health";
import { getSiteUrl } from "../src/shared/lib/site-url";

const ENDPOINT_PATH = "/api/voice-memos/process";

type CronOptions = {
    help: boolean;
    dryRun: boolean;
    limit: number;
    url: string | null;
};

type ApiSummary = {
    ok?: boolean;
    timestamp?: string;
    attempted?: number;
    processed?: number;
    failed?: number;
    skipped?: number;
    error?: string | null;
};

function loadEnv() {
    for (const file of [".env.local", ".env.production"]) {
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

function parseInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseVoiceMemoCronArgs(argv: string[]): CronOptions {
    const options: CronOptions = {
        help: false,
        dryRun: false,
        limit: parseInteger(process.env.VOICE_MEMO_PROCESSING_CRON_LIMIT, 3),
        url: process.env.VOICE_MEMO_PROCESSING_CRON_URL?.trim() || null,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const [flag, inlineValue] = arg.split("=", 2);
        const nextValue = inlineValue ?? argv[index + 1];

        if (arg === "--help" || arg === "-h") options.help = true;
        else if (arg === "--dry-run") options.dryRun = true;
        else if (flag === "--limit") {
            options.limit = parseInteger(nextValue, options.limit);
            if (!inlineValue) index += 1;
        } else if (flag === "--url") {
            options.url = nextValue?.trim() || null;
            if (!inlineValue) index += 1;
        }
    }

    options.limit = Math.max(1, Math.min(10, Math.trunc(options.limit)));
    return options;
}

function printHelp() {
    console.log(`Voice memo processing Coolify cron trigger

Usage:
  npm run cron:voice-memo-processing -- [--limit 3] [--dry-run] [--url <app-url-or-endpoint>]

Environment:
  VOICE_MEMO_PROCESSING_SECRET      Required bearer secret for real runs; CRON_SECRET is accepted as fallback.
  VOICE_MEMO_PROCESSING_CRON_URL    Optional app base URL or full processing endpoint.
  VOICE_MEMO_PROCESSING_CRON_LIMIT  Optional default processing limit, capped at 10.
  NEXT_PUBLIC_SITE_URL              Fallback app base URL.
  APP_URL                           Fallback app base URL.

Examples:
  npm run cron:voice-memo-processing
  npm run cron:voice-memo-processing -- --limit 5
  npm run cron:voice-memo-processing -- --dry-run
`);
}

export function resolveVoiceMemoProcessingEndpoint(options: Pick<CronOptions, "url">): string {
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
        event: "voice_memo_processing_cron_trigger",
        ok: response.ok === true,
        status,
        timestamp: response.timestamp ?? new Date().toISOString(),
        attempted: numberSummary(response.attempted),
        processed: numberSummary(response.processed),
        failed: numberSummary(response.failed),
        skipped: numberSummary(response.skipped),
        error: response.error ?? null,
    };
}

async function main() {
    loadEnv();
    const options = parseVoiceMemoCronArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const endpoint = resolveVoiceMemoProcessingEndpoint(options);
    const secret = process.env.VOICE_MEMO_PROCESSING_SECRET?.trim() || process.env.CRON_SECRET?.trim();
    const payload = { limit: options.limit };
    const startedAt = Date.now();

    if (options.dryRun) {
        console.log(JSON.stringify({
            event: "voice_memo_processing_cron_trigger_dry_run",
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
            integrationKey: "voice-memo-processing",
            status: "failing",
            message: "Voice memo processing cron wrapper is missing its bearer secret.",
            errorCode: "missing_secret",
            details: { endpoint, payload },
        });
        console.error(JSON.stringify({
            event: "voice_memo_processing_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            endpoint,
            error: "VOICE_MEMO_PROCESSING_SECRET or CRON_SECRET is required.",
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
                "user-agent": "platform-voice-memo-processing-cron/1.0",
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error(JSON.stringify({
            event: "voice_memo_processing_cron_trigger",
            ok: false,
            status: 0,
            timestamp: new Date().toISOString(),
            endpoint,
            error: error instanceof Error ? error.message : "Network failure",
        }));
        await recordCronWrapperHealth({
            integrationKey: "voice-memo-processing",
            status: "failing",
            message: error instanceof Error ? error.message : "Voice memo processing cron network failure.",
            latencyMs: Date.now() - startedAt,
            statusCode: 0,
            errorCode: "network_failure",
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
        body = { ok: false, error: text || "Non-JSON response from voice memo processing endpoint" };
    }

    const summary = operatorSummary(body, response.status);
    await recordCronWrapperHealth({
        integrationKey: "voice-memo-processing",
        status: response.ok && body.ok !== false ? "healthy" : "failing",
        message: response.ok && body.ok !== false
            ? `Voice memo cron processed ${summary.processed} of ${summary.attempted} attempted memos.`
            : body.error ?? `Voice memo cron returned HTTP ${response.status}.`,
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
        errorCode: response.ok && body.ok !== false ? null : "voice_memo_processing_failed",
        details: { endpoint, payload, ...summary },
    });

    const serialized = JSON.stringify(summary);
    if (!response.ok || body.ok === false) {
        console.error(serialized);
        process.exitCode = 1;
        return;
    }

    console.log(serialized);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error(JSON.stringify({
            event: "voice_memo_processing_cron_trigger",
            ok: false,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unexpected cron trigger failure",
        }));
        process.exitCode = 1;
    });
}
