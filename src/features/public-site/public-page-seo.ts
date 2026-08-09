import type { Locale } from "@/features/templates/types";
import { isPublicBuilderData } from "@/features/builder/puck.config";
import { isPublicPagePuckDataV2 } from "@/features/public-site/public-page-data";
import { SUPPORTED_LOCALES } from "@/shared/lib/i18n/routing";
import {
    normalizeSeoDescription,
    normalizeSeoTitle,
} from "@/features/seo/public-metadata-text";

interface PublicSeoPage {
    title: string;
    content_markdown?: string | null;
    visual_layout: unknown;
    public_layout_v2?: unknown;
}

export interface ResolvedPublicPageSeo {
    seoTitle: string;
    seoDescription: string;
    seoImage?: string;
    noindex?: boolean;
    canonicalPath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function localizedText(value: unknown, locale: Locale): string {
    if (typeof value === "string") return value.trim();
    if (!isRecord(value)) return "";

    const preferred = value[locale];
    if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
    const english = value.en;
    if (typeof english === "string" && english.trim()) return english.trim();

    const firstText = Object.values(value).find((candidate) => (
        typeof candidate === "string" && candidate.trim().length > 0
    ));
    return typeof firstText === "string" ? firstText.trim() : "";
}

function authoredLocalizedText(value: unknown, locale: Locale): string {
    if (locale === "en" && typeof value === "string") return value.trim();
    if (!isRecord(value)) return "";
    const candidate = value[locale];
    return typeof candidate === "string" ? candidate.trim() : "";
}

function metadataString(metadata: Record<string, unknown> | undefined, ...keys: string[]): string {
    if (!metadata) return "";
    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function resolveLayout(page: PublicSeoPage) {
    if (isPublicPagePuckDataV2(page.public_layout_v2)) {
        return {
            metadata: page.public_layout_v2.root.props.metadata as Record<string, unknown> | undefined,
            content: page.public_layout_v2.content,
        };
    }

    if (isPublicBuilderData(page.visual_layout)) {
        return {
            metadata: page.visual_layout.root?.props?.metadata as Record<string, unknown> | undefined,
            content: page.visual_layout.content ?? [],
        };
    }

    return { metadata: undefined, content: [] };
}

function resolveHeroCopy(content: Array<{ type?: unknown; props?: unknown }>, locale: Locale) {
    const hero = content.find((block) => {
        if (!isRecord(block) || !isRecord(block.props)) return false;
        const type = typeof block.type === "string" ? block.type.toLowerCase() : "";
        const id = typeof block.props.id === "string" ? block.props.id.toLowerCase() : "";
        return type.includes("hero") || id.includes("hero");
    });
    const props = hero && isRecord(hero.props) ? hero.props : {};
    const title = ["headline", "title", "header"]
        .map((key) => localizedText(props[key], locale))
        .find(Boolean) ?? "";
    const description = ["subhead", "subtitle", "description", "body"]
        .map((key) => localizedText(props[key], locale))
        .find(Boolean) ?? "";

    return { title, description };
}

function resolveAuthoredHeroCopy(content: Array<{ type?: unknown; props?: unknown }>, locale: Locale) {
    const hero = content.find((block) => {
        if (!isRecord(block) || !isRecord(block.props)) return false;
        const type = typeof block.type === "string" ? block.type.toLowerCase() : "";
        const id = typeof block.props.id === "string" ? block.props.id.toLowerCase() : "";
        return type.includes("hero") || id.includes("hero");
    });
    const props = hero && isRecord(hero.props) ? hero.props : {};
    const title = ["headline", "title", "header"]
        .map((key) => authoredLocalizedText(props[key], locale))
        .find(Boolean) ?? "";
    const description = ["subhead", "subtitle", "description", "body"]
        .map((key) => authoredLocalizedText(props[key], locale))
        .find(Boolean) ?? "";

    return { title, description };
}

/**
 * Only advertise locale variants with independently authored hero copy.
 * Rendering can still fall back to English for a visitor, but search engines
 * must not receive hreflang/sitemap promises for an untranslated URL.
 */
export function getPublicPageAvailableLocales(page: PublicSeoPage): Locale[] {
    const { content, metadata } = resolveLayout(page);
    return SUPPORTED_LOCALES.filter((locale) => {
        const hero = resolveAuthoredHeroCopy(content, locale);
        if (hero.title && hero.description) return true;
        if (locale !== "en") return false;

        const storedTitle = metadataString(metadata, "seoTitle", "seo_title");
        const storedDescription = metadataString(metadata, "seoDescription", "seo_description");
        return Boolean(
            (storedTitle && storedDescription)
            || (page.title.trim() && page.content_markdown?.trim()),
        );
    });
}

export function isPublicPageLocaleComplete(page: PublicSeoPage, locale: Locale): boolean {
    return getPublicPageAvailableLocales(page).includes(locale);
}

export function resolvePublicPageSeo(
    page: PublicSeoPage,
    locale: Locale,
    siteName: string,
): ResolvedPublicPageSeo {
    const { metadata, content } = resolveLayout(page);
    const hero = resolveHeroCopy(content, locale);
    const storedTitle = metadataString(metadata, "seoTitle", "seo_title");
    const storedDescription = metadataString(metadata, "seoDescription", "seo_description");
    const repairedStoredDescription = hero.description.length > storedDescription.length
        && hero.description.startsWith(storedDescription)
        ? hero.description
        : storedDescription;
    const localizedTitle = locale === "en" ? storedTitle : hero.title;
    const localizedDescription = locale === "en" ? repairedStoredDescription : hero.description;
    const seoTitle = normalizeSeoTitle({
        value: localizedTitle,
        fallback: hero.title || page.title,
        siteName,
        maxLength: Math.max(32, 62 - siteName.trim().length - 3),
    });
    const seoDescription = normalizeSeoDescription({
        value: localizedDescription,
        fallback: hero.description || page.content_markdown || "",
        maxLength: 160,
    });
    const heroMedia = metadataString(metadata, "heroMedia", "hero_media");
    const candidateCanonicalPath = metadataString(metadata, "canonicalPath", "canonical_path");

    return {
        seoTitle,
        seoDescription,
        seoImage: heroMedia || undefined,
        noindex: metadata?.noindex === true,
        canonicalPath: candidateCanonicalPath.startsWith("/")
            && !candidateCanonicalPath.startsWith("//")
            && !/[\u0000-\u001f\u007f\\]/.test(candidateCanonicalPath)
            ? candidateCanonicalPath
            : undefined,
    };
}
