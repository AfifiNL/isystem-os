import type { Locale } from "@/features/templates/types";
import type { PublicVideoItem } from "@/features/video-stream/public-actions";
import {
    normalizeSeoDescription,
    normalizeSeoTitle,
} from "@/features/seo/public-metadata-text";

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function asString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

const PUBLIC_STORAGE_MARKER = "/storage/v1/object/public/";

/**
 * Supabase Storage serves public objects with `X-Robots-Tag: none`, which
 * prevents Google from indexing the video bytes and poster even when their
 * watch page is indexable. Route those objects through the first-party media
 * proxy, which preserves range requests while returning crawlable headers.
 */
export function getIndexablePublicMediaUrl(value: string): string {
    try {
        const url = new URL(value);
        const markerIndex = url.pathname.indexOf(PUBLIC_STORAGE_MARKER);
        if (markerIndex < 0) return value;

        const publicObjectPath = url.pathname.slice(markerIndex + PUBLIC_STORAGE_MARKER.length);
        return publicObjectPath ? `/media/public/${publicObjectPath}` : value;
    } catch {
        return value;
    }
}

export function getPublicVideoContentUrl(item: PublicVideoItem): string {
    return getIndexablePublicMediaUrl(item.video_url);
}

export function getPublicVideoPoster(item: PublicVideoItem): string | undefined {
    const metadata = asRecord(item.metadata);
    const generatedFormats = asRecord(metadata?.generated_formats);
    const videoScript = asRecord(generatedFormats?.video_script);
    const candidates = [
        metadata?.poster_url,
        metadata?.thumbnail_url,
        videoScript?.thumbnail_url,
    ];

    const poster = candidates.map(asString).find(Boolean);
    return poster ? getIndexablePublicMediaUrl(poster) : undefined;
}

export function getPublicVideoDescription(item: PublicVideoItem, siteName = "Workspace"): string {
    const metadata = asRecord(item.metadata);
    return normalizeSeoDescription({
        value: asString(metadata?.description) || item.content_markdown,
        fallback: `${item.title} — ${siteName} walkthrough.`,
        maxLength: 160,
    });
}

export function getPublicVideoSeoTitle(item: PublicVideoItem, siteName = "Workspace"): string {
    const replacements: Record<string, string> = {
        "feature-inbox": "Inbox workflow walkthrough",
        "feature-popups": "Conversion popups walkthrough",
        "feature-videos": "Video Studio workflow walkthrough",
    };
    return replacements[item.slug ?? ""] ?? normalizeSeoTitle({
        value: item.title,
        fallback: `${siteName} walkthrough`,
        maxLength: 48,
    });
}

export function getPublicVideoEvidenceDetails(item: PublicVideoItem) {
    const metadata = asRecord(item.metadata);
    const systemLoop = Array.isArray(metadata?.system_thinking_loop)
        ? metadata.system_thinking_loop.filter((value): value is string => (
            typeof value === "string" && value.trim().length > 0
        ))
        : [];
    const publicSystemIds = Array.isArray(metadata?.public_system_ids)
        ? metadata.public_system_ids.filter((value): value is string => (
            typeof value === "string" && value.trim().length > 0
        ))
        : [];

    return {
        functionality: asString(metadata?.functionality),
        captureRoute: asString(metadata?.capture_route),
        capturedAt: asString(metadata?.captured_at) || item.created_at,
        systemLoop,
        publicSystemIds,
        silentCapture: metadata?.source === "isystem-captured-library",
        qaApproved: metadata?.qa_status === "approved",
    };
}

function isoDuration(seconds: number | null): string | undefined {
    if (!seconds || seconds <= 0) return undefined;
    const rounded = Math.round(seconds);
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const remainingSeconds = rounded % 60;
    return `PT${hours ? `${hours}H` : ""}${minutes ? `${minutes}M` : ""}${remainingSeconds || (!hours && !minutes) ? `${remainingSeconds}S` : ""}`;
}

function absoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
    if (!value) return undefined;

    try {
        return new URL(value, baseUrl).toString();
    } catch {
        return value;
    }
}

export function buildPublicVideoJsonLd(input: {
    item: PublicVideoItem;
    locale: Locale;
    pageUrl: string;
    siteName: string;
    siteUrl: string;
}) {
    const evidence = getPublicVideoEvidenceDetails(input.item);
    const thumbnailUrl = absoluteUrl(getPublicVideoPoster(input.item), input.pageUrl);
    const contentUrl = absoluteUrl(getPublicVideoContentUrl(input.item), input.pageUrl);

    return {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: getPublicVideoSeoTitle(input.item, input.siteName),
        description: getPublicVideoDescription(input.item, input.siteName),
        thumbnailUrl,
        uploadDate: evidence.capturedAt,
        dateModified: input.item.updated_at,
        duration: isoDuration(input.item.video_duration),
        contentUrl,
        url: input.pageUrl,
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": input.pageUrl,
        },
        inLanguage: input.locale,
        isAccessibleForFree: true,
        publisher: {
            "@type": "Organization",
            name: input.siteName,
            url: input.siteUrl,
        },
        about: evidence.publicSystemIds.map((systemId) => ({
            "@type": "Thing",
            name: systemId.replace(/-/g, " "),
        })),
    };
}
