import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublishedVideoBySlug, findPublishedLocalesForVideoSlug } from "@/features/video-stream/public-actions";
import { getActiveTemplate } from "@/features/templates/actions";
import { buildSecondaryPageMetadata } from "@/features/templates/metadata";
import { resolveMetadataBase } from "@/features/templates/metadata";
import { PersonalBrandVideosDetail } from "@/features/templates/pages/personal-brand/videos-detail";
import { localizeHref, DEFAULT_LOCALE } from "@/shared/lib/i18n/routing";
import {
    buildPublicVideoJsonLd,
    getPublicVideoDescription,
    getPublicVideoContentUrl,
    getPublicVideoPoster,
    getPublicVideoSeoTitle,
} from "@/features/video-stream/public-seo";

interface VideoPageProps {
    params: Promise<{ slug: string }>;
}

async function redirectToAvailableLocaleOrNotFound(slug: string): Promise<never> {
    const availableLocales = await findPublishedLocalesForVideoSlug(slug);

    if (availableLocales.length === 0) {
        notFound();
    }

    const targetLocale = availableLocales.includes(DEFAULT_LOCALE)
        ? DEFAULT_LOCALE
        : availableLocales[0];

    permanentRedirect(localizeHref(targetLocale, `/videos/${slug}`));
}

export async function generateMetadata({ params }: VideoPageProps): Promise<Metadata> {
    const { slug } = await params;
    const { video } = await getPublishedVideoBySlug(slug);
    const { config, locale, settings } = await getActiveTemplate();
    if (!video) {
        await redirectToAvailableLocaleOrNotFound(slug);
        return {};
    }
    const availableLocales = await findPublishedLocalesForVideoSlug(slug);
    const description = getPublicVideoDescription(video, settings.siteName || config.name);
    const [videoWidth, videoHeight] = (video.video_resolution ?? "")
        .split("x")
        .map((value) => Number.parseInt(value, 10));
    return buildSecondaryPageMetadata({
        path: `/videos/${video.slug ?? video.id}`,
        title: getPublicVideoSeoTitle(video, settings.siteName || config.name),
        description,
        locale,
        siteName: settings.siteName,
        siteDomain: settings.siteDomain,
        config,
        image: getPublicVideoPoster(video),
        ogType: "video.other",
        video: {
            url: getPublicVideoContentUrl(video),
            type: "video/mp4",
            width: Number.isFinite(videoWidth) ? videoWidth : undefined,
            height: Number.isFinite(videoHeight) ? videoHeight : undefined,
        },
        localized: true,
        availableLocales,
    });
}

export default async function VideoDetailPage({ params }: VideoPageProps) {
    const { slug } = await params;
    const { video } = await getPublishedVideoBySlug(slug);
    if (!video) {
        await redirectToAvailableLocaleOrNotFound(slug);
        return null;
    }

    const { config, locale, settings } = await getActiveTemplate();
    const Renderer = config.renderers?.videoDetail ?? PersonalBrandVideosDetail;
    const metadataBase = resolveMetadataBase(settings.siteDomain);
    const siteUrl = metadataBase?.toString().replace(/\/$/, "") ?? "";
    const pageUrl = metadataBase
        ? new URL(localizeHref(locale, `/videos/${video.slug ?? video.id}`), metadataBase).toString()
        : localizeHref(locale, `/videos/${video.slug ?? video.id}`);
    const videoSchema = buildPublicVideoJsonLd({
        item: video,
        locale,
        pageUrl,
        siteName: settings.siteName || config.name,
        siteUrl,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { renderers, ...safeConfig } = config;

    return (
        <div className={config.id === "isystem-agency" ? "isystem-editorial-surface" : undefined}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
            />
            <Renderer item={video} config={safeConfig as typeof config} locale={locale} />
        </div>
    );
}
