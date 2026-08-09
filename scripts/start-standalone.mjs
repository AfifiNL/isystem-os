import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";

const projectRoot = process.cwd();
const standaloneRoot = resolve(projectRoot, ".next/standalone");
const targetStatic = resolve(standaloneRoot, ".next/static");
const targetPublic = resolve(standaloneRoot, "public");
const serverEntry = resolve(standaloneRoot, "server.js");

nextEnv.loadEnvConfig(projectRoot);

if (!existsSync(serverEntry) || !existsSync(targetStatic) || !existsSync(targetPublic)) {
    throw new Error("Prepared standalone output is missing. Run `npm run build` before `npm run start:standalone`.");
}

await import(pathToFileURL(serverEntry).href);
