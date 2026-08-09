import type { Locale } from "@/features/templates/types";
import { isRetiredBlogSlug } from "@/features/blog/retired-posts";
import {
    canonicalizePublicHref,
    stripLocaleFromPathname,
} from "@/shared/lib/i18n/routing";

const IMPLEMENTATION_HISTORY_LABEL: Record<Locale, string> = {
    en: "the audited deployment history",
    nl: "de gecontroleerde implementatiegeschiedenis",
    ar: "سجل التنفيذ الخاضع للتدقيق",
};

/**
 * Last-mile protection for database-authored public copy. Internal branch,
 * migration, and archive paths are useful evidence during review but are not
 * meaningful reader-facing citations and should never leak into published
 * HTML.
 */
export function sanitizePublicContent(
    value: string | null | undefined,
    locale: Locale,
): string {
    if (!value) return value ?? "";

    const cleaned = value
        .replace(/\bclient\/[a-z0-9-]+-production\b/gi, IMPLEMENTATION_HISTORY_LABEL[locale])
        .replace(/\barchive\/main-pre-isystem\b/gi, IMPLEMENTATION_HISTORY_LABEL[locale])
        .replace(/\bsupabase\/migrations\/\d{8,}[a-z0-9_-]*\.sql\b/gi, IMPLEMENTATION_HISTORY_LABEL[locale]);

    const normalizeHref = (href: string) => {
        const path = stripLocaleFromPathname(href.split(/[?#]/, 1)[0] || "/");
        const blogMatch = path.match(/^\/blog\/([^/?#]+)\/?$/);
        if (blogMatch?.[1] && isRetiredBlogSlug(decodeURIComponent(blogMatch[1]))) {
            return canonicalizePublicHref(locale, "/blog");
        }
        return canonicalizePublicHref(locale, href);
    };

    return cleaned
        .replace(/(\]\()((?:\/)[^)\s]+)(?=[\s)])/g, (_match, prefix: string, href: string) => (
            `${prefix}${normalizeHref(href)}`
        ))
        .replace(/(<a\b[^>]*\bhref=["'])((?:\/)[^"']+)(["'])/gi, (
            _match,
            prefix: string,
            href: string,
            suffix: string,
        ) => `${prefix}${normalizeHref(href)}${suffix}`);
}
