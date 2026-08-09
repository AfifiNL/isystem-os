"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { migrateAiServiceOptionId, AI_SERVICES, type AiService } from "@/shared/lib/ai/models";
import { revalidatePath } from "next/cache";

export type WorkspaceAiModelConfigs = Partial<Record<AiService, string>> & Record<string, string>;

const AI_SERVICE_KEY_SET = new Set<string>(AI_SERVICES);

function isAiService(value: string): value is AiService {
    return AI_SERVICE_KEY_SET.has(value);
}

function normalizeWorkspaceAiModelConfigs(configs: Record<string, string>): {
    configs: WorkspaceAiModelConfigs;
    error: string | null;
} {
    const normalizedEntries: [string, string][] = [];

    for (const [service, modelId] of Object.entries(configs)) {
        if (typeof modelId !== "string" || modelId.trim().length === 0) continue;

        if (isAiService(service)) {
            const migratedModelId = migrateAiServiceOptionId(service, modelId);
            if (!migratedModelId) {
                return {
                    configs: {},
                    error: `Invalid model selection for ${service.replace(/_/g, " ")}.`,
                };
            }
            normalizedEntries.push([service, migratedModelId]);
            continue;
        }

        normalizedEntries.push([service, modelId]);
    }

    return {
        configs: Object.fromEntries(normalizedEntries) as WorkspaceAiModelConfigs,
        error: null,
    };
}

export async function getWorkspaceAiConfigs(workspaceId?: string) {
    const supabase = await createClient();
    const context = await resolveWorkspaceContext({ workspaceId });
    const activeWorkspaceId = workspaceId ?? context?.activeWorkspace?.id;

    if (!activeWorkspaceId) {
        return { error: "No active workspace session found.", configs: {} };
    }

    const { data, error } = await supabase
        .from("workspaces")
        .select("ai_model_configs")
        .eq("id", activeWorkspaceId)
        .maybeSingle();

    if (error) {
        return { error: error.message, configs: {} };
    }

    return {
        error: null,
        configs: (data?.ai_model_configs ?? {}) as WorkspaceAiModelConfigs
    };
}

export async function updateWorkspaceAiConfigs(workspaceId: string, configs: Record<string, string>) {
    const supabase = await createClient();
    const context = await resolveWorkspaceContext({ workspaceId });

    // Gate to workspace admin/manager
    if (!context || !context.activeWorkspace || context.activeWorkspace.id !== workspaceId) {
        return { error: "Unauthorized access to workspace." };
    }

    const isProfileAdminOrManager = context.role === "admin" || context.role === "manager";
    const isOwner = context.activeWorkspace.owner_profile_id === context.userId;

    if (!isProfileAdminOrManager && !isOwner) {
        return { error: "Forbidden: admin or manager role required." };
    }

    const normalized = normalizeWorkspaceAiModelConfigs(configs);
    if (normalized.error) {
        return { error: normalized.error };
    }

    const { error } = await supabase
        .from("workspaces")
        .update({
            ai_model_configs: normalized.configs,
            updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/", "layout");
    return { error: null };
}
