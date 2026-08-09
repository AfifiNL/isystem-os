import {
    chmodSync,
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
} from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = resolve(projectRoot, ".next/standalone");
const serverEntry = resolve(standaloneRoot, "server.js");
const sourceStatic = resolve(projectRoot, ".next/static");
const targetStatic = resolve(standaloneRoot, ".next/static");
const sourcePublic = resolve(projectRoot, "public");
const targetPublic = resolve(standaloneRoot, "public");
const buildCache = resolve(projectRoot, ".next/cache");
const runtimeCache = resolve(standaloneRoot, ".next/cache");

if (!existsSync(serverEntry) || !existsSync(sourceStatic) || !existsSync(sourcePublic)) {
    throw new Error("Standalone output is incomplete. Run this script only after `next build`.");
}

mkdirSync(targetStatic, { recursive: true });
cpSync(sourceStatic, targetStatic, { recursive: true });
mkdirSync(targetPublic, { recursive: true });
cpSync(sourcePublic, targetPublic, { recursive: true });

// Webpack's build cache can grow to several gigabytes and is not a runtime
// dependency. Empty its contents without removing the directory because
// Nixpacks mounts that directory as a BuildKit cache during this command.
mkdirSync(buildCache, { recursive: true });
for (const entry of readdirSync(buildCache)) {
    rmSync(resolve(buildCache, entry), { recursive: true, force: true });
}

// Coolify runs with a rootless user namespace, so startup cannot chown image
// files. Allow the deliberately empty cache to be written after dropping to
// www-data while keeping the rest of the standalone artifact immutable.
mkdirSync(runtimeCache, { recursive: true });
chmodSync(runtimeCache, 0o757);
