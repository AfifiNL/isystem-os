"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { revalidatePath } from "next/cache";
import type { Locale, TemplateId } from "@/features/templates/types";
import {
    buildDefaultSiteChrome,
    resolveSiteChromeConfig,
    siteChromeSchema,
    type SiteChromeConfig,
} from "@/features/site-chrome/schema";
import { getTemplateById } from "@/features/templates/registry";
import { newsletterSettingsSchema, type NewsletterSettingsInput } from "@/features/newsletter/schema";
import { getDefaultNewsletterSettings } from "@/features/newsletter/service";

function mergeSiteChromeMetadata(existing: unknown, nextChrome: SiteChromeConfig | undefined) {
    const base = existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};

    if (nextChrome !== undefined) {
        base.site_chrome = nextChrome;
    }

    return base;
}

// Per-locale site description used by SEO meta tags (description, og:description,
// twitter:description). English is canonical; nl/ar are optional overrides
// that fall back to the canonical site_description column when absent.
export interface SiteDescriptionI18n {
    en?: string;
    nl?: string;
    ar?: string;
}

// Optional per-locale Markdown for /privacy and /terms. Each page falls back
// to its hand-written hardcoded copy when its locale entry is missing.
export interface LegalPagesI18n {
    privacy?: { en?: string; nl?: string; ar?: string };
    terms?: { en?: string; nl?: string; ar?: string };
}

interface UpdateSettingsPayload {
    active_template?: TemplateId;
    locale?: Locale;
    workspace_default_locale?: Locale;
    site_name?: string;
    site_description?: string;
    site_description_i18n?: SiteDescriptionI18n;
    legal_pages_i18n?: LegalPagesI18n;
    site_chrome?: SiteChromeConfig;
    newsletter_settings?: NewsletterSettingsInput;
}

function sanitizeLocaleStringMap<K extends string>(input: Partial<Record<K, string | undefined>> | undefined, keys: readonly K[]): Partial<Record<K, string>> | undefined {
    if (!input || typeof input !== "object") return undefined;
    const out: Partial<Record<K, string>> = {};
    for (const key of keys) {
        const v = input[key];
        if (typeof v === "string") {
            const trimmed = v.trim();
            if (trimmed.length > 0) out[key] = trimmed;
        }
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeText(value: string | undefined): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function unquote(val: unknown) {
    if (typeof val === 'string') {
        return val.replace(/^"|"$/g, '');
    }
    return val;
}

export async function getSettings() {
    const supabase = await createClient();
    const context = await resolveWorkspaceContext();

    const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");

    if (error) return { error: error.message, data: null };

    const map = Object.fromEntries(
        (data ?? []).map((row: { key: string; value: unknown }) => [row.key, row.value])
    );

    const workspaceId = context?.activeWorkspace?.id ?? null;
    let workspaceSettings: {
        site_name: string | null;
        site_description: string | null;
        locale_override: string | null;
        template_override: string | null;
        metadata?: unknown;
    } | null = null;

    if (workspaceId) {
        const { data: workspaceData } = await supabase
            .from("workspace_settings")
            .select("site_name, site_description, locale_override, template_override, metadata")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

        workspaceSettings = workspaceData ?? null;
    }

    const globalActiveTemplate = (unquote(map.active_template) as string) ?? "personal-brand";
    const globalLocale = (unquote(map.locale) as string) ?? "en";
    const globalSiteName = (unquote(map.site_name) as string) ?? "";
    const globalSiteDescription = (unquote(map.site_description) as string) ?? "";

    const wsMetadata = workspaceSettings && typeof workspaceSettings.metadata === "object" && !Array.isArray(workspaceSettings.metadata)
        ? (workspaceSettings.metadata as Record<string, unknown>)
        : null;
    const siteDescriptionI18nRaw = wsMetadata?.site_description_i18n;
    const legalPagesI18nRaw = wsMetadata?.legal_pages_i18n;

    const resolvedSettings = {
        error: null,
        data: {
            active_template:
                workspaceSettings?.template_override
                ?? context?.activeWorkspace?.legacy_template_id
                ?? globalActiveTemplate,
            locale:
                workspaceSettings?.locale_override
                ?? context?.activeWorkspace?.default_locale
                ?? globalLocale,
            workspace_default_locale: context?.activeWorkspace?.default_locale ?? "en",
            site_name: workspaceSettings?.site_name ?? globalSiteName,
            site_description: workspaceSettings?.site_description ?? globalSiteDescription,
            site_description_i18n: (siteDescriptionI18nRaw && typeof siteDescriptionI18nRaw === "object" && !Array.isArray(siteDescriptionI18nRaw)
                ? siteDescriptionI18nRaw
                : {}) as SiteDescriptionI18n,
            legal_pages_i18n: (legalPagesI18nRaw && typeof legalPagesI18nRaw === "object" && !Array.isArray(legalPagesI18nRaw)
                ? legalPagesI18nRaw
                : {}) as LegalPagesI18n,
            site_chrome: null as SiteChromeConfig | null,
            newsletter_settings: getDefaultNewsletterSettings(context?.activeWorkspace?.name ?? "Workspace"),
        },
    };

    const activeTemplateId = resolvedSettings.data.active_template as TemplateId;
    const fallbackChrome = buildDefaultSiteChrome(getTemplateById(activeTemplateId), resolvedSettings.data.site_name || globalSiteName || "Site");

    resolvedSettings.data.site_chrome = resolveSiteChromeConfig(
        workspaceSettings && typeof workspaceSettings.metadata === "object"
            ? (workspaceSettings.metadata as { site_chrome?: unknown }).site_chrome
            : null,
        fallbackChrome,
    );

    const parsedNewsletterSettings = newsletterSettingsSchema.safeParse(
        workspaceSettings && typeof workspaceSettings.metadata === "object"
            ? (workspaceSettings.metadata as { newsletter?: unknown }).newsletter
            : null,
    );

    resolvedSettings.data.newsletter_settings = parsedNewsletterSettings.success
        ? parsedNewsletterSettings.data
        : getDefaultNewsletterSettings(context?.activeWorkspace?.name ?? "Workspace");

    return resolvedSettings;
}

export async function updateSettings(payload: UpdateSettingsPayload) {
    const supabase = await createClient();
    const context = await resolveWorkspaceContext();
    const workspaceId = context?.activeWorkspace?.id ?? null;
    let existingWorkspaceSettings: { metadata?: unknown } | null = null;

    if (workspaceId) {
        const { data } = await supabase
            .from("workspace_settings")
            .select("metadata")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

        existingWorkspaceSettings = data ?? null;
    }

    if (payload.workspace_default_locale && workspaceId) {
        const { error: workspaceError } = await supabase
            .from("workspaces")
            .update({
                default_locale: payload.workspace_default_locale,
                updated_at: new Date().toISOString(),
            })
            .eq("id", workspaceId);

        if (workspaceError) {
            return { error: `Failed to update workspace language: ${workspaceError.message}` };
        }
    }

    if (workspaceId) {
        const validatedChrome = payload.site_chrome === undefined
            ? undefined
            : siteChromeSchema.safeParse(payload.site_chrome);
        const validatedNewsletter = payload.newsletter_settings === undefined
            ? undefined
            : newsletterSettingsSchema.safeParse(payload.newsletter_settings);

        if (validatedChrome && !validatedChrome.success) {
            return { error: "Invalid site chrome configuration." };
        }

        if (validatedNewsletter && !validatedNewsletter.success) {
            return { error: validatedNewsletter.error.issues[0]?.message ?? "Invalid newsletter configuration." };
        }

        if (payload.active_template) {
            const { error: workspaceTemplateError } = await supabase
                .from("workspaces")
                .update({
                    legacy_template_id: payload.active_template,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", workspaceId);

            if (workspaceTemplateError) {
                return { error: `Failed to update workspace template identity: ${workspaceTemplateError.message}` };
            }
        }

        const workspaceSettingsPayload = {
            template_override: payload.active_template,
            locale_override: payload.locale,
            site_name: normalizeText(payload.site_name),
            site_description: normalizeText(payload.site_description),
            metadata: validatedChrome?.success
                ? mergeSiteChromeMetadata(existingWorkspaceSettings?.metadata, validatedChrome.data)
                : existingWorkspaceSettings?.metadata,
        };

        if (validatedNewsletter?.success) {
            const metadata = workspaceSettingsPayload.metadata && typeof workspaceSettingsPayload.metadata === "object" && !Array.isArray(workspaceSettingsPayload.metadata)
                ? { ...(workspaceSettingsPayload.metadata as Record<string, unknown>) }
                : {};
            metadata.newsletter = validatedNewsletter.data;
            workspaceSettingsPayload.metadata = metadata;
        }

        // Persist site_description_i18n + legal_pages_i18n into metadata. We
        // merge into the existing metadata blob so we don't clobber sibling
        // keys (site_chrome, newsletter, etc.).
        if (payload.site_description_i18n !== undefined || payload.legal_pages_i18n !== undefined) {
            const metadata = workspaceSettingsPayload.metadata && typeof workspaceSettingsPayload.metadata === "object" && !Array.isArray(workspaceSettingsPayload.metadata)
                ? { ...(workspaceSettingsPayload.metadata as Record<string, unknown>) }
                : {};
            if (payload.site_description_i18n !== undefined) {
                const sanitized = sanitizeLocaleStringMap(payload.site_description_i18n, ["en", "nl", "ar"] as const);
                if (sanitized) metadata.site_description_i18n = sanitized;
                else delete metadata.site_description_i18n;
            }
            if (payload.legal_pages_i18n !== undefined) {
                const sanitizedLegal: Record<string, Record<string, string>> = {};
                for (const page of ["privacy", "terms"] as const) {
                    const block = payload.legal_pages_i18n[page];
                    const localeMap = sanitizeLocaleStringMap(block, ["en", "nl", "ar"] as const);
                    if (localeMap) sanitizedLegal[page] = localeMap;
                }
                if (Object.keys(sanitizedLegal).length > 0) metadata.legal_pages_i18n = sanitizedLegal;
                else delete metadata.legal_pages_i18n;
            }
            workspaceSettingsPayload.metadata = metadata;
        }

        const hasWorkspaceSettingsUpdate = Object.values(workspaceSettingsPayload).some((value) => value !== undefined);

        if (hasWorkspaceSettingsUpdate) {
            const { error: workspaceSettingsError } = await supabase
                .from("workspace_settings")
                .upsert(
                    {
                        workspace_id: workspaceId,
                        ...workspaceSettingsPayload,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: "workspace_id" },
                );

            if (workspaceSettingsError) {
                return { error: `Failed to update workspace settings: ${workspaceSettingsError.message}` };
            }
        }

        revalidatePath("/", "layout");
        return { error: null };
    }

    const siteSettingsPayload = {
        active_template: payload.active_template,
        locale: payload.locale,
        site_name: normalizeText(payload.site_name),
        site_description: normalizeText(payload.site_description),
    };

    const updates = Object.entries(siteSettingsPayload).filter(([, v]) => v !== undefined);

    for (const [key, value] of updates) {
        const { error } = await supabase
            .from("site_settings")
            .update({ value, updated_at: new Date().toISOString() })
            .eq("key", key);

        if (error) {
            return { error: `Failed to update ${key}: ${error.message}` };
        }
    }

    // Revalidate all public pages so they re-fetch the template
    revalidatePath("/", "layout");

    return { error: null };
}
