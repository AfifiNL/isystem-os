import type { Json } from "@/shared/lib/supabase/database.types";
import type { ExternalPublicationPackageRow } from "../types";
import type { ExternalPublishingAttributionSummary } from "./performance-attribution";

export type ExternalPublishingConversionFeedbackOpportunity = {
    workspace_id: string;
    category: "conversion";
    severity: "low" | "medium" | "high";
    status: "pending";
    signal_key: string;
    title: string;
    summary: string;
    recommendation_markdown: string;
    signal_data: Json;
    priority_score: number;
};

export type ExternalPublishingConversionFeedbackEventPayload = {
    packageId: string;
    signalKey: string;
    platform: string;
    manualPublishedUrl: string | null;
    conversions: number;
    totalEvents: number;
    pageViews: number;
    ctaClicks: number;
    lastSeenAt: string | null;
    syncedAt: string;
};

function severityFor(summary: ExternalPublishingAttributionSummary): "low" | "medium" | "high" {
    if (summary.conversions >= 5 || summary.ctaClicks >= 10) return "high";
    if (summary.conversions >= 1 || summary.ctaClicks >= 3) return "medium";
    return "low";
}

export function buildExternalPublishingConversionFeedback(
    pkg: ExternalPublicationPackageRow,
    summary: ExternalPublishingAttributionSummary,
    syncedAt = new Date().toISOString(),
): { opportunity: ExternalPublishingConversionFeedbackOpportunity | null; eventPayload: ExternalPublishingConversionFeedbackEventPayload | null } {
    if (summary.conversions <= 0 && summary.ctaClicks <= 0) return { opportunity: null, eventPayload: null };
    const signalKey = `conversion_external_publishing_winner:${pkg.id}`;
    const signalData = {
        source: "external_publishing_attribution",
        packageId: pkg.id,
        platform: pkg.platform,
        topic: pkg.topic,
        targetUrl: pkg.target_url,
        manualPublishedUrl: pkg.manual_published_url,
        summary,
        syncedAt,
    };
    return {
        opportunity: {
            workspace_id: pkg.workspace_id,
            category: "conversion",
            severity: severityFor(summary),
            status: "pending",
            signal_key: signalKey,
            title: `External publishing winner: ${pkg.topic}`,
            summary: `${pkg.platform} package generated ${summary.conversions} conversions, ${summary.ctaClicks} CTA clicks, and ${summary.totalEvents} attributed events.`,
            recommendation_markdown: [
                `Repurpose the winning external publishing angle for **${pkg.topic}**.`,
                "",
                `- Platform: ${pkg.platform}`,
                `- Manual URL: ${pkg.manual_published_url ?? "Not recorded"}`,
                `- Conversions: ${summary.conversions}`,
                `- CTA clicks: ${summary.ctaClicks}`,
                `- Last seen: ${summary.lastSeenAt ?? "No timestamp"}`,
                "",
                "Suggested follow-up: turn the highest-converting framing into an owned content update, newsletter segment, or sales enablement snippet while preserving attribution tags.",
            ].join("\n"),
            signal_data: signalData as Json,
            priority_score: Math.min(100, 55 + summary.conversions * 10 + summary.ctaClicks * 2),
        },
        eventPayload: {
            packageId: pkg.id,
            signalKey,
            platform: pkg.platform,
            manualPublishedUrl: pkg.manual_published_url,
            conversions: summary.conversions,
            totalEvents: summary.totalEvents,
            pageViews: summary.pageViews,
            ctaClicks: summary.ctaClicks,
            lastSeenAt: summary.lastSeenAt,
            syncedAt,
        },
    };
}
