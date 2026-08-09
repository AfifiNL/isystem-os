import { processNextContentTranslationJob } from "../src/features/blog/translation-jobs";
import { reportWorkerHealth } from "../src/shared/lib/health/evidence";
import {
    assertSourceIntelligenceSupabaseTarget,
    loadSourceIntelligenceEnv,
} from "./source-intelligence-env";

const DEFAULT_JOB_DELAY_MS = 1_000;
const DEFAULT_IDLE_DELAY_MS = 30_000;

function numericArgument(name: string, fallback: number): number {
    const prefix = `--${name}=`;
    const value = process.argv.find((argument) => argument.startsWith(prefix));
    if (!value) return fallback;
    const parsed = Number.parseInt(value.slice(prefix.length), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

loadSourceIntelligenceEnv({ log: true });
assertSourceIntelligenceSupabaseTarget();

const workerId = `content-translation-worker-${process.pid}-${Date.now()}`;
const daemon = process.argv.includes("--daemon");
const jobDelayMs = numericArgument("job-delay-ms", DEFAULT_JOB_DELAY_MS);
const idleDelayMs = numericArgument("idle-delay-ms", DEFAULT_IDLE_DELAY_MS);
let shouldStop = false;

process.on("SIGINT", () => {
    shouldStop = true;
});
process.on("SIGTERM", () => {
    shouldStop = true;
});

async function main(): Promise<void> {
    await reportWorkerHealth({
        provider: "content-translation",
        integrationKey: "worker",
        status: "healthy",
        message: "Content translation worker started.",
        details: { workerId, daemon, jobDelayMs, idleDelayMs },
    });

    while (!shouldStop) {
        const startedAt = Date.now();
        const result = await processNextContentTranslationJob(workerId);

        if (result.message === "No queued translation jobs found.") {
            if (!daemon) break;
            await sleep(idleDelayMs);
            continue;
        }

        await reportWorkerHealth({
            workspaceId: result.workspaceId,
            provider: "content-translation",
            integrationKey: "worker",
            status: result.success || !result.terminal ? "healthy" : "degraded",
            latencyMs: Date.now() - startedAt,
            message: result.message,
            details: {
                workerId,
                jobId: result.jobId ?? null,
                terminal: result.terminal ?? null,
            },
        });

        if (!daemon && !result.success) break;
        await sleep(jobDelayMs);
    }
}

main().catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[content-translation-worker] Fatal worker error:", message);
    try {
        await reportWorkerHealth({
            provider: "content-translation",
            integrationKey: "worker",
            status: "failing",
            message,
            details: { workerId },
        });
    } catch (healthError) {
        console.error("[content-translation-worker] Health reporting failed:", healthError);
    }
    process.exitCode = 1;
});
