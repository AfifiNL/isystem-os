import { processNextWorkflowRun } from "../src/features/business-spine/workflow-service";
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
const workerId = `workflow-worker-${process.pid}-${Date.now()}`;
let shouldStop = false;

process.on("SIGINT", () => {
    shouldStop = true;
    console.log("\nWorkflow worker received SIGINT. Stopping after current iteration...");
});
process.on("SIGTERM", () => {
    shouldStop = true;
    console.log("\nWorkflow worker received SIGTERM. Stopping after current iteration...");
});

async function main() {
    console.log(`Starting Workflow Worker (${workerId})...`, options);
    let processed = 0;
    let failed = 0;
    let lastHeartbeatAt = Date.now();
    let wasIdle = false;
    let lastIdleWriteAt = 0;

    // Report startup health
    await reportWorkerHealth({
        provider: "workflow",
        integrationKey: "worker",
        status: "healthy",
        message: "Workflow worker daemon started.",
        details: { workerId, ...options }
    });

    while (!shouldStop) {
        const startedAt = Date.now();
        let result;
        try {
            result = await processNextWorkflowRun(workerId);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failed += 1;
            console.error(`[workflow-worker] Unexpected loop error: ${message}`);
            await reportWorkerHealth({
                provider: "workflow",
                integrationKey: "worker",
                status: "degraded",
                message: `Unexpected worker loop error: ${message}`,
                details: { workerId, processed, failed }
            });
            await sleep(options.idleDelayMs);
            continue;
        }

        if (!result.success && result.message === "No queued workflow runs found.") {
            const now = Date.now();
            if (!wasIdle || now - lastIdleWriteAt >= HEARTBEAT_INTERVAL_MS) {
                wasIdle = true;
                lastIdleWriteAt = now;
                await reportWorkerHealth({
                    provider: "workflow",
                    integrationKey: "worker",
                    status: "healthy",
                    message: "No queued workflow runs found; worker is idle.",
                    details: { workerId, idle: true, processed, failed }
                });
            }
            if (!options.daemon) break;
            console.log(`No queued workflow runs found. Sleeping for ${options.idleDelayMs}ms...`);
            await sleep(options.idleDelayMs);
            continue;
        }

        wasIdle = false;
        if (result.success) processed += 1;
        else failed += 1;

        if ("workspaceId" in result && typeof result.workspaceId === "string") {
            await reportWorkerHealth({
                workspaceId: result.workspaceId,
                provider: "workflow",
                integrationKey: "worker",
                status: result.success ? "healthy" : "degraded",
                latencyMs: Date.now() - startedAt,
                message: result.message,
                details: { workerId, runId: "runId" in result ? result.runId : null, processed, failed },
            });
            lastHeartbeatAt = Date.now();
        }

        console.log(`[workflow-worker] ${result.success ? "Processed" : "Failed"} ${"runId" in result ? result.runId : "no-run"}: ${result.message}`);

        // Throttled heartbeat check for global updates if we have active loops but no direct workspace writes
        const now = Date.now();
        if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeatAt = now;
            await reportWorkerHealth({
                provider: "workflow",
                integrationKey: "worker",
                status: "healthy",
                message: "Workflow worker daemon heartbeat.",
                details: { workerId, processed, failed }
            });
        }

        await sleep(options.jobDelayMs);
    }

    console.log(`Workflow Worker finished. Processed ${processed}. Failed/skipped ${failed}.`);
}

main().catch(async (error) => {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    try {
        await reportWorkerHealth({
            provider: "workflow",
            integrationKey: "worker",
            status: "failing",
            message: `Fatal error in workflow-worker: ${message}`,
            details: { workerId }
        });
    } catch (healthErr) {
        console.error("Failed to report fatal worker error to health database:", healthErr);
    }
    process.exitCode = 1;
});
