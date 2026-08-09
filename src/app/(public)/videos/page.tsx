import type { Metadata } from "next";
import { getPublishedVideos } from "@/features/video-stream/public-actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { PersonalBrandVideosIndex } from "@/features/templates/pages/personal-brand/videos-index";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";

const VIDEOS_FALLBACK: Record<"en" | "nl" | "ar", { title: string; description: string }> = {
    en: { title: "Videos", description: "Watch our video content and field reports." },
    nl: { title: "Video's", description: "Bekijk onze video's en veldrapportages." },
    ar: { title: "الفيديوهات", description: "شاهد مقاطعنا وتقاريرنا الميدانية." },
};

export async function generateMetadata(): Promise<Metadata> {
    const { config, locale, settings } = await getActiveTemplate();
    const supported = locale === "nl" || locale === "ar" ? locale : "en";
    const fallback = VIDEOS_FALLBACK[supported];
    const videos = config.pages.videos;
    const title = videos?.title ? pickLocaleText(videos.title, locale) : fallback.title;
    const description = videos?.description ? pickLocaleText(videos.description, locale) : fallback.description;
    return buildSecondaryPageMetadata({
        path: "/videos",
        title,
        description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        localized: true,
    });
}

export default async function VideosPage() {
    const { data: items } = await getPublishedVideos();
    const { config, locale } = await getActiveTemplate();

    const Renderer = config.renderers?.videoIndex ?? PersonalBrandVideosIndex;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <Renderer items={items} config={safeConfig as typeof config} locale={locale} />
        </div>
    );
}
