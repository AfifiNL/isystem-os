import { Metadata } from "next";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { NewsletterPageClient } from "@/features/newsletter/newsletter-page-client";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const { newsletter } = config.pages;
    return buildSecondaryPageMetadata({
        path: "/newsletter",
        title: pickLocaleText(newsletter.title, locale),
        description: pickLocaleText(newsletter.description, locale),
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

export default async function NewsletterPage() {
    const { config, locale, settings } = await getActiveTemplate();
    const { newsletter } = config.pages;

    const supportedLocale = locale === "nl" || locale === "ar" ? locale : "en";

    return (
        <NewsletterPageClient
            title={pickLocaleText(newsletter.title, locale)}
            description={pickLocaleText(newsletter.description, locale)}
            templateId={config.id}
            locale={supportedLocale}
            brandName={settings.siteName}
            brandLogoUrl={settings.siteChrome?.brand.navbarLogoUrl}
        />
    );
}
