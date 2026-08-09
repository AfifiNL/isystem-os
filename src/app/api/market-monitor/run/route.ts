import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/shared/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { runMarketMonitorScan } from "@/features/market-monitor/lib/monitor";

export const maxDuration = 120;

function getCronSecrets(): string[] {
    return [process.env.MARKET_MONITOR_CRON_SECRET, process.env.CRON_SECRET]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));
}

function isValidCronSecret(candidate: string | null): boolean {
    if (!candidate) return false;

    const candidateBuffer = Buffer.from(candidate);
    return getCronSecrets().some((secret) => {
        const secretBuffer = Buffer.from(secret);
        if (candidateBuffer.length !== secretBuffer.length) return false;
        return timingSafeEqual(candidateBuffer, secretBuffer);
    });
}

function isAuthorizedCronRequest(req: NextRequest): boolean {
    const authorization = req.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return false;
    return isValidCronSecret(authorization.slice("Bearer ".length).trim());
}

function getDefaultWorkspaceId(): string | null {
    return process.env.MARKET_MONITOR_WORKSPACE_ID?.trim() || null;
}

async function executeMarketMonitorScan(workspaceId: string) {
    if (!process.env.TAVILY_API_KEY) {
        return NextResponse.json({ error: "TAVILY_API_KEY is not configured" }, { status: 503 });
    }

    try {
        const summary = await runMarketMonitorScan(workspaceId);
        return NextResponse.json(summary);
    } catch (error) {
        console.error("[market-monitor] scan error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Scan failed" },
            { status: 500 },
        );
    }
}

export async function GET(req: NextRequest) {
    if (!isAuthorizedCronRequest(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.TAVILY_API_KEY) {
        return NextResponse.json({ error: "TAVILY_API_KEY is not configured" }, { status: 503 });
    }

    // Cron fan-out: scan every workspace that has an enabled monitor config.
    // The previous implementation pulled a single workspace id from
    // MARKET_MONITOR_WORKSPACE_ID, which meant any new Pro client never got
    // cron-triggered scans unless that env was updated per-client. The
    // monitor config table is itself the entitlement signal — if it's there
    // and enabled, scan it.
    const fallbackWorkspaceId = getDefaultWorkspaceId();
    const supabase = await createClient();
    const { data: configs, error: configError } = await (supabase as unknown as {
        from: (t: string) => {
            select: (c: string) => {
                eq: (c: string, v: boolean) => Promise<{ data: Array<{ workspace_id: string }> | null; error: { message: string } | null }>;
            };
        };
    })
        .from("workspace_market_monitor_config")
        .select("workspace_id")
        .eq("enabled", true);

    if (configError) {
        // If the table read fails, fall back to the single-workspace env so
        // we don't silently drop the entire cron sweep.
        if (!fallbackWorkspaceId) {
            return NextResponse.json({ error: `Could not list monitor configs: ${configError.message}` }, { status: 500 });
        }
        return executeMarketMonitorScan(fallbackWorkspaceId);
    }

    const workspaceIds = Array.from(new Set([
        ...(configs ?? []).map((c) => c.workspace_id),
        ...(fallbackWorkspaceId ? [fallbackWorkspaceId] : []),
    ]));

    if (workspaceIds.length === 0) {
        return NextResponse.json({ scanned: 0, results: [] });
    }

    const results = await Promise.all(
        workspaceIds.map(async (id) => {
            try {
                const summary = await runMarketMonitorScan(id);
                return { workspace_id: id, ok: true as const, summary };
            } catch (error) {
                console.error("[market-monitor] scan error:", id, error);
                return {
                    workspace_id: id,
                    ok: false as const,
                    error: error instanceof Error ? error.message : "Scan failed",
                };
            }
        }),
    );

    return NextResponse.json({ scanned: results.length, results });
}

export async function POST(req: NextRequest) {
    const cronAuthorized = isAuthorizedCronRequest(req);

    if (!cronAuthorized) {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const state = await getAdminDashboardState();
        if (!state) {
            return NextResponse.json(
                { error: "Unauthorized: admin or workspace manager access required" },
                { status: 403 },
            );
        }

        let requestedWorkspaceId: string | null = null;
        try {
            const body = await req.json();
            requestedWorkspaceId =
                typeof body.workspace_id === "string" && body.workspace_id ? body.workspace_id : null;
        } catch {
            // User-triggered scans default to the caller's active dashboard workspace.
        }

        if (requestedWorkspaceId && requestedWorkspaceId !== state.workspace.id) {
            return NextResponse.json(
                { error: "workspace_id must match the active dashboard workspace" },
                { status: 403 },
            );
        }

        return executeMarketMonitorScan(state.workspace.id);
    }

    let workspaceId: string | null = null;
    try {
        const body = await req.json();
        workspaceId = typeof body.workspace_id === "string" && body.workspace_id ? body.workspace_id : null;
    } catch {
        if (!cronAuthorized) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
    }

    workspaceId ||= getDefaultWorkspaceId();
    if (!workspaceId) {
        return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
    }

    return executeMarketMonitorScan(workspaceId);
}
