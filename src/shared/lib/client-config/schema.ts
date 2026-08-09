import { z } from "zod";

/**
 * The single source of truth for a client fork's identity, brand, and
 * runtime feature surface. One file per client at
 * `clients/<slug>/client.config.ts`. The `core` branch never reads or
 * commits client-specific values into the codebase — they all live in
 * the client's config file.
 *
 * The schema below is the contract:
 * - validated at clone-time by `scripts/seed-client.ts`
 * - persisted into workspace/workspace_settings records for runtime use
 *   (identity, palette tokens, locale defaults, module gating)
 *
 * **Do not** add fields here without a real reason. Every field becomes
 * a per-client decision an AI agent has to make. Prefer module-level
 * defaults that work without a config setting.
 */

const oklchString = z
    .string()
    .regex(/^oklch\(.+\)$/i, "must be an oklch(...) color string")
    .or(z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "must be a hex color"))
    .or(z.string().regex(/^(rgb|hsl|var)\(.+\)$/i, "must be a CSS color value"));

export const localeSchema = z.enum(["en", "nl", "ar"]);

export const TEMPLATE_IDS = [
    "personal-brand",
    "facility-services",
    "creative-agency",
    "isystem-agency",
    "saas-product",
    "restaurant",
    "ecommerce",
    "nonprofit",
] as const;

export const MODULE_KEYS = [
    "content",
    "generate",
    "builder",
    "manual-posts",
    "case-snippets",
    "settings",
    "analytics",
    "seo",
    "external-publishing",
    "newsletter",
    "outreach",
    "booking",
    "automations",
    "integrations",
    "health",
    "podcast",
    "music-library",
    "voices",
    "videos",
    "popups",
    "opportunities",
    "inbox",
    "market-monitor",
    "source-intelligence",
    "legibility-hub",
    "creative-studio",
    "render-queue",
    "slas",
    "clients",
    "customers",
    "work",
    "legal-vault",
    "commercial-ops",
    "admin-workspaces",
] as const;

export const clientBrandSchema = z.object({
    palette: z.object({
        primary: oklchString,
        primaryForeground: oklchString.optional(),
        accent: oklchString,
        accentForeground: oklchString.optional(),
        background: oklchString.optional(),
        foreground: oklchString.optional(),
    }),
    typography: z.object({
        display: z.string().min(1),
        body: z.string().min(1),
    }),
    logo: z.object({
        lightUrl: z.string().startsWith("/"),
        darkUrl: z.string().startsWith("/").optional(),
        alt: z.string().min(1),
    }),
    wallpaperUrl: z.string().startsWith("/").optional(),
});

export const clientModulesSchema = z.partialRecord(z.enum(MODULE_KEYS), z.boolean());
export const clientSupportedLocalesSchema = z.array(localeSchema).min(1);

export const clientConfigSchema = z.object({
    /**
     * Stable, lowercase, hyphen-only slug. Used in DB seeds, asset paths
     * (`public/clients/<slug>/`), and the fork branch name
     * `client/<slug>-production`. Cannot be changed once the fork is live.
     */
    slug: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase, hyphenated"),

    /** Human-readable display name. Free text. */
    displayName: z.string().min(1).max(80),

    /** Which template registry entry the workspace renders against. */
    template: z.enum(TEMPLATE_IDS),

    /** Workspace tier — controls Pro feature gating. */
    tier: z.enum(["basic", "pro"]).default("pro"),

    /** Sticky locale shown to first-visit users. */
    defaultLocale: localeSchema.default("en"),

    /**
     * Locales the public site renders for. Must include `defaultLocale`.
     * Subsetting to en-only is fine — the i18n framework treats absent
     * locales as fall-throughs to en.
     */
    supportedLocales: clientSupportedLocalesSchema.default(["en"]),

    /** Brand identity tokens. */
    brand: clientBrandSchema,

    /** Public-site identity. */
    site: z.object({
        /** Site title — appears in browser tab and og:site_name. */
        name: z.string().min(1).max(120),
        /** Default meta description — overridden per-page where present. */
        description: z.string().min(1).max(280),
        /** Production domain (no scheme), e.g. `client.example`. */
        domain: z
            .string()
            .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "valid bare domain (no scheme)"),
        /** Public inbox used by contact, legal, and operational surfaces. */
        contactEmail: z.string().email(),
        /** Optional public phone number in display format. */
        contactPhone: z.string().min(3).max(40).optional(),
        legal: z
            .object({
                privacyUrl: z.string().optional(),
                termsUrl: z.string().optional(),
            })
            .default({}),
    }),

    /**
     * Module switches. Anything set to `false` is hidden from the
     * dashboard launcher. Use this over forking the codebase. A module
     * not present is treated as the platform default. Setting a module to
     * `true` never bypasses tier, role, or capability checks.
     */
    modules: clientModulesSchema.default({}),

    /**
     * Optional list of runtime SQL seed files (relative to repo root)
     * to apply *after* migrations during initial provisioning. Used for
     * brand-specific content overlays that must not live in core
     * migrations.
     */
    seedOverlays: z.array(z.string().min(1)).default([]),

    /** First-time provisioning seed values. */
    workspaceSeed: z.object({
        /** Email of the first admin user — invited at provisioning time. */
        ownerEmail: z.string().email(),
        /** Optional first-admin display name. */
        ownerName: z.string().optional(),
        /**
         * Slug list of public pages to scaffold (about, services, etc.).
         * The provisioning script creates draft content_items rows for
         * each so the public site renders a complete sitemap on day one.
         */
        defaultPages: z.array(z.string().min(1)).default([]),
    }),

    /** Optional social handles. Surfaced in footer and structured data. */
    socials: z
        .object({
            linkedin: z.string().url().optional(),
            twitter: z.string().url().optional(),
            github: z.string().url().optional(),
            youtube: z.string().url().optional(),
            instagram: z.string().url().optional(),
            tiktok: z.string().url().optional(),
        })
        .default({}),
}).refine(
    (config) => config.supportedLocales.includes(config.defaultLocale),
    {
        message: "must include defaultLocale",
        path: ["supportedLocales"],
    },
);

export type ClientConfig = z.infer<typeof clientConfigSchema>;
export type Locale = z.infer<typeof localeSchema>;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type TemplateId = (typeof TEMPLATE_IDS)[number];
