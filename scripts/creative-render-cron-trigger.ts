import { timingSafeEqual } from "node:crypto";
import { drainCreativeRenderJobs } from "../src/features/creative-studio/worker";
import { getCreativeRenderProviderConfig } from "../src/features/creative-studio/providers/config";

function secretMatches(candidate: string | null, expected: string): boolean {
    if (!candidate) return false;
    const candidateBuffer = Buffer.from(candidate);
    const expectedBuffer = Buffer.from(expected);
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
}

function readArg(name: string): string | null {
    const prefix = `--${name}=`;
    const inline = process.argv.find((value) => value.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function main() {
    const config = getCreativeRenderProviderConfig();
    const expectedSecret = config.cronSecret;
    const candidateSecret = readArg("secret") ?? process.env.CREATIVE_RENDER_CRON_SECRET_CANDIDATE ?? null;
    const dryRun = process.argv.includes("--dry-run");
    const workerId = `creative-render-cron-${process.pid}-${Date.now()}`;

    if (dryRun) {
        console.log(JSON.stringify({ event: "creative_render_cron_dry_run", ok: true, hasSecret: Boolean(expectedSecret), workerId }));
        return;
    }

    if (expectedSecret && !secretMatches(candidateSecret, expectedSecret)) {
        console.error(JSON.stringify({ event: "creative_render_cron_rejected", ok: false, error: "Invalid or missing CREATIVE_RENDER_CRON_SECRET." }));
        process.exitCode = 1;
        return;
    }

    const results = await drainCreativeRenderJobs({ workerId, limit: config.workerDrainLimit });
    console.log(JSON.stringify({ event: "creative_render_cron_complete", ok: true, workerId, results }));
}

main().catch((error) => {
    console.error(JSON.stringify({ event: "creative_render_cron_fatal", ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
});
