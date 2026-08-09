import { createClient } from "@/shared/lib/supabase/server";
import { isTrueConversionEvent } from "@/features/analytics/taxonomy";
import type { Detector, OpportunitySignal } from "../types";

const MIN_VIEWS_TO_QUALIFY = 20;
const HIGH_CTA_CLICK_THRESHOLD = 8;
const MAX_SIGNALS = 10;

type EventRow = {
    page_slug: string | null;
    event_type: string;
    event_name: string;
};

/**
 * Finds pages with meaningful traffic but zero true conversions. CTA clicks are
 * engagement, not conversions; pages with high CTA clicks but no conversions get
 * a separate leakage signal so the Opportunity Engine can diagnose the gap.
 */
export const detectConversionSignals: Detector = async ({ workspaceId, lookbackDays }) => {
    const supabase = await createClient();
    const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: eventRows } = await supabase
        .from("analytics_events")
        .select("page_slug,event_type,event_name")
        .eq("workspace_id", workspaceId)
        .gte("created_at", sinceIso)
        .limit(5000)
        .returns<EventRow[]>();

    const events = eventRows ?? [];
    if (events.length === 0) return [];

    const viewsBySlug = new Map<string, number>();
    const conversionsBySlug = new Map<string, number>();
    const ctaClicksBySlug = new Map<string, number>();

    for (const event of events) {
        if (!event.page_slug) continue;
        if (event.event_type === "page_view") {
            viewsBySlug.set(event.page_slug, (viewsBySlug.get(event.page_slug) ?? 0) + 1);
            continue;
        }
        if (event.event_type === "cta_click") {
            ctaClicksBySlug.set(event.page_slug, (ctaClicksBySlug.get(event.page_slug) ?? 0) + 1);
            continue;
        }
        if (isTrueConversionEvent(event.event_type, event.event_name)) {
            conversionsBySlug.set(event.page_slug, (conversionsBySlug.get(event.page_slug) ?? 0) + 1);
        }
    }

    const weakPages = Array.from(viewsBySlug.entries())
        .filter(([slug, views]) => views >= MIN_VIEWS_TO_QUALIFY && (conversionsBySlug.get(slug) ?? 0) === 0)
        .map(([slug, views]) => ({ slug, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, MAX_SIGNALS);

    const noConversionSignals = weakPages.map(({ slug, views }) => {
        const priorityScore = Math.min(100, 50 + Math.floor(views / 10));
        const severity = views >= 100 ? "high" : views >= 50 ? "medium" : "low";
        return {
            category: "conversion",
            signalKey: `conversion_page_no_convert:${slug}`,
            severity,
            title: `No conversions on "${slug}"`,
            summary: `Page received ${views} views in the last ${lookbackDays} days but recorded zero conversion events.`,
            priorityScore,
            signalData: {
                pageSlug: slug,
                viewsInWindow: views,
                conversionsInWindow: 0,
                lookbackDays,
            },
        } satisfies OpportunitySignal;
    });

    const ctaLeakageSignals = Array.from(ctaClicksBySlug.entries())
        .filter(([slug, clicks]) => clicks >= HIGH_CTA_CLICK_THRESHOLD && (conversionsBySlug.get(slug) ?? 0) === 0)
        .map(([slug, clicks]) => ({ slug, clicks, views: viewsBySlug.get(slug) ?? 0 }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, MAX_SIGNALS)
        .map(({ slug, clicks, views }) => {
            const priorityScore = Math.min(100, 60 + clicks * 3);
            const severity = clicks >= 25 ? "high" : clicks >= 12 ? "medium" : "low";
            return {
                category: "conversion",
                signalKey: `conversion_cta_clicks_no_convert:${slug}`,
                severity,
                title: `CTA clicks are not converting on "${slug}"`,
                summary: `Page recorded ${clicks} CTA clicks in the last ${lookbackDays} days but no true conversion events. Review form friction, offer-message match, and booking/newsletter handoff tracking.`,
                priorityScore,
                signalData: {
                    pageSlug: slug,
                    viewsInWindow: views,
                    ctaClicksInWindow: clicks,
                    conversionsInWindow: 0,
                    lookbackDays,
                },
            } satisfies OpportunitySignal;
        });

    return [...ctaLeakageSignals, ...noConversionSignals]
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, MAX_SIGNALS);
};
