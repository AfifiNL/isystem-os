import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/supabase/database.types";
import type { DerivedDraftOutput } from "./derived-formats";
import type { DraftContentType } from "./draft-request-contract";

export const DRAFT_GENERATION_PHASES = [
    "brief_validation",
    "evidence_retrieval",
    "blueprint",
    "format_generation",
    "visual_enrichment",
    "editorial_validation",
    "persistence",
] as const;

export type DraftGenerationPhase = typeof DRAFT_GENERATION_PHASES[number];
type PhaseStatus = "running" | "succeeded" | "failed";
type ContentGenerationRunUpdate =
    Database["public"]["Tables"]["content_generation_runs"]["Update"];

interface DraftGenerationPhaseState {
    status: PhaseStatus;
    startedAt: string;
    completedAt?: string;
    metadata?: Record<string, unknown>;
    error?: string;
}

export interface DraftGenerationRunHandle {
    id: string;
    workspaceId: string;
    profileId: string;
    requestedFormats: DraftContentType[];
    currentPhase: DraftGenerationPhase | null;
    phaseState: Partial<Record<DraftGenerationPhase, DraftGenerationPhaseState>>;
    supabase: SupabaseClient<Database>;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function toJson(value: unknown): Json {
    return value as Json;
}

async function updateRun(
    run: DraftGenerationRunHandle,
    values: ContentGenerationRunUpdate,
): Promise<void> {
    const { error } = await run.supabase
        .from("content_generation_runs")
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq("id", run.id)
        .eq("workspace_id", run.workspaceId);

    if (error) {
        throw new Error(`Failed to persist draft generation state: ${error.message}`);
    }
}

export async function startDraftGenerationRun(input: {
    supabase: SupabaseClient<Database>;
    workspaceId: string;
    profileId: string;
    requestedFormats: DraftContentType[];
    inputSummary: Record<string, unknown>;
}): Promise<DraftGenerationRunHandle> {
    const { data, error } = await input.supabase
        .from("content_generation_runs")
        .insert({
            workspace_id: input.workspaceId,
            profile_id: input.profileId,
            status: "running",
            current_phase: null,
            requested_formats: input.requestedFormats,
            derived_outputs: [],
            phase_state: {},
            input_summary: toJson(input.inputSummary),
        })
        .select("id")
        .single();

    if (error || !data) {
        throw new Error(
            `Failed to create draft generation run: ${error?.message ?? "missing run id"}`,
        );
    }

    return {
        id: data.id,
        workspaceId: input.workspaceId,
        profileId: input.profileId,
        requestedFormats: [...input.requestedFormats],
        currentPhase: null,
        phaseState: {},
        supabase: input.supabase,
    };
}

export async function beginDraftGenerationPhase(
    run: DraftGenerationRunHandle,
    phase: DraftGenerationPhase,
    metadata: Record<string, unknown> = {},
): Promise<void> {
    const startedAt = new Date().toISOString();
    run.currentPhase = phase;
    run.phaseState[phase] = { status: "running", startedAt, metadata };
    await updateRun(run, {
        status: "running",
        current_phase: phase,
        phase_state: toJson(run.phaseState),
    });
}

export async function completeDraftGenerationPhase(
    run: DraftGenerationRunHandle,
    phase: DraftGenerationPhase,
    metadata: Record<string, unknown> = {},
): Promise<void> {
    const previous = run.phaseState[phase];
    run.phaseState[phase] = {
        status: "succeeded",
        startedAt: previous?.startedAt ?? new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: { ...previous?.metadata, ...metadata },
    };
    await updateRun(run, {
        current_phase: phase,
        phase_state: toJson(run.phaseState),
    });
}

export async function runDraftGenerationPhase<T>(
    run: DraftGenerationRunHandle,
    phase: DraftGenerationPhase,
    task: () => Promise<T>,
    summarize: (result: T) => Record<string, unknown> = () => ({}),
): Promise<T> {
    await beginDraftGenerationPhase(run, phase);
    try {
        const result = await task();
        await completeDraftGenerationPhase(run, phase, summarize(result));
        return result;
    } catch (error) {
        await failDraftGenerationRun(run, error);
        throw error;
    }
}

export async function completeDraftGenerationRun(
    run: DraftGenerationRunHandle,
    input: {
        contentItemId: string;
        derivedOutputs: DerivedDraftOutput[];
    },
): Promise<void> {
    await updateRun(run, {
        status: "succeeded",
        current_phase: "persistence",
        phase_state: toJson(run.phaseState),
        content_item_id: input.contentItemId,
        derived_outputs: toJson(input.derivedOutputs),
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
    });
}

export async function failDraftGenerationRun(
    run: DraftGenerationRunHandle,
    error: unknown,
): Promise<void> {
    const message = errorMessage(error).slice(0, 2_000);
    const phase = run.currentPhase;
    if (phase) {
        const previous = run.phaseState[phase];
        run.phaseState[phase] = {
            status: "failed",
            startedAt: previous?.startedAt ?? new Date().toISOString(),
            completedAt: new Date().toISOString(),
            metadata: previous?.metadata,
            error: message,
        };
    }
    await updateRun(run, {
        status: "failed",
        current_phase: phase,
        phase_state: toJson(run.phaseState),
        error_code: phase ? `${phase}_failed` : "generation_failed",
        error_message: message,
        completed_at: new Date().toISOString(),
    });
}
