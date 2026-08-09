import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "prepare-standalone.mjs");

test("standalone preparation copies runtime assets without a bundled FFmpeg binary", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "prepare-standalone-"));
    try {
        await Promise.all([
            mkdir(join(fixtureRoot, ".next/standalone"), { recursive: true }),
            mkdir(join(fixtureRoot, ".next/static"), { recursive: true }),
            mkdir(join(fixtureRoot, ".next/cache"), { recursive: true }),
            mkdir(join(fixtureRoot, "public"), { recursive: true }),
        ]);
        await Promise.all([
            writeFile(join(fixtureRoot, ".next/standalone/server.js"), "server", "utf8"),
            writeFile(join(fixtureRoot, ".next/static/app.js"), "static", "utf8"),
            writeFile(join(fixtureRoot, ".next/cache/build.bin"), "cache", "utf8"),
            writeFile(join(fixtureRoot, "public/asset.txt"), "public", "utf8"),
        ]);

        const result = spawnSync(process.execPath, [scriptPath], {
            cwd: fixtureRoot,
            encoding: "utf8",
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(join(fixtureRoot, ".next/standalone/.next/static/app.js")), true);
        assert.equal(existsSync(join(fixtureRoot, ".next/standalone/public/asset.txt")), true);
        assert.deepEqual(await readdir(join(fixtureRoot, ".next/cache")), []);
        assert.equal(existsSync(join(fixtureRoot, ".next/standalone/node_modules/ffmpeg-static")), false);
    } finally {
        await rm(fixtureRoot, { force: true, recursive: true });
    }
});
