import { createAdminClient } from "@/shared/lib/supabase/admin";
import type { Json } from "@/shared/lib/supabase/database.types";

type EnqueueSourceIngestionJobInput = {
    workspaceId: string;
    registryId: string;
    sourceUrl: string;
    locale?: "en" | "nl" | "ar";
    priority?: number;
    runAfter?: string;
    runId?: string | null;
    inputHash?: string | null;
};

export async function enqueueSourceIngestionJob(input: EnqueueSourceIngestionJobInput) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("source_ingestion_jobs" as never)
        .insert({
            workspace_id: input.workspaceId,
            registry_id: input.registryId,
            run_id: input.runId ?? null,
            source_url: input.sourceUrl,
            locale: input.locale ?? "en",
            priority: input.priority ?? 100,
            run_after: input.runAfter ?? new Date().toISOString(),
            input_hash: input.inputHash ?? null,
        } as never)
        .select("id" as never)
        .single();

    if (error) {
        throw new Error(`Failed to enqueue source ingestion job: ${error.message}`);
    }

    return data as { id: string };
}

export async function markSourceIngestionJobCompleted(input: {
    jobId: string;
    documentId?: string | null;
    resultSummary?: Json;
}) {
    const supabase = createAdminClient();
    const { error } = await supabase
        .from("source_ingestion_jobs" as never)
        .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            document_id: input.documentId ?? null,
            result_summary: input.resultSummary ?? {},
            error_message: null,
        } as never)
        .eq("id" as never, input.jobId as never);

    if (error) {
        throw new Error(`Failed to mark source ingestion job completed: ${error.message}`);
    }
}
