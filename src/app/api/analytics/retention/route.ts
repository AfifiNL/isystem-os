import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

type RetentionSettingsRow = {
    workspace_id: string;
    analytics_retention_days: number | null;
    logs_retention_days: number | null;
};

type WorkspaceRow = {
    id: string;
};

function isAuthorized(req: NextRequest) {
    const internalSecret = process.env.ANALYTICS_RETENTION_SECRET?.trim();
    const authHeader = req.headers.get("authorization") ?? "";

    return Boolean(internalSecret && authHeader === `Bearer ${internalSecret}`);
}

function retentionDays(value: number | null | undefined, fallback: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.max(1, Math.min(3650, Math.trunc(value)));
}

export async function POST(req: NextRequest) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
        return NextResponse.json({ error: "Retention route is not configured." }, { status: 503 });
    }

    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const [{ data: workspaceRows, error: workspaceError }, { data: settingsRows, error: settingsError }] = await Promise.all([
        admin
            .from("workspaces")
            .select("id")
            .eq("is_active", true),
        admin
            .from("workspace_gdpr_settings")
            .select("workspace_id,analytics_retention_days,logs_retention_days"),
    ]);

    if (workspaceError || settingsError) {
        return NextResponse.json(
            { error: workspaceError?.message ?? settingsError?.message ?? "Failed to load retention settings." },
            { status: 500 },
        );
    }

    const settingsByWorkspace = new Map(
        ((settingsRows ?? []) as RetentionSettingsRow[]).map((settings) => [settings.workspace_id, settings]),
    );

    const summaries = [];
    for (const workspace of (workspaceRows ?? []) as WorkspaceRow[]) {
        const workspaceId = workspace.id;
        const settings = settingsByWorkspace.get(workspaceId);
        const analyticsCutoff = new Date(
            Date.now() - retentionDays(settings?.analytics_retention_days, 365) * 24 * 60 * 60 * 1000,
        ).toISOString();
        const logsCutoff = new Date(
            Date.now() - retentionDays(settings?.logs_retention_days, 90) * 24 * 60 * 60 * 1000,
        ).toISOString();

        const [eventsResult, logsResult] = await Promise.all([
            admin
                .from("analytics_events")
                .delete({ count: "exact" })
                .eq("workspace_id", workspaceId)
                .lt("created_at", analyticsCutoff),
            admin
                .from("analytics_ingestion_logs")
                .delete({ count: "exact" })
                .eq("workspace_id", workspaceId)
                .lt("created_at", logsCutoff),
        ]);

        if (eventsResult.error || logsResult.error) {
            return NextResponse.json(
                {
                    error: eventsResult.error?.message ?? logsResult.error?.message ?? "Retention pruning failed.",
                    workspaceId,
                },
                { status: 500 },
            );
        }

        summaries.push({
            workspaceId,
            analyticsCutoff,
            logsCutoff,
            analyticsEventsDeleted: eventsResult.count ?? 0,
            ingestionLogsDeleted: logsResult.count ?? 0,
        });
    }

    // There is no general-purpose compliance audit table for analytics retention.
    // Do not overload Legal Vault's `legal_audit_events`; keep the worker output
    // structured for scheduler logs until a dedicated compliance ledger exists.
    console.info("[analytics.retention] completed", { workspaces: summaries.length, summaries });

    return NextResponse.json({ ok: true, workspaces: summaries.length, summaries });
}
