import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveFfmpegPath } from "@/shared/lib/media/ffmpeg";
import { concatTtsSegmentsViaFfmpeg } from "./ffmpeg-tts-concat";

test("concatenates generated WAV speech segments through the system FFmpeg", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "ffmpeg-concat-"));
    try {
        const ffmpegPath = resolveFfmpegPath();
        const segments = await Promise.all([440, 660].map(async (frequency, index) => {
            const outputPath = join(fixtureRoot, `segment-${index}.wav`);
            const generated = spawnSync(ffmpegPath, [
                "-hide_banner",
                "-loglevel", "error",
                "-f", "lavfi",
                "-i", `sine=frequency=${frequency}:duration=0.2`,
                "-c:a", "pcm_s16le",
                outputPath,
            ], { encoding: "utf8" });
            assert.equal(generated.status, 0, generated.stderr);
            return {
                base64Audio: (await readFile(outputPath)).toString("base64"),
                charCount: 20,
                mimeType: "audio/wav" as const,
                provider: "vertex" as const,
                providerModel: "test-system-ffmpeg",
            };
        }));

        const result = await concatTtsSegmentsViaFfmpeg(segments, {
            interSegmentSilenceMs: 50,
            loudnorm: false,
            logPrefix: "[ffmpeg-integration-test]",
        });

        assert.ok(result);
        assert.equal(result.mimeType, "audio/mpeg");
        assert.equal(result.charCount, 40);
        assert.ok(Buffer.from(result.base64Audio, "base64").length > 1024);
    } finally {
        await rm(fixtureRoot, { force: true, recursive: true });
    }
});
