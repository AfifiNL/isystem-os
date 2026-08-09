// Episode mixing core. Extracted out of /api/mix-podcast-episode so server
// actions (publishEpisode) can invoke it in-process — eliminates the cookie-
// forwarding + base-URL self-fetch fragility that publishEpisode used to deal
// with.
//
// The route handler at /api/mix-podcast-episode now wraps this function with
// HTTP plumbing (auth, body parsing, error mapping), and publishEpisode calls
// the same function directly using a service-role Supabase client.

import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
    configureFfmpegPath,
    configureFfprobePath,
    resolveFfmpegPath,
    resolveFfprobePath,
} from "@/shared/lib/media/ffmpeg";

const DRAFTS_BUCKET = "podcast-drafts";
const MUSIC_BUCKET = "workspace-music";
const PUBLIC_BUCKET = "audio-episodes";

interface MusicAttachment {
    role: "intro" | "bed" | "outro";
    start_offset_ms: number;
    fade_in_ms: number;
    fade_out_ms: number;
    gain_db: number;
    storage_path: string;
}

export interface MixEpisodeResult {
    audioUrl: string;
    byteSize: number;
    durationSeconds: number;
}

export interface MixEpisodeError {
    error: string;
    status: number;
}

// Speech tuning — applied to narration before any mix step. TTS providers
// emit at a loudness that's pleasant in isolation but loses presence under a
// bed; +4 dB of pre-gain restores the voice without clipping for typical
// material.
const NARRATION_PREGAIN_DB = 4;

// Bed reduction relative to the operator-configured `bed.gain_db`. The schema
// default is -18 dB; subtracting an extra 6 dB here lands the bed at -24 dB
// effective, which sits comfortably under speech for most material. If the
// operator wants the bed louder they can set a less-negative gain in the UI.
const BED_EXTRA_REDUCTION_DB = 6;

function buildFilterGraph(intro?: MusicAttachment, bed?: MusicAttachment, outro?: MusicAttachment): string {
    let nextIndex = 1;
    const introIdx = intro ? nextIndex++ : -1;
    const bedIdx = bed ? nextIndex++ : -1;
    const outroIdx = outro ? nextIndex++ : -1;

    // ffmpeg filter-graph rule: each labelled output can be consumed exactly
    // once. Use `asplit` whenever a stream feeds two downstream filters
    // (e.g. narration into both sidechaincompress AND amix when a bed is
    // attached).
    //
    // Loudness shaping notes:
    //   * Narration gets a small pre-gain so it cuts through under a bed.
    //   * `amix` would auto-normalize by 1/N, dragging both inputs down. We
    //     pass `normalize=0` to preserve absolute levels — the bed is already
    //     attenuated and ducked, and the narration is the primary content.
    //   * `apad=pad_dur=0.5` keeps a half-second of silence at the end of
    //     narration so a following concat (intro/outro) doesn't clip the tail.
    const parts: string[] = [];
    parts.push(
        `[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=${NARRATION_PREGAIN_DB}dB,apad=pad_dur=0.5[narr]`,
    );

    let speechLabel = "narr";
    if (bed) {
        // Effective bed gain = configured gain – extra reduction. Negative dB
        // attenuates further; positive dB would only happen if the operator
        // set a very loud bed, in which case we still cap with the reduction.
        const gain = bed.gain_db - BED_EXTRA_REDUCTION_DB;
        const offset = Math.max(0, bed.start_offset_ms ?? 0);
        const delayClause = offset > 0 ? `,adelay=${offset}|${offset}` : "";
        // Split the narration so we can feed it into both the sidechain
        // (control signal) and the final mix (audible signal).
        parts.push(`[narr]asplit=2[narrSC][narrMIX]`);
        parts.push(
            `[${bedIdx}:a]aresample=44100,aformat=channel_layouts=stereo,aloop=loop=-1:size=2147483647${delayClause},volume=${gain}dB[bedraw]`,
        );
        // Tighter threshold + faster release than before. TTS narration peaks
        // around -18 to -8 dBFS; threshold=0.02 (~ -34 dB) reliably triggers
        // the ducker on conversational speech without pumping on quiet beds.
        parts.push(
            `[bedraw][narrSC]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=250:makeup=1[bedducked]`,
        );
        // normalize=0 preserves the absolute levels we set above — without
        // this amix would multiply both inputs by 1/N and the voice would lose
        // 6 dB after the bed has already been attenuated.
        parts.push(
            `[bedducked][narrMIX]amix=inputs=2:duration=first:dropout_transition=0.5:normalize=0[trunk]`,
        );
        speechLabel = "trunk";
    }

    let prevLabel = speechLabel;

    if (intro) {
        const fadeOut = (intro.fade_out_ms / 1000).toFixed(2);
        const introOffset = Math.max(0, intro.start_offset_ms ?? 0);
        const introDelay = introOffset > 0 ? `,adelay=${introOffset}|${introOffset}` : "";
        // Fade the END of the intro out (not the beginning!). `afade=t=out`
        // requires a known start time, which we don't have without probing
        // the file first. The classic workaround: reverse → fade-in → reverse.
        // This is mathematically identical to fading out at the end and
        // doesn't require pre-probing the intro length. Without this fix the
        // intro plays its first `fadeOut` seconds (fading to silence) and
        // then sits silent for the rest of its duration, producing the
        // multi-second "silent intro" that operators report.
        parts.push(
            `[${introIdx}:a]aresample=44100,aformat=channel_layouts=stereo${introDelay},areverse,afade=t=in:st=0:d=${fadeOut},areverse[introproc]`,
        );
        parts.push(`[introproc][${prevLabel}]concat=n=2:v=0:a=1[withintro]`);
        prevLabel = "withintro";
    }

    if (outro) {
        const fadeIn = (outro.fade_in_ms / 1000).toFixed(2);
        const outroOffset = Math.max(0, outro.start_offset_ms ?? 0);
        const outroDelay = outroOffset > 0 ? `,adelay=${outroOffset}|${outroOffset}` : "";
        parts.push(
            `[${outroIdx}:a]aresample=44100,aformat=channel_layouts=stereo${outroDelay},afade=t=in:st=0:d=${fadeIn}[outroproc]`,
        );
        parts.push(`[${prevLabel}][outroproc]concat=n=2:v=0:a=1[final]`);
        prevLabel = "final";
    }

    if (prevLabel !== "final") {
        parts.push(`[${prevLabel}]anull[final]`);
    }

    return parts.join(";");
}

async function probeDurationSeconds(ffmpegBinary: string, filePath: string): Promise<number> {
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
            const seconds = data.format?.duration ?? 0;
            resolve(Math.round(seconds));
        });
    });
}

async function runFfmpegMix(
    ffmpegBinary: string,
    inputs: string[],
    filterGraph: string,
    outputPath: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const cmd = configureFfmpegPath(ffmpeg(), ffmpegBinary);
        for (const input of inputs) cmd.input(input);
        cmd.complexFilter(filterGraph);
        cmd.outputOptions([
            "-map", "[final]",
            "-c:a", "libmp3lame",
            "-b:a", "128k",
            "-ac", "2",
            "-ar", "44100",
        ]);
        cmd.output(outputPath);
        cmd.on("error", (err, _stdout, stderr) => {
            console.error("[mix-episode] ffmpeg error:", err.message, stderr);
            reject(new Error(`ffmpeg failed: ${err.message}`));
        });
        cmd.on("end", () => resolve());
        cmd.run();
    });
}

async function uploadAndFinalize(
    supabase: SupabaseClient,
    workspaceId: string,
    episodeId: string,
    buffer: Buffer,
    durationSeconds?: number,
): Promise<MixEpisodeResult> {
    const publicPath = `${workspaceId}/${episodeId}/audio.mp3`;
    const { error: uploadError } = await supabase.storage
        .from(PUBLIC_BUCKET)
        .upload(publicPath, buffer, {
            contentType: "audio/mpeg",
            upsert: true,
            cacheControl: "public, max-age=3600",
        });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(publicPath);
    return {
        audioUrl: urlData.publicUrl,
        byteSize: buffer.length,
        durationSeconds: durationSeconds ?? Math.round(buffer.length / 16384),
    };
}

/**
 * Mix the narration audio for an episode together with its attached intro,
 * bed, and outro tracks (if any), upload the resulting MP3 to the public
 * audio-episodes bucket, and return the final URL + size + duration.
 *
 * The supplied Supabase client should be a service-role client — the function
 * needs to read from `podcast-drafts` (private) and `workspace-music` (private)
 * and write to `audio-episodes` (public). The caller is responsible for
 * authorizing the operation upstream.
 */
export async function mixEpisode(
    supabase: SupabaseClient,
    params: { episodeId: string; expectedWorkspaceId: string },
): Promise<MixEpisodeResult | MixEpisodeError> {
    const { episodeId, expectedWorkspaceId } = params;

    const { data: episode, error: episodeError } = await supabase
        .from("podcast_episodes")
        .select("id, workspace_id, narration_only_url, audio_mime_type")
        .eq("id", episodeId)
        .maybeSingle();
    if (episodeError) return { error: episodeError.message, status: 500 };
    if (!episode) return { error: "Episode not found", status: 404 };
    if (episode.workspace_id !== expectedWorkspaceId) {
        return { error: "Episode is outside the caller workspace.", status: 403 };
    }
    if (!episode.narration_only_url) {
        return { error: "Episode has no narration audio yet.", status: 409 };
    }

    const { data: musicRows, error: musicError } = await supabase
        .from("podcast_episode_music")
        .select(`
            role,
            start_offset_ms,
            fade_in_ms,
            fade_out_ms,
            gain_db,
            workspace_music_tracks!inner(storage_path)
        `)
        .eq("episode_id", episodeId);
    if (musicError) return { error: musicError.message, status: 500 };

    type MusicRow = {
        role: "intro" | "bed" | "outro";
        start_offset_ms: number;
        fade_in_ms: number;
        fade_out_ms: number;
        gain_db: number;
        workspace_music_tracks: { storage_path: string } | { storage_path: string }[];
    };
    const attachments: MusicAttachment[] = (musicRows ?? []).map((row: unknown) => {
        const r = row as MusicRow;
        const track = Array.isArray(r.workspace_music_tracks) ? r.workspace_music_tracks[0] : r.workspace_music_tracks;
        return {
            role: r.role,
            start_offset_ms: r.start_offset_ms ?? 0,
            fade_in_ms: r.fade_in_ms,
            fade_out_ms: r.fade_out_ms,
            gain_db: r.gain_db,
            storage_path: track?.storage_path ?? "",
        };
    }).filter((a) => a.storage_path);

    const intro = attachments.find((a) => a.role === "intro");
    const bed = attachments.find((a) => a.role === "bed");
    const outro = attachments.find((a) => a.role === "outro");

    const workDir = join(tmpdir(), `podcast-mix-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });

    try {
        const narrationExt =
            episode.narration_only_url.toLowerCase().endsWith(".mp3") || episode.audio_mime_type === "audio/mpeg"
                ? "mp3"
                : "wav";
        const narrationPath = join(workDir, `narration.${narrationExt}`);
        {
            const { data, error } = await supabase.storage.from(DRAFTS_BUCKET).download(episode.narration_only_url);
            if (error || !data) {
                return { error: `Could not download narration: ${error?.message ?? "missing"}`, status: 500 };
            }
            await writeFile(narrationPath, Buffer.from(await data.arrayBuffer()));
        }

        const inputs: string[] = [narrationPath];
        const downloadSlot = async (attachment: MusicAttachment | undefined, idx: number) => {
            if (!attachment) return;
            const ext = attachment.storage_path.split(".").pop() || "mp3";
            const slotPath = join(workDir, `slot_${idx}.${ext}`);
            const { data, error } = await supabase.storage.from(MUSIC_BUCKET).download(attachment.storage_path);
            if (error || !data) {
                throw new Error(`Could not download ${attachment.role} track: ${error?.message ?? "missing"}`);
            }
            await writeFile(slotPath, Buffer.from(await data.arrayBuffer()));
            inputs.push(slotPath);
        };
        await downloadSlot(intro, 1);
        await downloadSlot(bed, 2);
        await downloadSlot(outro, 3);

        const ffmpegBinary = resolveFfmpegPath();
        const outputPath = join(workDir, "out.mp3");

        if (!intro && !bed && !outro) {
            if (narrationExt === "mp3") {
                const buffer = await readFile(narrationPath);
                return await uploadAndFinalize(supabase, episode.workspace_id, episode.id, buffer);
            }
            await new Promise<void>((resolve, reject) => {
                const cmd = configureFfmpegPath(ffmpeg(), ffmpegBinary);
                cmd.input(narrationPath);
                cmd.outputOptions(["-c:a", "libmp3lame", "-b:a", "128k", "-ac", "2", "-ar", "44100"]);
                cmd.output(outputPath);
                cmd.on("error", (err, _stdout, stderr) => {
                    console.error("[mix-episode] transcode error:", err.message, stderr);
                    reject(new Error(`Transcode failed: ${err.message}`));
                });
                cmd.on("end", () => resolve());
                cmd.run();
            });
        } else {
            const filterGraph = buildFilterGraph(intro, bed, outro);
            await runFfmpegMix(ffmpegBinary, inputs, filterGraph, outputPath);
        }

        const buffer = await readFile(outputPath);
        const durationSeconds = await probeDurationSeconds(ffmpegBinary, outputPath);
        return await uploadAndFinalize(supabase, episode.workspace_id, episode.id, buffer, durationSeconds);
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
