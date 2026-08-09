import { createAdminClient } from "@/shared/lib/supabase/admin";
import { recordBusinessIntegrationHealthCheck } from "@/features/business-spine/integrations";
import type { BusinessIntegrationStatus } from "@/features/business-spine/health";

/**
 * Standard health reporter helper.
 * This function updates the health check for the specific workspace, or if no workspaceId is provided,
 * it queries all workspaces that have this provider & integrationKey registered and updates their health.
 */
export async function reportWorkerHealth(params: {
    provider: string;
    integrationKey: string;
    status: BusinessIntegrationStatus;
    workspaceId?: string | null;
    latencyMs?: number | null;
    statusCode?: number | null;
    message?: string | null;
    errorCode?: string | null;
    details?: Record<string, unknown>;
    checkedAt?: string;
}) {
    const checkedAt = params.checkedAt ?? new Date().toISOString();

    if (params.workspaceId) {
        try {
            return await recordBusinessIntegrationHealthCheck({
                workspaceId: params.workspaceId,
                provider: params.provider,
                integrationKey: params.integrationKey,
                status: params.status,
                latencyMs: params.latencyMs,
                statusCode: params.statusCode,
                message: params.message,
                errorCode: params.errorCode,
                details: params.details,
                checkedAt,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[health-evidence] recordBusinessIntegrationHealthCheck failed: ${msg}`);
            return { ok: false, error: msg };
        }
    }

    // Otherwise, find all workspaces that have this integration registered and update them
    try {
        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from("workspace_integrations" as never)
            .select("workspace_id" as never)
            .eq("provider" as never, params.provider as never)
            .eq("integration_key" as never, params.integrationKey as never) as unknown as { data: Array<{ workspace_id: string }> | null; error: { message: string } | null };

        if (error) {
            console.warn(`[health-evidence] failed to query workspaces for health report: ${error.message}`);
            return { ok: false, error: error.message };
        }

        if (!data || data.length === 0) {
            // No workspaces configured yet
            return { ok: true, message: "No registered workspaces found for this integration." };
        }

        const promises = data.map((row) =>
            recordBusinessIntegrationHealthCheck({
                workspaceId: row.workspace_id,
                provider: params.provider,
                integrationKey: params.integrationKey,
                status: params.status,
                latencyMs: params.latencyMs,
                statusCode: params.statusCode,
                message: params.message,
                errorCode: params.errorCode,
                details: params.details,
                checkedAt,
            })
        );

        await Promise.all(promises);
        return { ok: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[health-evidence] unexpected error reporting health: ${message}`);
        return { ok: false, error: message };
    }
}
