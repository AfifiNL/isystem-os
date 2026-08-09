import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import { detectContentSignals } from "../detectors/content-detector";
import { detectConversionSignals } from "../detectors/conversion-detector";
import { detectMarketMonitorSignals } from "../detectors/market-monitor-detector";
import type { Detector, OpportunitySignal } from "../types";
import { narrateSignals } from "./narrate";
import { enrichSignalsWithExternalContext } from "./enrich";

const DEFAULT_LOOKBACK_DAYS = 30;

const DETECTORS: Array<{ key: string; run: Detector }> = [
    { key: "content", run: detectContentSignals },
    { key: "conversion", run: detectConversionSignals },
    { key: "market-monitor", run: detectMarketMonitorSignals },
];

export interface RunScanResult {
    scanId: string;
    signalsFound: number;
    inserted: number;
    errors: string[];
}

/**
 * Runs all detectors in parallel, persists a scan row + opportunity rows, and
 * narrates each new opportunity via Gemini. Callers must enforce authorization
 * (the server action does this via assertWorkspaceAiEnabled) — this function
 * re-asserts as a defense-in-depth check.
 */
export async function runOpportunityScan(options: {
    triggeredVia?: "manual" | "scheduled";
    lookbackDays?: number;
} = {}): Promise<RunScanResult> {
    const context = await assertWorkspaceAiEnabled();
    const workspaceId = context.activeWorkspace.id;
    const workspaceName = context.activeWorkspace.name ?? "your workspace";
    const locale = context.activeWorkspace.default_locale ?? "en";
    const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const triggeredVia = options.triggeredVia ?? "manual";

    const supabase = await createClient();

    const { data: scanRow, error: scanInsertError } = await supabase
        .from("workspace_opportunity_scans")
        .insert({
            workspace_id: workspaceId,
            status: "running",
            triggered_by_profile_id: context.userId,
            triggered_via: triggeredVia,
            started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

    if (scanInsertError || !scanRow) {
        throw new Error(scanInsertError?.message ?? "Failed to create opportunity scan row");
    }
    const scanId = scanRow.id as string;

    const errors: string[] = [];
    const allSignals: OpportunitySignal[] = [];

    const detectorOutputs = await Promise.allSettled(
        DETECTORS.map((detector) => detector.run({ workspaceId, lookbackDays })),
    );

    detectorOutputs.forEach((outcome, index) => {
        const detectorKey = DETECTORS[index].key;
        if (outcome.status === "fulfilled") {
            allSignals.push(...outcome.value);
        } else {
            const message =
                outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            errors.push(`${detectorKey}: ${message}`);
        }
    });

    const enrichments = await enrichSignalsWithExternalContext(allSignals, { locale });
    const narrationMap = await narrateSignals(
        allSignals,
        { workspaceId, workspaceName, locale },
        enrichments,
    );

    const rowsToInsert = allSignals.map((signal) => {
        const narration = narrationMap.get(signal.signalKey);
        if (narration?.error) {
            errors.push(`narrate:${signal.signalKey}: ${narration.error}`);
        }
        return {
            workspace_id: workspaceId,
            scan_id: scanId,
            category: signal.category,
            severity: signal.severity,
            signal_key: signal.signalKey,
            title: signal.title,
            summary: signal.summary,
            signal_data: signal.signalData,
            priority_score: signal.priorityScore,
            recommendation_markdown: narration?.recommendationMarkdown ?? null,
        };
    });

    let inserted = 0;
    if (rowsToInsert.length > 0) {
        const { data: insertedRows, error: insertError } = await supabase
            .from("workspace_opportunities")
            .upsert(rowsToInsert, {
                onConflict: "workspace_id,category,signal_key",
                ignoreDuplicates: true,
            })
            .select("id");

        if (insertError) {
            errors.push(`insert: ${insertError.message}`);
        } else {
            inserted = insertedRows?.length ?? 0;
        }
    }

    const allDetectorsFailed =
        errors.length > 0 && detectorOutputs.every((outcome) => outcome.status === "rejected");
    const finalStatus = allDetectorsFailed ? "failed" : "completed";

    const { error: updateError } = await supabase
        .from("workspace_opportunity_scans")
        .update({
            status: finalStatus,
            signals_found: allSignals.length,
            completed_at: new Date().toISOString(),
            error_message: errors.length > 0 ? errors.join(" | ") : null,
            metadata: { lookbackDays, inserted },
        })
        .eq("id", scanId);

    if (updateError) {
        errors.push(`scan_update: ${updateError.message}`);
    }

    return {
        scanId,
        signalsFound: allSignals.length,
        inserted,
        errors,
    };
}
