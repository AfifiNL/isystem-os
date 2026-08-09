import { createClient } from "@/shared/lib/supabase/server";
import type { Detector, OpportunitySignal } from "../types";

const LOW_TRAFFIC_THRESHOLD = 10;
const MAX_SIGNALS = 10;

type ContentRow = {
    id: string;
    title: string;
    slug: string;
    status: string | null;
    type: string;
    created_at: string | null;
};

type EventRow = {
    content_id: string | null;
    page_slug: string | null;
    event_type: string;
};

/**
 * Flags published content_items that received below-threshold traffic in the
 * lookback window. Does not touch AI — the title/summary here are the raw
 * signal; the narration step enriches them later.
 */
export const detectContentSignals: Detector = async ({ workspaceId, lookbackDays }) => {
    const supabase = await createClient();

    const { data: contentRows } = await supabase
        .from("content_items")
        .select("id,title,slug,status,type,created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "published")
        .returns<ContentRow[]>();

    const published = contentRows ?? [];
    if (published.length === 0) return [];

    const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: eventRows } = await supabase
        .from("analytics_events")
        .select("content_id,page_slug,event_type")
        .eq("workspace_id", workspaceId)
        .eq("event_type", "page_view")
        .gte("created_at", sinceIso)
        .limit(5000)
        .returns<EventRow[]>();

    const events = eventRows ?? [];
    const viewsById = new Map<string, number>();
    const viewsBySlug = new Map<string, number>();
    for (const event of events) {
        if (event.content_id) {
            viewsById.set(event.content_id, (viewsById.get(event.content_id) ?? 0) + 1);
        }
        if (event.page_slug) {
            viewsBySlug.set(event.page_slug, (viewsBySlug.get(event.page_slug) ?? 0) + 1);
        }
    }

    const ageDays = (iso: string | null): number => {
        if (!iso) return Number.POSITIVE_INFINITY;
        return Math.max(0, (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
    };

    const ranked = published
        .map((row) => {
            const byId = viewsById.get(row.id) ?? 0;
            const bySlug = viewsBySlug.get(row.slug) ?? 0;
            const views = Math.max(byId, bySlug);
            return { row, views, age: ageDays(row.created_at) };
        })
        // Skip brand-new content; it hasn't had a fair chance yet.
        .filter(({ views, age }) => age >= 14 && views < LOW_TRAFFIC_THRESHOLD)
        .sort((a, b) => a.views - b.views)
        .slice(0, MAX_SIGNALS);

    return ranked.map(({ row, views }) => {
        const priorityScore = views === 0 ? 80 : Math.max(40, 80 - views * 3);
        return {
            category: "content",
            signalKey: `content_low_traffic:${row.id}`,
            severity: views === 0 ? "high" : "medium",
            title: `Low traffic: "${row.title}"`,
            summary:
                views === 0
                    ? `This ${row.type} has received no page views in the last ${lookbackDays} days.`
                    : `This ${row.type} received only ${views} page views in the last ${lookbackDays} days.`,
            priorityScore,
            signalData: {
                contentId: row.id,
                slug: row.slug,
                type: row.type,
                viewsInWindow: views,
                lookbackDays,
            },
        } satisfies OpportunitySignal;
    });
};
