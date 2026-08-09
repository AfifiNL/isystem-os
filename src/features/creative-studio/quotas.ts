import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/lib/supabase/database.types";
import type { CreativeRenderProviderId } from "./providers/types";

export interface HiggsfieldRenderQuotaConfig {
    enabled: boolean;
    apiBaseUrl: string | null;
    apiKey: string | null;
    monthlyBudgetMillicents: number;
    maxDurationSeconds: number;
    maxPendingJobsPerWorkspace: number;
    dailyRenderLimitPerWorkspace: number;
}

export interface CreativeRenderQuotaConfig {
    higgsfield: HiggsfieldRenderQuotaConfig;
}

export const CREATIVE_STUDIO_RATE_LIMIT_KEYS = {
    strategy: "creative-studio:strategy",
    evaluate: "creative-studio:evaluate",
    renderSubmit: "creative-studio:render-submit",
} as const;

export const CREATIVE_STUDIO_RATE_LIMITS = {
    strategy: { maxPerWindow: 10, windowSeconds: 60 },
    evaluate: { maxPerWindow: 20, windowSeconds: 60 },
    renderSubmit: { maxPerWindow: 5, windowSeconds: 60 },
} as const;

export interface CreativeRenderBudgetGateInput {
    provider: CreativeRenderProviderId;
    durationSeconds: number | null | undefined;
    estimatedCostMillicents: number | null | undefined;
    pendingJobsForWorkspace: number;
    rendersTodayForWorkspace: number;
    monthlySpendMillicents: number;
    config: CreativeRenderQuotaConfig;
}

export interface CreativeRenderBudgetGateResult {
    allowed: boolean;
    reasons: string[];
}

function normalizeNonNegativeInteger(value: number | null | undefined): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value ?? 0));
}

export function evaluateCreativeRenderBudgetGate(input: CreativeRenderBudgetGateInput): CreativeRenderBudgetGateResult {
    const config = input.config;
    const durationSeconds = normalizeNonNegativeInteger(input.durationSeconds);
    const estimatedCostMillicents = normalizeNonNegativeInteger(input.estimatedCostMillicents);
    const pendingJobsForWorkspace = normalizeNonNegativeInteger(input.pendingJobsForWorkspace);
    const rendersTodayForWorkspace = normalizeNonNegativeInteger(input.rendersTodayForWorkspace);
    const monthlySpendMillicents = normalizeNonNegativeInteger(input.monthlySpendMillicents);
    const reasons: string[] = [];

    if (input.provider === "higgsfield") {
        if (!config.higgsfield.enabled) reasons.push("Higgsfield rendering is disabled by HIGGSFIELD_ENABLED.");
        if (!config.higgsfield.apiBaseUrl) reasons.push("HIGGSFIELD_API_BASE_URL is not configured.");
        if (!config.higgsfield.apiKey) reasons.push("HIGGSFIELD_API_KEY is not configured.");
        if (config.higgsfield.monthlyBudgetMillicents <= 0) reasons.push("HIGGSFIELD_MONTHLY_BUDGET_MILLICENTS must be approved before live renders.");
    }

    if (durationSeconds <= 0) {
        reasons.push("Creative renders require a positive duration_seconds value before metering.");
    }

    if (durationSeconds > config.higgsfield.maxDurationSeconds) {
        reasons.push(`Requested render duration exceeds HIGGSFIELD_MAX_DURATION_SECONDS (${config.higgsfield.maxDurationSeconds}).`);
    }

    if (pendingJobsForWorkspace >= config.higgsfield.maxPendingJobsPerWorkspace) {
        reasons.push(`Workspace has reached HIGGSFIELD_MAX_PENDING_JOBS_PER_WORKSPACE (${config.higgsfield.maxPendingJobsPerWorkspace}).`);
    }

    if (rendersTodayForWorkspace >= config.higgsfield.dailyRenderLimitPerWorkspace) {
        reasons.push(`Workspace has reached HIGGSFIELD_DAILY_RENDER_LIMIT_PER_WORKSPACE (${config.higgsfield.dailyRenderLimitPerWorkspace}).`);
    }

    if (input.provider === "higgsfield" && monthlySpendMillicents + estimatedCostMillicents > config.higgsfield.monthlyBudgetMillicents) {
        reasons.push("Estimated render cost would exceed the monthly Higgsfield budget cap.");
    }

    return { allowed: reasons.length === 0, reasons };
}

type CreativeRenderJobUsageRow = {
    final_cost_millicents: number | null;
    estimated_cost_millicents: number | null;
};

export interface CreativeRenderBudgetSnapshot {
    pendingJobsForWorkspace: number;
    rendersTodayForWorkspace: number;
    monthlySpendMillicents: number;
}

export async function loadCreativeRenderBudgetSnapshot(
    supabase: SupabaseClient<Database>,
    workspaceId: string,
    provider: CreativeRenderProviderId,
    now = new Date(),
): Promise<CreativeRenderBudgetSnapshot> {
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const fromCreativeJobs = () => supabase.from("creative_render_jobs" as never) as ReturnType<typeof supabase.from>;
    const [{ count: pendingCount, error: pendingError }, { count: dailyCount, error: dailyError }, { data: monthlyRows, error: monthlyError }] = await Promise.all([
        fromCreativeJobs()
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("provider", provider)
            .in("status", ["draft", "queued", "running", "provider_submitted", "provider_processing", "needs_manual_review"]),
        fromCreativeJobs()
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("provider", provider)
            .gte("created_at", startOfDay.toISOString()),
        fromCreativeJobs()
            .select("final_cost_millicents,estimated_cost_millicents")
            .eq("workspace_id", workspaceId)
            .eq("provider", provider)
            .gte("created_at", startOfMonth.toISOString()),
    ]);

    if (pendingError || dailyError || monthlyError) {
        throw new Error(`Creative render budget snapshot failed: ${pendingError?.message ?? dailyError?.message ?? monthlyError?.message}`);
    }

    const monthlySpendMillicents = ((monthlyRows ?? []) as CreativeRenderJobUsageRow[]).reduce((sum, row) => {
        return sum + normalizeNonNegativeInteger(row.final_cost_millicents ?? row.estimated_cost_millicents);
    }, 0);

    return {
        pendingJobsForWorkspace: pendingCount ?? 0,
        rendersTodayForWorkspace: dailyCount ?? 0,
        monthlySpendMillicents,
    };
}
