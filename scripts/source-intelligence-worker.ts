import { processNextSourceIngestionJob, sourceWorkerIntegrationStatusForResult } from "../src/features/source-intelligence/worker";
import { reportWorkerHealth } from "../src/shared/lib/health/evidence";
import { assertSourceIntelligenceSupabaseTarget, loadSourceIntelligenceEnv } from "./source-intelligence-env";

const DEFAULT_JOB_DELAY_MS = 1_000;
const DEFAULT_IDLE_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type WorkerOptions = {
    daemon: boolean;
    jobDelayMs: number;
    idleDelayMs: number;
};

function readNumericArg(name: string, fallback: number) {
    const prefix = `--${name}=`;
    const arg = process.argv.find((value) => value.startsWith(prefix));
    if (!arg) return fallback;

    const parsed = Number.parseInt(arg.slice(prefix.length), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readOptions(): WorkerOptions {
    return {
        daemon: process.argv.includes("--daemon"),
        jobDelayMs: readNumericArg("job-delay-ms", DEFAULT_JOB_DELAY_MS),
        idleDelayMs: readNumericArg("idle-delay-ms", DEFAULT_IDLE_DELAY_MS),
    };
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

loadSourceIntelligenceEnv({ log: true });
assertSourceIntelligenceSupabaseTarget();

const workerId = `source-intelligence-worker-${process.pid}-${Date.now()}`;
const options = readOptions();
let shouldStop = false;

process.on("SIGINT", () => {
    shouldStop = true;
    console.log("\n🛑 Source Intelligence Worker received SIGINT. Stopping after current iteration...");
});

process.on("SIGTERM", () => {
    shouldStop = true;
    console.log("\n🛑 Source Intelligence Worker received SIGTERM. Stopping after current iteration...");
});

async function main() {
    console.log(`🚀 Starting Source Intelligence Worker (${workerId})...`, options);

    let processed = 0;
    let failed = 0;
    let lastHeartbeatAt = Date.now();
    let wasIdle = false;
    let lastIdleWriteAt = 0;

    // Report startup health
    await reportWorkerHealth({
        provider: "source-intelligence",
        integrationKey: "worker",
        status: "healthy",
        message: "Source Intelligence worker daemon started.",
        details: { workerId, ...options }
    });

    while (!shouldStop) {
        const startedAt = Date.now();
        try {
            const result = await processNextSourceIngestionJob(workerId);
            if (result.workspaceId) {
                const healthStatus = sourceWorkerIntegrationStatusForResult(result);
                await reportWorkerHealth({
                    workspaceId: result.workspaceId,
                    provider: "source-intelligence",
                    integrationKey: "worker",
                    status: healthStatus,
                    latencyMs: Date.now() - startedAt,
                    message: result.success
                        ? result.message
                        : healthStatus === "healthy"
                            ? `Worker handled source job; source ingestion failed: ${result.message}`
                            : result.message,
                    details: { workerId, jobId: result.jobId ?? null, processed, failed, jobSucceeded: result.success, failureKind: result.failureKind ?? null },
                });
                lastHeartbeatAt = Date.now();
            }

            if (!result.success) {
                if (result.message === "No queued jobs found.") {
                    const now = Date.now();
                    if (!wasIdle || now - lastIdleWriteAt >= HEARTBEAT_INTERVAL_MS) {
                        wasIdle = true;
                        lastIdleWriteAt = now;
                        await reportWorkerHealth({
                            provider: "source-intelligence",
                            integrationKey: "worker",
                            status: "healthy",
                            message: "No queued source ingestion jobs found; worker is idle.",
                            details: { workerId, idle: true, processed, failed }
                        });
                    }

                    if (!options.daemon) {
                        console.log("ℹ️ No queued jobs left. Exiting.");
                        break;
                    }

                    console.log(`ℹ️ No queued jobs found. Sleeping for ${options.idleDelayMs}ms...`);
                    await sleep(options.idleDelayMs);
                    continue;
                }

                wasIdle = false;
                failed++;
                console.warn(`⚠️ Job processing skipped or failed: ${result.message}`);
                if (!options.daemon && !result.jobId) break;
                await sleep(options.jobDelayMs);
                continue;
            }

            wasIdle = false;
            processed++;
            console.log(`[source-intelligence-worker] ✅ Processed job: ${result.jobId}`);

            // Throttled heartbeat check for global updates if we have active loops but no direct workspace writes
            const now = Date.now();
            if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
                lastHeartbeatAt = now;
                await reportWorkerHealth({
                    provider: "source-intelligence",
                    integrationKey: "worker",
                    status: "healthy",
                    message: "Source Intelligence worker daemon heartbeat.",
                    details: { workerId, processed, failed }
                });
            }

            await sleep(options.jobDelayMs);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error("❌ Worker loop encountered unexpected error:", message);
            failed++;

            await reportWorkerHealth({
                provider: "source-intelligence",
                integrationKey: "worker",
                status: "degraded",
                message: `Unexpected worker loop error: ${message}`,
                details: { workerId, processed, failed }
            });

            if (!options.daemon) break;
            await sleep(options.idleDelayMs);
        }
    }

    console.log(`🎉 Source Intelligence Worker finished. Processed ${processed} jobs. Failed/skipped ${failed} jobs.`);
}

main().catch(async (error) => {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    try {
        await reportWorkerHealth({
            provider: "source-intelligence",
            integrationKey: "worker",
            status: "failing",
            message: `Fatal error in source-intelligence-worker: ${message}`,
            details: { workerId }
        });
    } catch (healthErr) {
        console.error("Failed to report fatal worker error to health database:", healthErr);
    }
    process.exitCode = 1;
});
