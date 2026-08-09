import { Metadata } from "next";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { FacilityServicesProjects } from "@/features/templates/pages/facility-services/projects";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { createIsystemProofIndexPageData } from "@/features/public-site/isystem-public-page-seeds";
import type { Locale } from "@/features/templates/types";

const PROJECTS_COPY: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: { title: "Case Studies", description: "Real outcomes from our integrated approach." },
    nl: { title: "Cases", description: "Echte resultaten van onze geïntegreerde aanpak." },
    ar: { title: "دراسات الحالة", description: "نتائج حقيقية من نهجنا المتكامل." },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const copy = config.id === "isystem-agency"
        ? {
            title: supported === "en" ? "Proof in preparation" : supported === "nl" ? "Bewijs in voorbereiding" : "الدليل قيد الإعداد",
            description: supported === "en"
                ? "iSystem publishes delivery evidence only when the source, date, permission, and limitation are clear."
                : supported === "nl"
                    ? "iSystem publiceert leveringsbewijs pas wanneer bron, datum, toestemming en beperking helder zijn."
                    : "ينشر iSystem أدلة التنفيذ فقط عندما يكون المصدر والتاريخ والإذن والحدود واضحة.",
        }
        : PROJECTS_COPY[supported];
    const metadata = buildSecondaryPageMetadata({
        path: "/projects",
        title: copy.title,
        description: copy.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });

    if (config.id !== "isystem-agency") return metadata;

    return {
        ...metadata,
        robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
    };
}

export default async function ProjectsPage() {
    const { config, locale } = await getActiveTemplate();
    if (config.id === "isystem-agency") {
        const data = createIsystemProofIndexPageData();
        data.root.props.locale = (locale ?? "en") as Locale;
        return (
            <PublicPageRenderer
                definition={resolvePublicPageDefinition("/projects")!}
                data={data}
                locale={(locale ?? "en") as Locale}
                mode="published"
            />
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return <FacilityServicesProjects config={safeConfig as typeof config} locale={locale} />;
}
