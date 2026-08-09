import type { Locale } from "@/features/templates/types";
import { DEFAULT_LOCALE, localizeHref } from "@/shared/lib/i18n/routing";
import { canonicalBlogHref } from "@/features/blog/urls";

/**
 * Build the public URL for an internal content item from its slug + type.
 *
 * Correct route shapes (see src/app/(public)/):
 *   - blog posts                        → /blog/{slug} for EN, /{locale}/blog/{slug} for translations
 *   - root page (slug = "home")         → /{locale}
 *   - every other page                  → /{locale}/{slug}
 *
 * Historically this was implemented as `/${slug}`, which produced
 * `/beyond-2026-...` for a blog post that should have lived at
 * `/en/blog/beyond-2026-...`, so every applied internal link dumped the
 * reader onto a 404. This helper is the one source of truth for both the
 * blog-enhancement path (markdown splice) and the SEO control-center path
 * (visual_layout mutation).
 */
export function buildInternalContentHref(input: {
    slug: string | null | undefined;
    type?: string | null;
    locale?: Locale | string | null;
}): string | null {
    const rawSlug = typeof input.slug === "string" ? input.slug.trim() : "";
    const type = (input.type ?? "").toLowerCase();

    // If no slug is provided, it is only valid if it's a page (representing the homepage)
    if (!rawSlug && type !== "page") return null;

    // Strip leading/trailing slashes to normalize regardless of how callers
    // formatted the slug (some pre-prefix with `/`, some don't).
    const slug = rawSlug.replace(/^\/+|\/+$/g, "");

    const locale: Locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE;

    if (type === "blog" || type === "blog_post" || type === "newsletter_issue") {
        return canonicalBlogHref(locale, `/blog/${slug}`);
    }

    // Pages — special-case the "home" or empty slug so it doesn't render as
    // /en/home (which 404s) but as /en.
    if (slug === "home" || slug === "") {
        return localizeHref(locale, "/");
    }

    return localizeHref(locale, `/${slug}`);
}

function isLocale(value: unknown): value is Locale {
    return value === "en" || value === "nl" || value === "ar";
}
