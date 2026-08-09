import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedShowBySlug } from "@/features/podcast/public-actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { PersonalBrandPodcastShow } from "@/features/templates/pages/personal-brand/podcast-show";

interface ShowPageProps {
    params: Promise<{ showSlug: string }>;
}

export async function generateMetadata({ params }: ShowPageProps): Promise<Metadata> {
    const { showSlug } = await params;
    const { show } = await getPublishedShowBySlug(showSlug);
    if (!show) return { title: "Show not found", robots: { index: false, follow: false } };
    const { config, locale, settings } = await getActiveTemplate();
    const description = show.description ?? show.subtitle ?? `${show.title} — podcast`;
    return buildSecondaryPageMetadata({
        path: `/podcast/${show.slug}`,
        title: show.title,
        description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
        image: show.cover_art_url ?? undefined,
    });
}

export default async function PodcastShowPage({ params }: ShowPageProps) {
    const { showSlug } = await params;
    const { show, episodes } = await getPublishedShowBySlug(showSlug);
    if (!show) notFound();

    const { config, locale } = await getActiveTemplate();
    const Renderer = config.renderers?.podcastShow ?? PersonalBrandPodcastShow;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <Renderer show={show} episodes={episodes} config={safeConfig as typeof config} locale={locale} />
        </div>
    );
}
