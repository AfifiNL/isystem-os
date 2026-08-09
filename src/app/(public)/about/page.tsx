import { Metadata } from "next";
import { getPageContentItemBySlug } from "@/features/content-engine/actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { pickSiteDescription } from "@/features/templates/site-description";
import { buildPublicMetadata } from "@/features/templates/metadata";
import { PublicSeoSchemas } from "@/features/templates/seo";
import { AboutRenderer } from "@/features/templates/ui/AboutRenderer";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { resolveIsystemPublicPageData } from "@/features/public-site/public-page-data";
import { isPublicV2Route } from "@/features/public-site/public-site-rollout";

export async function generateMetadata(): Promise<Metadata> {
    const { config, settings, locale } = await getActiveTemplate();

    return buildPublicMetadata({
        page: "about",
        config,
        locale,
        siteName: settings.siteName,
        siteDescription: pickSiteDescription(settings, locale),
        siteDomain: settings.siteDomain,
    });
}

export default async function AboutPage() {
    const [{ data: pageEntry }, { config, locale, settings }] = await Promise.all([
        getPageContentItemBySlug("about"),
        getActiveTemplate(),
    ]);

    if (isPublicV2Route(config.id, settings.publicSiteRenderer, "about")) {
        const entry = pageEntry as (typeof pageEntry & { public_layout_v2?: unknown }) | null;
        const { data } = resolveIsystemPublicPageData(entry?.public_layout_v2 ?? entry?.visual_layout, "about");
        return (
            <>
                <PublicSeoSchemas page="about" />
                <PublicPageRenderer
                    definition={resolvePublicPageDefinition("/about")!}
                    data={data}
                    locale={locale}
                    mode="published"
                />
            </>
        );
    }

    return (
        <>
            <PublicSeoSchemas page="about" />
            <AboutRenderer visualLayout={pageEntry?.visual_layout ?? null} />
        </>
    );
}
