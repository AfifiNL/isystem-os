import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Render } from "@puckeditor/core/rsc";
import { getPageContentItemBySlug } from "@/features/content-engine/actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { resolveMetadataBase } from "@/features/templates/metadata";
import { isPublicBuilderData, normalizePublicBuilderData, puckRenderConfig } from "@/features/builder/puck.config";
import { DEFAULT_LOCALE, localizeHref, toOpenGraphLocale } from "@/shared/lib/i18n/routing";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { isPublicPagePuckDataV2 } from "@/features/public-site/public-page-data";
import { isPublicV2Route } from "@/features/public-site/public-site-rollout";
import { getPublicPageAvailableLocales, resolvePublicPageSeo } from "@/features/public-site/public-page-seo";

interface PublicCustomPageProps {
    params: Promise<{ slug: string }>;
}

const ISYSTEM_CUSTOM_PAGE_SERVICE_TYPES = [
    "AI implementation for Dutch SMEs",
    "Digital operating system for SMEs",
    "Governed AI workflows",
    "AI audit trails and rollback workflows",
    "Workflow automation for service businesses",
] as const;

const RESERVED_SLUGS = new Set([
    "home",
    "about",
    "services",
    "contact",
    "audit",
    "blog",
    "newsletter",
    "projects",
    "videos",
    "booking",
    "podcast",
    "privacy",
    "terms",
    "tools",
    "login",
    "reset-password",
    "dashboard",
    "portal",
    "api",
    "setup",
    "outreach",
    "case-studies"
]);

const LEGACY_OFFER_REDIRECTS = new Set(["basic-vs-pro"]);

function resolveDefaultShareImage(templateId: string) {
    void templateId;
    return "/brand/github-social-preview.jpg";
}

function resolveAbsoluteAssetUrl(metadataBase: URL | null, assetPath: string) {
    if (!assetPath) {
        return undefined;
    }

    if (assetPath.startsWith("http://") || assetPath.startsWith("https://")) {
        return assetPath;
    }

    return metadataBase ? new URL(assetPath, metadataBase).toString() : assetPath;
}

export async function generateMetadata({ params }: PublicCustomPageProps): Promise<Metadata> {
    const { slug } = await params;
    if (LEGACY_OFFER_REDIRECTS.has(slug)) {
        permanentRedirect("/services");
    }
    if (RESERVED_SLUGS.has(slug)) {
        notFound();
    }
    const [{ data: page }, { config, settings, locale }] = await Promise.all([
        getPageContentItemBySlug(slug),
        getActiveTemplate(),
    ]);

    if (!page) {
        return {};
    }

    const metadataBase = resolveMetadataBase(settings.siteDomain);
    const { seoTitle, seoDescription, seoImage, noindex, canonicalPath } = resolvePublicPageSeo(page, locale, settings.siteName);
    const availableLocales = getPublicPageAvailableLocales(page)
        .filter((candidate) => settings.supportedLocales.includes(candidate));
    const path = canonicalPath ?? `/${slug}`;
    const localizedPath = localizeHref(locale, path);
    const absoluteUrl = metadataBase ? new URL(localizedPath, metadataBase).toString() : undefined;
    const imageUrl = resolveAbsoluteAssetUrl(metadataBase, seoImage || resolveDefaultShareImage(config.id));
    const languageAlternates = metadataBase
        ? Object.fromEntries([
            ...availableLocales.map((supportedLocale) => [
                supportedLocale,
                new URL(localizeHref(supportedLocale, path), metadataBase).toString(),
            ]),
            ...(availableLocales.length
                ? [["x-default", new URL(localizeHref(
                    availableLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : availableLocales[0],
                    path,
                ), metadataBase).toString()] as const]
                : []),
        ])
        : undefined;

    return {
        title: seoTitle,
        description: seoDescription || undefined,
        alternates: absoluteUrl || languageAlternates
            ? {
                canonical: absoluteUrl,
                languages: languageAlternates,
            }
            : undefined,
        openGraph: {
            type: "website",
            url: absoluteUrl,
            locale: toOpenGraphLocale(locale),
            alternateLocale: availableLocales.filter((supportedLocale) => supportedLocale !== locale).map(toOpenGraphLocale),
            title: seoTitle,
            description: seoDescription || undefined,
            siteName: settings.siteName || config.name,
            images: imageUrl
                ? [
                    {
                        url: imageUrl,
                        width: 1200,
                        height: 630,
                        alt: seoTitle,
                    },
                ]
                : undefined,
        },
        twitter: {
            card: imageUrl ? "summary_large_image" : "summary",
            title: seoTitle,
            description: seoDescription || undefined,
            images: imageUrl ? [imageUrl] : undefined,
        },
        ...(noindex ? { robots: { index: false, follow: true } } : {}),
    };
}

export default async function PublicCustomPage({ params }: PublicCustomPageProps) {
    const { slug } = await params;
    if (LEGACY_OFFER_REDIRECTS.has(slug)) {
        permanentRedirect("/services");
    }
    if (RESERVED_SLUGS.has(slug)) {
        notFound();
    }
    const [{ data: page }, { config, settings, locale }] = await Promise.all([
        getPageContentItemBySlug(slug),
        getActiveTemplate(),
    ]);

    if (!page || !isPublicBuilderData(page.visual_layout)) {
        const v2Layout = (page as unknown as { public_layout_v2?: unknown } | null)?.public_layout_v2;
        if (!page || !isPublicPagePuckDataV2(v2Layout)) notFound();
    }

    const v2Layout = (page as unknown as { public_layout_v2?: unknown } | null)?.public_layout_v2;
    const definition = resolvePublicPageDefinition(`/${slug}`);
    if (definition && isPublicV2Route(config.id, settings.publicSiteRenderer, definition.id) && isPublicPagePuckDataV2(v2Layout)) {
        v2Layout.root.props.locale = locale;
        return (
            <PublicPageRenderer
                definition={definition}
                data={v2Layout}
                locale={locale}
                mode="published"
            />
        );
    }

    const pageKind = typeof page.metadata?.page_kind === "string" ? page.metadata.page_kind : undefined;
    const pageIntent = typeof page.metadata?.page_intent === "string" ? page.metadata.page_intent : undefined;
    const normalizedVisualLayout = normalizePublicBuilderData(page.visual_layout, pageKind);

    if (!normalizedVisualLayout) {
        notFound();
    }

    // Override the locale stored in the page data with the URL locale so /nl/ pages render in Dutch.
    // normalizePublicBuilderData preserves the authored locale, but on public routes the URL locale takes precedence.
    if ((locale === "nl" || locale === "en" || locale === "ar") && normalizedVisualLayout.root?.props) {
        normalizedVisualLayout.root.props.locale = locale;
    }

    const metadataBase = resolveMetadataBase(settings.siteDomain);
    const { seoTitle, seoDescription, seoImage, canonicalPath } = resolvePublicPageSeo(page, locale, settings.siteName);
    const path = canonicalPath ?? `/${slug}`;
    const absoluteUrl = metadataBase ? new URL(localizeHref(locale, path), metadataBase).toString() : undefined;
    const siteUrl = metadataBase?.toString().replace(/\/$/, "") ?? undefined;
    const imageUrl = resolveAbsoluteAssetUrl(metadataBase, seoImage || resolveDefaultShareImage(config.id));
    const siteName = settings.siteName || config.name;
    const isIndustryPage = slug.endsWith("-digital-systems");
    const isServiceLikePage = isIndustryPage || pageIntent === "service-page" || pageIntent === "sector-page" || pageIntent === "pillar-page";
    const schemas = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: seoTitle,
            description: seoDescription || undefined,
            url: absoluteUrl,
            inLanguage: locale,
            image: imageUrl,
            isPartOf: siteUrl
                ? {
                    "@type": "WebSite",
                    name: siteName,
                    url: siteUrl,
                }
                : undefined,
        },
        isServiceLikePage
            ? {
                "@context": "https://schema.org",
                "@type": "Service",
                name: seoTitle,
                serviceType: config.id === "isystem-agency" ? ISYSTEM_CUSTOM_PAGE_SERVICE_TYPES : undefined,
                description: seoDescription || undefined,
                url: absoluteUrl,
                areaServed: {
                    "@type": "Country",
                    name: "Netherlands",
                },
                provider: {
                    "@type": "Organization",
                    name: siteName,
                    url: siteUrl,
                },
                image: imageUrl,
            }
            : null,
    ].filter(Boolean);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(schemas),
                }}
            />
            <div className="min-h-screen overflow-hidden [background:var(--template-surface-canvas)]">
                <Render config={puckRenderConfig} data={normalizedVisualLayout as never} metadata={{ locale }} />
            </div>
        </>
    );
}
