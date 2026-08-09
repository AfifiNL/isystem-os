type IndexingSiteEnvironment = {
    NEXT_PUBLIC_SITE_URL?: string;
    GOOGLE_SEARCH_CONSOLE_SITE_URL?: string;
};

export function resolveIndexingSiteUrl(
    environment: IndexingSiteEnvironment = {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        GOOGLE_SEARCH_CONSOLE_SITE_URL: process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL,
    },
): string {
    const publicSiteUrl = environment.NEXT_PUBLIC_SITE_URL?.trim();
    const searchConsoleSiteUrl = environment.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim();
    const configured = publicSiteUrl || searchConsoleSiteUrl;
    if (!configured) {
        throw new Error("NEXT_PUBLIC_SITE_URL or GOOGLE_SEARCH_CONSOLE_SITE_URL is required for SEO indexing.");
    }

    if (!publicSiteUrl && searchConsoleSiteUrl?.toLowerCase().startsWith("sc-domain:")) {
        const propertyHost = resolveGscPropertyHost(searchConsoleSiteUrl);
        if (!propertyHost) {
            throw new Error("GOOGLE_SEARCH_CONSOLE_SITE_URL contains an invalid domain property.");
        }
        return `https://${propertyHost}`;
    }

    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol)) {
        throw new Error("The SEO indexing site URL must use http or https.");
    }
    return url.toString().replace(/\/$/, "");
}
import { resolveGscPropertyHost } from "@/features/seo/lib/google-search-console/site-association";
