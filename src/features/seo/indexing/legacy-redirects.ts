import { canonicalizeIncomingPublicPath, cleanIndexingSearch } from "@/features/seo/indexing/url-normalization";
import { getLocaleFromPathname, stripLocaleFromPathname } from "@/shared/lib/i18n/routing";
import { isRetiredBlogSlug } from "@/features/blog/retired-posts";

const LEGACY_404_REDIRECTS = new Map<string, string>([
    ["/media-ops-demo", "/en/media-agency-digital-systems"],
]);

function withQueryAndHash(targetPath: string, search: string, hash: string) {
    return `${targetPath}${search}${hash}`;
}

export function resolveLegacyIndexingRedirect(input: {
    pathname: string;
    search?: string;
    hash?: string;
}): string | null {
    // SEO canonicalization is only for public documents. Applying query cleanup
    // to API endpoints can remove semantic parameters such as the Supabase
    // `type=magiclink` value required by /api/auth/confirm.
    if (input.pathname === "/api" || input.pathname.startsWith("/api/")) {
        return null;
    }

    const search = input.search ?? "";
    const hash = input.hash ?? "";
    const cleanedSearch = cleanIndexingSearch(search);

    const duplicatePodcastMatch = input.pathname.match(/^\/(en|nl|ar)\/podcast\/\/([^/?#]+)\/?$/);
    if (duplicatePodcastMatch) {
        return withQueryAndHash(`/${duplicatePodcastMatch[1]}/podcast`, cleanedSearch, hash);
    }

    const canonicalPath = canonicalizeIncomingPublicPath(input.pathname);

    if (canonicalPath !== input.pathname) {
        return withQueryAndHash(canonicalPath, cleanedSearch, hash);
    }

    const locale = getLocaleFromPathname(input.pathname);
    const stripped = stripLocaleFromPathname(input.pathname);
    const blogMatch = stripped.match(/^\/blog\/([^/?#]+)\/?$/);
    if (blogMatch && isRetiredBlogSlug(decodeURIComponent(blogMatch[1]))) {
        if (locale && locale !== "en") {
            return withQueryAndHash(`/${locale}/blog`, "", hash);
        }
        return withQueryAndHash("/blog", "", hash);
    }

    const exact = LEGACY_404_REDIRECTS.get(input.pathname);
    if (exact) {
        return withQueryAndHash(exact, "", hash);
    }

    if (cleanedSearch !== search) {
        return withQueryAndHash(input.pathname, cleanedSearch, hash);
    }

    return null;
}
