"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import {
    ANALYTICS_CONVERSION_CANDIDATE_EVENT_TYPES,
    ANALYTICS_FORM_SUBMIT_COMPATIBLE_CONVERSION_NAMES,
    ANALYTICS_TRUE_CONVERSION_EVENT_TYPES,
    isTrueConversionEvent,
} from "@/features/analytics/taxonomy";
import {
    mapAnalyticsEventsToExportRows,
    type AnalyticsExportCsvRow,
    type AnalyticsExportEventRow,
    type AnalyticsExportMode,
} from "@/features/analytics/export";

type AnalyticsRow = {
    page_slug: string | null;
    event_type: string;
    event_name: string;
    created_at: string;
    workspace_id: string | null;
    metadata: Record<string, unknown> | null;
};

type ConversionAnalyticsRow = {
    event_type: string;
    event_name: string;
    page_slug: string | null;
    created_at: string;
};

type NewsletterRecipientSummary = {
    open_count: number;
    click_count: number;
};

const TREND_AGGREGATION_CAP = 5000;

async function countEvents(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
    since: string,
    eventType?: string,
): Promise<{ count: number | null; error: { message: string } | null }> {
    const base = (supabase.from("analytics_events") as unknown as {
        select: (columns: string, options: { count: "exact"; head: true }) => {
            eq: (column: string, value: string) => unknown;
        };
    }).select("id", { count: "exact", head: true });
    let q = (base as unknown as { eq: (c: string, v: string) => unknown }).eq("workspace_id", workspaceId);
    if (eventType) {
        q = (q as { eq: (c: string, v: string) => unknown }).eq("event_type", eventType);
    }
    const result = await (q as { gte: (c: string, v: string) => Promise<{ count: number | null; error: { message: string } | null }> }).gte("created_at", since);
    return result;
}

async function countTrueConversionEvents(
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
    since: string,
): Promise<{ count: number | null; error: { message: string } | null }> {
    const [directConversionsRes, semanticFormSubmitsRes] = await Promise.all([
        supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .in("event_type", [...ANALYTICS_TRUE_CONVERSION_EVENT_TYPES])
            .gte("created_at", since),
        supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("event_type", "form_submit")
            .in("event_name", [...ANALYTICS_FORM_SUBMIT_COMPATIBLE_CONVERSION_NAMES])
            .gte("created_at", since),
    ]);

    const error = directConversionsRes.error || semanticFormSubmitsRes.error;
    if (error) {
        return { count: null, error };
    }

    return { count: (directConversionsRes.count ?? 0) + (semanticFormSubmitsRes.count ?? 0), error: null };
}

export async function getAnalyticsOverview(input?: { workspaceId?: string; days?: number }) {
    const supabase = await createClient();
    const context = await resolveWorkspaceContext();
    const workspaceId = input?.workspaceId ?? context?.activeWorkspace?.id;
    const days = Math.max(1, Math.min(input?.days ?? 30, 365));

    if (!workspaceId) {
        return { data: null, error: "No active workspace." };
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [
        totalEventsRes,
        pageViewCountRes,
        ctaClickCountRes,
        conversionCountRes,
        audioPlayCountRes,
        audioProgressCountRes,
        audioCompleteCountRes,
        pageViewRowsRes,
        recentConversionsRes,
    ] = await Promise.all([
        countEvents(supabase, workspaceId, since),
        countEvents(supabase, workspaceId, since, "page_view"),
        countEvents(supabase, workspaceId, since, "cta_click"),
        countTrueConversionEvents(supabase, workspaceId, since),
        countEvents(supabase, workspaceId, since, "audio_play"),
        countEvents(supabase, workspaceId, since, "audio_progress"),
        countEvents(supabase, workspaceId, since, "audio_complete"),
        supabase
            .from("analytics_events")
            .select("page_slug,event_type,event_name,created_at")
            .eq("workspace_id", workspaceId)
            .eq("event_type", "page_view")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(TREND_AGGREGATION_CAP),
        supabase
            .from("analytics_events")
            .select("event_type,event_name,page_slug,created_at")
            .eq("workspace_id", workspaceId)
            .in("event_type", [...ANALYTICS_CONVERSION_CANDIDATE_EVENT_TYPES])
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(50),
    ]);

    const firstError =
        totalEventsRes.error ||
        pageViewCountRes.error ||
        ctaClickCountRes.error ||
        conversionCountRes.error ||
        audioPlayCountRes.error ||
        audioProgressCountRes.error ||
        audioCompleteCountRes.error ||
        pageViewRowsRes.error ||
        recentConversionsRes.error;
    if (firstError) {
        return { data: null, error: firstError.message };
    }

    const pageViewRows = (pageViewRowsRes.data ?? []) as AnalyticsRow[];
    const recentConversions = ((recentConversionsRes.data ?? []) as ConversionAnalyticsRow[])
        .filter((row) => isTrueConversionEvent(row.event_type, row.event_name))
        .slice(0, 10);

    const topPages = Array.from(
        pageViewRows.reduce((acc, row) => {
            const key = row.page_slug || row.event_name || "unknown";
            acc.set(key, (acc.get(key) ?? 0) + 1);
            return acc;
        }, new Map<string, number>()),
    )
        .map(([slug, views]) => ({ slug, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

    const dailyTrend = Array.from(
        pageViewRows.reduce((acc, row) => {
            const day = row.created_at.slice(0, 10);
            acc.set(day, (acc.get(day) ?? 0) + 1);
            return acc;
        }, new Map<string, number>()),
    )
        .map(([date, views]) => ({ date, views }))
        .sort((a, b) => a.date.localeCompare(b.date));

    const [newsletterCampaignsResult, { count: contactCount }, { count: automationCount }] = await Promise.all([
        supabase.from("newsletter_campaigns").select("id").eq("workspace_id", workspaceId),
        supabase.from("newsletter_contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("newsletter_automations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ]);

    const campaignIds = (newsletterCampaignsResult.data ?? []).map((campaign) => campaign.id);
    const newsletterRecipientsResult = campaignIds.length > 0
        ? await supabase
              .from("newsletter_campaign_recipients")
              .select("open_count,click_count")
              .in("campaign_id", campaignIds)
        : { data: [] as NewsletterRecipientSummary[] };

    const newsletterRecipients = (newsletterRecipientsResult.data ?? []) as NewsletterRecipientSummary[];
    const newsletterOpens = newsletterRecipients.reduce((sum, recipient) => sum + recipient.open_count, 0);
    const newsletterClicks = newsletterRecipients.reduce((sum, recipient) => sum + recipient.click_count, 0);

    const totalConversions = conversionCountRes.count ?? 0;

    return {
        data: {
            totalEvents: totalEventsRes.count ?? 0,
            totalPageViews: pageViewCountRes.count ?? 0,
            totalConversions,
            totalCtaClicks: ctaClickCountRes.count ?? 0,
            trendAggregationCapped: pageViewRows.length >= TREND_AGGREGATION_CAP,
            topPages,
            dailyTrend,
            recentConversions: recentConversions as Array<{
                event_type: string;
                event_name: string;
                page_slug: string | null;
                created_at: string;
            }>,
            newsletter: {
                campaigns: campaignIds.length,
                contacts: contactCount ?? 0,
                automations: automationCount ?? 0,
                opens: newsletterOpens,
                clicks: newsletterClicks,
            },
            audio: {
                plays: audioPlayCountRes.count ?? 0,
                progress: audioProgressCountRes.count ?? 0,
                completes: audioCompleteCountRes.count ?? 0,
            },
        },
        error: null,
    };
}

async function resolveAuthorizedAnalyticsWorkspace(workspaceId?: string): Promise<{
    workspaceId: string | null;
    error: string | null;
}> {
    const context = await resolveWorkspaceContext(workspaceId ? { workspaceId } : {});
    if (!context || !context.activeWorkspace) {
        return { workspaceId: null, error: "No active workspace." };
    }

    if (workspaceId && !context.accessibleWorkspaces.some((workspace) => workspace.id === workspaceId)) {
        return { workspaceId: null, error: "Forbidden: workspace is outside your membership scope." };
    }

    return { workspaceId: workspaceId ?? context.activeWorkspace.id, error: null };
}

export async function getAnalyticsExportRows(input?: {
    workspaceId?: string;
    days?: number;
    mode?: AnalyticsExportMode;
}): Promise<{ data: AnalyticsExportCsvRow[] | null; error: string | null }> {
    const authorization = await resolveAuthorizedAnalyticsWorkspace(input?.workspaceId);
    if (authorization.error || !authorization.workspaceId) {
        return { data: null, error: authorization.error ?? "No active workspace." };
    }

    const supabase = await createClient();
    const days = Math.max(1, Math.min(input?.days ?? 30, 3650));
    const mode = input?.mode ?? "summary";
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("analytics_events")
        .select("created_at,event_type,event_name,path,page_slug,utm_source,utm_medium,utm_campaign,referrer,metadata")
        .eq("workspace_id", authorization.workspaceId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);

    if (error) {
        return { data: null, error: error.message };
    }

    return {
        data: mapAnalyticsEventsToExportRows((data ?? []) as AnalyticsExportEventRow[], mode),
        error: null,
    };
}

// ────────────────────────────────────────────────────────────────────────────────
// Paginated event log + pruning actions
// ────────────────────────────────────────────────────────────────────────────────

export interface AnalyticsEventRow {
    id: string;
    page_slug: string | null;
    event_type: string;
    event_name: string;
    created_at: string;
    workspace_id: string | null;
    metadata: Record<string, unknown> | null;
}

export interface AnalyticsEventsQuery {
    workspaceId?: string;
    eventTypes?: string[];
    search?: string;
    sinceDays?: number | null;
    page?: number;
    pageSize?: number;
}

export interface AnalyticsEventsResult {
    rows: AnalyticsEventRow[];
    total: number;
    page: number;
    pageSize: number;
    error: string | null;
}

export async function getAnalyticsEvents(query: AnalyticsEventsQuery): Promise<AnalyticsEventsResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

    try {
        const supabase = await createClient();
        const context = await resolveWorkspaceContext();
        const workspaceId = query.workspaceId ?? context?.activeWorkspace?.id;
        if (!workspaceId) {
            return { rows: [], total: 0, page, pageSize, error: "No active workspace." };
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let builder = (supabase as unknown as {
            from: (t: string) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                select: (c: string, opts: { count: "exact" }) => any;
            };
        })
            .from("analytics_events")
            .select("id,page_slug,event_type,event_name,created_at,workspace_id,metadata", { count: "exact" })
            .eq("workspace_id", workspaceId);

        if (query.eventTypes && query.eventTypes.length > 0) {
            builder = builder.in("event_type", query.eventTypes);
        }

        if (query.sinceDays && query.sinceDays > 0) {
            builder = builder.gte(
                "created_at",
                new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000).toISOString(),
            );
        }

        if (query.search && query.search.trim()) {
            const term = query.search.trim().replace(/[%_]/g, "\\$&");
            builder = builder.or(
                `event_name.ilike.%${term}%,page_slug.ilike.%${term}%,event_type.ilike.%${term}%`,
            );
        }

        const { data, error, count } = await builder
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            return { rows: [], total: 0, page, pageSize, error: error.message };
        }

        return {
            rows: (data ?? []) as AnalyticsEventRow[],
            total: count ?? 0,
            page,
            pageSize,
            error: null,
        };
    } catch (err) {
        return {
            rows: [],
            total: 0,
            page,
            pageSize,
            error: err instanceof Error ? err.message : "Failed to load events.",
        };
    }
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function deleteAnalyticsEvents(
    ids: readonly string[],
    workspaceId?: string,
): Promise<{ error: string | null; deleted: number }> {
    try {
        const cleaned = sanitizeIds(ids);
        if (cleaned.length === 0) return { error: null, deleted: 0 };
        const authorization = await resolveAuthorizedAnalyticsWorkspace(workspaceId);
        if (authorization.error || !authorization.workspaceId) {
            return { error: authorization.error ?? "No active workspace.", deleted: 0 };
        }

        const admin = createAdminClient();
        const { error, count } = await admin
            .from("analytics_events")
            .delete({ count: "exact" })
            .in("id", cleaned)
            .eq("workspace_id", authorization.workspaceId);
        if (error) return { error: error.message, deleted: 0 };

        revalidatePath("/dashboard/analytics");
        return { error: null, deleted: count ?? 0 };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to delete events.", deleted: 0 };
    }
}

export async function pruneAnalyticsEventsByFilter(query: {
    workspaceId?: string;
    olderThanDays: number;
    eventTypes?: string[];
}): Promise<{ error: string | null; deleted: number }> {
    try {
        const authorization = await resolveAuthorizedAnalyticsWorkspace(query.workspaceId);
        if (authorization.error || !authorization.workspaceId) {
            return { error: authorization.error ?? "No active workspace.", deleted: 0 };
        }
        if (!Number.isFinite(query.olderThanDays) || query.olderThanDays <= 0) {
            return { error: "Invalid retention window.", deleted: 0 };
        }
        const cutoff = new Date(Date.now() - query.olderThanDays * 24 * 60 * 60 * 1000).toISOString();
        const admin = createAdminClient();
        let builder = (admin as unknown as {
            from: (t: string) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delete: (opts: { count: "exact" }) => any;
            };
        })
            .from("analytics_events")
            .delete({ count: "exact" })
            .eq("workspace_id", authorization.workspaceId)
            .lt("created_at", cutoff);
        if (query.eventTypes && query.eventTypes.length > 0) {
            builder = builder.in("event_type", query.eventTypes);
        }
        const { error, count } = await builder;
        if (error) return { error: error.message, deleted: 0 };
        revalidatePath("/dashboard/analytics");
        return { error: null, deleted: count ?? 0 };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to prune events.", deleted: 0 };
    }
}
