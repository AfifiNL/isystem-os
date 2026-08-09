"use server";

import { revalidatePath } from "next/cache";
import { getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { initialSourceIntelligenceRunActionState, type SourceIntelligenceRunActionState } from "@/features/source-intelligence/action-state";
import { enqueueDueSourceIntelligenceJobs } from "@/features/source-intelligence/run";
import { createClient } from "@/shared/lib/supabase/server";

async function requireSourceIntelligenceAccess() {
    const state = await getAdminDashboardState();
    if (!state) return { error: "Unauthorized: manager or admin access required.", state: null } as const;
    const moduleEntry = state.modules.find((entry) => entry.key === "source-intelligence" && entry.enabled);
    if (!moduleEntry) return { error: "Source Intelligence is only available on Pro workspaces with dashboard access.", state: null } as const;
    if (state.role !== "admin" && state.role !== "manager") return { error: "Forbidden: manager or admin access required.", state: null } as const;
    return { error: null, state } as const;
}

function buildRunSummary(input: {
    runId: string | null;
    enqueued: number;
    processed: number;
    failed: number;
    skipped: number;
    existingQueued: number;
    existingRunning: number;
}) {
    if (input.enqueued > 0 || input.processed > 0 || input.failed > 0) {
        const drainText = input.processed > 0 || input.failed > 0
            ? `${input.processed} processed immediately${input.failed > 0 ? `, ${input.failed} failed` : ""}`
            : "queued for the background worker";
        return `${input.enqueued} source ${input.enqueued === 1 ? "job was" : "jobs were"} enqueued and ${drainText}.`;
    }
    if (input.existingQueued > 0 || input.existingRunning > 0) {
        return `No duplicate jobs were queued because ${input.existingQueued} job${input.existingQueued === 1 ? " is" : "s are"} already queued and ${input.existingRunning} job${input.existingRunning === 1 ? " is" : "s are"} running.`;
    }
    if (input.skipped > 0) {
        return `No new jobs were queued because ${input.skipped} enabled source ${input.skipped === 1 ? "is" : "are"} not due for ingestion yet.`;
    }
    return "No source jobs were queued. Check that at least one active source exists for this workspace.";
}

function errorState(error: string): SourceIntelligenceRunActionState {
    return {
        ...initialSourceIntelligenceRunActionState,
        error,
        timestamp: new Date().toISOString(),
        summary: error,
    };
}

export async function triggerSourceIntelligenceRunAction(
    _previousState?: SourceIntelligenceRunActionState,
    formData?: FormData,
): Promise<SourceIntelligenceRunActionState> {
    try {
        const access = await requireSourceIntelligenceAccess();
        if (access.error || !access.state) return errorState(access.error ?? "Source Intelligence access denied.");

        const registryId = formData?.get("registryId");
        const supabase = await createClient();
        const { data: userResult } = await supabase.auth.getUser();

        const result = await enqueueDueSourceIntelligenceJobs({
            workspaceId: access.state.workspace.id,
            registryId: typeof registryId === "string" && registryId.trim() ? registryId.trim() : null,
            reason: "manual",
            drainLimit: 3,
            startedBy: userResult.user?.id ?? null,
        });

        revalidatePath("/dashboard/source-intelligence");
        revalidatePath("/dashboard");
        const state = {
            success: true,
            error: null,
            runId: result.runId ?? null,
            enqueued: result.enqueued ?? 0,
            processed: result.processed ?? 0,
            failed: result.failed ?? 0,
            skipped: result.skipped ?? 0,
            existingQueued: result.existingQueued ?? 0,
            existingRunning: result.existingRunning ?? 0,
            timestamp: new Date().toISOString(),
        };
        return {
            ...state,
            summary: buildRunSummary(state),
        };
    } catch (error) {
        return errorState(error instanceof Error ? error.message : "Failed to run Source Intelligence.");
    }
}

export async function updateContentEvidenceFeedbackAction(formData: FormData): Promise<{ error: string | null }> {
    try {
        const access = await requireSourceIntelligenceAccess();
        if (access.error || !access.state) return { error: access.error };

        const linkId = formData.get("linkId");
        const feedback = formData.get("feedback");
        if (typeof linkId !== "string" || !linkId.trim()) return { error: "Missing evidence link." };
        if (feedback !== "accepted" && feedback !== "rejected" && feedback !== "downgraded") return { error: "Unsupported feedback value." };

        const supabase = await createClient();
        const { data: existing, error: fetchError } = await supabase
            .from("content_evidence_links" as never)
            .select("id,metadata,source_document_id,source_claim_id" as never)
            .eq("id" as never, linkId as never)
            .eq("workspace_id" as never, access.state.workspace.id as never)
            .maybeSingle();

        if (fetchError || !existing) return { error: fetchError?.message ?? "Evidence link not found." };
        const row = existing as unknown as { metadata: Record<string, unknown> | null; source_document_id: string | null; source_claim_id: string | null };
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

        const { error: updateError } = await supabase
            .from("content_evidence_links" as never)
            .update({
                metadata: {
                    ...metadata,
                    validation_status: feedback,
                    operator_feedback_at: new Date().toISOString(),
                },
            } as never)
            .eq("id" as never, linkId as never)
            .eq("workspace_id" as never, access.state.workspace.id as never);

        if (updateError) return { error: updateError.message };

        await supabase.from("source_feedback_events" as never).insert({
            workspace_id: access.state.workspace.id,
            content_evidence_link_id: linkId,
            source_document_id: row.source_document_id,
            source_claim_id: row.source_claim_id,
            event_type: feedback === "downgraded" ? "quality_adjusted" : feedback,
            feedback_text: feedback === "downgraded" ? "Operator downgraded evidence status from dashboard." : `Operator marked evidence as ${feedback}.`,
            metadata: { source: "source_intelligence_dashboard", feedback },
        } as never);

        revalidatePath("/dashboard/source-intelligence");
        return { error: null };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Failed to save evidence feedback." };
    }
}

export async function updateContentEvidenceFeedbackFormAction(formData: FormData): Promise<void> {
    await updateContentEvidenceFeedbackAction(formData);
}
