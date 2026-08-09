import { createAdminClient } from "../../src/shared/lib/supabase/admin";
import { recordBusinessIntegrationHealthCheck } from "../../src/features/business-spine/integrations";

type CronHealthStatus = "healthy" | "degraded" | "failing" | "unknown" | "disabled";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unique(values: Array<string | null | undefined>) {
    return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

async function workspaceIdsFromSlugs(slugs: string[]) {
    if (slugs.length === 0) return [];
    try {
        const supabase = createAdminClient();
        const { data, error } = await (supabase.from("workspaces" as never) as unknown as {
            select: (columns: string) => {
                in: (column: string, values: string[]) => Promise<{ data: Array<{ id: string; slug: string | null }> | null; error: { message: string } | null }>;
            };
        }).select("id,slug").in("slug", slugs);
        if (error) {
            console.warn(JSON.stringify({
                event: "cron_health_workspace_lookup_failed",
                ok: false,
                error: error.message,
            }));
            return [];
        }
        return (data ?? []).map((row) => row.id).filter(Boolean);
    } catch (error) {
        console.warn(JSON.stringify({
            event: "cron_health_workspace_lookup_failed",
            ok: false,
            error: error instanceof Error ? error.message : "Workspace lookup failed",
        }));
        return [];
    }
}

export async function resolveCronHealthWorkspaceIds(input?: {
    workspaceIds?: Array<string | null | undefined>;
    workspaceSlugs?: Array<string | null | undefined>;
}) {
    const explicitIds = unique([
        ...(input?.workspaceIds ?? []),
        process.env.CRON_HEALTH_WORKSPACE_ID,
        process.env.BUSINESS_HEALTH_WORKSPACE_ID,
        process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID,
    ]).filter((value) => UUID_RE.test(value));

    if (explicitIds.length > 0) return explicitIds;

    const slugs = unique([
        ...(input?.workspaceSlugs ?? []),
        process.env.CRON_HEALTH_WORKSPACE_SLUG,
        process.env.BUSINESS_HEALTH_WORKSPACE_SLUG,
        process.env.NEXT_PUBLIC_WORKSPACE_SLUG,
    ]);
    return workspaceIdsFromSlugs(slugs);
}

export async function recordCronWrapperHealth(input: {
    provider?: string;
    integrationKey: string;
    status: CronHealthStatus;
    message: string;
    latencyMs?: number | null;
    statusCode?: number | null;
    errorCode?: string | null;
    details?: Record<string, unknown>;
    workspaceIds?: Array<string | null | undefined>;
    workspaceSlugs?: Array<string | null | undefined>;
}) {
    const workspaceIds = await resolveCronHealthWorkspaceIds({
        workspaceIds: input.workspaceIds,
        workspaceSlugs: input.workspaceSlugs,
    });

    if (workspaceIds.length === 0) {
        console.warn(JSON.stringify({
            event: "cron_health_skipped",
            ok: false,
            integration_key: input.integrationKey,
            reason: "No workspace resolved for cron health check.",
        }));
        return { ok: false, error: "No workspace resolved." };
    }

    const results = await Promise.all(workspaceIds.map((workspaceId) => recordBusinessIntegrationHealthCheck({
        workspaceId,
        provider: input.provider ?? "cron",
        integrationKey: input.integrationKey,
        status: input.status,
        latencyMs: input.latencyMs ?? null,
        statusCode: input.statusCode ?? null,
        message: input.message,
        errorCode: input.errorCode ?? null,
        details: {
            wrapper: true,
            ...(input.details ?? {}),
        },
    })));

    const failed = results.find((result) => !result.ok);
    return failed ?? { ok: true, error: null };
}
