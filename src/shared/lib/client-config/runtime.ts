import type { SiteChromeConfig } from "@/features/site-chrome/schema";
import { resolveDesignTokens } from "@/features/templates/design-tokens";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import {
    clientBrandSchema,
    clientModulesSchema,
    clientSupportedLocalesSchema,
} from "./schema";
import type { ClientConfig } from "./schema";

export interface PublicRuntimeConfig {
    brand?: ClientConfig["brand"];
    modules?: ClientConfig["modules"];
    supportedLocales?: Locale[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

export function extractPublicRuntimeConfig(metadata: unknown): PublicRuntimeConfig {
    const root = asRecord(metadata);
    const candidate = asRecord(root?.public_config) ?? root;
    if (!candidate) return {};

    const brand = clientBrandSchema.safeParse(candidate.brand);
    const modules = clientModulesSchema.safeParse(candidate.modules);
    const supportedLocales = clientSupportedLocalesSchema.safeParse(candidate.supportedLocales);

    return {
        ...(brand.success ? { brand: brand.data } : {}),
        ...(modules.success ? { modules: modules.data } : {}),
        ...(supportedLocales.success ? { supportedLocales: supportedLocales.data } : {}),
    };
}

export function resolveSupportedPublicLocales(
    metadata: unknown,
    fallback: readonly Locale[] = ["en", "nl", "ar"],
): Locale[] {
    const configured = extractPublicRuntimeConfig(metadata).supportedLocales;
    return configured?.length ? [...configured] : [...fallback];
}

export function applyPublicBrandToTemplate(
    config: TemplateConfig,
    brand: PublicRuntimeConfig["brand"],
): TemplateConfig {
    if (!brand) return config;

    const baseTokens = resolveDesignTokens(config);
    const colors = {
        ...config.colors,
        primary: brand.palette.primary,
        primaryForeground: brand.palette.primaryForeground ?? config.colors.primaryForeground,
        accent: brand.palette.accent,
        accentForeground: brand.palette.accentForeground ?? config.colors.accentForeground,
        gradientFrom: brand.palette.primary,
        gradientTo: brand.palette.accent,
    };

    return {
        ...config,
        colors,
        fonts: {
            heading: brand.typography.display,
            body: brand.typography.body,
        },
        designTokens: {
            ...baseTokens,
            surfaces: {
                ...baseTokens.surfaces,
                ...(brand.palette.background
                    ? { canvas: brand.palette.background, light: brand.palette.background }
                    : {}),
            },
            text: {
                ...baseTokens.text,
                ...(brand.palette.foreground ? { primary: brand.palette.foreground } : {}),
                accent: colors.primary,
                accentStrong: colors.accent,
            },
        },
    };
}

export function applyPublicBrandToSiteChrome(
    chrome: SiteChromeConfig,
    siteName: string,
    brand: PublicRuntimeConfig["brand"],
): SiteChromeConfig {
    if (!brand) return chrome;
    return {
        ...chrome,
        brand: {
            ...chrome.brand,
            name: { en: siteName },
            accentText: { en: "" },
            navbarLogoUrl: brand.logo.lightUrl,
            footerLogoUrl: brand.logo.darkUrl ?? brand.logo.lightUrl,
        },
    };
}
