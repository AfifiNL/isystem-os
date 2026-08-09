"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { runMarketMonitorScan } from "./lib/monitor";
import type {
    MarketMonitorConfig,
    MarketMonitorResult,
    MonitorChangeType,
    MonitorScanSummary,
} from "./types";

export interface MarketMonitorFilters {
    changeTypes?: MonitorChangeType[];
    trustTiers?: number[];
    readState?: "all" | "unread" | "read";
    archivedState?: "active" | "archived" | "all";
    search?: string;
    sinceDays?: number | null;
}

export interface MarketMonitorQuery extends MarketMonitorFilters {
    page?: number;
    pageSize?: number;
}

export interface MarketMonitorDashboardData {
    workspaceId: string | null;
    config: MarketMonitorConfig | null;
    results: MarketMonitorResult[];
    total: number;
    unreadCount: number;
    archivedCount: number;
    page: number;
    pageSize: number;
    error: string | null;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function loadMarketMonitorDashboard(
    query: MarketMonitorQuery = {},
): Promise<MarketMonitorDashboardData> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(5, query.pageSize ?? DEFAULT_PAGE_SIZE));

    try {
        const ctx = await resolveWorkspaceContext();
        if (!ctx?.activeWorkspace?.id) {
            return {
                workspaceId: null,
                config: null,
                results: [],
                total: 0,
                unreadCount: 0,
                archivedCount: 0,
                page,
                pageSize,
                error: "No active workspace.",
            };
        }
        const workspaceId = ctx.activeWorkspace.id;
        const supabase = await createClient();

        const configPromise = supabase
            .from("workspace_market_monitor_config")
            .select("*")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let resultsQuery = supabase
            .from("workspace_market_monitor_results")
            .select(
                "id,workspace_id,config_id,url,title,snippet,change_type,trust_tier,published_date,detected_at,read,archived,archived_at",
                { count: "exact" },
            )
            .eq("workspace_id", workspaceId);

        const archivedState = query.archivedState ?? "active";
        if (archivedState === "active") {
            resultsQuery = resultsQuery.eq("archived", false);
        } else if (archivedState === "archived") {
            resultsQuery = resultsQuery.eq("archived", true);
        }

        const readState = query.readState ?? "all";
        if (readState === "unread") {
            resultsQuery = resultsQuery.eq("read", false);
        } else if (readState === "read") {
            resultsQuery = resultsQuery.eq("read", true);
        }

        if (query.changeTypes && query.changeTypes.length > 0) {
            resultsQuery = resultsQuery.in("change_type", query.changeTypes);
        }

        if (query.trustTiers && query.trustTiers.length > 0) {
            resultsQuery = resultsQuery.in("trust_tier", query.trustTiers);
        }

        if (query.search && query.search.trim()) {
            const term = query.search.trim().replace(/[%_]/g, "\\$&");
            resultsQuery = resultsQuery.or(
                `title.ilike.%${term}%,snippet.ilike.%${term}%,url.ilike.%${term}%`,
            );
        }

        if (query.sinceDays && query.sinceDays > 0) {
            const since = new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000).toISOString();
            resultsQuery = resultsQuery.gte("detected_at", since);
        }

        resultsQuery = resultsQuery.order("detected_at", { ascending: false }).range(from, to);

        const countPromises = [
            supabase
                .from("workspace_market_monitor_results")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .eq("archived", false)
                .eq("read", false),
            supabase
                .from("workspace_market_monitor_results")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", workspaceId)
                .eq("archived", true),
        ] as const;

        const [configRes, resultsRes, unreadRes, archivedRes] = await Promise.all([
            configPromise,
            resultsQuery,
            countPromises[0],
            countPromises[1],
        ]);

        if (configRes.error && configRes.error.code !== "PGRST116") {
            return {
                workspaceId,
                config: null,
                results: [],
                total: 0,
                unreadCount: 0,
                archivedCount: 0,
                page,
                pageSize,
                error: configRes.error.message,
            };
        }
        if (resultsRes.error) {
            return {
                workspaceId,
                config: (configRes.data as MarketMonitorConfig | null) ?? null,
                results: [],
                total: 0,
                unreadCount: 0,
                archivedCount: 0,
                page,
                pageSize,
                error: resultsRes.error.message,
            };
        }

        return {
            workspaceId,
            config: (configRes.data as MarketMonitorConfig | null) ?? null,
            results: (resultsRes.data ?? []) as MarketMonitorResult[],
            total: resultsRes.count ?? 0,
            unreadCount: unreadRes.count ?? 0,
            archivedCount: archivedRes.count ?? 0,
            page,
            pageSize,
            error: null,
        };
    } catch (err) {
        return {
            workspaceId: null,
            config: null,
            results: [],
            total: 0,
            unreadCount: 0,
            archivedCount: 0,
            page,
            pageSize,
            error: err instanceof Error ? err.message : "Failed to load market monitor.",
        };
    }
}

export interface UpsertMarketMonitorConfigInput {
    competitorDomains: string[];
    authorityDomains: string[];
    industryKeywords: string[];
    enabled: boolean;
}

function normalizeList(values: string[], maxLen = 120): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of values) {
        const value = raw.trim().slice(0, maxLen);
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
    }
    return out;
}

export async function upsertMarketMonitorConfig(input: UpsertMarketMonitorConfigInput): Promise<{ error: string | null }> {
    try {
        const ctx = await resolveWorkspaceContext();
        if (!ctx?.activeWorkspace?.id) return { error: "No active workspace." };
        const workspaceId = ctx.activeWorkspace.id;
        const supabase = await createClient();

        const payload = {
            workspace_id: workspaceId,
            competitor_domains: normalizeList(input.competitorDomains),
            authority_domains: normalizeList(input.authorityDomains),
            industry_keywords: normalizeList(input.industryKeywords),
            enabled: input.enabled,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from("workspace_market_monitor_config")
            .upsert(payload, { onConflict: "workspace_id" });
        if (error) return { error: error.message };

        revalidatePath("/dashboard/market-monitor");
        revalidatePath("/dashboard/settings");
        return { error: null };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to save market monitor config." };
    }
}

export interface TriggerMarketMonitorScanResult {
    summary: MonitorScanSummary | null;
    error: string | null;
}

export async function triggerMarketMonitorScan(): Promise<TriggerMarketMonitorScanResult> {
    try {
        const state = await getAdminDashboardState();
        if (!state) {
            return { summary: null, error: "Unauthorized: admin or workspace manager access required." };
        }

        const ctx = await resolveWorkspaceContext();
        const workspaceId = ctx?.activeWorkspace?.id;
        if (!workspaceId) {
            return { summary: null, error: "No active workspace." };
        }

        if (!process.env.TAVILY_API_KEY) {
            return { summary: null, error: "TAVILY_API_KEY is not configured on the server." };
        }

        const summary = await runMarketMonitorScan(workspaceId);
        revalidatePath("/dashboard/market-monitor");
        revalidatePath("/dashboard");
        return { summary, error: null };
    } catch (err) {
        return {
            summary: null,
            error: err instanceof Error ? err.message : "Failed to run market monitor scan.",
        };
    }
}

async function resolveWorkspaceOrError(): Promise<{ workspaceId: string } | { error: string }> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { error: "No active workspace." };
    return { workspaceId: ctx.activeWorkspace.id };
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function markMarketMonitorResultRead(resultId: string): Promise<{ error: string | null }> {
    return setMarketMonitorResultsRead([resultId], true);
}

export async function setMarketMonitorResultsRead(
    resultIds: readonly string[],
    read: boolean,
): Promise<{ error: string | null }> {
    try {
        const ids = sanitizeIds(resultIds);
        if (ids.length === 0) return { error: null };
        const resolved = await resolveWorkspaceOrError();
        if ("error" in resolved) return { error: resolved.error };
        const supabase = await createClient();
        const { error } = await supabase
            .from("workspace_market_monitor_results")
            .update({ read })
            .in("id", ids)
            .eq("workspace_id", resolved.workspaceId);
        if (error) return { error: error.message };
        revalidatePath("/dashboard/market-monitor");
        revalidatePath("/dashboard");
        return { error: null };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to update results." };
    }
}

export async function setMarketMonitorResultsArchived(
    resultIds: readonly string[],
    archived: boolean,
): Promise<{ error: string | null }> {
    try {
        const ids = sanitizeIds(resultIds);
        if (ids.length === 0) return { error: null };
        const resolved = await resolveWorkspaceOrError();
        if ("error" in resolved) return { error: resolved.error };
        const supabase = await createClient();
        const { error } = await supabase
            .from("workspace_market_monitor_results")
            .update({ archived, archived_at: archived ? new Date().toISOString() : null })
            .in("id", ids)
            .eq("workspace_id", resolved.workspaceId);
        if (error) return { error: error.message };
        revalidatePath("/dashboard/market-monitor");
        revalidatePath("/dashboard");
        return { error: null };
    } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to archive results." };
    }
}

export async function deleteMarketMonitorResults(
    resultIds: readonly string[],
): Promise<{ error: string | null; deleted: number }> {
    try {
        const ids = sanitizeIds(resultIds);
        if (ids.length === 0) return { error: null, deleted: 0 };
        const resolved = await resolveWorkspaceOrError();
        if ("error" in resolved) return { error: resolved.error, deleted: 0 };
        const supabase = await createClient();
        const { error, count } = await supabase
            .from("workspace_market_monitor_results")
            .delete({ count: "exact" })
            .in("id", ids)
            .eq("workspace_id", resolved.workspaceId);
        if (error) return { error: error.message, deleted: 0 };
        revalidatePath("/dashboard/market-monitor");
        revalidatePath("/dashboard");
        return { error: null, deleted: count ?? 0 };
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : "Failed to delete results.",
            deleted: 0,
        };
    }
}
