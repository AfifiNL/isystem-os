import fs from "fs";
import path from "path";

const DEFAULT_ENV_FILES = [".env.local"];

type LoadSourceIntelligenceEnvOptions = {
    files?: string[];
    override?: boolean;
    log?: boolean;
};

function parseEnvLine(line: string): { key: string; value: string } | null {
    const match = line.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) return null;

    let value = match[2] || "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
    }

    return { key: match[1], value };
}

function hostFromEnvUrl(name: string): string | null {
    const raw = process.env[name]?.trim();
    if (!raw) return null;
    try {
        return new URL(raw).host.toLowerCase();
    } catch {
        return null;
    }
}

export function loadSourceIntelligenceEnv(options: LoadSourceIntelligenceEnvOptions = {}) {
    const files = options.files ?? DEFAULT_ENV_FILES;
    const override = options.override ?? false;
    const shouldLog = options.log ?? false;
    const loadedFiles: string[] = [];
    let duplicateCount = 0;

    for (const file of files) {
        const envPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(envPath)) continue;

        for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
            const parsed = parseEnvLine(line);
            if (!parsed) continue;

            if (!override && process.env[parsed.key] !== undefined) {
                duplicateCount += 1;
                continue;
            }

            process.env[parsed.key] = parsed.value;
        }

        loadedFiles.push(file);
    }

    if (shouldLog) {
        if (loadedFiles.length > 0) {
            console.log(`✅ Loaded environment variables from ${loadedFiles.join(", ")} (existing values preserved)`);
            if (duplicateCount > 0) {
                console.log(`ℹ️ Ignored ${duplicateCount} duplicate environment assignment${duplicateCount === 1 ? "" : "s"} to preserve the first/process value.`);
            }
        } else {
            console.warn("⚠️ Warning: No env file found. In Coolify/Hetzner production, relying on container environment variables.");
        }
    }

    return { loadedFiles, duplicateCount };
}

export function assertSourceIntelligenceSupabaseTarget() {
    const supabaseHost = hostFromEnvUrl("NEXT_PUBLIC_SUPABASE_URL");
    const expectedSupabaseHost = process.env.SOURCE_INTELLIGENCE_EXPECTED_SUPABASE_HOST?.trim().toLowerCase();

    if (expectedSupabaseHost && supabaseHost && supabaseHost !== expectedSupabaseHost) {
        throw new Error(
            `Source Intelligence environment mismatch: NEXT_PUBLIC_SUPABASE_URL points at ${supabaseHost}, expected ${expectedSupabaseHost}. Refusing to process jobs against the wrong Supabase project.`,
        );
    }
}
