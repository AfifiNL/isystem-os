import fs from "fs";
import path from "path";
import { processNextInternalLinkJob } from "../src/features/seo/worker";
import { reportWorkerHealth } from "../src/shared/lib/health/evidence";

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

// Load environment variables manually
function loadEnv() {
  const envFiles = [".env.local", ".env.local-isystem"];
  let loaded = false;
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      envContent.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || "";
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value;
        }
      });
      console.log(`✅ Loaded environment variables from ${file}`);
      loaded = true;
    }
  }
  if (!loaded) {
    console.warn("⚠️ Warning: No env file found (.env.local or .env.local-isystem). If in production VPS, relying on container/OS env variables.");
  }
}

loadEnv();

const workerId = `hetzner-worker-${process.pid}-${Date.now()}`;
const options = readOptions();
let shouldStop = false;

process.on("SIGINT", () => {
  shouldStop = true;
  console.log("\n🛑 SEO Internal Link Background Worker received SIGINT. Stopping after current iteration...");
});

process.on("SIGTERM", () => {
  shouldStop = true;
  console.log("\n🛑 SEO Internal Link Background Worker received SIGTERM. Stopping after current iteration...");
});

async function main() {
  console.log(`🚀 Starting SEO Internal Link Background Worker (${workerId})...`, options);

  let processed = 0;
  let failed = 0;
  let lastHeartbeatAt = Date.now();
  let wasIdle = false;
  let lastIdleWriteAt = 0;

  // Report startup health
  await reportWorkerHealth({
    provider: "seo",
    integrationKey: "internal-links-worker",
    status: "healthy",
    message: "SEO internal-link worker daemon started.",
    details: { workerId, ...options }
  });

  while (!shouldStop) {
    const startedAt = Date.now();
    try {
      const result = await processNextInternalLinkJob(workerId);
      if ("workspaceId" in result && result.workspaceId) {
        const resultMessage = "message" in result && typeof result.message === "string"
          ? result.message
          : result.success
            ? "SEO internal-link job processed."
            : "SEO internal-link job failed.";
        await reportWorkerHealth({
          workspaceId: result.workspaceId,
          provider: "seo",
          integrationKey: "internal-links-worker",
          status: result.success ? "healthy" : "degraded",
          latencyMs: Date.now() - startedAt,
          message: resultMessage,
          details: { workerId, jobId: result.jobId ?? null, processed, failed },
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
              provider: "seo",
              integrationKey: "internal-links-worker",
              status: "healthy",
              message: "No queued internal-link jobs found; worker is idle.",
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

        if (!options.daemon && !result.jobId) {
          break;
        }

        await sleep(options.jobDelayMs);
        continue;
      }

      wasIdle = false;
      processed++;
      console.log(`[seo-worker] ✅ Processed job: ${result.jobId}`);

      // Throttled heartbeat check for global updates if we have active loops but no direct workspace writes
      const now = Date.now();
      if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatAt = now;
        await reportWorkerHealth({
          provider: "seo",
          integrationKey: "internal-links-worker",
          status: "healthy",
          message: "SEO internal-link worker daemon heartbeat.",
          details: { workerId, processed, failed }
        });
      }

      await sleep(options.jobDelayMs);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("❌ Worker loop encountered unexpected error:", message);

      failed++;
      await reportWorkerHealth({
        provider: "seo",
        integrationKey: "internal-links-worker",
        status: "degraded",
        message: `Unexpected worker loop error: ${message}`,
        details: { workerId, processed, failed }
      });

      if (!options.daemon) {
        break;
      }

      await sleep(options.idleDelayMs);
    }
  }

  console.log(`🎉 SEO Internal Link Background Worker finished. Processed ${processed} jobs. Failed/skipped ${failed} jobs.`);
}

main().catch(async (error) => {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  try {
    await reportWorkerHealth({
      provider: "seo",
      integrationKey: "internal-links-worker",
      status: "failing",
      message: `Fatal error in seo-internal-link-worker: ${message}`,
      details: { workerId }
    });
  } catch (healthErr) {
    console.error("Failed to report fatal worker error to health database:", healthErr);
  }
});
