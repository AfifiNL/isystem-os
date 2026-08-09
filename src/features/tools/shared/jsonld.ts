import type { ToolLocale, ToolMeta } from "./types";
import { SUPPORTED_LOCALES, localizeHref, getLocaleBcp47 } from "@/shared/lib/i18n/routing";
import { ISYSTEM_BUSINESS } from "./business";
import {
    ISYSTEM_COMMERCIAL_OFFER,
    ISYSTEM_PUBLIC_OFFER_NOTES,
    ISYSTEM_BOOKING_SERVICE_FACTS,
    formatCommercialPrice,
} from "@/features/marketing/isystem-commercial-offer";
import { ISYSTEM_PUBLIC_POSITIONING } from "@/features/marketing/isystem-public-truth";

/**
 * Schema.org JSON-LD builders for the /tools surface.
 *
 * Strategy:
 *   - Each tool page emits SoftwareApplication + FAQPage + BreadcrumbList +
 *     HowTo (for the URL-fetching audit tools) + WebPage as the primary entity.
 *   - The hub page emits WebSite (with SearchAction), Organization (with
 *     founder + sameAs), ItemList, and BreadcrumbList.
 *   - The share page emits WebPage with noindex (already set via metadata).
 *
 * We never inline AggregateRating or Review. Commercial Offer nodes are
 * emitted only from the canonical iSystem registry; free tools carry price: 0
 * with priceCurrency EUR (correct, not a stretch).
 *
 * Every URL we emit goes through localizeHref so AI crawlers and search
 * engines see the canonical locale path (e.g. /nl/tools/<slug>).
 */

const ISYSTEM_ORG_ID = "https://isystem.ai#organization";
const FOUNDER_ID = "https://isystem.ai#person-hossam-afifi";
const WEBSITE_ID = "https://isystem.ai#website";
const ISYSTEM_SEO_CATEGORY_TERMS = [
    "AI implementation for Dutch SMEs",
    "Digital operating system for SMEs",
    "AI automation for SMEs",
    "Governed AI workflows",
    "AI audit trails and rollback workflows",
    "Workflow automation for service businesses",
    "Workflow orchestration",
] as const;

function absUrl(siteUrl: string, path: string): string {
    const base = siteUrl.replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
}

function localizedUrlMap(siteUrl: string, path: string): Record<string, string> {
    const map: Record<string, string> = {};
    for (const loc of SUPPORTED_LOCALES) {
        map[getLocaleBcp47(loc)] = absUrl(siteUrl, localizeHref(loc, path));
    }
    map["x-default"] = absUrl(siteUrl, localizeHref("en", path));
    return map;
}

/* ─── Organization & Founder ────────────────────────────────────────────── */

/**
 * Builds an Organization (also typed as ProfessionalService) for iSystem.
 *
 * Deliberate omissions and reasoning:
 *   - No `streetAddress` or `postalCode`. We don't accept visitors; publishing
 *     a street implies one. We carry country + region only, which is honest.
 *   - No `aggregateRating` — see master brief §6 honesty contract.
 *   - No `priceRange` — engagements are fixed-scope quotes, not a generic band.
 *
 * Surfaced:
 *   - `legalName` and `identifier` (KvK 42053547) so search engines and AI
 *     crawlers can tie the brand to a real Dutch trade-register entry.
 *   - `areaServed` listing remote/global, EU travel, and the three NL meeting
 *     cities — accurate to how engagements actually work.
 */
export function buildOrganizationJsonLd(params: { siteName: string; siteUrl: string }) {
    const { siteName, siteUrl } = params;
    return {
        "@context": "https://schema.org",
        "@type": ["Organization", "ProfessionalService"],
        "@id": ISYSTEM_ORG_ID,
        name: siteName,
        legalName: ISYSTEM_BUSINESS.legalName,
        url: siteUrl,
        logo: `${siteUrl}/stealth-cto-hero.png`,
        description: ISYSTEM_PUBLIC_POSITIONING.en,
        foundingDate: "2024",
        founder: { "@id": FOUNDER_ID },
        knowsLanguage: ISYSTEM_BUSINESS.languages.map((code) => getLocaleBcp47(code)),
        // Address is country-only — see file header comment in business.ts.
        address: {
            "@type": "PostalAddress",
            addressCountry: ISYSTEM_BUSINESS.countryCode,
            addressRegion: ISYSTEM_BUSINESS.region,
        },
        // KvK identifier as a PropertyValue — search engines and AI crawlers
        // recognise the propertyID="KvK" convention.
        identifier: {
            "@type": "PropertyValue",
            propertyID: "KvK",
            name: "Dutch Chamber of Commerce registration",
            value: ISYSTEM_BUSINESS.kvkNumber,
        },
        // Service-only business: areaServed expresses geography without
        // implying a physical office.
        areaServed: [
            { "@type": "Place", name: "Worldwide (remote engagements)" },
            { "@type": "Place", name: `Europe (client visits by arrangement)` },
            { "@type": "Country", name: ISYSTEM_BUSINESS.countryName },
            ...ISYSTEM_BUSINESS.meetingCities.map((city) => ({
                "@type": "City" as const,
                name: city,
                containedInPlace: { "@type": "Country" as const, name: ISYSTEM_BUSINESS.countryName },
            })),
        ],
        // Public service area as an explicit GeoShape-free Place list. Mirrors
        // areaServed but typed as serviceArea for tools that look for that.
        serviceArea: { "@type": "Place", name: "Worldwide" },
        sameAs: [...ISYSTEM_BUSINESS.sameAs],
        contactPoint: [
            {
                "@type": "ContactPoint",
                contactType: "customer support",
                email: ISYSTEM_BUSINESS.contactEmail,
                availableLanguage: ISYSTEM_BUSINESS.languages.map((code) => ISYSTEM_BUSINESS.languageLabels[code]),
                areaServed: "Worldwide",
                contactOption: "Online appointment booking",
            },
            {
                "@type": "ContactPoint",
                contactType: "sales",
                email: ISYSTEM_BUSINESS.contactEmail,
                availableLanguage: ISYSTEM_BUSINESS.languages.map((code) => ISYSTEM_BUSINESS.languageLabels[code]),
                areaServed: "Worldwide",
            },
        ],
        knowsAbout: [
            ...ISYSTEM_SEO_CATEGORY_TERMS,
            "GDPR compliance",
            "SEO and generative-engine optimization",
            "Customer support automation",
            "Multilingual (EN / NL / AR) digital operations",
        ],
    };
}

/**
 * Service schema for the consulting offering. Emitted on the /tools hub
 * because that page is where free-tool traffic can continue to the Systems Fit Call.
 * Links back to the Organization via @id so the graph stays connected.
 */
export function buildConsultingServiceJsonLd(params: { siteUrl: string }) {
    const fitCall = ISYSTEM_BOOKING_SERVICE_FACTS["systems-fit-call"];
    const blueprint = ISYSTEM_BOOKING_SERVICE_FACTS["systems-blueprint"];
    const foundation = ISYSTEM_COMMERCIAL_OFFER.foundation;
    const growth = ISYSTEM_COMMERCIAL_OFFER.growth;
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        "@id": `${params.siteUrl}#consulting-service`,
        name: "iSystem founder-led digital systems implementation",
        serviceType: [
            ...ISYSTEM_SEO_CATEGORY_TERMS,
            "GDPR-aware digital systems",
            "Founder-led digital systems implementation and operations",
        ],
        description:
            "Founder-led implementation and ongoing operations for Dutch service SMEs. Start with a free 30-minute Systems Fit Call for qualification only. If deeper diagnosis is warranted, the €490 Systems Blueprint provides a written system map, prioritized plan, and fixed proposal; it is credited to implementation when contracted within 30 days.",
        provider: { "@id": ISYSTEM_ORG_ID },
        areaServed: [
            { "@type": "Place", name: "Worldwide (remote)" },
            { "@type": "Country", name: ISYSTEM_BUSINESS.countryName },
            ...ISYSTEM_BUSINESS.meetingCities.map((city) => ({
                "@type": "City" as const,
                name: city,
                containedInPlace: { "@type": "Country" as const, name: ISYSTEM_BUSINESS.countryName },
            })),
        ],
        availableChannel: [
            {
                "@type": "ServiceChannel",
                serviceLocation: { "@type": "Place", name: "Online (video call)" },
                availableLanguage: ISYSTEM_BUSINESS.languages.map((code) => ISYSTEM_BUSINESS.languageLabels[code]),
                serviceUrl: `${params.siteUrl}/booking`,
            },
            {
                "@type": "ServiceChannel",
                serviceLocation: {
                    "@type": "Place",
                    name: `In-person meeting in ${ISYSTEM_BUSINESS.meetingCities.join(", ")} or elsewhere in Europe by arrangement`,
                },
                availableLanguage: ["English", "Dutch"],
                serviceUrl: `${params.siteUrl}/booking`,
            },
        ],
        audience: {
            "@type": "BusinessAudience",
            audienceType: "SME founders and operations directors",
            geographicArea: { "@type": "Place", name: "Worldwide (with focus on the Netherlands)" },
        },
        offers: [
            {
                "@type": "Offer",
                name: fitCall.title,
                description: "Free 30-minute qualification conversation. No audit or written report is included.",
                price: fitCall.priceAmountCents / 100,
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
                url: `${params.siteUrl}/booking`,
                seller: { "@id": ISYSTEM_ORG_ID },
            },
            {
                "@type": "Offer",
                name: blueprint.title,
                description: ISYSTEM_PUBLIC_OFFER_NOTES.blueprint.en,
                price: blueprint.priceAmountCents / 100,
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
                url: `${params.siteUrl}/booking`,
                seller: { "@id": ISYSTEM_ORG_ID },
            },
            {
                "@type": "Offer",
                name: foundation.name,
                description: `${formatCommercialPrice(foundation.setupPriceEur)} setup + ${formatCommercialPrice(foundation.monthlyPriceEur)}/month. ${ISYSTEM_PUBLIC_OFFER_NOTES.vatExclusion.en}`,
                price: foundation.setupPriceEur,
                priceCurrency: "EUR",
                priceSpecification: {
                    "@type": "PriceSpecification",
                    price: foundation.monthlyPriceEur,
                    priceCurrency: "EUR",
                    unitText: "MONTH",
                },
                availability: "https://schema.org/InStock",
                url: `${params.siteUrl}/services#foundation`,
                seller: { "@id": ISYSTEM_ORG_ID },
            },
            {
                "@type": "Offer",
                name: growth.name,
                description: `${formatCommercialPrice(growth.setupPriceEur)} setup + ${formatCommercialPrice(growth.monthlyPriceEur)}/month. ${ISYSTEM_PUBLIC_OFFER_NOTES.vatExclusion.en}`,
                price: growth.setupPriceEur,
                priceCurrency: "EUR",
                priceSpecification: {
                    "@type": "PriceSpecification",
                    price: growth.monthlyPriceEur,
                    priceCurrency: "EUR",
                    unitText: "MONTH",
                },
                availability: "https://schema.org/InStock",
                url: `${params.siteUrl}/services#growth`,
                seller: { "@id": ISYSTEM_ORG_ID },
            },
        ],
        brand: { "@id": ISYSTEM_ORG_ID },
    };
}

export function buildFounderJsonLd(params: { siteUrl: string }) {
    return {
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": FOUNDER_ID,
        name: "Hossam Afifi",
        givenName: "Hossam",
        familyName: "Afifi",
        jobTitle: "Founder, iSystem.ai",
        worksFor: { "@id": ISYSTEM_ORG_ID },
        url: `${params.siteUrl}/about`,
        knowsLanguage: ["en", "ar", "nl"],
        nationality: "EG",
        alumniOf: [
            {
                "@type": "EducationalOrganization",
                name: "Rotterdam Business School",
                department: "MSc Consultancy & Entrepreneurship",
            },
            {
                "@type": "EducationalOrganization",
                name: "Mansoura University",
                department: "Law",
            },
        ],
    };
}

/* ─── WebSite (with SearchAction) ───────────────────────────────────────── */

export function buildWebsiteJsonLd(params: { siteName: string; siteUrl: string }) {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: params.siteName,
        url: params.siteUrl,
        inLanguage: ["en", "nl", "ar"],
        publisher: { "@id": ISYSTEM_ORG_ID },
        potentialAction: {
            "@type": "SearchAction",
            target: {
                "@type": "EntryPoint",
                urlTemplate: `${params.siteUrl}/blog?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
        },
        hasPart: {
            "@type": "CollectionPage",
            name: "Free SME diagnostic tools",
            url: `${params.siteUrl}/tools`,
            about: ["AI automation", "AI search visibility", "SEO", "GDPR", "conversion", "support automation"],
        },
    };
}

/* ─── Breadcrumb ────────────────────────────────────────────────────────── */

export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: item.url,
        })),
    };
}

/* ─── Tool SoftwareApplication ──────────────────────────────────────────── */

const CATEGORY_TO_APPLICATION: Record<ToolMeta["category"], string> = {
    automation: "BusinessApplication",
    "ai-search": "BusinessApplication",
    compliance: "BusinessApplication",
    growth: "BusinessApplication",
    support: "BusinessApplication",
};

const CATEGORY_TO_SUBCATEGORY: Record<ToolMeta["category"], string> = {
    automation: "AutomationApplication",
    "ai-search": "MarketingApplication",
    compliance: "ComplianceApplication",
    growth: "MarketingApplication",
    support: "CustomerServiceApplication",
};

export function buildToolJsonLd(params: {
    meta: ToolMeta;
    locale: ToolLocale;
    siteName: string;
    siteUrl: string;
    pageUrl: string;
    featureList?: string[];
}) {
    const { meta, locale, siteName, siteUrl, pageUrl, featureList } = params;
    const path = `/tools/${meta.slug}`;
    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": `${absUrl(siteUrl, path)}#software`,
        name: meta.title[locale],
        alternateName: [meta.title.en, meta.title.nl, meta.title.ar].filter((t) => t !== meta.title[locale]),
        applicationCategory: CATEGORY_TO_APPLICATION[meta.category],
        applicationSubCategory: CATEGORY_TO_SUBCATEGORY[meta.category],
        operatingSystem: "Web",
        url: pageUrl,
        sameAs: Object.values(localizedUrlMap(siteUrl, path)),
        inLanguage: SUPPORTED_LOCALES.map((loc) => getLocaleBcp47(loc)),
        description: meta.description[locale],
        keywords: [meta.keyword.en, meta.keyword.nl, meta.keyword.ar].join(", "),
        featureList: featureList ?? [
            "Free to use without signup",
            "Result delivered in under three minutes",
            "Server-side rate limiting and SSRF-safe fetching",
            "Optional email delivery of full report",
            "Shareable read-only result page",
        ],
        offers: {
            "@type": "Offer",
            price: 0,
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: pageUrl,
        },
        creator: { "@id": ISYSTEM_ORG_ID },
        publisher: { "@id": ISYSTEM_ORG_ID },
        provider: { "@id": ISYSTEM_ORG_ID },
        author: { "@id": FOUNDER_ID },
        isAccessibleForFree: true,
        potentialAction: {
            "@type": "UseAction",
            name: `Run ${meta.title.en}`,
            target: pageUrl,
            result: {
                "@type": "Thing",
                name: "Printable diagnostic report with optional email delivery",
            },
        },
        // Note: AggregateRating intentionally omitted — we don't fabricate ratings.
        // The master production brief forbids unsupported trust signals.
        about: {
            "@type": "Thing",
            name: siteName,
        },
    };
}

/* ─── FAQ ───────────────────────────────────────────────────────────────── */

export function buildFaqJsonLd(faq: Array<{ q: string; a: string }>) {
    if (!faq.length) return null;
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
            },
        })),
    };
}

/* ─── HowTo (for URL-scanning tools) ────────────────────────────────────── */

export function buildToolHowToJsonLd(params: {
    meta: ToolMeta;
    locale: ToolLocale;
    steps: Array<{ name: string; text: string }>;
}) {
    return {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: `How to use the ${params.meta.title[params.locale]}`,
        description: params.meta.summary[params.locale],
        totalTime: `PT${Math.max(1, params.meta.timeMinutes)}M`,
        inLanguage: getLocaleBcp47(params.locale),
        step: params.steps.map((s, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: s.name,
            text: s.text,
        })),
    };
}

/* ─── Hub ItemList ──────────────────────────────────────────────────────── */

export function buildToolHubItemListJsonLd(params: {
    tools: ToolMeta[];
    locale: ToolLocale;
    pageUrl: string;
}) {
    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        url: params.pageUrl,
        name: "iSystem.ai free diagnostic tools",
        description: "Nine free tools for SME operators: automation, AI search visibility, GDPR compliance, conversion, support, and Dutch ZZP agreements.",
        numberOfItems: params.tools.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: params.tools.map((tool, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            url: `${params.pageUrl.replace(/\/$/, "")}/${tool.slug}`,
            name: tool.title[params.locale],
            description: tool.summary[params.locale],
        })),
    };
}

/** Backwards-compat shim — older import sites used this name. */
export const buildToolListJsonLd = buildToolHubItemListJsonLd;
