import type { Json } from "@/shared/lib/supabase/database.types";

export type ExternalPublishingAnalyticsEvent = {
    event_type: string;
    event_name: string;
    created_at: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer: string | null;
    metadata: Json;
};

export type ExternalPublishingAttributionSummary = {
    packageId: string;
    totalEvents: number;
    utmMatchedEvents: number;
    referrerMatchedEvents: number;
    pageViews: number;
    ctaClicks: number;
    conversions: number;
    lastSeenAt: string | null;
    topReferrers: Array<{ host: string; count: number }>;
    staleNoTraffic: boolean;
};

function metadataString(metadata: Json, key: string): string | null {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
}

function hostFromUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return null;
    }
}

function isConversion(event: Pick<ExternalPublishingAnalyticsEvent, "event_type" | "event_name">) {
    const text = `${event.event_type}:${event.event_name}`.toLowerCase();
    return text.includes("form_submit") || text.includes("newsletter_subscribe") || text.includes("booking") || text.includes("conversion");
}

export function summarizeExternalPublishingAttribution(input: {
    packageId: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmContent: string;
    manualPublishedUrl?: string | null;
    events: ExternalPublishingAnalyticsEvent[];
}): ExternalPublishingAttributionSummary {
    const manualHost = hostFromUrl(input.manualPublishedUrl);
    const matched = input.events.map((event) => {
        const eventUtmContent = metadataString(event.metadata, "utm_content") ?? metadataString(event.metadata, "utmContent");
        const utmMatched = event.utm_source === input.utmSource
            && event.utm_medium === input.utmMedium
            && event.utm_campaign === input.utmCampaign
            && eventUtmContent === input.utmContent;
        const referrerHost = hostFromUrl(event.referrer);
        const referrerMatched = Boolean(manualHost && referrerHost === manualHost);
        return { event, utmMatched, referrerMatched, referrerHost };
    }).filter((item) => item.utmMatched || item.referrerMatched);

    const referrerCounts = new Map<string, number>();
    for (const item of matched) {
        if (!item.referrerHost) continue;
        referrerCounts.set(item.referrerHost, (referrerCounts.get(item.referrerHost) ?? 0) + 1);
    }

    return {
        packageId: input.packageId,
        totalEvents: matched.length,
        utmMatchedEvents: matched.filter((item) => item.utmMatched).length,
        referrerMatchedEvents: matched.filter((item) => item.referrerMatched).length,
        pageViews: matched.filter(({ event }) => event.event_type === "page_view").length,
        ctaClicks: matched.filter(({ event }) => event.event_type === "cta_click").length,
        conversions: matched.filter(({ event }) => isConversion(event)).length,
        lastSeenAt: matched.reduce<string | null>((latest, { event }) => latest && latest > event.created_at ? latest : event.created_at, null),
        topReferrers: [...referrerCounts.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 5),
        staleNoTraffic: matched.length === 0,
    };
}
