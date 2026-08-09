import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveTemplate } from "@/features/templates/actions";
import { createIsystemPublicPageData } from "@/features/public-site/isystem-public-page-seeds";
import { PublicPageRenderer } from "@/features/public-site/public-page-renderer";
import { resolvePublicPageDefinition } from "@/features/public-site/public-page-contract";
import type { Locale } from "@/features/templates/types";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";

export async function generateMetadata(): Promise<Metadata> {
    const { config, settings, locale } = await getActiveTemplate();
    if (config.id !== "isystem-agency") return {};

    const metadata = buildSecondaryPageMetadata({
        path: "/system-proof",
        title: "System proof fixture",
        description: "Non-indexed visual fixture for the iSystem public renderer.",
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
        noIndex: true,
    });

    return {
        ...metadata,
        robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    };
}

export default async function SystemProofFixturePage() {
    const { config, locale: rawLocale } = await getActiveTemplate();
    if (config.id !== "isystem-agency") notFound();

    const locale = (rawLocale ?? "en") as Locale;
    const data = createIsystemPublicPageData("system-proof");
    data.root.props.locale = locale;
    data.root.props.metadata = {
        ...data.root.props.metadata,
        noindex: true,
    };

    return (
        <PublicPageRenderer
            definition={resolvePublicPageDefinition("/system-proof")!}
            data={data}
            locale={locale}
            mode="fixture"
        />
    );
}
