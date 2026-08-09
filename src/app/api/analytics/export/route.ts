import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsExportRows } from "@/features/analytics/actions";
import { formatAnalyticsExportCsv, parseAnalyticsExportMode } from "@/features/analytics/export";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";

export async function GET(req: NextRequest) {
    const requestedWorkspaceId = req.nextUrl.searchParams.get("workspaceId")?.trim() || undefined;
    const days = Number.parseInt(req.nextUrl.searchParams.get("days") || "30", 10) || 30;
    const mode = parseAnalyticsExportMode(req.nextUrl.searchParams.get("mode"));
    const context = await resolveWorkspaceContext(
        requestedWorkspaceId ? { workspaceId: requestedWorkspaceId } : {}
    );

    if (!context || !context.activeWorkspace) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (requestedWorkspaceId && !context.accessibleWorkspaces.some((workspace) => workspace.id === requestedWorkspaceId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await getAnalyticsExportRows({ workspaceId: context.activeWorkspace.id, days, mode });

    if (result.error || !result.data) {
        return NextResponse.json({ error: result.error || "Failed to export analytics." }, { status: 500 });
    }

    const csv = formatAnalyticsExportCsv(result.data);

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename=analytics-export-${mode}-${days}d.csv`,
        },
    });
}
