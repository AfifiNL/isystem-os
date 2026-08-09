/**
 * seed-client.ts — provision a fresh Supabase project for a client fork.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=<url> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   npm run seed:client
 *
 * Defaults to the checked-in `isystem.config.ts`. Set CLIENT_CONFIG to
 * override it with another validated config file.
 *
 * What it does (idempotent):
 *   1. Loads + validates the client's config against the Zod schema.
 *   2. Verifies a `theme_catalog` row exists for the requested template.
 *   3. UPSERTs the workspace row (slug = config.slug) with brand metadata
 *      drawn from the config (display name, default locale, tier,
 *      wallpaper, palette tokens stored in metadata.brand).
 *   4. Binds a fresh workspace to the active theme version; an existing,
 *      different binding fails closed and must be changed deliberately.
 *   5. Inserts only missing default content_items rows for each defaultPages slug.
 *   6. Applies any seedOverlays SQL files in order.
 *
 * What it deliberately does NOT do:
 *   - It does not run migrations. Run `supabase db push` separately
 *     against the client's Supabase project before invoking this.
 *   - It does not create the auth user. Invite the owner via the admin
 *     dashboard or Supabase auth dashboard after provisioning.
 *   - It does not push to remote, deploy, or touch Vercel.
 *
 * Re-running is safe: existing page content and unrelated metadata are
 * preserved. Identity/config fields update, while a theme change is refused.
 */

import { existsSync } from "node:fs";
import { isAbsolute, relative as relativeFilePath, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { clientConfigSchema, type ClientConfig } from "../src/shared/lib/client-config/schema";
import { buildWorkspaceSettingsSeed } from "../src/shared/lib/client-config/provisioning";
import type { Database, Json } from "../src/shared/lib/supabase/database.types";

interface SeedContext {
    supabase: SupabaseClient<Database>;
    config: ClientConfig;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

export function resolveClientConfigPath(
    cwd = process.cwd(),
    environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
    return resolvePath(cwd, environment.CLIENT_CONFIG?.trim() || "isystem.config.ts");
}

export function loadProvisioningEnvironment(cwd = process.cwd()): void {
    loadEnvConfig(cwd, process.env.NODE_ENV !== "production", console, true);
}

async function loadConfig(): Promise<ClientConfig> {
    const absolute = resolveClientConfigPath();
    const mod = await import(pathToFileURL(absolute).href);
    const raw = mod.default ?? mod;
    return clientConfigSchema.parse(raw);
}

async function ensureThemeAvailable(ctx: SeedContext): Promise<{ themeId: string; versionId: string }> {
    const { data: theme, error: themeErr } = await ctx.supabase
        .from("theme_catalog")
        .select("id")
        .eq("theme_key", ctx.config.template)
        .maybeSingle();

    if (themeErr || !theme) {
        throw new Error(
            `theme_catalog has no row for theme_key='${ctx.config.template}'. ` +
                "Did you run `supabase db push` against this project first?",
        );
    }

    const { data: version, error: versionErr } = await ctx.supabase
        .from("theme_versions")
        .select("id")
        .eq("theme_id", theme.id)
        .eq("status", "active")
        .order("released_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

    if (versionErr || !version) {
        throw new Error(
            `No active theme_versions row for template '${ctx.config.template}'. ` +
                "Activate a theme version or apply the client theme seed before provisioning.",
        );
    }

    return { themeId: theme.id, versionId: version.id };
}

async function upsertWorkspace(
    ctx: SeedContext,
    themeBinding: { themeId: string; versionId: string },
): Promise<string> {
    const { data: existingWorkspace, error: readError } = await ctx.supabase
        .from("workspaces")
        .select("id, metadata")
        .eq("slug", ctx.config.slug)
        .maybeSingle();
    if (readError) throw new Error(`Failed to read existing workspace: ${readError.message}`);
    if (existingWorkspace?.id) {
        const { data: existingBinding, error: existingBindingError } = await ctx.supabase
            .from("workspace_theme_bindings")
            .select("theme_version_id")
            .eq("workspace_id", existingWorkspace.id)
            .eq("is_active", true)
            .is("effective_to", null)
            .maybeSingle();
        if (existingBindingError) {
            throw new Error(`Failed to read workspace theme binding: ${existingBindingError.message}`);
        }
        if (existingBinding && existingBinding.theme_version_id !== themeBinding.versionId) {
            throw new Error(
                "Workspace already has a different active theme. Change it through the dashboard before rerunning provisioning.",
            );
        }
    }
    const existingMetadata = existingWorkspace?.metadata && typeof existingWorkspace.metadata === "object" && !Array.isArray(existingWorkspace.metadata)
        ? existingWorkspace.metadata as Record<string, Json | undefined>
        : {};
    const publicConfig = {
        brand: ctx.config.brand,
        modules: ctx.config.modules,
        supportedLocales: ctx.config.supportedLocales,
    };
    const metadata: Json = {
        ...existingMetadata,
        public_config: publicConfig,
        brand: ctx.config.brand,
        site: ctx.config.site,
        socials: ctx.config.socials,
        modules: ctx.config.modules,
        supportedLocales: ctx.config.supportedLocales,
        seedOverlays: ctx.config.seedOverlays,
        provisionedFromConfig: true,
    };

    const { data, error } = await ctx.supabase
        .from("workspaces")
        .upsert(
            {
                slug: ctx.config.slug,
                name: ctx.config.displayName,
                workspace_tier: ctx.config.tier,
                default_locale: ctx.config.defaultLocale,
                legacy_template_id: ctx.config.template,
                wallpaper_url: ctx.config.brand.wallpaperUrl ?? null,
                metadata,
                is_active: true,
            },
            { onConflict: "slug" },
        )
        .select("id")
        .single();

    if (error || !data) {
        throw new Error(`Failed to upsert workspace: ${error?.message ?? "unknown error"}`);
    }

    const workspaceId = data.id;

    const { data: activeBinding, error: bindingReadError } = await ctx.supabase
        .from("workspace_theme_bindings")
        .select("theme_version_id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .is("effective_to", null)
        .maybeSingle();
    if (bindingReadError) throw new Error(`Failed to read workspace theme binding: ${bindingReadError.message}`);
    if (activeBinding && activeBinding.theme_version_id !== themeBinding.versionId) {
        throw new Error(
            "Workspace already has a different active theme. Change it through the dashboard before rerunning provisioning.",
        );
    }
    if (!activeBinding) {
        const { error: bindingErr } = await ctx.supabase.from("workspace_theme_bindings").insert({
            workspace_id: workspaceId,
            theme_version_id: themeBinding.versionId,
            effective_from: new Date().toISOString(),
            is_active: true,
        });
        if (bindingErr) throw new Error(`Failed to bind workspace theme: ${bindingErr.message}`);
    }

    return workspaceId;
}

async function seedDefaultPages(ctx: SeedContext, workspaceId: string): Promise<number> {
    if (ctx.config.workspaceSeed.defaultPages.length === 0) return 0;
    let inserted = 0;

    for (const slug of ctx.config.workspaceSeed.defaultPages) {
        const { data: existing, error: readError } = await ctx.supabase.from("content_items")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("type", "page")
            .eq("locale", ctx.config.defaultLocale)
            .eq("slug", slug)
            .maybeSingle();
        if (readError) throw new Error(`Failed to check page '${slug}': ${readError.message}`);
        if (existing) continue;
        const { error } = await ctx.supabase.from("content_items").insert({
            workspace_id: workspaceId,
            slug,
            title: slug.replace(/(^|-)([a-z])/g, (_, sep, ch) => `${sep === "-" ? " " : ""}${ch.toUpperCase()}`),
            type: "page",
            status: "draft",
            locale: ctx.config.defaultLocale,
            // Workspace-owned pages deliberately leave template_id null.
            // The schema's template/locale/slug unique index is reserved for
            // shared template fallback content and would collide across clients.
            template_id: null,
        });
        if (error) throw new Error(`Failed to seed page '${slug}': ${error.message}`);
        inserted += 1;
    }
    return inserted;
}

async function upsertWorkspaceSettings(ctx: SeedContext, workspaceId: string): Promise<void> {
    const { data: existing, error: readError } = await ctx.supabase
        .from("workspace_settings")
        .select("metadata")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (readError) throw new Error(`Failed to read workspace settings: ${readError.message}`);
    const existingMetadata = existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? existing.metadata as Record<string, Json | undefined>
        : {};
    const seed = buildWorkspaceSettingsSeed(ctx.config, workspaceId);
    const { error } = await ctx.supabase
        .from("workspace_settings")
        .upsert({ ...seed, metadata: { ...existingMetadata, ...(seed.metadata as Record<string, Json>) } }, {
            onConflict: "workspace_id",
        });

    if (error) {
        throw new Error(`Failed to upsert workspace settings: ${error.message}`);
    }
}

function applySeedOverlays(config: ClientConfig): void {
    if (config.seedOverlays.length === 0) return;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is required when seedOverlays are configured.");
    }
    const parsed = new URL(databaseUrl);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
        throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme.");
    }
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!parsed.hostname || !parsed.username || !databaseName) {
        throw new Error("DATABASE_URL must include host, user, and database name.");
    }
    const psqlEnvironment = {
        ...process.env,
        PGHOST: parsed.hostname,
        PGPORT: parsed.port || "5432",
        PGUSER: decodeURIComponent(parsed.username),
        PGPASSWORD: decodeURIComponent(parsed.password),
        PGDATABASE: databaseName,
        ...(parsed.searchParams.get("sslmode") ? { PGSSLMODE: parsed.searchParams.get("sslmode")! } : {}),
    };

    for (const relPath of config.seedOverlays) {
        const repositoryRoot = resolvePath(process.cwd());
        const absolute = resolvePath(repositoryRoot, relPath);
        const repositoryRelativePath = relativeFilePath(repositoryRoot, absolute);
        if (repositoryRelativePath.startsWith("..") || isAbsolute(repositoryRelativePath) || !existsSync(absolute)) {
            throw new Error(`Seed overlay must be an existing file inside the repository: ${relPath}`);
        }
        console.log(`Applying seed overlay: ${relPath}`);
        try {
            execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", absolute], {
                stdio: "inherit",
                env: psqlEnvironment,
            });
        } catch (err) {
            throw new Error(`Seed overlay failed (${relPath}): ${(err as Error).message}`);
        }
    }
}

function preflightSeedOverlays(config: ClientConfig): void {
    if (config.seedOverlays.length === 0) return;
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is required when seedOverlays are configured.");
    }
    let parsed: URL;
    try {
        parsed = new URL(databaseUrl);
    } catch {
        throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
    }
    if ((parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:")
        || !parsed.hostname || !parsed.username || !parsed.pathname.replace(/^\//, "")) {
        throw new Error("DATABASE_URL must use PostgreSQL and include host, user, and database name.");
    }
    const repositoryRoot = resolvePath(process.cwd());
    for (const relPath of config.seedOverlays) {
        const absolute = resolvePath(repositoryRoot, relPath);
        const repositoryRelativePath = relativeFilePath(repositoryRoot, absolute);
        if (repositoryRelativePath.startsWith("..") || isAbsolute(repositoryRelativePath) || !existsSync(absolute)) {
            throw new Error(`Seed overlay must be an existing file inside the repository: ${relPath}`);
        }
    }
    try {
        execFileSync("psql", ["--version"], { stdio: "ignore" });
    } catch {
        throw new Error("psql is required when seedOverlays are configured.");
    }
}

async function main(): Promise<void> {
    loadProvisioningEnvironment();
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const config = await loadConfig();
    preflightSeedOverlays(config);

    console.log(`\n→ Provisioning workspace '${config.slug}' (${config.displayName})`);
    console.log(`  template: ${config.template}, tier: ${config.tier}, locale: ${config.defaultLocale}`);

    const supabase = createClient<Database>(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const ctx: SeedContext = { supabase, config };

    const themeBinding = await ensureThemeAvailable(ctx);
    console.log(`  theme version: ${themeBinding.versionId}`);

    const workspaceId = await upsertWorkspace(ctx, themeBinding);
    console.log(`  workspace id:  ${workspaceId}`);

    await upsertWorkspaceSettings(ctx, workspaceId);
    console.log(`  site identity: ${config.site.domain} (${config.site.contactEmail})`);

    const insertedPages = await seedDefaultPages(ctx, workspaceId);
    console.log(`  pages seeded:  ${insertedPages} new, ${config.workspaceSeed.defaultPages.length - insertedPages} existing`);

    applySeedOverlays(config);

    console.log(`\n✓ Provisioning complete. Next:`);
    console.log(`  1. Invite the owner (${config.workspaceSeed.ownerEmail}) via Supabase auth.`);
    console.log(`  2. Visit /dashboard, sign in, and the onboarding tour will auto-launch.`);
    console.log(`  3. Configure the client branch and process env vars in Coolify, then deploy.\n`);
}

const isMain = process.argv[1]
    ? import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href
    : false;

if (isMain) {
    main().catch((err) => {
        console.error("\n✗ Provisioning failed:", err.message ?? err);
        if (process.env.DEBUG) console.error(err);
        process.exit(1);
    });
}
