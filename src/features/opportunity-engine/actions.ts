"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import { runOpportunityScan } from "./lib/run-scan";
import type {
    OpportunityRecord,
    OpportunityScanRecord,
    OpportunityStatus,
} from "./types";

type RunScanState = { error: string | null; success: boolean; inserted: number | null };

const VALID_STATUSES: ReadonlyArray<OpportunityStatus> = [
    "pending",
    "approved",
    "dismissed",
    "implemented",
    "superseded",
];

type OpportunityRow = {
    id: string;
    workspace_id: string;
    scan_id: string | null;
    category: string;
    severity: string;
    status: string;
    signal_key: string;
    title: string;
    summary: string | null;
    recommendation_markdown: string | null;
    signal_data: Record<string, unknown> | null;
    priority_score: number | null;
    resolved_at: string | null;
    resolved_by_profile_id: string | null;
    created_at: string;
    updated_at: string;
};

type ScanRow = {
    id: string;
    workspace_id: string;
    status: string;
    triggered_by_profile_id: string | null;
    triggered_via: string;
    signals_found: number;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
};

function rowToOpportunity(row: OpportunityRow): OpportunityRecord {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        scanId: row.scan_id,
        category: row.category as OpportunityRecord["category"],
        severity: row.severity as OpportunityRecord["severity"],
        status: row.status as OpportunityRecord["status"],
        signalKey: row.signal_key,
        title: row.title,
        summary: row.summary,
        recommendationMarkdown: row.recommendation_markdown,
        signalData: row.signal_data ?? {},
        priorityScore: Number(row.priority_score ?? 0),
        resolvedAt: row.resolved_at,
        resolvedByProfileId: row.resolved_by_profile_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function rowToScan(row: ScanRow): OpportunityScanRecord {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        status: row.status as OpportunityScanRecord["status"],
        triggeredByProfileId: row.triggered_by_profile_id,
        triggeredVia: row.triggered_via,
        signalsFound: row.signals_found,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export interface OpportunitiesQuery {
    statuses?: OpportunityStatus[];
    severities?: string[];
    categories?: string[];
    search?: string;
    page?: number;
    pageSize?: number;
}

export interface OpportunitiesListResult {
    workspaceId: string | null;
    opportunities: OpportunityRecord[];
    total: number;
    page: number;
    pageSize: number;
    latestScan: OpportunityScanRecord | null;
    statusCounts: Record<OpportunityStatus, number>;
    error: string | null;
}

export async function listOpportunities(query: OpportunitiesQuery = {}): Promise<OpportunitiesListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

    const emptyStatusCounts: Record<OpportunityStatus, number> = {
        pending: 0,
        approved: 0,
        implemented: 0,
        dismissed: 0,
        superseded: 0,
    };

    const supabase = await createClient();
    let workspaceId: string | null = null;
    try {
        const context = await assertWorkspaceAiEnabled();
        workspaceId = context.activeWorkspace.id;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        return {
            workspaceId: null,
            opportunities: [],
            total: 0,
            page,
            pageSize,
            latestScan: null,
            statusCounts: emptyStatusCounts,
            error: message,
        };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let oppsBuilder = (supabase.from("workspace_opportunities") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select(
            "id,workspace_id,scan_id,category,severity,status,signal_key,title,summary,recommendation_markdown,signal_data,priority_score,resolved_at,resolved_by_profile_id,created_at,updated_at",
            { count: "exact" },
        )
        .eq("workspace_id", workspaceId);

    if (query.statuses && query.statuses.length > 0) {
        oppsBuilder = oppsBuilder.in("status", query.statuses);
    }
    if (query.severities && query.severities.length > 0) {
        oppsBuilder = oppsBuilder.in("severity", query.severities);
    }
    if (query.categories && query.categories.length > 0) {
        oppsBuilder = oppsBuilder.in("category", query.categories);
    }
    if (query.search && query.search.trim()) {
        const term = query.search.trim().replace(/[%_]/g, "\\$&");
        oppsBuilder = oppsBuilder.or(`title.ilike.%${term}%,summary.ilike.%${term}%,recommendation_markdown.ilike.%${term}%`);
    }

    const countStatus = async (status: OpportunityStatus) => {
        const res = await (supabase.from("workspace_opportunities") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    eq: (c: string, v: string) => Promise<{ count: number | null }>;
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId!)
            .eq("status", status);
        return { status, count: res.count ?? 0 };
    };

    const [oppsResult, scanResult, ...statusCountResults] = await Promise.all([
        oppsBuilder
            .order("priority_score", { ascending: false })
            .order("created_at", { ascending: false })
            .range(from, to) as Promise<{ data: OpportunityRow[] | null; error: { message: string } | null; count: number | null }>,
        supabase
            .from("workspace_opportunity_scans")
            .select(
                "id,workspace_id,status,triggered_by_profile_id,triggered_via,signals_found,error_message,started_at,completed_at,metadata,created_at,updated_at",
            )
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(1)
            .returns<ScanRow[]>(),
        ...VALID_STATUSES.map(countStatus),
    ]);

    if (oppsResult.error) {
        return {
            workspaceId,
            opportunities: [],
            total: 0,
            page,
            pageSize,
            latestScan: null,
            statusCounts: emptyStatusCounts,
            error: oppsResult.error.message,
        };
    }

    const statusCounts = { ...emptyStatusCounts };
    for (const r of statusCountResults) {
        statusCounts[r.status] = r.count;
    }

    return {
        workspaceId,
        opportunities: (oppsResult.data ?? []).map(rowToOpportunity),
        total: oppsResult.count ?? 0,
        page,
        pageSize,
        latestScan: (scanResult.data ?? [])[0] ? rowToScan(scanResult.data![0]) : null,
        statusCounts,
        error: null,
    };
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function deleteOpportunities(
    ids: readonly string[],
): Promise<{ error: string | null; deleted: number }> {
    let workspaceId: string;
    try {
        const context = await assertWorkspaceAiEnabled();
        workspaceId = context.activeWorkspace.id;
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unauthorized", deleted: 0 };
    }
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, deleted: 0 };
    const supabase = await createClient();
    const { error, count } = await (supabase as unknown as {
        from: (t: string) => {
            delete: (opts: { count: "exact" }) => {
                in: (c: string, v: string[]) => {
                    eq: (c: string, v: string) => Promise<{ error: { message: string } | null; count: number | null }>;
                };
            };
        };
    })
        .from("workspace_opportunities")
        .delete({ count: "exact" })
        .in("id", cleaned)
        .eq("workspace_id", workspaceId);
    if (error) return { error: error.message, deleted: 0 };
    const deleted = count ?? 0;
    // RLS denial on DELETE returns 0 rows without raising an error. Surface
    // that as an actionable message instead of silently appearing to succeed.
    if (deleted === 0 && cleaned.length > 0) {
        return {
            error:
                "Delete was blocked by row-level security. Ask an admin to run the workspace_opportunities delete-policy migration.",
            deleted: 0,
        };
    }
    revalidatePath("/dashboard/opportunities");
    return { error: null, deleted };
}

export async function bulkUpdateOpportunityStatus(
    ids: readonly string[],
    nextStatus: OpportunityStatus,
): Promise<{ error: string | null; updated: number }> {
    if (!VALID_STATUSES.includes(nextStatus)) {
        return { error: `Invalid status: ${nextStatus}`, updated: 0 };
    }
    let workspaceId: string;
    let userId: string;
    try {
        const context = await assertWorkspaceAiEnabled();
        workspaceId = context.activeWorkspace.id;
        userId = context.userId;
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Unauthorized", updated: 0 };
    }
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, updated: 0 };
    const supabase = await createClient();
    const isResolved = nextStatus !== "pending";
    const patch: Record<string, unknown> = {
        status: nextStatus,
        resolved_at: isResolved ? new Date().toISOString() : null,
        resolved_by_profile_id: isResolved ? userId : null,
    };
    const { error, count } = await (supabase as unknown as {
        from: (t: string) => {
            update: (patch: Record<string, unknown>, opts: { count: "exact" }) => {
                in: (c: string, v: string[]) => {
                    eq: (c: string, v: string) => Promise<{ error: { message: string } | null; count: number | null }>;
                };
            };
        };
    })
        .from("workspace_opportunities")
        .update(patch, { count: "exact" })
        .in("id", cleaned)
        .eq("workspace_id", workspaceId);
    if (error) return { error: error.message, updated: 0 };
    revalidatePath("/dashboard/opportunities");
    return { error: null, updated: count ?? 0 };
}

export async function runScanAction(
    _prev: RunScanState,
    _formData: FormData,
): Promise<RunScanState> {
    void _prev;
    void _formData;
    try {
        const result = await runOpportunityScan({ triggeredVia: "manual" });
        revalidatePath("/dashboard/opportunities");
        return {
            error: result.errors.length > 0 ? result.errors.join(" | ") : null,
            success: true,
            inserted: result.inserted,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run scan";
        return { error: message, success: false, inserted: null };
    }
}

export type UpdateOpportunityResult = {
    error: string | null;
    finalStatus: OpportunityStatus | null;
};

export async function updateOpportunityStatus(
    opportunityId: string,
    nextStatus: OpportunityStatus,
): Promise<UpdateOpportunityResult> {
    if (!VALID_STATUSES.includes(nextStatus)) {
        return { error: `Invalid status: ${nextStatus}`, finalStatus: null };
    }

    let workspaceId: string;
    let userId: string;
    try {
        const context = await assertWorkspaceAiEnabled();
        workspaceId = context.activeWorkspace.id;
        userId = context.userId;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        return { error: message, finalStatus: null };
    }

    const supabase = await createClient();

    const { error: fetchError } = await supabase
        .from("workspace_opportunities")
        .select("id")
        .eq("id", opportunityId)
        .eq("workspace_id", workspaceId)
        .single();

    if (fetchError) {
        return {
            error: fetchError.message ?? "Opportunity not found for this workspace.",
            finalStatus: null,
        };
    }

    const resolvedStatus: OpportunityStatus = nextStatus;
    const isResolved = resolvedStatus !== "pending";
    const patch: Record<string, unknown> = {
        status: resolvedStatus,
        resolved_at: isResolved ? new Date().toISOString() : null,
        resolved_by_profile_id: isResolved ? userId : null,
    };

    const { error } = await supabase
        .from("workspace_opportunities")
        .update(patch)
        .eq("id", opportunityId)
        .eq("workspace_id", workspaceId);

    if (error) {
        return { error: error.message, finalStatus: null };
    }

    revalidatePath("/dashboard/opportunities");
    return { error: null, finalStatus: resolvedStatus };
}
