import type { Locale } from "@/features/templates/types";

interface SiteDescriptionShape {
    siteDescription: string;
    siteDescriptionI18n?: { en?: string; nl?: string; ar?: string };
}

/**
 * Pick the locale-appropriate site description for SEO meta tags.
 * Read precedence: siteDescriptionI18n[locale] → siteDescriptionI18n.en
 *   → siteDescription (canonical column) → "".
 *
 * Lives in its own non-"use server" module so it can be imported by
 * generateMetadata, server components, and per-page metadata builders without
 * forcing them to be async.
 */
export function pickSiteDescription(settings: SiteDescriptionShape, locale: Locale): string {
    const map = settings.siteDescriptionI18n;
    const localized = map?.[locale]?.trim();
    if (localized) return localized;
    const fallbackEn = map?.en?.trim();
    if (fallbackEn) return fallbackEn;
    return settings.siteDescription;
}
