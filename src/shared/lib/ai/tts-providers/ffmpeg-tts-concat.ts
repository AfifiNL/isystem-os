/**
 * ffmpeg-backed concatenation for multi-segment TTS output.
 *
 * Replaces the byte-level concat path for multi-speaker dialogues and
 * (optionally) long single-speaker scripts. Solves three concrete gaps:
 *
 *   * MP3 boundary fragility — raw `Buffer.concat` of CBR MP3 risks bit
 *     reservoir pops, ID3 leakage, and decoder-reported duration drift.
 *   * WAV header assumptions — the previous concat hardcoded 44-byte headers
 *     and assumed identical fmt parameters across segments.
 *   * Per-segment loudness drift — different ElevenLabs voices, or the same
 *     voice across separate calls, can sit several dB apart. EBU R128
 *     loudnorm per segment levels them before glue.
 *
 * Bonus: an inter-segment silence pad (default 350 ms) is appended to every
 * segment except the last, producing natural turn-taking pacing instead of
 * the rapid-fire byte-glue feel.
 *
 * Output is always MP3 (libmp3lame, 128 kbps, 44.1 kHz, stereo) to match the
 * downstream mixer's narration input expectation. Callers store the result
 * in podcast-drafts and pass the path to mixEpisode unchanged.
 */

import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import {
    configureFfmpegPath,
    configureFfprobePath,
    resolveFfmpegPath,
    resolveFfprobePath,
} from "@/shared/lib/media/ffmpeg";
import type { TtsResult } from "./types";

export interface FfmpegConcatOptions {
    /** Silence inserted between segments, in milliseconds. Default 350. */
    interSegmentSilenceMs?: number;
    /** Apply EBU R128 loudness normalization per segment. Default true. */
    loudnorm?: boolean;
    /** Logger prefix for diagnostics. */
    logPrefix?: string;
}

function probeDurationSeconds(ffmpegBinary: string, filePath: string): Promise<number> {
    return new Promise((resolve) => {
        const ffprobeBinary = resolveFfprobePath(ffmpegBinary);
        if (!ffprobeBinary) {
            resolve(0);
            return;
        }
        configureFfmpegPath(ffmpeg, ffmpegBinary);
        configureFfprobePath(ffmpeg, ffprobeBinary);
        ffmpeg.ffprobe(filePath, (err, data) => {
            if (err) {
                resolve(0);
                return;
            }
            resolve(data.format?.duration ?? 0);
        });
    });
}

function extensionForMime(mime: string): string {
    if (mime === "audio/mpeg") return "mp3";
    if (mime === "audio/wav") return "wav";
    return "bin";
}

/**
 * Concatenate TTS segments via ffmpeg with optional per-segment loudnorm and
 * inter-segment silence padding. Returns null if any segment is invalid
 * (zero bytes / suspiciously short) — the caller decides whether to retry.
 */
export async function concatTtsSegmentsViaFfmpeg(
    segments: TtsResult[],
    options: FfmpegConcatOptions = {},
): Promise<TtsResult | null> {
    if (segments.length === 0) return null;

    const interSegmentSilenceMs = Math.max(0, Math.min(2000, options.interSegmentSilenceMs ?? 350));
    const loudnorm = options.loudnorm ?? true;
    const logPrefix = options.logPrefix ?? "[ffmpeg-tts-concat]";
    const ffmpegBinary = resolveFfmpegPath();

    // Empty / malformed segment guard. Real spoken audio at 24 kHz mono 16-bit
    // is ~48 KB/s; at 128 kbps MP3 ~16 KB/s. A 1 KB segment is nearly always
    // a header-only artifact from a provider edge case.
    const MIN_BYTES = 1024;
    for (let i = 0; i < segments.length; i += 1) {
        const seg = segments[i];
        const byteLen = Math.floor((seg.base64Audio.length * 3) / 4);
        if (byteLen < MIN_BYTES) {
            console.warn(`${logPrefix} segment ${i} is suspiciously small (${byteLen} bytes); aborting concat.`);
            return null;
        }
    }

    const workDir = join(tmpdir(), `tts-concat-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });

    try {
        const inputPaths: string[] = [];
        for (let i = 0; i < segments.length; i += 1) {
            const seg = segments[i];
            const path = join(workDir, `seg_${i}.${extensionForMime(seg.mimeType)}`);
            await writeFile(path, Buffer.from(seg.base64Audio, "base64"));
            inputPaths.push(path);
        }

        const silenceSeconds = (interSegmentSilenceMs / 1000).toFixed(3);
        const filterParts: string[] = [];
        const concatLabels: string[] = [];

        for (let i = 0; i < segments.length; i += 1) {
            const isLast = i === segments.length - 1;
            const stages: string[] = [
                "aresample=44100",
                "aformat=channel_layouts=stereo:sample_fmts=fltp",
            ];
            if (loudnorm) {
                // Single-pass loudnorm is fast enough for production. Two-pass
                // would be more precise but adds a probe step per segment.
                // Targets are EBU R128 podcast defaults: -16 LUFS integrated,
                // -1.5 dB true-peak, 11 LU range.
                stages.push("loudnorm=I=-16:TP=-1.5:LRA=11");
            }
            if (!isLast && interSegmentSilenceMs > 0) {
                stages.push(`apad=pad_dur=${silenceSeconds}`);
            }
            const label = `a${i}`;
            filterParts.push(`[${i}:a]${stages.join(",")}[${label}]`);
            concatLabels.push(`[${label}]`);
        }
        filterParts.push(`${concatLabels.join("")}concat=n=${segments.length}:v=0:a=1[out]`);
        const filterGraph = filterParts.join(";");

        const outputPath = join(workDir, "out.mp3");
        await new Promise<void>((resolve, reject) => {
            const cmd = configureFfmpegPath(ffmpeg(), ffmpegBinary);
            for (const input of inputPaths) cmd.input(input);
            cmd.complexFilter(filterGraph);
            cmd.outputOptions([
                "-map", "[out]",
                "-c:a", "libmp3lame",
                "-b:a", "128k",
                "-ac", "2",
                "-ar", "44100",
            ]);
            cmd.output(outputPath);
            cmd.on("error", (err, _stdout, stderr) => {
                console.error(`${logPrefix} ffmpeg failed:`, err.message, stderr);
                reject(new Error(`ffmpeg concat failed: ${err.message}`));
            });
            cmd.on("end", () => resolve());
            cmd.run();
        });

        const buffer = await readFile(outputPath);
        const probed = await probeDurationSeconds(ffmpegBinary, outputPath);

        const totalChars = segments.reduce((acc, s) => acc + s.charCount, 0);
        const provider = segments[0].provider;
        const providerModel = segments[0].providerModel;

        return {
            base64Audio: buffer.toString("base64"),
            mimeType: "audio/mpeg",
            charCount: totalChars,
            durationSeconds: probed > 0 ? Math.round(probed) : undefined,
            provider,
            providerModel,
        };
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
