import { drainCreativeRenderJobs, processNextCreativeRenderJob } from "../src/features/creative-studio/worker";
import { getCreativeRenderProviderConfig } from "../src/features/creative-studio/providers/config";

const DEFAULT_JOB_DELAY_MS = 1_000;
const DEFAULT_IDLE_DELAY_MS = 30_000;

type WorkerOptions = {
    daemon: boolean;
    drainLimit: number;
    jobDelayMs: number;
    idleDelayMs: number;
};

function readNumericArg(name: string, fallback: number): number {
    const prefix = `--${name}=`;
    const arg = process.argv.find((value) => value.startsWith(prefix));
    if (!arg) return fallback;
    const parsed = Number.parseInt(arg.slice(prefix.length), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readOptions(): WorkerOptions {
    const config = getCreativeRenderProviderConfig();
    return {
        daemon: process.argv.includes("--daemon"),
        drainLimit: readNumericArg("drain-limit", config.workerDrainLimit),
        jobDelayMs: readNumericArg("job-delay-ms", DEFAULT_JOB_DELAY_MS),
        idleDelayMs: readNumericArg("idle-delay-ms", DEFAULT_IDLE_DELAY_MS),
    };
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const workerId = `creative-render-worker-${process.pid}-${Date.now()}`;
const options = readOptions();
let shouldStop = false;

process.on("SIGINT", () => {
    shouldStop = true;
    console.log("\n[creative-render-worker] received SIGINT; stopping after current iteration.");
});

process.on("SIGTERM", () => {
    shouldStop = true;
    console.log("\n[creative-render-worker] received SIGTERM; stopping after current iteration.");
});

async function main() {
    console.log(JSON.stringify({ event: "creative_render_worker_start", workerId, options }));

    if (!options.daemon) {
        const results = await drainCreativeRenderJobs({ workerId, limit: Math.max(1, options.drainLimit) });
        console.log(JSON.stringify({ event: "creative_render_worker_drain_complete", workerId, results }));
        return;
    }

    let processed = 0;
    let failed = 0;
    while (!shouldStop) {
        const result = await processNextCreativeRenderJob(workerId);
        if (!result.jobId) {
            console.log(JSON.stringify({ event: "creative_render_worker_idle", workerId, processed, failed }));
            await sleep(options.idleDelayMs);
            continue;
        }

        if (result.success) processed += 1;
        else failed += 1;

        console.log(JSON.stringify({ event: "creative_render_worker_iteration", workerId, result, processed, failed }));
        await sleep(options.jobDelayMs);
    }

    console.log(JSON.stringify({ event: "creative_render_worker_stop", workerId, processed, failed }));
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "creative_render_worker_fatal",
        workerId,
        error: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
});
