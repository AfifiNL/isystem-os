import { Metadata } from "next";
import { getActiveTemplate } from "@/features/templates/actions";
import { pickSiteDescription } from "@/features/templates/site-description";
import { buildPublicMetadata } from "@/features/templates/metadata";
import { PublicSeoSchemas } from "@/features/templates/seo";
import { ContactRenderer } from "@/features/templates/ui/ContactRenderer";
import { getDictionary } from "@/shared/lib/i18n/get-dictionary";
import { getPageContentItemBySlug } from "@/features/content-engine/actions";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import { resolveIsystemPublicPageData } from "@/features/public-site/public-page-data";
import { isPublicV2Route } from "@/features/public-site/public-site-rollout";

export async function generateMetadata(): Promise<Metadata> {
    const { config, settings, locale } = await getActiveTemplate();

    return buildPublicMetadata({
        page: "contact",
        config,
        locale,
        siteName: settings.siteName,
        siteDescription: pickSiteDescription(settings, locale),
        siteDomain: settings.siteDomain,
    });
}

export default async function ContactPage() {
    const { config, locale, settings } = await getActiveTemplate();
    const dictionary = await getDictionary(locale);
    const { data: pageEntry } = await getPageContentItemBySlug("contact");
    if (isPublicV2Route(config.id, settings.publicSiteRenderer, "contact")) {
        const entry = pageEntry as (typeof pageEntry & { public_layout_v2?: unknown }) | null;
        const { data } = resolveIsystemPublicPageData(entry?.public_layout_v2 ?? entry?.visual_layout, "contact");
        return (
            <>
                <PublicSeoSchemas page="contact" />
                <PublicPageRenderer
                    definition={resolvePublicPageDefinition("/contact")!}
                    data={data}
                    locale={locale}
                    mode="published"
                    templateId={config.id}
                />
            </>
        );
    }
    return (
        <>
            <PublicSeoSchemas page="contact" />
            <ContactRenderer themeId={config.id} config={config} dictionary={dictionary} locale={locale} visualLayout={pageEntry?.visual_layout} />
        </>
    );
}
