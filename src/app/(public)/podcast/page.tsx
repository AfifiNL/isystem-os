import type { Metadata } from "next";
import { getPublishedShows } from "@/features/podcast/public-actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { PersonalBrandPodcastIndex } from "@/features/templates/pages/personal-brand/podcast-index";

const PODCAST_INDEX_COPY: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: { title: "Podcast", description: "Conversations and original audio essays." },
    nl: { title: "Podcast", description: "Gesprekken en originele audio-essays." },
    ar: { title: "البودكاست", description: "محادثات ومقالات صوتية أصلية." },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const copy = PODCAST_INDEX_COPY[supported];
    return buildSecondaryPageMetadata({
        path: "/podcast",
        title: copy.title,
        description: copy.description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

export default async function PodcastIndexPage() {
    const { data: shows } = await getPublishedShows();
    const { config, locale } = await getActiveTemplate();

    // Prefer the active template's renderer; fall back to the editorial-default
    // renderer so any template lacking a custom one still gets a polished page.
    const Renderer = config.renderers?.podcastIndex ?? PersonalBrandPodcastIndex;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <Renderer shows={shows ?? []} config={safeConfig as typeof config} locale={locale} />
        </div>
    );
}
