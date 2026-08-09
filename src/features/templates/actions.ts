"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { getTemplateById } from "./registry";
import type { Locale, TemplateConfig } from "./types";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { LOCALE_COOKIE_KEY, LOCALE_PREF_COOKIE_KEY } from "@/shared/lib/i18n/cookies";
import { getLocaleFromPathname, isSupportedLocale, LOCALE_HEADER_KEY, PATHNAME_HEADER_KEY } from "@/shared/lib/i18n/routing";
import {
    buildDefaultSiteChrome,
    resolveSiteChromeConfig,
    type SiteChromeConfig,
} from "@/features/site-chrome/schema";
import type { PublicSiteRendererSettings } from "@/features/public-site/public-site-rollout";
import {
    applyPublicBrandToSiteChrome,
    applyPublicBrandToTemplate,
    extractPublicRuntimeConfig,
    resolveSupportedPublicLocales,
    type PublicRuntimeConfig,
} from "@/shared/lib/client-config/runtime";

export interface SiteSettings {
    activeTemplate: string;
    locale: Locale;
    siteName: string;
    siteDescription: string;
    /** Per-locale overrides used by SEO meta tags. EN canonical lives in siteDescription. */
    siteDescriptionI18n?: { en?: string; nl?: string; ar?: string };
    /** Optional Markdown overrides for /privacy and /terms per locale. */
    legalPagesI18n?: {
        privacy?: { en?: string; nl?: string; ar?: string };
        terms?: { en?: string; nl?: string; ar?: string };
    };
    siteDomain: string;
    contactEmail?: string;
    contactPhone?: string;
    siteChrome?: SiteChromeConfig;
    publicSiteRenderer?: PublicSiteRendererSettings;
    supportedLocales: Locale[];
    publicConfig?: PublicRuntimeConfig;
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
    activeTemplate: "personal-brand",
    locale: "en",
    siteName: "Platform",
    siteDescription: "A configurable digital operating system.",
    siteDomain: "example.com",
    supportedLocales: ["en", "nl", "ar"],
};


function unquote(val: unknown) {
    if (typeof val === 'string') {
        return val.replace(/^"|"$/g, '');
    }
    return val;
}

function toNonEmptyString(value: unknown): string | null {
    const normalized = unquote(value);
    if (typeof normalized !== "string") {
        return null;
    }

    const trimmed = normalized.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toLocaleOrNull(value: unknown): Locale | null {
    const normalized = toNonEmptyString(value);
    if (normalized === "nl") return "nl";
    if (normalized === "ar") return "ar";
    if (normalized === "en") return "en";
    return null;
}

async function getGlobalSiteSettings(): Promise<SiteSettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");

    if (error || !data) {
        return { ...DEFAULT_SITE_SETTINGS };
    }

    const map = Object.fromEntries(data.map((row: { key: string; value: unknown }) => [row.key, row.value]));

    return {
        activeTemplate: toNonEmptyString(map.active_template) ?? DEFAULT_SITE_SETTINGS.activeTemplate,
        locale: toLocaleOrNull(map.locale) ?? DEFAULT_SITE_SETTINGS.locale,
        siteName: toNonEmptyString(map.site_name) ?? DEFAULT_SITE_SETTINGS.siteName,
        siteDescription: toNonEmptyString(map.site_description) ?? DEFAULT_SITE_SETTINGS.siteDescription,
        siteDomain: toNonEmptyString(map.site_domain) ?? DEFAULT_SITE_SETTINGS.siteDomain,
        supportedLocales: DEFAULT_SITE_SETTINGS.supportedLocales,
    };
}

/** Fetch all site_settings rows and return a structured object. */
export async function getSiteSettings(): Promise<SiteSettings> {
    const supabase = await createClient();
    const global = await getGlobalSiteSettings();
    const siteUrlOverride = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const workspaceContext = await resolveWorkspaceContext();
    const activeWorkspace = workspaceContext?.activeWorkspace;
    const globalTemplateConfig = getTemplateById(global.activeTemplate);
    const globalSiteChrome = buildDefaultSiteChrome(globalTemplateConfig, global.siteName);

    // Anonymous visitors have no auth context, so activeWorkspace is null.
    // Fall back to the canonical workspace that owns the active template so
    // public reads of `workspace_settings` (which holds the customized chrome
    // / navbar / footer config) return the SAME data admins edit. Without
    // this fallback, anonymous visitors get only `buildDefaultSiteChrome` —
    // the minimal hardcoded template default — which manifests as a stale,
    // "minimal old version" of the navbar and footer in incognito.
    const workspaceId =
        activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(global.activeTemplate));

    if (!workspaceId) {
        return {
            ...global,
            siteDomain: siteUrlOverride || global.siteDomain,
            siteChrome: globalSiteChrome,
            supportedLocales: global.supportedLocales,
        };
    }

    // For anonymous visitors RLS blocks `workspace_settings` reads
    // (`can_access_workspace` returns false without auth), so even with the
    // resolved workspaceId above we'd get back null and fall through to
    // `buildDefaultSiteChrome`. Mirror the `getPublicGdprFlags` pattern:
    // when no auth context is present, do a narrow service-role read of
    // public-facing columns only. Every column we select is already
    // rendered on the public site (site name, description, domain, contact,
    // chrome metadata), so a service-role read here doesn't expand the
    // public attack surface.
    const PUBLIC_COLUMNS = "site_name, site_description, site_domain, contact_email, contact_phone, locale_override, template_override, metadata";
    let workspaceSettings: Record<string, unknown> | null = null;
    let workspaceSettingsError: unknown = null;

    if (activeWorkspace?.id) {
        const { data, error } = await supabase
            .from("workspace_settings")
            .select(PUBLIC_COLUMNS)
            .eq("workspace_id", workspaceId)
            .maybeSingle();
        workspaceSettings = data as Record<string, unknown> | null;
        workspaceSettingsError = error;
    } else {
        const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceUrl && serviceKey) {
            const { createClient: createServiceRoleClient } = await import("@supabase/supabase-js");
            const serviceSupabase = createServiceRoleClient(serviceUrl, serviceKey, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data, error } = await serviceSupabase
                .from("workspace_settings")
                .select(PUBLIC_COLUMNS)
                .eq("workspace_id", workspaceId)
                .maybeSingle();
            workspaceSettings = data as Record<string, unknown> | null;
            workspaceSettingsError = error;
        }
    }

    const error = workspaceSettingsError;

    if (error || !workspaceSettings) {
        const fallbackPublicConfig = extractPublicRuntimeConfig(activeWorkspace?.metadata);
        const fallbackSiteName = global.siteName;
        const fallbackChrome = buildDefaultSiteChrome(
            getTemplateById(activeWorkspace?.legacy_template_id ?? global.activeTemplate),
            fallbackSiteName,
        );
        return {
            ...global,
            activeTemplate: activeWorkspace?.legacy_template_id ?? global.activeTemplate,
            locale: activeWorkspace?.default_locale ?? global.locale,
            siteDomain: siteUrlOverride || activeWorkspace?.slug || global.siteDomain,
            siteChrome: applyPublicBrandToSiteChrome(fallbackChrome, fallbackSiteName, fallbackPublicConfig.brand),
            supportedLocales: resolveSupportedPublicLocales(activeWorkspace?.metadata),
            publicConfig: fallbackPublicConfig,
        };
    }

    const ws = workspaceSettings as {
        site_name?: unknown;
        site_description?: unknown;
        site_domain?: unknown;
        contact_email?: unknown;
        contact_phone?: unknown;
        locale_override?: unknown;
        template_override?: unknown;
        metadata?: unknown;
    };
    const resolvedSettings = {
        activeTemplate:
            toNonEmptyString(ws.template_override)
            ?? activeWorkspace?.legacy_template_id
            ?? global.activeTemplate,
        locale:
            toLocaleOrNull(ws.locale_override)
            ?? activeWorkspace?.default_locale
            ?? global.locale,
        siteName: toNonEmptyString(ws.site_name) ?? global.siteName,
        siteDescription: toNonEmptyString(ws.site_description) ?? global.siteDescription,
        siteDomain: siteUrlOverride || toNonEmptyString(ws.site_domain) || global.siteDomain,
        contactEmail: toNonEmptyString(ws.contact_email) ?? undefined,
        contactPhone: toNonEmptyString(ws.contact_phone) ?? undefined,
    };

    const templateConfig = getTemplateById(resolvedSettings.activeTemplate);
    const defaultChrome = buildDefaultSiteChrome(templateConfig, resolvedSettings.siteName);
    const workspaceMetadata = workspaceSettings && typeof workspaceSettings === "object" && "metadata" in workspaceSettings
        ? (workspaceSettings as { metadata?: unknown }).metadata
        : null;

    const siteDescriptionI18nRaw = workspaceMetadata && typeof workspaceMetadata === "object"
        ? (workspaceMetadata as { site_description_i18n?: unknown }).site_description_i18n
        : null;
    const legalPagesI18nRaw = workspaceMetadata && typeof workspaceMetadata === "object"
        ? (workspaceMetadata as { legal_pages_i18n?: unknown }).legal_pages_i18n
        : null;
    const publicSiteRendererRaw = workspaceMetadata && typeof workspaceMetadata === "object"
        ? (workspaceMetadata as { public_site_renderer?: unknown }).public_site_renderer
        : null;
    const publicConfig = extractPublicRuntimeConfig(workspaceMetadata);
    const resolvedChrome = resolveSiteChromeConfig(
        workspaceMetadata && typeof workspaceMetadata === "object"
            ? (workspaceMetadata as { site_chrome?: unknown }).site_chrome
            : null,
        defaultChrome,
    );

    return {
        ...resolvedSettings,
        siteDescriptionI18n: (siteDescriptionI18nRaw && typeof siteDescriptionI18nRaw === "object" && !Array.isArray(siteDescriptionI18nRaw)
            ? siteDescriptionI18nRaw
            : undefined) as SiteSettings["siteDescriptionI18n"],
        legalPagesI18n: (legalPagesI18nRaw && typeof legalPagesI18nRaw === "object" && !Array.isArray(legalPagesI18nRaw)
            ? legalPagesI18nRaw
            : undefined) as SiteSettings["legalPagesI18n"],
        publicSiteRenderer: (publicSiteRendererRaw && typeof publicSiteRendererRaw === "object" && !Array.isArray(publicSiteRendererRaw)
            ? publicSiteRendererRaw
            : undefined) as SiteSettings["publicSiteRenderer"],
        supportedLocales: resolveSupportedPublicLocales(workspaceMetadata),
        publicConfig,
        siteChrome: applyPublicBrandToSiteChrome(resolvedChrome, resolvedSettings.siteName, publicConfig.brand),
    };
}

import { cookies, headers } from "next/headers";

/** Resolve the full template config from the DB. */
export async function getActiveTemplate(): Promise<{ config: TemplateConfig; locale: Locale; settings: SiteSettings }> {
    const settings = await getSiteSettings();
    const workspaceContext = await resolveWorkspaceContext();
    const resolvedTemplate = await resolveLegacyTemplateForWorkspaceContext(
        workspaceContext,
        settings.activeTemplate,
    );
    const baseConfig = resolvedTemplate.config ?? getTemplateById(settings.activeTemplate);
    const config = applyPublicBrandToTemplate(
        baseConfig,
        extractPublicRuntimeConfig(workspaceContext?.activeWorkspace?.metadata).brand
            ?? settings.publicConfig?.brand,
    );

    const headerStore = await headers();
    const cookieStore = await cookies();
    // Prefer the URL as the source of truth — on /nl/... the pathname header is
    // set by middleware to the original request path, even after the internal
    // rewrite. This avoids a class of bugs where the header-based locale signal
    // is lost but the URL still reflects /nl.
    const localeHeader = headerStore.get(LOCALE_HEADER_KEY);
    const pathnameHeader = headerStore.get(PATHNAME_HEADER_KEY);
    const localeFromPathname = pathnameHeader ? getLocaleFromPathname(pathnameHeader) : null;
    const localeCookie = cookieStore.get(LOCALE_COOKIE_KEY)?.value as Locale | undefined;
    const requestedLocale = localeFromPathname
        ?? (isSupportedLocale(localeHeader) ? localeHeader : null)
        ?? (isSupportedLocale(localeCookie) ? localeCookie : null)
        ?? settings.locale;
    const locale = settings.supportedLocales.includes(requestedLocale)
        ? requestedLocale
        : settings.supportedLocales.includes(settings.locale)
            ? settings.locale
            : settings.supportedLocales[0] ?? "en";

    return {
        config,
        locale,
        settings: {
            ...settings,
            activeTemplate: config.id,
            siteDomain: settings.siteDomain,
        },
    };
}

/** Switch the site locale between en and nl. */
export async function setLocale(newLocale: Locale) {
    const { cookies } = await import("next/headers");
    const { revalidatePath } = await import("next/cache");

    const cookieStore = await cookies();
    const cookieOptions = {
        path: "/",
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24 * 365, // 1 year
    };
    cookieStore.set(LOCALE_COOKIE_KEY, newLocale, cookieOptions);
    // Mark this as an explicit user choice. Middleware treats this cookie as
    // sticky: any mismatching URL locale is redirected to this value.
    cookieStore.set(LOCALE_PREF_COOKIE_KEY, newLocale, cookieOptions);

    revalidatePath("/", "layout");
}
