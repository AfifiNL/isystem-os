import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { delimiter, dirname, isAbsolute, join } from "node:path";

interface FfmpegEnvironment {
    FFMPEG_PATH?: string;
    FFPROBE_PATH?: string;
    PATH?: string;
}

interface FfmpegPathTarget {
    setFfmpegPath(path: string): unknown;
}

interface FfprobePathTarget {
    setFfprobePath(path: string): unknown;
}

function executableFile(candidate: string): string | null {
    try {
        const canonicalPath = realpathSync(candidate);
        if (!statSync(canonicalPath).isFile()) return null;
        accessSync(canonicalPath, constants.X_OK);
        return canonicalPath;
    } catch {
        return null;
    }
}

/**
 * Resolve an operator-installed FFmpeg executable without invoking a shell.
 * An explicit override is fail-closed; PATH is used only when no override is
 * configured, and relative/empty PATH entries are ignored to prevent working-
 * directory executable substitution.
 */
export function resolveFfmpegPath(environment: FfmpegEnvironment = process.env as FfmpegEnvironment): string {
    const override = environment.FFMPEG_PATH?.trim();
    if (override) {
        if (!isAbsolute(override)) {
            throw new Error("FFMPEG_PATH must be an absolute path.");
        }
        const executable = executableFile(override);
        if (!executable) {
            throw new Error("FFMPEG_PATH does not reference an executable file.");
        }
        return executable;
    }

    const executableNames = process.platform === "win32" ? ["ffmpeg.exe", "ffmpeg"] : ["ffmpeg"];
    for (const searchDirectory of (environment.PATH ?? "").split(delimiter)) {
        if (!searchDirectory || !isAbsolute(searchDirectory)) continue;
        for (const executableName of executableNames) {
            const executable = executableFile(join(searchDirectory, executableName));
            if (executable) return executable;
        }
    }

    throw new Error(
        "FFmpeg was not found. Install FFmpeg on the system PATH or set FFMPEG_PATH to its absolute executable path.",
    );
}

/**
 * Resolve ffprobe beside the selected FFmpeg first, then from safe PATH entries.
 * Missing ffprobe remains a supported best-effort state for duration metadata;
 * an explicitly configured but invalid FFPROBE_PATH is always an error.
 */
export function resolveFfprobePath(
    ffmpegPath: string,
    environment: FfmpegEnvironment = process.env as FfmpegEnvironment,
): string | null {
    const override = environment.FFPROBE_PATH?.trim();
    if (override) {
        if (!isAbsolute(override)) {
            throw new Error("FFPROBE_PATH must be an absolute path.");
        }
        const executable = executableFile(override);
        if (!executable) {
            throw new Error("FFPROBE_PATH does not reference an executable file.");
        }
        return executable;
    }

    const executableNames = process.platform === "win32" ? ["ffprobe.exe", "ffprobe"] : ["ffprobe"];
    if (isAbsolute(ffmpegPath)) {
        for (const executableName of executableNames) {
            const sibling = executableFile(join(dirname(ffmpegPath), executableName));
            if (sibling) return sibling;
        }
    }
    for (const searchDirectory of (environment.PATH ?? "").split(delimiter)) {
        if (!searchDirectory || !isAbsolute(searchDirectory)) continue;
        for (const executableName of executableNames) {
            const executable = executableFile(join(searchDirectory, executableName));
            if (executable) return executable;
        }
    }

    return null;
}

/** Apply one resolved executable consistently to a fluent-ffmpeg factory or command. */
export function configureFfmpegPath<T extends FfmpegPathTarget>(
    target: T,
    executablePath = resolveFfmpegPath(),
): T {
    target.setFfmpegPath(executablePath);
    return target;
}

/** Apply a resolved ffprobe path to the fluent-ffmpeg factory. */
export function configureFfprobePath<T extends FfprobePathTarget>(target: T, executablePath: string): T {
    target.setFfprobePath(executablePath);
    return target;
}
