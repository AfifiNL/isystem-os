import { canonicalBlogHref } from "@/features/blog/urls";
import type { Locale } from "@/features/templates/types";
import { DEFAULT_LOCALE, getLocaleFromPathname, localizeHref, stripLocaleFromPathname } from "@/shared/lib/i18n/routing";

const INDEXING_IGNORED_QUERY_PARAMS = new Set(["ref", "type", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);

function normalizePathSlashes(pathname: string): string {
    const normalized = pathname.replace(/\/{2,}/g, "/");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function canonicalPathForPublicUrl(input: {
    type: "blog" | "page" | "video" | "podcast";
    slug: string;
    locale?: string | null;
    showSlug?: string | null;
}): string {
    const locale = input.locale === "nl" || input.locale === "ar" || input.locale === "en" ? input.locale : DEFAULT_LOCALE;

    if (input.type === "blog") {
        return canonicalBlogHref(locale, `/blog/${input.slug}`);
    }

    if (input.type === "video") {
        return localizeHref(locale, `/videos/${input.slug}`);
    }

    if (input.type === "podcast") {
        const showSlug = input.showSlug?.trim();
        if (!showSlug) {
            throw new Error("A podcast show slug is required to build a canonical episode path.");
        }
        return localizeHref(locale, `/podcast/${showSlug}/${input.slug}`);
    }

    const pagePath = input.slug === "home" ? "/" : `/${input.slug}`;
    return localizeHref(locale, pagePath);
}

export function cleanIndexingUrl(rawUrl: string): { url: string; canonicalPath: string } | null {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return null;
    }

    for (const key of Array.from(parsed.searchParams.keys())) {
        if (INDEXING_IGNORED_QUERY_PARAMS.has(key.toLowerCase())) {
            parsed.searchParams.delete(key);
        }
    }

    parsed.pathname = normalizePathSlashes(parsed.pathname);
    parsed.hash = "";

    const canonicalPath = parsed.pathname || "/";
    return {
        url: parsed.toString(),
        canonicalPath,
    };
}

export function cleanIndexingSearch(search: string): string {
    if (!search) return "";

    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    let changed = false;

    for (const key of Array.from(params.keys())) {
        if (INDEXING_IGNORED_QUERY_PARAMS.has(key.toLowerCase())) {
            params.delete(key);
            changed = true;
        }
    }

    if (!changed) return search;

    const cleaned = params.toString();
    return cleaned ? `?${cleaned}` : "";
}

export function buildCanonicalBlogUrl(input: {
    siteUrl: string;
    slug: string;
    locale?: string | null;
}): { url: string; canonicalPath: string } {
    const locale = input.locale === "nl" || input.locale === "ar" || input.locale === "en" ? input.locale as Locale : DEFAULT_LOCALE;
    return buildCanonicalPublicContentUrl({
        siteUrl: input.siteUrl,
        type: "blog",
        slug: input.slug,
        locale,
    });
}

export function buildCanonicalPublicContentUrl(input: {
    siteUrl: string;
    type: "blog" | "page";
    slug: string;
    locale?: string | null;
}): { url: string; canonicalPath: string } {
    const base = input.siteUrl.replace(/\/$/, "");
    const locale = input.locale === "nl" || input.locale === "ar" || input.locale === "en" ? input.locale as Locale : DEFAULT_LOCALE;
    const canonicalPath = canonicalPathForPublicUrl({
        type: input.type,
        slug: input.slug,
        locale,
    });
    return {
        url: `${base}${canonicalPath}`,
        canonicalPath,
    };
}

export function gscPageSlugCandidatesForBlog(input: {
    slug: string;
    locale?: string | null;
}): string[] {
    const locale = input.locale === "nl" || input.locale === "ar" || input.locale === "en" ? input.locale as Locale : DEFAULT_LOCALE;
    const canonical = canonicalBlogHref(locale, `/blog/${input.slug}`);
    const localePrefixed = localizeHref(locale, `/blog/${input.slug}`);
    // Keep the legacy explicit /en path as an evidence lookup candidate even
    // though English blog canonicals are now unprefixed. Historical GSC rows
    // can retain the redirected URL during the reporting window.
    const explicitLocalePrefixed = `/${locale}/blog/${input.slug}`;
    const unprefixed = `/blog/${input.slug}`;
    return Array.from(new Set([canonical, localePrefixed, explicitLocalePrefixed, unprefixed, stripLocaleFromPathname(canonical)]));
}

export function isNoisyIndexingUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return Array.from(parsed.searchParams.keys()).some((key) => INDEXING_IGNORED_QUERY_PARAMS.has(key.toLowerCase()));
    } catch {
        return true;
    }
}

export function canonicalizeIncomingPublicPath(pathname: string): string {
    const normalized = normalizePathSlashes(pathname);
    const locale = getLocaleFromPathname(normalized);
    const stripped = stripLocaleFromPathname(normalized);

    if (stripped === "/home" || stripped === "/home/") {
        return locale ? `/${locale}` : "/";
    }

    return normalized;
}
