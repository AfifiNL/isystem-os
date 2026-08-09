import { getActiveTemplate } from "@/features/templates/actions";
import { pickSiteDescription } from "@/features/templates/site-description";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { getPageContentItemBySlug } from "@/features/content-engine/actions";
import { ISYSTEM_BUSINESS } from "@/features/tools/shared/business";
import {
    buildFaqJsonLdFromEntries,
    buildPublicFaqJsonLd,
    extractFaqEntriesFromLayout,
    type FaqLocale,
    type SeoPage,
} from "@/features/templates/seo-faq";

function resolveBaseUrl(siteDomain: string) {
    const domain = siteDomain.trim();
    if (!domain) return null;

    try {
        return domain.startsWith("http://") || domain.startsWith("https://")
            ? new URL(domain)
            : new URL(`https://${domain}`);
    } catch {
        return null;
    }
}

function resolveFaqLocale(locale: string): FaqLocale {
    if (locale === "nl" || locale === "ar") return locale;
    return "en";
}

export async function PublicSeoSchemas({ page }: { page: SeoPage }) {
    const { config, settings, locale } = await getActiveTemplate();
    const baseUrl = resolveBaseUrl(settings.siteDomain);
    const siteName = settings.siteName || config.name;
    const siteDescription = pickSiteDescription(settings, locale) || config.description;
    const siteUrl = baseUrl?.toString().replace(/\/$/, "") ?? undefined;
    const localizedHomeUrl = siteUrl ? `${siteUrl}${localizeHref(locale, "/")}` : undefined;
    const pagePath = page === "home" ? "/" : `/${page}`;
    const pageUrl = siteUrl ? `${siteUrl}${localizeHref(locale, pagePath)}` : undefined;
    const isIsystem = config.id === "isystem-agency";
    const isFacilityServices = config.id === "facility-services";
    const logoPath = isIsystem
        ? "/icon.png"
        : settings.publicConfig?.brand?.logo.lightUrl ?? settings.siteChrome?.brand.navbarLogoUrl;
    const imagePath = isIsystem
        ? "/stealth-cto-hero.png"
        : settings.publicConfig?.brand?.wallpaperUrl;
    const absoluteAssetUrl = (assetPath: string | undefined) => assetPath
        ? siteUrl ? new URL(assetPath, `${siteUrl}/`).toString() : assetPath
        : undefined;
    const logoUrl = absoluteAssetUrl(logoPath);
    const imageUrl = absoluteAssetUrl(imagePath);
    const contactEmail = settings.contactEmail ?? (isIsystem ? ISYSTEM_BUSINESS.contactEmail : undefined);
    // Only emit `telephone` if we actually have one configured. The previous
    // hardcoded fallback "+31 20 000 0000" was a fake number and a trust risk.
    const contactPhone = settings.contactPhone?.trim() || null;
    const sameAs = isIsystem
        ? ISYSTEM_BUSINESS.sameAs.slice()
        : settings.siteChrome?.footer.socialLinks.map((link) => link.href) ?? [];
    const pageDescriptionMap = {
        home: siteDescription,
        about: config.pages.about.description[locale] || config.pages.about.description.en || siteDescription,
        services: config.pages.services?.description[locale] || config.pages.services?.description.en || siteDescription,
        contact: config.pages.contact.subtitle[locale] || config.pages.contact.subtitle.en || siteDescription,
    } as const;
    const pageLabelMap: Record<"en" | "nl" | "ar", { home: string; about: string; services: string; contact: string }> = {
        en: { home: siteName, about: "About", services: "Services", contact: "Contact" },
        nl: { home: siteName, about: "Over", services: "Diensten", contact: "Contact" },
        ar: { home: siteName, about: "نبذة عنا", services: "الخدمات", contact: "اتصل بنا" },
    };
    const pageDescription = pageDescriptionMap[page];

    // iSystem-specific Organization payload: legalName, KvK identifier,
    // country-only address (no walk-in office), accurate areaServed across
    // remote engagements + EU client visits + the NL meeting cities. Falls
    // through to a simpler Organization for Facility Services / other templates.
    const organizationSchema = isIsystem
        ? {
            "@context": "https://schema.org",
            "@type": ["Organization", "ProfessionalService"],
            name: siteName,
            legalName: ISYSTEM_BUSINESS.legalName,
            alternateName: config.name,
            url: siteUrl,
            logo: logoUrl,
            image: imageUrl,
            description: siteDescription,
            ...(contactEmail ? { email: contactEmail } : {}),
            ...(contactPhone ? { telephone: contactPhone } : {}),
            sameAs,
            foundingDate: "2024",
            knowsLanguage: ISYSTEM_BUSINESS.languages.slice(),
            identifier: {
                "@type": "PropertyValue",
                propertyID: "KvK",
                name: "Dutch Chamber of Commerce registration",
                value: ISYSTEM_BUSINESS.kvkNumber,
            },
            address: {
                "@type": "PostalAddress",
                addressCountry: ISYSTEM_BUSINESS.countryCode,
                addressRegion: ISYSTEM_BUSINESS.region,
            },
            areaServed: [
                { "@type": "Place", name: "Worldwide (remote engagements)" },
                { "@type": "Place", name: "Europe (client visits by arrangement)" },
                { "@type": "Country", name: ISYSTEM_BUSINESS.countryName },
                ...ISYSTEM_BUSINESS.meetingCities.map((city) => ({
                    "@type": "City",
                    name: city,
                    containedInPlace: { "@type": "Country", name: ISYSTEM_BUSINESS.countryName },
                })),
            ],
            contactPoint: [
                {
                    "@type": "ContactPoint",
                    contactType: "customer support",
                    email: contactEmail,
                    ...(contactPhone ? { telephone: contactPhone } : {}),
                    areaServed: "Worldwide",
                    availableLanguage: ISYSTEM_BUSINESS.languages.map((code) => ISYSTEM_BUSINESS.languageLabels[code]),
                    contactOption: "Online appointment booking",
                },
                {
                    "@type": "ContactPoint",
                    contactType: "sales",
                    email: contactEmail,
                    areaServed: "Worldwide",
                    availableLanguage: ISYSTEM_BUSINESS.languages.map((code) => ISYSTEM_BUSINESS.languageLabels[code]),
                },
            ],
            knowsAbout: [
                "AI implementation for Dutch SMEs",
                "Digital operating system for SMEs",
                "AI automation for SMEs",
                "Governed AI workflows",
                "AI audit trails and rollback workflows",
                "Workflow automation for service businesses",
                "Workflow orchestration",
                "GDPR compliance",
                "SEO and generative-engine optimization",
                "Customer support automation",
            ],
        }
        : {
            "@context": "https://schema.org",
            "@type": isFacilityServices ? "LocalBusiness" : "Organization",
            name: siteName,
            alternateName: config.name,
            url: siteUrl,
            logo: logoUrl,
            image: imageUrl,
            description: siteDescription,
            email: contactEmail,
            ...(contactPhone ? { telephone: contactPhone } : {}),
            ...(sameAs.length ? { sameAs } : {}),
            ...(contactEmail || contactPhone ? {
                contactPoint: {
                    "@type": "ContactPoint",
                    contactType: "customer support",
                    ...(contactEmail ? { email: contactEmail } : {}),
                    ...(contactPhone ? { telephone: contactPhone } : {}),
                    availableLanguage: settings.supportedLocales,
                },
            } : {}),
        };

    const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: siteUrl,
        description: siteDescription,
        inLanguage: locale,
    };

    const webPageSchema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${page === "home" ? siteName : `${pageLabelMap[locale][page]} | ${siteName}`}`,
        description: pageDescription,
        url: pageUrl,
        inLanguage: locale,
        isPartOf: siteUrl
            ? {
                "@type": "WebSite",
                url: siteUrl,
                name: siteName,
            }
            : undefined,
        primaryImageOfPage: imageUrl,
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: siteName,
                item: localizedHomeUrl,
            },
            ...(page === "home"
                ? []
                : [
                    {
                        "@type": "ListItem",
                        position: 2,
                        name: pageLabelMap[locale][page],
                        item: pageUrl,
                    },
                ]),
        ],
    };

    const serviceSchema = page === "services" || page === "home"
        ? {
            "@context": "https://schema.org",
            "@type": "Service",
            serviceType: isIsystem
                ? [
                    "AI implementation for Dutch SMEs",
                    "Digital operating system for SMEs",
                    "Governed AI workflows",
                    "AI audit trails and rollback workflows",
                    "Workflow automation for service businesses",
                    "AI Integration, Web Systems, and Digital Operations Consultancy",
                ]
                : "Facility Management and Operational Support",
            provider: {
                "@type": isFacilityServices ? "LocalBusiness" : "Organization",
                name: siteName,
                url: siteUrl,
            },
            areaServed: isIsystem
                ? [
                    { "@type": "Place", name: "Worldwide (remote)" },
                    { "@type": "Country", name: ISYSTEM_BUSINESS.countryName },
                    ...ISYSTEM_BUSINESS.meetingCities.map((city) => ({
                        "@type": "City",
                        name: city,
                    })),
                ]
                : { "@type": "Country", name: "Netherlands" },
            description: config.pages.services?.description[locale] || config.pages.services?.description.en || siteDescription,
            image: imageUrl,
            offers: {
                "@type": "Offer",
                availability: "https://schema.org/InStock",
                url: siteUrl ? `${siteUrl}${localizeHref(locale, "/contact")}` : undefined,
            },
        }
        : null;

    const aboutSchema = page === "about"
        ? {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: `${pageLabelMap[locale].about} | ${siteName}`,
            url: pageUrl,
            description: pageDescription,
            about: {
                "@type": isFacilityServices ? "LocalBusiness" : "Organization",
                name: siteName,
                url: siteUrl,
            },
        }
        : null;

    const contactSchema = page === "contact"
        ? {
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: `${pageLabelMap[locale].contact} | ${siteName}`,
            url: pageUrl,
            description: pageDescription,
            mainEntity: {
                "@type": isFacilityServices ? "LocalBusiness" : "Organization",
                name: siteName,
                email: contactEmail,
                ...(contactPhone ? { telephone: contactPhone } : {}),
                url: siteUrl,
            },
        }
        : null;

    // FAQPage schema. Currently emitted for iSystem only. When the page's
    // Puck visual_layout contains an `FaqAccordionBlock` (seeded via the
    // 20260514_isystem_public_faq_blocks migration, and editable from the
    // page builder afterwards) we derive the schema from the live block
    // content so manager edits propagate to the rich-result entries. The
    // seo-faq.ts curated set is the fallback for fresh installs.
    let faqSchema: ReturnType<typeof buildPublicFaqJsonLd> | null = null;
    if (isIsystem) {
        const faqLocale = resolveFaqLocale(locale);
        const slugForFaq = page === "home" ? "home" : page;
        const pageItem = await getPageContentItemBySlug(slugForFaq).catch(() => ({ data: null }));
        const layoutEntries = pageItem?.data?.visual_layout
            ? extractFaqEntriesFromLayout(pageItem.data.visual_layout, faqLocale)
            : null;
        faqSchema = layoutEntries && layoutEntries.length > 0
            ? buildFaqJsonLdFromEntries(layoutEntries)
            : buildPublicFaqJsonLd(page, faqLocale);
    }

    const schemas = [
        organizationSchema,
        websiteSchema,
        webPageSchema,
        breadcrumbSchema,
        serviceSchema,
        aboutSchema,
        contactSchema,
        faqSchema,
    ].filter(Boolean);

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(schemas),
            }}
        />
    );
}
