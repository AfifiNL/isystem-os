import type { Metadata } from "next";
import type { Locale, TemplateConfig } from "@/features/templates/types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localizeHref, toOpenGraphLocale } from "@/shared/lib/i18n/routing";
import { ISYSTEM_PUBLIC_POSITIONING } from "@/features/marketing/isystem-public-truth";

export type PublicMetadataPage = "home" | "about" | "services" | "contact";

const ISYSTEM_HOME_METADATA: Record<Locale, { title: string; description: string }> = {
    en: {
        title: "One Accountable Digital System for Dutch Service SMEs",
        description: ISYSTEM_PUBLIC_POSITIONING.en,
    },
    nl: {
        title: "Eén Verantwoordelijk Digitaal Systeem voor Nederlandse Dienstverleners",
        description: ISYSTEM_PUBLIC_POSITIONING.nl,
    },
    ar: {
        title: "نظام رقمي واحد واضح المسؤولية لشركات الخدمات الهولندية",
        description: ISYSTEM_PUBLIC_POSITIONING.ar,
    },
};

export interface PublicMetadataInput {
    page: PublicMetadataPage;
    locale: Locale;
    siteName: string;
    /** Locale-resolved canonical site description (already picked by caller via pickSiteDescription). */
    siteDescription: string;
    siteDomain: string;
    config: TemplateConfig;
}

export function resolveMetadataBase(siteDomain: string): URL | null {
    const domain = siteDomain.trim();
    if (!domain) {
        return null;
    }

    try {
        return domain.startsWith("http://") || domain.startsWith("https://")
            ? new URL(domain)
            : new URL(`https://${domain}`);
    } catch {
        return null;
    }
}

function getPageDescription(input: PublicMetadataInput): string {
    const { page, config, locale, siteDescription } = input;

    if (page === "home") {
        return siteDescription || config.description;
    }

    if (page === "about") {
        return config.pages.about.description[locale] || config.pages.about.description.en || siteDescription || config.description;
    }

    if (page === "services") {
        return config.pages.services?.description[locale] || config.pages.services?.description.en || siteDescription || config.description;
    }

    return config.pages.contact.subtitle[locale] || config.pages.contact.subtitle.en || siteDescription || config.description;
}

function getPagePath(page: PublicMetadataPage) {
    if (page === "home") return "/";
    return `/${page}`;
}

function getShareImage(config: TemplateConfig) {
    if (config.id === "facility-services") {
        return "/themes/facility-services/hero.jpg";
    }

    if (config.id === "isystem-agency") {
        return "/stealth-cto-hero.png";
    }

    return "/stealth-cto-hero.png";
}

function buildLocalizedHref(locale: Locale, path: string): string {
    if ((path === "/blog" || path.startsWith("/blog/")) && locale === DEFAULT_LOCALE) {
        return path;
    }

    return localizeHref(locale, path);
}

function getLocalizedPageLabel(locale: Locale, page: Exclude<PublicMetadataPage, "home">) {
    const labels: Record<Locale, Record<Exclude<PublicMetadataPage, "home">, string>> = {
        en: {
            about: "About",
            services: "Services",
            contact: "Contact",
        },
        nl: {
            about: "Over",
            services: "Diensten",
            contact: "Contact",
        },
        ar: {
            about: "نبذة عنا",
            services: "الخدمات",
            contact: "اتصل بنا",
        },
    };

    return labels[locale][page];
}

function getPageTitle(input: PublicMetadataInput): Metadata["title"] {
    const { page, siteName, locale } = input;
    const baseTitle = siteName || input.config.name;

    if (page === "home") {
        return { absolute: baseTitle };
    }

    return getLocalizedPageLabel(locale, page);
}

export function buildPublicMetadata(input: PublicMetadataInput): Metadata {
    const metadataBase = resolveMetadataBase(input.siteDomain);
    const isIsystemHome = input.page === "home" && input.config.id === "isystem-agency";
    const isystemHomeMetadata = ISYSTEM_HOME_METADATA[input.locale];
    const description = isIsystemHome ? isystemHomeMetadata.description : getPageDescription(input);
    const shareImage = getShareImage(input.config);
    const localizedPath = localizeHref(input.locale, getPagePath(input.page));
    const absoluteUrl = metadataBase ? new URL(localizedPath, metadataBase).toString() : undefined;
    const imageUrl = metadataBase ? new URL(shareImage, metadataBase).toString() : shareImage;
    const baseTitle = input.siteName || input.config.name;
    const title = isIsystemHome ? isystemHomeMetadata.title : getPageTitle(input);
    const resolvedTitle = isIsystemHome
        ? `${isystemHomeMetadata.title} | ${baseTitle}`
        : input.page === "home"
        ? (input.siteName || input.config.name)
        : `${getLocalizedPageLabel(input.locale, input.page)} | ${baseTitle}`;
    const languageAlternates = metadataBase
        ? Object.fromEntries([
            ...SUPPORTED_LOCALES.map((locale) => [
                locale,
                new URL(localizeHref(locale, getPagePath(input.page)), metadataBase).toString(),
            ]),
            ["x-default", new URL(localizeHref(DEFAULT_LOCALE, getPagePath(input.page)), metadataBase).toString()],
        ])
        : undefined;
    const alternateLocale = SUPPORTED_LOCALES
        .filter((locale) => locale !== input.locale)
        .map((locale) => toOpenGraphLocale(locale));

    const keywords = input.config.id === "isystem-agency"
        ? [
            input.siteName || input.config.name,
            input.config.name,
            "AI integration",
            "automation consultancy",
            "web development",
            "business management consultancy",
            "Netherlands",
            "SME digital solutions",
        ]
        : [
            input.siteName || input.config.name,
            input.config.name,
            "facility services",
            "facility management",
            "operational support",
            "commercial cleaning",
            "Netherlands",
        ];

    // Icons are served from src/app/{favicon.ico,icon.png,apple-icon.png} via
    // Next.js file-based conventions — we don't emit competing <link> tags here.

    return {
        title,
        description,
        applicationName: input.siteName || input.config.name,
        keywords,
        authors: [{ name: input.siteName || input.config.name }],
        creator: input.siteName || input.config.name,
        publisher: input.siteName || input.config.name,
        category: input.config.id,
        alternates: absoluteUrl || languageAlternates
            ? {
                canonical: absoluteUrl,
                languages: languageAlternates,
            }
            : undefined,
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-image-preview": "large",
                "max-snippet": -1,
                "max-video-preview": -1,
            },
        },
        openGraph: {
            type: "website",
            url: absoluteUrl,
            locale: toOpenGraphLocale(input.locale),
            alternateLocale,
            title: resolvedTitle,
            description,
            siteName: input.siteName || input.config.name,
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 630,
                    alt: `${input.siteName || input.config.name} preview image`,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: resolvedTitle,
            description,
            images: [imageUrl],
        },
        ...(metadataBase ? { metadataBase } : {}),
    };
}

export interface SecondaryPageMetadataInput {
    /** Path beginning with "/", without locale prefix (e.g. "/blog", "/podcast/foo"). */
    path: string;
    /** Page title (without site-name suffix — will be appended via template). */
    title: string;
    description: string;
    locale: Locale;
    siteName: string;
    siteDomain: string;
    config: TemplateConfig;
    /** OG type — defaults to "website". */
    ogType?: "website" | "article" | "video.other";
    /** Video metadata emitted when ogType is "video.other". */
    video?: {
        url: string;
        type?: string;
        width?: number;
        height?: number;
    };
    /** Optional override for share image URL (absolute or relative). */
    image?: string;
    /** When true, sets robots noindex/nofollow (login, reset-password, etc). */
    noIndex?: boolean;
    /** When true, hreflang alternates are emitted across SUPPORTED_LOCALES. */
    localized?: boolean;
    /** Optional subset of locales that actually publish this item (restricts alternates). */
    availableLocales?: Locale[];
    /** Optional mapping of locale to specific path if the path differs across locales (e.g. podcast episodes). */
    alternatePaths?: Partial<Record<Locale, string>>;
}

/**
 * Build metadata for non-core public pages (blog index, podcast index,
 * projects, videos, newsletter, booking, audit, legal, auth) using the same
 * canonical/hreflang/OG/Twitter conventions as buildPublicMetadata. Unifies
 * what used to be a scatter of hardcoded `metadata` exports.
 */
export function buildSecondaryPageMetadata(input: SecondaryPageMetadataInput): Metadata {
    const metadataBase = resolveMetadataBase(input.siteDomain);
    const shareImage = input.image ?? getShareImage(input.config);
    const localizedPath = buildLocalizedHref(input.locale, input.path);
    const absoluteUrl = metadataBase ? new URL(localizedPath, metadataBase).toString() : undefined;
    const imageUrl = metadataBase ? new URL(shareImage, metadataBase).toString() : shareImage;
    const baseSiteName = input.siteName || input.config.name;
    const fullTitle = `${input.title} | ${baseSiteName}`;
    const targetLocales = input.availableLocales ?? SUPPORTED_LOCALES;
    const languageAlternates = input.localized && metadataBase
        ? Object.fromEntries([
            ...targetLocales.map((locale) => {
                const path = input.alternatePaths?.[locale] ?? input.path;
                return [locale, new URL(buildLocalizedHref(locale, path), metadataBase).toString()];
            }),
            ...(targetLocales.length > 0
                ? [
                    [
                        "x-default",
                        new URL(
                            buildLocalizedHref(
                                targetLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : targetLocales[0],
                                input.alternatePaths?.[targetLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : targetLocales[0]] ?? input.path
                            ),
                            metadataBase
                        ).toString(),
                    ] as const
                ]
                : []),
        ])
        : undefined;
    const alternateLocale = input.localized
        ? targetLocales.filter((l) => l !== input.locale).map((l) => toOpenGraphLocale(l))
        : undefined;

    const robots = input.noIndex
        ? { index: false, follow: false, googleBot: { index: false, follow: false } }
        : {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-image-preview": "large" as const,
                "max-snippet": -1,
                "max-video-preview": -1,
            },
        };
    const openGraphCommon = {
        url: absoluteUrl,
        locale: toOpenGraphLocale(input.locale),
        alternateLocale,
        title: fullTitle,
        description: input.description,
        siteName: baseSiteName,
        images: [
            {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: `${baseSiteName} preview image`,
            },
        ],
    };
    const openGraph: NonNullable<Metadata["openGraph"]> = input.ogType === "video.other"
        ? {
            ...openGraphCommon,
            type: "video.other",
            videos: input.video ? [input.video] : undefined,
        }
        : {
            ...openGraphCommon,
            type: input.ogType ?? "website",
        };

    return {
        title: input.title,
        description: input.description,
        applicationName: baseSiteName,
        alternates: absoluteUrl || languageAlternates
            ? { canonical: absoluteUrl, languages: languageAlternates }
            : undefined,
        robots,
        openGraph,
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description: input.description,
            images: [imageUrl],
        },
        ...(metadataBase ? { metadataBase } : {}),
    };
}
