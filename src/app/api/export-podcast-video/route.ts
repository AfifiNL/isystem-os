import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { createClient } from "@supabase/supabase-js";
import { configureFfmpegPath, resolveFfmpegPath } from "@/shared/lib/media/ffmpeg";
import { assertWorkspaceAdminOrManager } from "@/shared/lib/workspace/context";

export const runtime = "nodejs";
export const maxDuration = 300;

// SSRF guard: any URL we hand to fetch() or ffmpeg must originate from our
// own Supabase storage. Without this, a workspace admin can write
// `audio_url = file:///etc/passwd` or `http://169.254.169.254/...` into a
// podcast_episodes row and have the server (or ffmpeg's protocol handlers)
// follow it on export. ffmpeg in particular supports file://, http://,
// concat:, hls, rtmp, subfile:, and data: by default — see -protocol_whitelist
// below for the complementary defense at the demuxer layer.
function getStorageOriginPrefix(): string | null {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!raw) return null;
    try {
        const u = new URL(raw);
        // Public storage URLs look like: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
        return `${u.origin}/storage/v1/object/`;
    } catch {
        return null;
    }
}

function isTrustedStorageUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    const prefix = getStorageOriginPrefix();
    if (!prefix) return false;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        return url.startsWith(prefix);
    } catch {
        return false;
    }
}

// Tight protocol allowlist for ffmpeg input. `file` is intentionally included
// because we feed local poster/audio temp files to the same demuxer; it cannot
// be reached via attacker-controlled URLs because every URL that lands in
// `cmd.input(...)` either (a) was just written by us into workDir, or (b)
// passed isTrustedStorageUrl.
const FFMPEG_PROTOCOL_WHITELIST = "file,https,tls,tcp";

const PUBLIC_BUCKET = "audio-episodes"; // reuse — exports live alongside the published audio

type SocialFormat = "square" | "vertical" | "landscape";

interface ExportBody {
    episodeId: string;
    format?: SocialFormat;
}

const FORMAT_DIMENSIONS: Record<SocialFormat, { width: number; height: number }> = {
    square: { width: 1080, height: 1080 },        // Instagram Feed, LinkedIn
    vertical: { width: 1080, height: 1920 },      // Reels, Shorts, TikTok
    landscape: { width: 1920, height: 1080 },     // YouTube, X, LinkedIn
};

/**
 * Compose a still poster: blurred cover-art backdrop + dark gradient overlay
 * + centered cover. No text — the user adds caption on the destination
 * platform. Result is a PNG buffer at exact target dimensions.
 */
async function buildPoster(
    coverBytes: Buffer,
    format: SocialFormat,
): Promise<Buffer> {
    const { width, height } = FORMAT_DIMENSIONS[format];

    // Background: cover art scaled to fill, heavily blurred, then dark gradient
    // overlay for visual depth + text-safe surface (in case captions are
    // burned-in by the social platform).
    const background = await sharp(coverBytes)
        .resize(width, height, { fit: "cover", position: "attention" })
        .blur(40)
        .modulate({ brightness: 0.55 })
        .toBuffer();

    // Foreground: cover art at ~60% of the shorter dimension, centered.
    const coverSize = Math.round(Math.min(width, height) * 0.62);
    const cover = await sharp(coverBytes)
        .resize(coverSize, coverSize, { fit: "cover", position: "centre" })
        .png({ compressionLevel: 6 })
        .toBuffer();

    // Optional radial vignette to draw eyes to the center cover.
    const vignetteSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <defs>
                <radialGradient id="g" cx="50%" cy="50%" r="65%">
                    <stop offset="0%" stop-color="black" stop-opacity="0" />
                    <stop offset="100%" stop-color="black" stop-opacity="0.45" />
                </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)" />
        </svg>`,
    );

    return sharp(background)
        .composite([
            { input: vignetteSvg, top: 0, left: 0 },
            {
                input: cover,
                top: Math.round((height - coverSize) / 2),
                left: Math.round((width - coverSize) / 2),
            },
        ])
        .png({ compressionLevel: 9 })
        .toBuffer();
}


async function downloadByUrl(url: string): Promise<Buffer | null> {
    if (!isTrustedStorageUrl(url)) {
        console.warn("[export-podcast-video] refusing to download untrusted URL");
        return null;
    }
    try {
        const res = await fetch(url, { cache: "no-store", redirect: "manual" });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
    } catch {
        return null;
    }
}

// Quick HEAD check so we fail with a clear JSON error if the audio URL is
// unreachable, rather than blowing up inside ffmpeg with an opaque exit code.
async function isUrlReachable(url: string): Promise<boolean> {
    if (!isTrustedStorageUrl(url)) return false;
    try {
        const res = await fetch(url, { method: "HEAD", cache: "no-store", redirect: "manual" });
        return res.ok;
    } catch {
        return false;
    }
}

async function buildVideo(
    ffmpegBinary: string,
    posterPath: string,
    audioInput: string,
    outputPath: string,
    format: SocialFormat,
): Promise<void> {
    const { width, height } = FORMAT_DIMENSIONS[format];
    return new Promise((resolve, reject) => {
        const cmd = configureFfmpegPath(ffmpeg(), ffmpegBinary);
        // -loop 1 keeps the still image looping until audio runs out.
        // -protocol_whitelist clamps libavformat to file/https/tls/tcp so
        // attacker-supplied input URLs can't trigger ffmpeg's `concat:`,
        // `subfile:`, `hls`, `data:`, `rtmp` or other historically risky
        // protocol handlers (CVE-2016-1897/8 and friends). Applies to the
        // input that follows it, so we attach it to BOTH inputs.
        cmd.input(posterPath).inputOptions([
            "-protocol_whitelist", FFMPEG_PROTOCOL_WHITELIST,
            "-loop", "1",
        ]);
        // `audioInput` may be a local file path OR an https:// URL — ffmpeg's
        // libavformat resolves both. Streaming from URL avoids holding the
        // full MP3 in memory, which matters on serverless runtimes where the
        // function memory is the binding constraint.
        cmd.input(audioInput).inputOptions([
            "-protocol_whitelist", FFMPEG_PROTOCOL_WHITELIST,
        ]);
        cmd.outputOptions([
            "-c:v", "libx264",
            "-tune", "stillimage",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-vf", `scale=${width}:${height}:force_original_aspect_ratio=disable`,
            "-r", "24",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "44100",
            "-shortest",
            "-movflags", "+faststart",
        ]);
        cmd.output(outputPath);
        cmd.on("error", (err, _stdout, stderr) => {
            console.error("[export-podcast-video] ffmpeg error:", err.message, stderr);
            reject(new Error(`ffmpeg failed: ${err.message}`));
        });
        cmd.on("end", () => resolve());
        cmd.run();
    });
}

/**
 * Auth: same pattern as the mixer — accepts either user-cookie session or
 * an internal service-role bearer token (for future server-action callers).
 */
async function resolveCallerWorkspaceId(
    request: NextRequest,
    bodyWorkspaceId: string | undefined,
): Promise<{ workspaceId: string } | { error: string; status: number }> {
    const authHeader = request.headers.get("authorization") ?? "";
    const internalSecret = process.env.PODCAST_INTERNAL_SECRET?.trim();
    if (
        internalSecret
        && authHeader.startsWith("Bearer ")
        && authHeader.slice("Bearer ".length).trim() === internalSecret
    ) {
        if (!bodyWorkspaceId) {
            return { error: "workspaceId required for internal-token requests.", status: 400 };
        }
        return { workspaceId: bodyWorkspaceId };
    }
    try {
        const context = await assertWorkspaceAdminOrManager();
        return { workspaceId: context.activeWorkspace.id };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unauthorized";
        const status = message.startsWith("Forbidden") ? 403 : 401;
        return { error: message, status };
    }
}

export async function POST(request: NextRequest) {
    let workDir: string | null = null;
    try {
        const body = (await request.json()) as ExportBody & { workspaceId?: string };
        if (!body.episodeId) {
            return NextResponse.json({ error: "episodeId required" }, { status: 400 });
        }
        const format: SocialFormat = body.format && (body.format in FORMAT_DIMENSIONS)
            ? body.format
            : "square";

        const auth = await resolveCallerWorkspaceId(request, body.workspaceId);
        if ("error" in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const callerWorkspaceId = auth.workspaceId;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !serviceRoleKey) {
            return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
        }
        const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Load episode + show for cover-art fallbacks.
        const { data: episode, error: epError } = await supabase
            .from("podcast_episodes")
            .select(`
                id, workspace_id, title, slug, audio_url, audio_mime_type,
                audio_duration_seconds, cover_art_url, status,
                podcast_shows!inner(slug, cover_art_url)
            `)
            .eq("id", body.episodeId)
            .maybeSingle();
        if (epError) return NextResponse.json({ error: epError.message }, { status: 500 });
        if (!episode || episode.workspace_id !== callerWorkspaceId) {
            return NextResponse.json({ error: "Episode not found in this workspace." }, { status: 404 });
        }
        if (episode.status !== "published" || !episode.audio_url) {
            return NextResponse.json(
                { error: "Episode must be published with rendered audio before export." },
                { status: 409 },
            );
        }

        const show = Array.isArray(episode.podcast_shows) ? episode.podcast_shows[0] : episode.podcast_shows;

        // Resolve cover image. Prefer episode cover, fall back to show cover.
        const coverUrl = episode.cover_art_url || show?.cover_art_url || null;
        if (!coverUrl) {
            return NextResponse.json(
                { error: "No cover art available — set one on the episode or show before exporting." },
                { status: 400 },
            );
        }

        // SSRF guard: episode.audio_url and cover_art_url are persisted strings
        // that an admin/manager can write into the DB. Refuse to touch any URL
        // that isn't on our own Supabase storage origin so neither downloadByUrl
        // nor ffmpeg can be coerced into reaching internal services, the cloud
        // metadata endpoint, or the local filesystem via file:// / concat:.
        if (!isTrustedStorageUrl(coverUrl)) {
            return NextResponse.json(
                { error: "Cover art URL is not hosted on this project's storage." },
                { status: 400 },
            );
        }
        if (!isTrustedStorageUrl(episode.audio_url)) {
            return NextResponse.json(
                { error: "Audio URL is not hosted on this project's storage." },
                { status: 400 },
            );
        }

        workDir = join(tmpdir(), `podcast-export-${randomUUID()}`);
        await mkdir(workDir, { recursive: true });

        // Download cover art only — we keep this in memory because sharp
        // operates on Buffers. The audio is streamed directly from its public
        // URL into ffmpeg below to keep peak memory low on serverless.
        const coverBytes = await downloadByUrl(coverUrl);
        if (!coverBytes) {
            return NextResponse.json({ error: "Could not download cover art." }, { status: 500 });
        }

        // Verify the audio URL is actually reachable so we surface a clear
        // 502 rather than a cryptic ffmpeg exit code if it isn't.
        if (!(await isUrlReachable(episode.audio_url))) {
            return NextResponse.json(
                { error: "Published audio URL is not reachable. Re-publish the episode to refresh it." },
                { status: 502 },
            );
        }

        const posterBuffer = await buildPoster(coverBytes, format);

        const posterPath = join(workDir, `poster-${format}.png`);
        const outputPath = join(workDir, `episode-${format}.mp4`);

        await writeFile(posterPath, posterBuffer);

        const ffmpegBinary = resolveFfmpegPath();
        // Pass audio_url directly so ffmpeg streams it via libavformat instead
        // of buffering the whole MP3 in Node.
        await buildVideo(ffmpegBinary, posterPath, episode.audio_url, outputPath, format);

        const mp4Bytes = await readFile(outputPath);

        // Upload to the public bucket under exports/. Filenames are
        // workspace-id-prefixed so storage RLS still enforces admin/manager
        // writes (write policy uses the first folder segment).
        const exportPath = `${callerWorkspaceId}/${episode.id}/exports/${format}-${Date.now()}.mp4`;
        const { error: uploadError } = await supabase.storage
            .from(PUBLIC_BUCKET)
            .upload(exportPath, mp4Bytes, {
                contentType: "video/mp4",
                cacheControl: "public, max-age=86400",
                upsert: true,
            });
        if (uploadError) {
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        const { data: urlData } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(exportPath);
        const downloadFilename = `${show?.slug ?? "podcast"}-${episode.slug}-${format}.mp4`;

        await rm(workDir, { recursive: true, force: true });
        workDir = null;

        return NextResponse.json({
            videoUrl: urlData.publicUrl,
            byteSize: mp4Bytes.length,
            format,
            dimensions: FORMAT_DIMENSIONS[format],
            durationSeconds: episode.audio_duration_seconds,
            downloadFilename,
        });
    } catch (err: unknown) {
        if (workDir) {
            await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
        }
        const message = err instanceof Error ? err.message : "Export failed";
        console.error("[export-podcast-video] error:", err);
        const status = message.startsWith("Forbidden") ? 403 : message.startsWith("Unauthorized") ? 401 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
