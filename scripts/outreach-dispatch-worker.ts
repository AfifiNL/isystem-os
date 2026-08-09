import { processNextOutreachDispatchJob } from "../src/features/outreach/dispatch";
import { reportWorkerHealth } from "../src/shared/lib/health/evidence";

const DEFAULT_JOB_DELAY_MS = 1_000;
const DEFAULT_IDLE_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function readNumericArg(name: string, fallback: number) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((value) => value.startsWith(prefix));
    if (!arg) return fallback;
    const parsed = Number.parseInt(arg.slice(prefix.length), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const options = {
    daemon: process.argv.includes("--daemon"),
    jobDelayMs: readNumericArg("job-delay-ms", DEFAULT_JOB_DELAY_MS),
    idleDelayMs: readNumericArg("idle-delay-ms", DEFAULT_IDLE_DELAY_MS),
};
const workerId = `outreach-dispatch-worker-${process.pid}-${Date.now()}`;
let shouldStop = false;

process.on("SIGINT", () => {
    shouldStop = true;
    console.log("\nOutreach dispatch worker received SIGINT. Stopping after current iteration...");
});
process.on("SIGTERM", () => {
    shouldStop = true;
    console.log("\nOutreach dispatch worker received SIGTERM. Stopping after current iteration...");
});

async function main() {
    console.log(`Starting Outreach Dispatch Worker (${workerId})...`, options);
    let processed = 0;
    let failed = 0;
    let lastHeartbeatAt = Date.now();
    let wasIdle = false;
    let lastIdleWriteAt = 0;

    // Report startup health
    await reportWorkerHealth({
        provider: "outreach",
        integrationKey: "dispatch-worker",
        status: "healthy",
        message: "Outreach dispatch worker daemon started.",
        details: { workerId, ...options }
    });

    while (!shouldStop) {
        const startedAt = Date.now();
        let result;
        try {
            result = await processNextOutreachDispatchJob(workerId);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failed += 1;
            console.error(`[outreach-dispatch-worker] Unexpected loop error: ${message}`);
            await reportWorkerHealth({
                provider: "outreach",
                integrationKey: "dispatch-worker",
                status: "degraded",
                message: `Unexpected worker loop error: ${message}`,
                details: { workerId, processed, failed }
            });
            await sleep(options.idleDelayMs);
            continue;
        }

        if (result.workspaceId) {
            await reportWorkerHealth({
                workspaceId: result.workspaceId,
                provider: "outreach",
                integrationKey: "dispatch-worker",
                status: result.success ? "healthy" : "degraded",
                latencyMs: Date.now() - startedAt,
                message: result.message,
                details: { workerId, jobId: result.jobId ?? null, processed, failed },
            });
            lastHeartbeatAt = Date.now();
        }

        if (!result.success && result.message === "No queued jobs found.") {
            const now = Date.now();
            if (!wasIdle || now - lastIdleWriteAt >= HEARTBEAT_INTERVAL_MS) {
                wasIdle = true;
                lastIdleWriteAt = now;
                await reportWorkerHealth({
                    provider: "outreach",
                    integrationKey: "dispatch-worker",
                    status: "healthy",
                    message: "No queued dispatch jobs found; worker is idle.",
                    details: { workerId, idle: true, processed, failed }
                });
            }
            if (!options.daemon) break;
            console.log(`No queued dispatch jobs found. Sleeping for ${options.idleDelayMs}ms...`);
            await sleep(options.idleDelayMs);
            continue;
        }

        wasIdle = false;
        if (result.success) processed += 1;
        else failed += 1;

        console.log(`[outreach-dispatch-worker] ${result.success ? "Processed" : "Failed"} ${result.jobId ?? "no-job"}: ${result.message}`);

        // Throttled heartbeat check for global updates if we have active loops but no direct workspace writes
        const now = Date.now();
        if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeatAt = now;
            await reportWorkerHealth({
                provider: "outreach",
                integrationKey: "dispatch-worker",
                status: "healthy",
                message: "Outreach dispatch worker daemon heartbeat.",
                details: { workerId, processed, failed }
            });
        }

        await sleep(options.jobDelayMs);
    }
    console.log(`Outreach Dispatch Worker finished. Processed ${processed}. Failed/skipped ${failed}.`);
}

main().catch(async (error) => {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    try {
        await reportWorkerHealth({
            provider: "outreach",
            integrationKey: "dispatch-worker",
            status: "failing",
            message: `Fatal error in outreach-dispatch-worker: ${message}`,
            details: { workerId }
        });
    } catch (healthErr) {
        console.error("Failed to report fatal worker error to health database:", healthErr);
    }
    process.exitCode = 1;
});
