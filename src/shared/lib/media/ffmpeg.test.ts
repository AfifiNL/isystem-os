import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
    configureFfmpegPath,
    configureFfprobePath,
    resolveFfmpegPath,
    resolveFfprobePath,
} from "./ffmpeg";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

async function createExecutable(name = "ffmpeg"): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "ffmpeg-resolver-"));
    temporaryDirectories.push(directory);
    const executable = join(directory, name);
    await writeFile(executable, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(executable, 0o755);
    return executable;
}

describe("resolveFfmpegPath", () => {
    it("uses an absolute executable FFMPEG_PATH override", async () => {
        const executable = await createExecutable();

        assert.equal(resolveFfmpegPath({ FFMPEG_PATH: executable, PATH: "" }), await realpath(executable));
    });

    it("rejects a relative FFMPEG_PATH override instead of searching from the working directory", () => {
        assert.throws(
            () => resolveFfmpegPath({ FFMPEG_PATH: "tools/ffmpeg", PATH: process.env.PATH }),
            /FFMPEG_PATH must be an absolute path/u,
        );
    });

    it("does not fall back to PATH when an explicit override is invalid", async () => {
        const pathExecutable = await createExecutable();

        assert.throws(
            () => resolveFfmpegPath({
                FFMPEG_PATH: join(tmpdir(), "missing-ffmpeg"),
                PATH: pathExecutable.slice(0, -"ffmpeg".length),
            }),
            /FFMPEG_PATH does not reference an executable file/u,
        );
    });

    it("resolves the system ffmpeg from absolute PATH entries", async () => {
        const executable = await createExecutable();
        const executableDirectory = executable.slice(0, -"ffmpeg".length);

        assert.equal(resolveFfmpegPath({ PATH: executableDirectory }), await realpath(executable));
    });

    it("ignores empty and relative PATH entries", async () => {
        const root = await mkdtemp(join(tmpdir(), "ffmpeg-relative-path-"));
        temporaryDirectories.push(root);
        const relativeDirectory = "relative-bin";
        await mkdir(join(root, relativeDirectory));

        assert.throws(
            () => resolveFfmpegPath({ PATH: `${delimiter}${relativeDirectory}` }),
            /FFmpeg was not found/u,
        );
    });

    it("rejects a non-executable file", async () => {
        const directory = await mkdtemp(join(tmpdir(), "ffmpeg-non-executable-"));
        temporaryDirectories.push(directory);
        const executable = join(directory, "ffmpeg");
        await writeFile(executable, "not executable", "utf8");
        await chmod(executable, 0o644);

        assert.throws(
            () => resolveFfmpegPath({ FFMPEG_PATH: executable }),
            /FFMPEG_PATH does not reference an executable file/u,
        );
    });
});

describe("configureFfmpegPath", () => {
    it("applies the resolved executable path to fluent-ffmpeg factories and commands", async () => {
        const executable = await createExecutable();
        let configuredPath: string | undefined;
        const target = {
            setFfmpegPath(path: string) {
                configuredPath = path;
            },
        };

        assert.equal(configureFfmpegPath(target, executable), target);
        assert.equal(configuredPath, executable);
    });
});

describe("resolveFfprobePath", () => {
    it("uses an absolute executable FFPROBE_PATH override", async () => {
        const ffmpegExecutable = await createExecutable();
        const ffprobeExecutable = await createExecutable("ffprobe");

        assert.equal(
            resolveFfprobePath(ffmpegExecutable, { FFPROBE_PATH: ffprobeExecutable, PATH: "" }),
            await realpath(ffprobeExecutable),
        );
    });

    it("prefers an executable ffprobe sibling of the selected FFmpeg", async () => {
        const ffmpegExecutable = await createExecutable();
        const ffprobeExecutable = join(dirname(ffmpegExecutable), "ffprobe");
        await writeFile(ffprobeExecutable, "#!/bin/sh\nexit 0\n", "utf8");
        await chmod(ffprobeExecutable, 0o755);

        assert.equal(resolveFfprobePath(ffmpegExecutable, { PATH: "" }), await realpath(ffprobeExecutable));
    });

    it("does not fall back when an explicit FFPROBE_PATH is invalid", async () => {
        const ffmpegExecutable = await createExecutable();
        const pathExecutable = await createExecutable("ffprobe");

        assert.throws(
            () => resolveFfprobePath(ffmpegExecutable, {
                FFPROBE_PATH: join(tmpdir(), "missing-ffprobe"),
                PATH: dirname(pathExecutable),
            }),
            /FFPROBE_PATH does not reference an executable file/u,
        );
    });

    it("returns null when optional ffprobe discovery finds nothing", async () => {
        const ffmpegExecutable = await createExecutable();

        assert.equal(resolveFfprobePath(ffmpegExecutable, { PATH: "" }), null);
    });
});

describe("configureFfprobePath", () => {
    it("applies the resolved executable to the fluent-ffmpeg factory", async () => {
        const executable = await createExecutable("ffprobe");
        let configuredPath: string | undefined;
        const target = {
            setFfprobePath(path: string) {
                configuredPath = path;
            },
        };

        assert.equal(configureFfprobePath(target, executable), target);
        assert.equal(configuredPath, executable);
    });
});
