import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { clientConfigSchema } from "../src/shared/lib/client-config/schema.ts";

const STARTER_ENV = [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
];

const STAGED_ENV = [
    "RESEND_API_KEY",
    "RESEND_WEBHOOK_SECRET",
    "NEWSLETTER_FROM_EMAIL",
    "NEWSLETTER_REPLY_TO_EMAIL",
    "BOOKING_MANAGEMENT_SECRET",
];

const OPTIONAL_ROTATION_ENV = ["BOOKING_MANAGEMENT_SECRET_PREVIOUS"];

const FULL_ENV = [
    "AI_PROVIDER",
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_CLOUD_LOCATION",
    "GOOGLE_APPLICATION_CREDENTIALS_JSON",
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
];

function parseVersion(version) {
    const match = String(version).trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareVersions(left, right) {
    for (let index = 0; index < 3; index += 1) {
        if (left[index] !== right[index]) return left[index] - right[index];
    }
    return 0;
}

export function isVersionInRange(version, range) {
    const parsedVersion = parseVersion(version);
    if (!parsedVersion) return false;

    return String(range)
        .trim()
        .split(/\s+/)
        .every((constraint) => {
            const match = constraint.match(/^(>=|>|<=|<|=)?(.+)$/);
            const parsedTarget = match ? parseVersion(match[2]) : null;
            if (!match || !parsedTarget) return false;
            const comparison = compareVersions(parsedVersion, parsedTarget);
            switch (match[1] ?? "=") {
                case ">=": return comparison >= 0;
                case ">": return comparison > 0;
                case "<=": return comparison <= 0;
                case "<": return comparison < 0;
                default: return comparison === 0;
            }
        });
}

export function parseEnvText(text) {
    const environment = {};
    for (const rawLine of String(text).split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
        const separator = normalized.indexOf("=");
        if (separator <= 0) continue;
        const name = normalized.slice(0, separator).trim();
        let value = normalized.slice(separator + 1).trim();
        if (
            value.length >= 2 &&
            ((value.startsWith("\"") && value.endsWith("\"")) ||
                (value.startsWith("'") && value.endsWith("'")))
        ) {
            value = value.slice(1, -1);
        }
        environment[name] = value;
    }
    return environment;
}

function legacyJwtRole(value) {
    const segments = String(value).split(".");
    if (segments.length !== 3
        || !segments.every((segment) => segment.length >= 8 && /^[A-Za-z0-9_-]+$/.test(segment))) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
        return typeof payload?.role === "string" ? payload.role : null;
    } catch {
        return null;
    }
}

function looksLikeSupabaseKey(name, value) {
    const normalized = String(value).trim();
    const legacyRole = legacyJwtRole(normalized);
    if (legacyRole) {
        return name === "NEXT_PUBLIC_SUPABASE_ANON_KEY"
            ? legacyRole === "anon"
            : legacyRole === "service_role";
    }
    if (name === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
        return /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(normalized);
    }
    return /^sb_secret_[A-Za-z0-9_-]{12,}$/.test(normalized);
}

function environmentState(name, value) {
    if (!value || String(value).trim().length === 0) return "missing";
    const normalized = String(value).trim().toLowerCase();
    const placeholders = [
        "example.invalid",
        ".invalid",
        "client.example",
        "project-ref",
        "starter-workspace",
        "owner@example",
        "your-",
        "replace-me",
        "change-me",
        "changeme",
        "<",
    ];
    if (placeholders.some((marker) => normalized.includes(marker))) return "placeholder";

    if (name === "NEXT_PUBLIC_SITE_URL" || name === "NEXT_PUBLIC_SUPABASE_URL") {
        try {
            const url = new URL(String(value));
            const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
            if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
                return "invalid";
            }
        } catch {
            return "invalid";
        }
    }

    if (name === "NEXT_PUBLIC_SUPABASE_ANON_KEY" || name === "SUPABASE_SERVICE_ROLE_KEY") {
        return looksLikeSupabaseKey(name, value) ? "configured" : "invalid";
    }

    if (name === "BOOKING_MANAGEMENT_SECRET" || name === "BOOKING_MANAGEMENT_SECRET_PREVIOUS") {
        return Buffer.byteLength(String(value).trim(), "utf8") >= 32 ? "configured" : "invalid";
    }

    return "configured";
}

export function collectEnvironmentStatus(environment, names) {
    const status = names.map((name) => ({ name, state: environmentState(name, environment[name]) }));
    if (environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
        && environment.NEXT_PUBLIC_SUPABASE_ANON_KEY === environment.SUPABASE_SERVICE_ROLE_KEY) {
        return status.map((item) => (
            item.name === "NEXT_PUBLIC_SUPABASE_ANON_KEY" || item.name === "SUPABASE_SERVICE_ROLE_KEY"
                ? { ...item, state: "invalid" }
                : item
        ));
    }
    return status;
}

export function isStarterConfigPlaceholder(config) {
    const values = [
        config.slug,
        config.displayName,
        config.site?.name,
        config.site?.domain,
        config.site?.contactEmail,
        config.workspaceSeed?.ownerEmail,
    ].filter((value) => typeof value === "string").map((value) => value.toLowerCase());
    return values.some((value) => value.includes("starter-workspace")
        || value.includes("starter workspace")
        || value.endsWith(".invalid")
        || value.endsWith("@example.invalid"));
}

function readLocalEnvironment(cwd) {
    const path = resolve(cwd, ".env.local");
    if (!existsSync(path)) return {};
    return parseEnvText(readFileSync(path, "utf8"));
}

function relativeDisplayPath(cwd, absolutePath) {
    const prefix = `${resolve(cwd)}/`;
    return absolutePath.startsWith(prefix) ? absolutePath.slice(prefix.length) : absolutePath;
}

function printEnvironmentProfile(label, status, required) {
    const configured = status.filter((item) => item.state === "configured").length;
    const icon = required
        ? configured === status.length ? "PASS" : "FAIL"
        : "INFO";
    console.log(`  [${icon}] ${label}: ${configured}/${status.length} configured`);
    for (const item of status.filter((entry) => entry.state !== "configured")) {
        console.log(`         ${item.name}: ${item.state}`);
    }
}

async function validateConfig(cwd, relativePath) {
    const absolutePath = resolve(cwd, relativePath);
    if (!existsSync(absolutePath)) {
        return { ok: false, detail: `not found (${relativePath})`, config: null };
    }

    try {
        const importedConfig = await import(`${pathToFileURL(absolutePath).href}?doctor=${Date.now()}`);
        const result = clientConfigSchema.safeParse(importedConfig.default ?? importedConfig);
        if (!result.success) {
            const paths = result.error.issues
                .map((issue) => issue.path.join(".") || "root")
                .filter((path, index, all) => all.indexOf(path) === index)
                .slice(0, 8);
            return {
                ok: false,
                detail: `schema issues at: ${paths.join(", ")}`,
                config: null,
            };
        }
        if (isStarterConfigPlaceholder(result.data)) {
            return { ok: false, detail: `starter placeholders remain (${relativePath})`, config: result.data };
        }
        return { ok: true, detail: relativePath, config: result.data };
    } catch {
        return { ok: false, detail: `could not load (${relativePath})`, config: null };
    }
}

async function main() {
    const cwd = process.cwd();
    const packagePath = resolve(cwd, "package.json");
    if (!existsSync(packagePath)) {
        throw new Error("Run this command from the repository root (package.json not found). ");
    }

    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    const nodeRange = packageJson.engines?.node ?? ">=22";
    const npmRange = packageJson.engines?.npm ?? ">=10";
    const nodeVersion = process.versions.node;
    const npmResult = spawnSync("npm", ["--version"], { encoding: "utf8" });
    const npmVersion = npmResult.status === 0 ? npmResult.stdout.trim() : "unavailable";
    let hasFailure = false;

    console.log("iSystem OS doctor (values are never printed)\n");
    const nodeOk = isVersionInRange(nodeVersion, nodeRange);
    const npmOk = npmResult.status === 0 && isVersionInRange(npmVersion, npmRange);
    console.log(`  [${nodeOk ? "PASS" : "FAIL"}] Node ${nodeVersion}; expected ${nodeRange}`);
    console.log(`  [${npmOk ? "PASS" : "FAIL"}] npm ${npmVersion}; expected ${npmRange}`);
    hasFailure ||= !nodeOk || !npmOk;

    const configPath = process.env.CLIENT_CONFIG?.trim() || "isystem.config.ts";
    const configResult = await validateConfig(cwd, configPath);
    console.log(`  [${configResult.ok ? "PASS" : "FAIL"}] config: ${configResult.detail}`);
    hasFailure ||= !configResult.ok;

    const requiredFiles = ["package-lock.json", "supabase/migrations"];
    for (const relativePath of requiredFiles) {
        const present = existsSync(resolve(cwd, relativePath));
        console.log(`  [${present ? "PASS" : "FAIL"}] local: ${relativePath}`);
        hasFailure ||= !present;
    }

    const envTemplatePresent = [".env.example", ".env.production.example"]
        .some((relativePath) => existsSync(resolve(cwd, relativePath)));
    console.log(`  [${envTemplatePresent ? "PASS" : "FAIL"}] local: environment template`);
    hasFailure ||= !envTemplatePresent;

    if (configResult.config) {
        const logoPath = resolve(cwd, "public", configResult.config.brand.logo.lightUrl.slice(1));
        const logoExists = existsSync(logoPath);
        console.log(
            `  [${logoExists ? "PASS" : "FAIL"}] logo: ${relativeDisplayPath(cwd, logoPath)}`,
        );
        hasFailure ||= !logoExists;
    }

    const envPath = resolve(cwd, ".env.local");
    const envExists = existsSync(envPath);
    console.log(`  [${envExists ? "PASS" : "FAIL"}] local: .env.local`);
    hasFailure ||= !envExists;

    const environment = { ...readLocalEnvironment(cwd), ...process.env };
    console.log("\nProfiles:");
    const starterStatus = collectEnvironmentStatus(environment, STARTER_ENV);
    printEnvironmentProfile("starter (local app + Supabase)", starterStatus, true);
    hasFailure ||= starterStatus.some((item) => item.state !== "configured");
    const stagedStatus = collectEnvironmentStatus(environment, STAGED_ENV);
    printEnvironmentProfile("staged (transactional email)", stagedStatus, false);
    hasFailure ||= stagedStatus.some((item) => item.state === "invalid");
    const rotationStatus = collectEnvironmentStatus(environment, OPTIONAL_ROTATION_ENV);
    printEnvironmentProfile("optional secret rotation", rotationStatus, false);
    hasFailure ||= rotationStatus.some((item) => item.state === "invalid");
    printEnvironmentProfile(
        "full (AI + payments)",
        collectEnvironmentStatus(environment, FULL_ENV),
        false,
    );

    console.log("\nGuidance:");
    console.log("  1. Starter: configure the four required variables, then run npm run dev.");
    console.log("  2. Staged: add a verified sender and webhook before enabling email workflows.");
    console.log("  3. Full: add provider credentials one integration at a time and rerun doctor.");
    console.log("  4. Provision only after migrations: npm run seed:client.");

    if (hasFailure) {
        console.log("\nDoctor found starter blockers. No files or remote systems were changed.");
        process.exitCode = 1;
    } else {
        console.log("\nStarter profile is ready. No files or remote systems were changed.");
    }
}

const isMain = process.argv[1]
    ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
    : false;

if (isMain) {
    main().catch((error) => {
        console.error(`Doctor failed safely: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    });
}
