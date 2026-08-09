import { Metadata } from "next";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { AuditPageClient } from "@/features/audit/audit-page-client";

const TITLES: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: {
        title: "How much is your fragmented stack quietly costing you?",
        description: "Two minutes. Seven inputs. See what consolidating your software stack could return in savings and recovered team hours.",
    },
    nl: {
        title: "Hoeveel kost jouw versnipperde stack je stilletjes?",
        description: "Twee minuten. Zeven velden. Bekijk wat consolidatie van je softwarestack kan teruggeven aan softwarekosten en teamuren.",
    },
    ar: {
        title: "كم تكلّفك حزمة أدواتك المشتّتة بهدوء؟",
        description: "دقيقتان. سبع مدخلات. تعرّف على ما يمكن أن يعيده توحيد حزمة البرامج من تكاليف وساعات عمل الفريق.",
    },
};

const META: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: { title: "Systems Audit", description: "Calculate your tech-stack waste and automation upside in two minutes." },
    nl: { title: "Systeem-audit", description: "Bereken je stackverspilling en automatiseringskansen in twee minuten." },
    ar: { title: "تدقيق الأنظمة", description: "احسب هدر حزمتك التقنية وإمكانات الأتمتة في دقيقتين." },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const meta = META[supported];
    return buildSecondaryPageMetadata({
        path: "/audit",
        title: meta.title,
        description: meta.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

export default async function AuditPage() {
    const { config, locale, settings } = await getActiveTemplate();
    const supportedLocale = locale === "nl" || locale === "ar" ? locale : "en";
    const copy = TITLES[supportedLocale];

    return (
        <AuditPageClient
            title={copy.title}
            description={copy.description}
            templateId={config.id}
            locale={supportedLocale}
            brandName={settings.siteName}
            brandLogoUrl={settings.siteChrome?.brand.navbarLogoUrl}
        />
    );
}
