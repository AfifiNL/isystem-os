import type { Direction, Locale } from "@/features/templates/types";

export const SUPPORTED_LOCALES = ["en", "nl", "ar"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_HEADER_KEY = "x-site-locale";
export const PATHNAME_HEADER_KEY = "x-site-pathname";

const NON_LOCALIZED_EXACT_PATHS = new Set([
    "/favicon.ico",
    "/llms.txt",
    "/llms-full.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
]);

// Note: '/portal' is intentionally NOT in this list. Portal URLs are
// localized (e.g. /ar/portal/dashboard) so customers experience the partner
// portal in their chosen language. Auth redirects must use localizeHref().
const NON_LOCALIZED_PREFIXES = [
    "/dashboard",
    "/.well-known",
    "/api",
    "/launch",
    "/login",
    "/setup",
    "/test",
    "/batch_queues",
    "/reset-password",
    "/_next",
] as const;

const STATIC_ASSET_EXTENSION = /\.(?:avif|css|csv|gif|ico|jpe?g|js|json|map|mp3|mp4|pdf|png|svg|txt|webm|webp|xml|zip)$/i;

const LOCALE_DIRECTION: Record<Locale, Direction> = {
    en: "ltr",
    nl: "ltr",
    ar: "rtl",
};

const LOCALE_NATIVE_LABEL: Record<Locale, string> = {
    en: "English",
    nl: "Nederlands",
    ar: "العربية",
};

const LOCALE_BCP47: Record<Locale, string> = {
    en: "en-US",
    nl: "nl-NL",
    ar: "ar",
};

const LOCALE_OG: Record<Locale, string> = {
    en: "en_US",
    nl: "nl_NL",
    ar: "ar",
};

function normalizePathname(pathname: string): string {
    if (!pathname) {
        return "/";
    }

    return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
    return value === "en" || value === "nl" || value === "ar";
}

export function getLocaleDirection(locale: Locale): Direction {
    return LOCALE_DIRECTION[locale];
}

export function getLocaleNativeLabel(locale: Locale): string {
    return LOCALE_NATIVE_LABEL[locale];
}

export function getLocaleBcp47(locale: Locale): string {
    return LOCALE_BCP47[locale];
}

export function getLocaleFromPathname(pathname: string): Locale | null {
    const normalizedPathname = normalizePathname(pathname);
    const [, maybeLocale] = normalizedPathname.split("/");

    return isSupportedLocale(maybeLocale) ? maybeLocale : null;
}

export function stripLocaleFromPathname(pathname: string): string {
    const normalizedPathname = normalizePathname(pathname);
    const locale = getLocaleFromPathname(normalizedPathname);

    if (!locale) {
        return normalizedPathname;
    }

    const strippedPath = normalizedPathname.slice(locale.length + 1);
    return strippedPath.startsWith("/") ? strippedPath || "/" : `/${strippedPath}`;
}

export function isNonLocalizedPath(pathname: string): boolean {
    const normalizedPathname = normalizePathname(pathname);

    if (NON_LOCALIZED_EXACT_PATHS.has(normalizedPathname) || STATIC_ASSET_EXTENSION.test(normalizedPathname)) {
        return true;
    }

    return NON_LOCALIZED_PREFIXES.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`));
}

export function shouldLocalizePath(pathname: string): boolean {
    const normalizedPathname = normalizePathname(pathname);

    if (normalizedPathname === "/") {
        return true;
    }

    return !isNonLocalizedPath(normalizedPathname);
}

function splitHref(href: string) {
    const match = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);

    return {
        path: match?.[1] ?? href,
        query: match?.[2] ?? "",
        hash: match?.[3] ?? "",
    };
}

export function localizeHref(locale: Locale, href: string): string {
    if (!href) {
        return href;
    }

    if (
        href.startsWith("http://")
        || href.startsWith("https://")
        || href.startsWith("mailto:")
        || href.startsWith("tel:")
        || href.startsWith("#")
        || href.startsWith("//")
    ) {
        return href;
    }

    const { path, query, hash } = splitHref(href);
    const normalizedPath = normalizePathname(path || "/");

    if (getLocaleFromPathname(normalizedPath) || !shouldLocalizePath(normalizedPath)) {
        return `${normalizedPath}${query}${hash}`;
    }

    // English blog URLs intentionally use the unprefixed canonical surface.
    // Keeping this rule in the shared helper prevents nav, footer, CTA, and
    // CMS-authored links from creating a site-wide /en/blog → /blog redirect.
    if (
        locale === DEFAULT_LOCALE
        && (normalizedPath === "/blog" || normalizedPath.startsWith("/blog/"))
    ) {
        return `${normalizedPath}${query}${hash}`;
    }

    const localizedPath = normalizedPath === "/" ? `/${locale}` : `/${locale}${normalizedPath}`;
    return `${localizedPath}${query}${hash}`;
}

/**
 * Rewrites an internal href to the requested locale even when CMS content
 * already contains a different locale prefix. This also collapses the legacy
 * default-English `/en/blog/*` form to its unprefixed canonical URL.
 */
export function canonicalizePublicHref(locale: Locale, href: string): string {
    if (
        !href
        || href.startsWith("http://")
        || href.startsWith("https://")
        || href.startsWith("mailto:")
        || href.startsWith("tel:")
        || href.startsWith("#")
        || href.startsWith("//")
    ) {
        return href;
    }

    const { path, query, hash } = splitHref(href);
    const localeNeutralPath = stripLocaleFromPathname(normalizePathname(path || "/"));
    return localizeHref(locale, `${localeNeutralPath}${query}${hash}`);
}

// Parse Accept-Language header into a q-ordered tag list and select the first
// supported locale by tag prefix (so 'ar-SA', 'ar-EG', etc. all resolve to
// 'ar'). Replaces the previous naive substring matcher.
function pickLocaleFromAcceptLanguage(header: string | null | undefined): Locale | null {
    if (!header) {
        return null;
    }

    const entries = header
        .split(",")
        .map((part) => {
            const [tagRaw, ...params] = part.trim().split(";");
            const tag = tagRaw?.toLowerCase().trim();
            if (!tag) {
                return null;
            }
            let q = 1;
            for (const param of params) {
                const [k, v] = param.trim().split("=");
                if (k === "q" && v) {
                    const parsed = Number.parseFloat(v);
                    if (!Number.isNaN(parsed)) {
                        q = parsed;
                    }
                }
            }
            return { tag, q };
        })
        .filter((entry): entry is { tag: string; q: number } => entry !== null)
        .sort((a, b) => b.q - a.q);

    for (const { tag } of entries) {
        const primary = tag.split("-")[0];
        if (isSupportedLocale(primary)) {
            return primary;
        }
    }

    return null;
}

export function resolveLocaleFromRequest(input: {
    pathname: string;
    cookieLocale?: string | null;
    acceptLanguage?: string | null;
    defaultLocale?: Locale;
}): Locale {
    const localeFromPath = getLocaleFromPathname(input.pathname);
    if (localeFromPath) {
        return localeFromPath;
    }

    if (isSupportedLocale(input.cookieLocale)) {
        return input.cookieLocale;
    }

    const fromAccept = pickLocaleFromAcceptLanguage(input.acceptLanguage);
    if (fromAccept) {
        return fromAccept;
    }

    return input.defaultLocale ?? DEFAULT_LOCALE;
}

export function toOpenGraphLocale(locale: Locale): string {
    return LOCALE_OG[locale];
}
