import { Metadata } from "next";
import { getActiveTemplate } from "@/features/templates/actions";
import { pickSiteDescription } from "@/features/templates/site-description";
import { buildPublicMetadata } from "@/features/templates/metadata";
import { PublicSeoSchemas } from "@/features/templates/seo";
import { ThemeRenderer } from "@/features/templates/ui/ThemeRenderer";
import { getDictionary } from "@/shared/lib/i18n/get-dictionary";
import type { Locale } from "@/features/templates/types";
import { getPageContentItemBySlug } from "@/features/content-engine/actions";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { resolveIsystemPublicPageData } from "@/features/public-site/public-page-data";
import { isPublicV2Route } from "@/features/public-site/public-site-rollout";

export async function generateMetadata(): Promise<Metadata> {
    const { config, settings, locale } = await getActiveTemplate();

    return buildPublicMetadata({
        page: "home",
        config,
        locale,
        siteName: settings.siteName,
        siteDescription: pickSiteDescription(settings, locale),
        siteDomain: settings.siteDomain,
    });
}

export default async function LandingPage() {
    const { config, locale, settings } = await getActiveTemplate();
    const resolvedLocale = (locale ?? "en") as Locale;
    const dictionary = await getDictionary(resolvedLocale);
    const { data: pageEntry } = await getPageContentItemBySlug("home");

    if (isPublicV2Route(config.id, settings.publicSiteRenderer, "home")) {
        const entry = pageEntry as (typeof pageEntry & { public_layout_v2?: unknown }) | null;
        const { data } = resolveIsystemPublicPageData(entry?.public_layout_v2 ?? entry?.visual_layout, "home");
        return (
            <>
                <PublicSeoSchemas page="home" />
                <PublicPageRenderer
                    definition={resolvePublicPageDefinition("/")!}
                    data={data}
                    locale={resolvedLocale}
                    mode="published"
                />
            </>
        );
    }

    return (
        <>
            <PublicSeoSchemas page="home" />
            <ThemeRenderer
                themeId={config.id}
                sections={config.homeSections}
                dictionary={dictionary}
                locale={resolvedLocale}
                visualLayout={pageEntry?.visual_layout}
            />
        </>
    );
}
