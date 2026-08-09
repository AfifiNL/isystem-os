import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getPublishedEpisode, getPublishedShowBySlug, findAvailableLocalesForEpisode } from "@/features/podcast/public-actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { PersonalBrandPodcastEpisode } from "@/features/templates/pages/personal-brand/podcast-episode";
import { localizeHref, SUPPORTED_LOCALES } from "@/shared/lib/i18n/routing";
import { getPublicEvidenceForContent } from "@/features/source-intelligence/public";

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface EpisodePageProps {
    params: Promise<{ showSlug: string; episodeSlug: string }>;
}

async function redirectToAvailableLocaleOrFallback(showSlug: string, episodeSlug: string, currentLocale: SupportedLocale): Promise<never> {
    const available = await findAvailableLocalesForEpisode(showSlug, episodeSlug);

    if (available.length > 0) {
        const target = available.find((a) => a.locale === "en") || available[0];
        permanentRedirect(localizeHref(target.locale, `/podcast/${target.showSlug}/${target.episodeSlug}`));
    }

    const { show } = await getPublishedShowBySlug(showSlug).catch(() => ({ show: null }));
    if (show) {
        permanentRedirect(localizeHref(currentLocale, `/podcast/${showSlug}`));
    }

    permanentRedirect(localizeHref(currentLocale, "/podcast"));
}

export async function generateMetadata({ params }: EpisodePageProps): Promise<Metadata> {
    const { showSlug, episodeSlug } = await params;
    const { show, episode } = await getPublishedEpisode(showSlug, episodeSlug);
    const { config, locale, settings } = await getActiveTemplate();
    if (!show || !episode) {
        await redirectToAvailableLocaleOrFallback(showSlug, episodeSlug, locale);
        return {};
    }
    const available = await findAvailableLocalesForEpisode(showSlug, episodeSlug);
    const alternatePaths = Object.fromEntries(
        available.map((a) => [a.locale, `/podcast/${showSlug}/${a.episodeSlug}`])
    );
    const availableLocales = available.map((a) => a.locale);

    const description = episode.summary || episode.description || show.description || `${episode.title} — ${show.title}`;
    const image = episode.cover_art_url || show.cover_art_url || undefined;
    const meta = buildSecondaryPageMetadata({
        path: `/podcast/${show.slug}/${episode.slug}`,
        title: `${episode.title} — ${show.title}`,
        description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
        ogType: "article",
        image,
        availableLocales,
        alternatePaths,
    });
    if (episode.audio_url && meta.openGraph) {
        (meta.openGraph as { audio?: string[] }).audio = [episode.audio_url];
    }
    return meta;
}

export default async function EpisodePage({ params }: EpisodePageProps) {
    const { showSlug, episodeSlug } = await params;
    const { show, episode } = await getPublishedEpisode(showSlug, episodeSlug);
    const { config, locale } = await getActiveTemplate();
    if (!show || !episode) {
        await redirectToAvailableLocaleOrFallback(showSlug, episodeSlug, locale);
        return null;
    }

    // Surrounding-episode nav.
    const { episodes } = await getPublishedShowBySlug(showSlug);
    const currentIndex = episodes.findIndex((ep) => ep.id === episode.id);
    const previousEpisode = currentIndex >= 0 ? episodes[currentIndex + 1] ?? null : null; // older
    const nextEpisode = currentIndex > 0 ? episodes[currentIndex - 1] ?? null : null;       // newer
    const episodeSources = episode.content_item_id ? await getPublicEvidenceForContent(episode.content_item_id) : [];

    const ldJson = {
        "@context": "https://schema.org",
        "@type": "PodcastEpisode",
        name: episode.title,
        description: episode.summary || episode.description || "",
        datePublished: episode.published_at,
        url: `/podcast/${show.slug}/${episode.slug}`,
        partOfSeries: {
            "@type": "PodcastSeries",
            name: show.title,
            url: `/podcast/${show.slug}`,
        },
        associatedMedia: episode.audio_url ? {
            "@type": "MediaObject",
            contentUrl: episode.audio_url,
            encodingFormat: episode.audio_mime_type,
        } : undefined,
        image: episode.cover_art_url || show.cover_art_url || undefined,
        timeRequired: episode.audio_duration_seconds ? `PT${episode.audio_duration_seconds}S` : undefined,
    };

    const Renderer = config.renderers?.podcastEpisode ?? PersonalBrandPodcastEpisode;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
            />
            <Renderer
                show={show}
                episode={{ ...episode, publicEvidenceSources: episodeSources }}
                previousEpisode={previousEpisode}
                nextEpisode={nextEpisode}
                config={safeConfig as typeof config}
                locale={locale}
            />
        </div>
    );
}
