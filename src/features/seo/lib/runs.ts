import { createClient } from "@/shared/lib/supabase/server";
import type { Locale } from "@/features/templates/types";

type SeoRunInsertResponse = { id: string };

export async function createRun(workspaceId: string, runType: string, locale: Locale) {
    const supabase = await createClient();
    const { data: userResult } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from("seo_recommendation_runs")
        .insert({
            workspace_id: workspaceId,
            run_type: runType,
            status: "running",
            locale,
            started_at: new Date().toISOString(),
            triggered_by_profile_id: userResult.user?.id ?? null,
        })
        .select("id")
        .single();

    const inserted = data as SeoRunInsertResponse | null;

    if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Failed to create SEO run.");
    }

    return inserted.id;
}

export async function completeRun(runId: string, summary: Record<string, unknown>, totals: Record<string, unknown>, failedMessage?: string) {
    const supabase = await createClient();
    await supabase
        .from("seo_recommendation_runs")
        .update({
            status: failedMessage ? "failed" : "completed",
            completed_at: new Date().toISOString(),
            summary,
            totals,
            error_message: failedMessage ?? null,
        })
        .eq("id", runId);
}
