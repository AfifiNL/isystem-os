import type { Locale } from "@/features/templates/types";
import { DEFAULT_LOCALE, localizeHref } from "@/shared/lib/i18n/routing";

export function isBlogPath(pathname: string): boolean {
    return pathname === "/blog" || pathname.startsWith("/blog/");
}

/**
 * Blog SEO uses the unprefixed English URL as canonical (`/blog/...`) and
 * locale-prefixed URLs only for non-default translations. This avoids having
 * both `/blog/foo` and `/en/blog/foo` appear indexable for the same EN post.
 */
export function canonicalBlogHref(locale: Locale, href: string): string {
    if (!isBlogPath(href) || locale !== DEFAULT_LOCALE) {
        return localizeHref(locale, href);
    }

    return href;
}
