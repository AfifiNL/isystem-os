import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { createIsystemCaseStudyPageData } from "@/features/public-site/isystem-public-page-seeds";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { isPublicV2Route } from "@/features/public-site/public-site-rollout";
import type { Locale } from "@/features/templates/types";

const KNOWN_CASE_STUDY_SLUGS = new Set(["legal-firm"]);

export default async function CaseStudyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    if (!KNOWN_CASE_STUDY_SLUGS.has(slug)) notFound();
    const { config, settings, locale: rawLocale } = await getActiveTemplate();
    if (config.id !== "isystem-agency" || !isPublicV2Route(config.id, settings.publicSiteRenderer, "case-study")) {
        notFound();
    }

    const locale = (rawLocale ?? "en") as Locale;
    const data = createIsystemCaseStudyPageData();
    data.root.props.locale = locale;
    data.root.props.metadata = {
        ...data.root.props.metadata,
        noindex: true,
    };

    return (
        <PublicPageRenderer
            definition={resolvePublicPageDefinition(`/case-studies/${slug}`)!}
            data={data}
            locale={locale}
            mode="published"
        />
    );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    if (!KNOWN_CASE_STUDY_SLUGS.has(slug)) notFound();
    const { config, settings, locale: rawLocale } = await getActiveTemplate();
    const locale = (rawLocale ?? "en") as Locale;
    const metadata = buildSecondaryPageMetadata({
        path: `/case-studies/${slug}`,
        title: "Case study · evidence in preparation",
        description: "A public case-study record is being prepared from permissioned evidence.",
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
    return config.id === "isystem-agency"
        ? { ...metadata, robots: { index: false, follow: true } }
        : metadata;
}
