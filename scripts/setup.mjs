import {
    chmodSync,
    existsSync,
    readFileSync,
    writeFileSync,
} from "node:fs";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { clientConfigSchema } from "../src/shared/lib/client-config/schema.ts";

const ENV_TEMPLATE_CANDIDATES = [".env.example", ".env.production.example"];

function findEnvTemplate(cwd) {
    const name = ENV_TEMPLATE_CANDIDATES.find((candidate) => existsSync(resolve(cwd, candidate)));
    if (!name) {
        throw new Error(
            "No environment template found. Expected .env.example or .env.production.example.",
        );
    }
    return name;
}

async function promptForReplacement() {
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
        const answer = await prompt.question(
            ".env.local already exists and may contain secrets. Replace it from the template? Type YES: ",
        );
        return answer.trim() === "YES";
    } finally {
        prompt.close();
    }
}

export async function ensureEnvLocal({
    cwd = process.cwd(),
    replace = false,
    isInteractive = Boolean(stdin.isTTY && stdout.isTTY),
    confirmReplace = promptForReplacement,
} = {}) {
    const targetPath = resolve(cwd, ".env.local");
    const targetExists = existsSync(targetPath);

    if (targetExists && !replace) {
        return { outcome: "preserved", template: null };
    }

    if (targetExists && replace && !isInteractive) {
        throw new Error(
            "Refusing to replace .env.local without explicit interactive confirmation.",
        );
    }

    if (targetExists && !(await confirmReplace())) {
        return { outcome: "preserved", template: null };
    }

    const template = findEnvTemplate(cwd);
    const templateContents = readFileSync(resolve(cwd, template), "utf8");
    writeFileSync(targetPath, templateContents, {
        encoding: "utf8",
        flag: targetExists ? "w" : "wx",
        mode: 0o600,
    });
    chmodSync(targetPath, 0o600);

    return { outcome: targetExists ? "replaced" : "created", template };
}

async function loadAndValidateConfig(cwd) {
    const relativePath = process.env.CLIENT_CONFIG?.trim() || "isystem.config.ts";
    const absolutePath = resolve(cwd, relativePath);
    if (!existsSync(absolutePath)) {
        throw new Error(`Client config not found: ${relativePath}`);
    }
    const importedConfig = await import(`${pathToFileURL(absolutePath).href}?setup=${Date.now()}`);
    clientConfigSchema.parse(importedConfig.default ?? importedConfig);
    return relativePath;
}

function printHelp() {
    console.log(`Usage: npm run setup -- [--replace-env]\n\n` +
        "Creates .env.local from the checked-in template when missing and validates " +
        "the starter config. Existing environment files are preserved unless you " +
        "request replacement and type YES at the interactive prompt.");
}

async function main() {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
        printHelp();
        return;
    }

    const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--replace-env");
    if (unknownArgs.length > 0) {
        throw new Error(`Unknown setup option: ${unknownArgs[0]}`);
    }

    const cwd = process.cwd();
    const configPath = await loadAndValidateConfig(cwd);
    const envResult = await ensureEnvLocal({
        cwd,
        replace: process.argv.includes("--replace-env"),
    });

    console.log("\nSetup check complete.");
    console.log(`  config: ${configPath} (valid)`);
    if (envResult.outcome === "preserved") {
        console.log("  env:    .env.local preserved");
    } else {
        console.log(`  env:    .env.local ${envResult.outcome} from ${envResult.template}`);
    }
    console.log("\nNext: edit isystem.config.ts and .env.local, then run npm run doctor.");
}

const isMain = process.argv[1]
    ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
    : false;

if (isMain) {
    main().catch((error) => {
        console.error(`\nSetup failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    });
}
