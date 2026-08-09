import { NextResponse } from "next/server";
import { validateWorkflowRulePreview } from "@/features/business-spine/workflow-engine";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";

export async function POST(req: Request) {
    try {
        // We require workflow.read at minimum to preview, but practically it's for workflow.manage
        // since we are previewing rules before save. Let's require automations access.
        const state = await requireDashboardModuleAccess("automations");
        if (state.role !== "admin" && !state.capabilities.includes("workflow.manage")) {
            return NextResponse.json({ error: "Missing workflow.manage capability." }, { status: 403 });
        }

        const body = await req.json();

        if (!body || typeof body !== "object") {
            return NextResponse.json({ error: "Invalid request payload. Must be a JSON object." }, { status: 400 });
        }

        const { triggerKey, conditionJson, actionJson, samplePayload } = body;

        if (typeof triggerKey !== "string") {
            return NextResponse.json({ error: "triggerKey must be a string." }, { status: 400 });
        }

        const preview = validateWorkflowRulePreview({
            triggerKey,
            conditionJson,
            actionJson,
            samplePayload: typeof samplePayload === "object" && samplePayload !== null ? samplePayload as Record<string, unknown> : undefined,
            sampleSourceModule: "dashboard",
        });

        return NextResponse.json(preview);
    } catch (error) {
        console.error("Workflow preview endpoint error:", error);
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
