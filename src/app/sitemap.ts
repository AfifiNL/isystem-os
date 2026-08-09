import type { MetadataRoute } from "next";
import { getPublishedPostLocaleMap } from "@/features/blog/actions";
import { getPageContentItems } from "@/features/content-engine/actions";
import { getPublishedShows, getPublishedEpisodeLocaleMap } from "@/features/podcast/public-actions";
import { getPublishedVideoLocaleMap } from "@/features/video-stream/public-actions";
import { getSiteSettings } from "@/features/templates/actions";
import { resolveMetadataBase } from "@/features/templates/metadata";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localizeHref, isSupportedLocale } from "@/shared/lib/i18n/routing";
import { TOOL_SLUGS } from "@/features/tools/shared/registry";
import { RESOURCE_REGISTRY } from "@/features/resources/resource-registry";
import { canonicalBlogHref, isBlogPath } from "@/features/blog/urls";
import { isPublicToolsBrandReady } from "@/features/tools/shared/availability";
import {
    createPodcastEpisodePath,
    isPublicPageLayoutNoIndex,
    isRetiredPublicSlug,
} from "@/features/public-site/sitemap-policy";
import { getPublicPageAvailableLocales } from "@/features/public-site/public-page-seo";

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Static, file-backed public routes under src/app/(public)/**. CMS-driven
// slug pages (served by [slug]/page.tsx) are injected below from the
// content_items table so we never list a URL that would 404.
const CORE_PUBLIC_PATHS = [
    "/",
    "/about",
    "/services",
    "/contact",
    "/audit",
    "/blog",
    "/newsletter",
    "/projects",
    "/videos",
    "/booking",
    "/podcast",
    "/case-studies/legal-firm",
    "/privacy",
    "/terms",
    "/tools",
] as const;

const TOOLS_BASE_PATHS = TOOL_SLUGS.map((slug) => `/tools/${slug}`);

const RESERVED_PUBLIC_SLUGS = new Set([
    ...CORE_PUBLIC_PATHS.map((path) => path.replace(/^\//, "").split("/")[0]).filter(Boolean),
    "login",
    "reset-password",
]);

const HIGH_VALUE_PATHS = new Set(["/", "/about", "/services", "/contact", "/audit", "/booking", "/tools", "/resources", "/sme-digital-operating-system-starter-kit"]);

const STATIC_LEGAL_PATHS = new Set(["/privacy", "/terms"]);

type SitemapEntry = MetadataRoute.Sitemap[number];

type SitemapEntryInput = Omit<SitemapEntry, "url" | "alternates"> & {
    path: string;
    localized?: boolean;
    includeAlternates?: boolean;
    // When provided, alternates and the canonical URL are limited to this
    // subset of locales. Used by blog entries so we never emit hreflang
    // pointing at a locale that has no published translation (Google would
    // crawl and 404). The canonical falls back to the first locale in this
    // list that exists, preferring DEFAULT_LOCALE.
    availableLocales?: readonly SupportedLocale[];
};

function sanitizePath(path: string) {
    const normalized = path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    return normalized ? `/${normalized}` : "/";
}

function isIndexablePublicSlug(slug: string) {
    const sanitized = slug.trim().replace(/^\/+/, "").replace(/\/+$/, "");

    return Boolean(sanitized)
        && !sanitized.includes("/")
        && !sanitized.startsWith("[")
        && !isRetiredPublicSlug(sanitized)
        && !RESERVED_PUBLIC_SLUGS.has(sanitized);
}

function createPriority(path: string) {
    if (path === "/") return 1;
    if (HIGH_VALUE_PATHS.has(path) || path.endsWith("-digital-systems")) return 0.9;
    if (path.endsWith("-digital-systems-playbook")) return 0.8;
    if (path.endsWith("-playbook") || path === "/systems-planning-canvas" || path === "/saas-trap-workbook" || path === "/dutch-sme-ai-adoption-framework") return 0.75;
    if (path.startsWith("/tools/")) return 0.85;
    if (path.startsWith("/blog/")) return 0.7;
    if (path.startsWith("/podcast/") && path.split("/").length > 3) return 0.65;
    if (path.startsWith("/podcast/")) return 0.75;
    if (path.startsWith("/videos/")) return 0.7;
    if (STATIC_LEGAL_PATHS.has(path)) return 0.4;
    return 0.8;
}

function createChangeFrequency(path: string): MetadataRoute.Sitemap[number]["changeFrequency"] {
    if (path === "/") return "weekly";
    if (path === "/blog" || path === "/podcast" || path === "/videos") return "weekly";
    if (path.startsWith("/blog/") || path.startsWith("/podcast/") || path.startsWith("/videos/")) return "monthly";
    if (STATIC_LEGAL_PATHS.has(path)) return "yearly";
    return "monthly";
}

function localizedSitemapHref(locale: SupportedLocale, path: string): string {
    return isBlogPath(path) ? canonicalBlogHref(locale, path) : localizeHref(locale, path);
}

function createLocalizedEntry(input: SitemapEntryInput, metadataBase: URL): SitemapEntry | null {
    return createLocalizedEntries(input, metadataBase)[0] ?? null;
}

function createLocalizedEntries(input: SitemapEntryInput, metadataBase: URL): SitemapEntry[] {
    const localized = input.localized ?? true;
    const localeSubset = input.availableLocales;

    let canonicalLocale: SupportedLocale | null = null;
    let alternateLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES;

    if (localeSubset) {
        if (localeSubset.length === 0) {
            return [];
        }
        canonicalLocale = localeSubset.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : localeSubset[0];
        alternateLocales = localeSubset;
    } else if (localized) {
        canonicalLocale = DEFAULT_LOCALE;
    }

    const entryLocales = localized ? alternateLocales : [null];
    const languages = localized && input.includeAlternates !== false
        ? Object.fromEntries([
            ...alternateLocales.map((locale) => [
                locale,
                new URL(localizedSitemapHref(locale, input.path), metadataBase).toString(),
            ]),
            ...(canonicalLocale
                ? [["x-default", new URL(localizedSitemapHref(canonicalLocale, input.path), metadataBase).toString()] as const]
                : []),
        ])
        : undefined;

    return entryLocales.map((locale) => {
        const entryPath = locale ? localizedSitemapHref(locale, input.path) : input.path;

        return {
            url: new URL(entryPath, metadataBase).toString(),
            lastModified: input.lastModified,
            changeFrequency: input.changeFrequency ?? createChangeFrequency(input.path),
            priority: input.priority ?? createPriority(input.path),
            alternates: languages ? { languages } : undefined,
            images: input.images,
            videos: input.videos,
        };
    });
}

async function createPodcastEntries(metadataBase: URL, lastModified: Date, supportedLocales: readonly SupportedLocale[]): Promise<SitemapEntry[]> {
    const { data: shows } = await getPublishedShows();

    if (!shows?.length) {
        return [];
    }

    const showEntries = shows
        .filter((show) => typeof show.slug === "string" && show.slug.length > 0)
        .flatMap((show) => {
            const showPath = `/podcast/${show.slug}`;
            return createLocalizedEntries({
                path: showPath,
                lastModified: new Date(show.updated_at ?? lastModified),
                priority: createPriority(showPath),
                changeFrequency: createChangeFrequency(showPath),
                images: show.cover_art_url ? [show.cover_art_url] : undefined,
                availableLocales: supportedLocales,
            }, metadataBase);
        });

    const episodeRows = await getPublishedEpisodeLocaleMap();

    type EpisodeGroup = {
        showSlug: string;
        episodes: Array<{
            locale: SupportedLocale;
            slug: string;
            lastModified: Date;
            image: string | null;
        }>;
    };
    const groups = new Map<string, EpisodeGroup>();

    episodeRows.forEach((row) => {
        if (!isSupportedLocale(row.locale) || !supportedLocales.includes(row.locale)) return;
        const path = createPodcastEpisodePath(row.show_slug, row.episode_slug);
        if (!path) return;
        const showSlug = path.split("/")[2];
        const episodeSlug = path.split("/")[3];
        const key = `${showSlug}:${row.content_item_id || `standalone-${episodeSlug}`}`;
        const existing = groups.get(key) ?? { showSlug, episodes: [] };
        existing.episodes.push({
            locale: row.locale,
            slug: episodeSlug,
            lastModified: new Date(row.updated_at ?? row.published_at ?? lastModified),
            image: row.cover_art_url || row.show_cover_art_url || null,
        });
        groups.set(key, existing);
    });

    const episodeEntries = Array.from(groups.values()).flatMap((group) => {
        const showSlug = group.showSlug;

        return group.episodes.map((ep) => {
            const path = createPodcastEpisodePath(showSlug, ep.slug);
            if (!path) return null;
            const canonicalLocale = group.episodes.some((e) => e.locale === DEFAULT_LOCALE)
                ? DEFAULT_LOCALE
                : group.episodes[0].locale;

            const languages = Object.fromEntries([
                ...group.episodes.map((e) => [
                    e.locale,
                    new URL(localizeHref(e.locale, createPodcastEpisodePath(showSlug, e.slug)!), metadataBase).toString(),
                ]),
                ["x-default", new URL(localizeHref(canonicalLocale, createPodcastEpisodePath(showSlug, group.episodes.find((e) => e.locale === canonicalLocale)!.slug)!), metadataBase).toString()],
            ]);

            return {
                url: new URL(localizeHref(ep.locale, path), metadataBase).toString(),
                lastModified: ep.lastModified,
                changeFrequency: createChangeFrequency(path),
                priority: createPriority(path),
                alternates: {
                    languages,
                },
                images: ep.image ? [ep.image] : undefined,
            } as SitemapEntry;
        });
    }).filter((entry): entry is SitemapEntry => entry !== null);

    return [...showEntries, ...episodeEntries];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const settings = await getSiteSettings();
    const metadataBase = resolveMetadataBase(settings.siteDomain);

    if (!metadataBase) {
        return [];
    }

    const now = new Date();
    const supportedLocales = settings.supportedLocales.filter(isSupportedLocale);
    const [{ data: pages }, { data: postLocaleRows }, podcastEntries, { data: videoLocaleRows }] = await Promise.all([
        getPageContentItems(),
        getPublishedPostLocaleMap(),
        createPodcastEntries(metadataBase, now, supportedLocales),
        getPublishedVideoLocaleMap(),
    ]);

    // Static, file-backed routes have no per-request "last modified" signal
    // we can trust. Emitting `now` on every build trains Google to ignore
    // the lastmod field across the whole sitemap (and lowers crawl
    // priority — confirmed root cause of the "Discovered – currently not
    // indexed" bucket for /tools/*, /about, /privacy, /terms, etc.). We
    // omit lastModified for these; Google handles missing lastmod fine and
    // schedules crawl from inbound signals instead.
    // CMS-backed entries below still use real updated_at timestamps.
    const templateCorePaths = settings.activeTemplate === "isystem-agency"
        ? CORE_PUBLIC_PATHS.filter((path) => path !== "/projects" && path !== "/case-studies/legal-firm")
        : CORE_PUBLIC_PATHS;
    const publicToolsEnabled = isPublicToolsBrandReady(settings.activeTemplate);
    const staticPathSet = new Set<string>([
        ...templateCorePaths.filter((path) => path !== "/tools" || publicToolsEnabled),
        ...(publicToolsEnabled ? TOOLS_BASE_PATHS : []),
    ]);
    const cmsPathMap = new Map<string, { lastModified: Date; availableLocales: SupportedLocale[] }>();

    (pages ?? [])
        .filter((page) => page.status === "published"
            && typeof page.slug === "string"
            && isIndexablePublicSlug(page.slug)
            && !isPublicPageLayoutNoIndex(page.public_layout_v2)
            && !isPublicPageLayoutNoIndex(page.visual_layout))
        .forEach((page) => {
            const path = page.slug === "home" ? "/" : sanitizePath(page.slug);
            const availableLocales = getPublicPageAvailableLocales(page)
                .filter((locale) => supportedLocales.includes(locale));
            if (availableLocales.length > 0) {
                cmsPathMap.set(path, { lastModified: new Date(page.updated_at ?? now), availableLocales });
            }
        });

    const staticEntries = Array.from(staticPathSet)
        .flatMap((path) => createLocalizedEntries({
            path,
            // Intentionally no lastModified — see comment above.
            changeFrequency: createChangeFrequency(path),
            priority: createPriority(path),
            availableLocales: supportedLocales,
        }, metadataBase));

    const cmsEntries = Array.from(cmsPathMap.entries())
        .filter(([path]) => !staticPathSet.has(path))
        .flatMap(([path, { lastModified, availableLocales }]) => createLocalizedEntries({
            path,
            lastModified,
            changeFrequency: createChangeFrequency(path),
            priority: createPriority(path),
            availableLocales,
        }, metadataBase));

    const pageEntries = [...staticEntries, ...cmsEntries];

    type BlogGroup = {
        locales: Set<SupportedLocale>;
        lastModified: number;
        image: string | null;
    };
    const blogGroups = new Map<string, BlogGroup>();

    (postLocaleRows ?? []).forEach((row) => {
        if (typeof row.slug !== "string" || row.slug.length === 0) return;
        if (!isSupportedLocale(row.locale) || !supportedLocales.includes(row.locale)) return;

        const existing = blogGroups.get(row.slug) ?? {
            locales: new Set<SupportedLocale>(),
            lastModified: 0,
            image: null,
        };
        existing.locales.add(row.locale);
        const ts = new Date(row.updated_at ?? row.created_at ?? Date.now()).getTime();
        if (ts > existing.lastModified) existing.lastModified = ts;
        if (!existing.image && row.featured_image_url) existing.image = row.featured_image_url;
        blogGroups.set(row.slug, existing);
    });

    const blogEntries = Array.from(blogGroups.entries())
        .flatMap(([slug, group]) => {
            const path = `/blog/${slug}`;
            return createLocalizedEntries({
                path,
                lastModified: new Date(group.lastModified || Date.now()),
                changeFrequency: createChangeFrequency(path),
                priority: createPriority(path),
                images: group.image ? [group.image] : undefined,
                availableLocales: Array.from(group.locales),
            }, metadataBase);
        });

    const videoGroups = new Map<string, { locales: Set<SupportedLocale>; lastModified: number }>();

    (videoLocaleRows ?? []).forEach((row) => {
        if (typeof row.slug !== "string" || row.slug.length === 0) return;
        if (!isSupportedLocale(row.locale) || !supportedLocales.includes(row.locale)) return;

        const existing = videoGroups.get(row.slug) ?? {
            locales: new Set<SupportedLocale>(),
            lastModified: 0,
        };
        existing.locales.add(row.locale);
        const ts = new Date(row.updated_at ?? row.created_at ?? now).getTime();
        if (ts > existing.lastModified) existing.lastModified = ts;
        videoGroups.set(row.slug, existing);
    });

    const videoEntries = Array.from(videoGroups.entries())
        .flatMap(([slug, group]) => {
            const path = `/videos/${slug}`;
            return createLocalizedEntries({
                path,
                lastModified: new Date(group.lastModified || now),
                changeFrequency: createChangeFrequency(path),
                priority: createPriority(path),
                availableLocales: Array.from(group.locales),
            }, metadataBase);
        });

    const pdfEntries = RESOURCE_REGISTRY.map((item) => {
        return createLocalizedEntry({
            path: item.pdfHref,
            localized: false,
            lastModified: new Date(item.lastModified),
            changeFrequency: "monthly" as const,
            priority: item.funnelRole === "pillar" ? 0.75 : 0.65,
        }, metadataBase);
    }).filter((entry): entry is SitemapEntry => entry !== null);

    const entries = [...pageEntries, ...blogEntries, ...podcastEntries, ...videoEntries, ...pdfEntries];
    const dedupedEntries = new Map<string, SitemapEntry>();

    entries.forEach((entry) => {
        dedupedEntries.set(entry.url, entry);
    });

    return Array.from(dedupedEntries.values()).sort((a, b) => a.url.localeCompare(b.url));
}
