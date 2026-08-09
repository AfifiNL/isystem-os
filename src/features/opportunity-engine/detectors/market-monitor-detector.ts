import { createClient } from "@/shared/lib/supabase/server";
import type { Detector, OpportunitySeverity, OpportunitySignal } from "../types";

const MAX_SIGNALS = 15;

export interface MarketMonitorResultRow {
    id: string;
    workspace_id: string;
    config_id: string;
    url: string;
    canonical_url: string | null;
    title: string | null;
    snippet: string | null;
    change_type: string;
    trust_tier: number;
    published_date: string | null;
    detected_at: string;
    read: boolean;
    archived: boolean;
    archived_at: string | null;
}

const BASE_PRIORITY_BY_CHANGE_TYPE: Record<string, number> = {
    regulation_update: 92,
    pricing_signal: 84,
    competitor_update: 72,
    industry_news: 65,
    new_page: 50,
};

function severityForPriority(priorityScore: number): OpportunitySeverity {
    if (priorityScore >= 85) return "high";
    if (priorityScore >= 65) return "medium";
    return "low";
}

function sourceHostname(sourceUrl: string): string {
    try {
        return new URL(sourceUrl).hostname || "an external source";
    } catch {
        return "an external source";
    }
}

/**
 * Converts a tenant-scoped Market Monitor result into the Opportunity Engine's
 * normalized signal contract. The provenance fields are intentionally stable:
 * downstream modules must follow the source row instead of parsing narration.
 */
export function marketMonitorResultToSignal(row: MarketMonitorResultRow): OpportunitySignal {
    const sourceUrl = row.canonical_url ?? row.url;
    const basePriority = BASE_PRIORITY_BY_CHANGE_TYPE[row.change_type] ?? 55;
    const trustTier = Number.isFinite(row.trust_tier) ? row.trust_tier : 1;
    const trustBonus = Math.max(0, Math.min(8, (trustTier - 1) * 2));
    const priorityScore = Math.min(100, basePriority + trustBonus);
    const title = row.title?.trim() || `Market signal from ${sourceHostname(sourceUrl)}`;

    return {
        category: "market",
        signalKey: `market_monitor:${row.id}`,
        severity: severityForPriority(priorityScore),
        title,
        summary:
            row.snippet?.trim()
            || `${row.change_type.replaceAll("_", " ")} detected by Market Monitor.`,
        priorityScore,
        signalData: {
            source: "workspace_market_monitor_results",
            marketMonitorResultId: row.id,
            marketMonitorConfigId: row.config_id,
            sourceUrl,
            canonicalUrl: row.canonical_url,
            changeType: row.change_type,
            trustTier,
            publishedDate: row.published_date,
            detectedAt: row.detected_at,
            bridgeVersion: 1,
        },
    };
}

/**
 * Reads only this workspace's active, recent Market Monitor results. RLS still
 * applies, while the explicit workspace predicate makes tenant scope auditable.
 */
export const detectMarketMonitorSignals: Detector = async ({ workspaceId, lookbackDays }) => {
    const supabase = await createClient();
    const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("workspace_market_monitor_results")
        .select(
            "id,workspace_id,config_id,url,canonical_url,title,snippet,change_type,trust_tier,published_date,detected_at,read,archived,archived_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("archived", false)
        .gte("detected_at", sinceIso)
        .order("detected_at", { ascending: false })
        .limit(MAX_SIGNALS)
        .returns<MarketMonitorResultRow[]>();

    if (error) {
        throw new Error(`Market Monitor detector failed: ${error.message}`);
    }

    return (data ?? []).map(marketMonitorResultToSignal);
};
