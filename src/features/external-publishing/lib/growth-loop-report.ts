import type { Json } from "@/shared/lib/supabase/database.types";
import type { ExternalPublicationEventRow, ExternalPublicationPackageRow } from "../types";
import type { ExternalPublishingAttributionSummary } from "./performance-attribution";

export type ExternalPublishingGrowthLoopRow = {
    packageId: string;
    sourceType: string;
    sourceEntity: string;
    topic: string;
    platform: string;
    packageStatus: string;
    manualUrl: string | null;
    totalTraffic: number;
    conversions: number;
    ctaClicks: number;
    latestFollowUp: string | null;
    latestFollowUpAt: string | null;
};

function asRecord(value: Json): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sourceEntity(pkg: ExternalPublicationPackageRow): string {
    return pkg.source_content_id ?? pkg.source_seo_plan_id ?? pkg.source_seo_opportunity_id ?? pkg.target_slug ?? pkg.primary_query ?? pkg.topic;
}

function eventLabel(event: ExternalPublicationEventRow): string {
    const payload = asRecord(event.payload);
    const signalKey = typeof payload.signalKey === "string" ? ` · ${payload.signalKey}` : "";
    return `${event.event_type}${signalKey}`;
}

export function buildExternalPublishingGrowthLoopReport(input: {
    packages: ExternalPublicationPackageRow[];
    performanceByPackageId: Record<string, ExternalPublishingAttributionSummary>;
    recentEvents: ExternalPublicationEventRow[];
}): ExternalPublishingGrowthLoopRow[] {
    const eventsByPackageId = new Map<string, ExternalPublicationEventRow[]>();
    for (const event of input.recentEvents) {
        const list = eventsByPackageId.get(event.package_id) ?? [];
        list.push(event);
        eventsByPackageId.set(event.package_id, list);
    }

    return input.packages.map((pkg) => {
        const performance = input.performanceByPackageId[pkg.id];
        const followUp = (eventsByPackageId.get(pkg.id) ?? [])
            .filter((event) => event.event_type === "analytics_attributed" || event.event_type === "stale")
            .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0] ?? null;
        return {
            packageId: pkg.id,
            sourceType: pkg.source_type,
            sourceEntity: sourceEntity(pkg),
            topic: pkg.topic,
            platform: pkg.platform,
            packageStatus: pkg.status,
            manualUrl: pkg.manual_published_url,
            totalTraffic: performance?.totalEvents ?? 0,
            conversions: performance?.conversions ?? 0,
            ctaClicks: performance?.ctaClicks ?? 0,
            latestFollowUp: followUp ? eventLabel(followUp) : null,
            latestFollowUpAt: followUp?.occurred_at ?? null,
        };
    }).sort((a, b) => (b.conversions - a.conversions) || (b.totalTraffic - a.totalTraffic));
}
