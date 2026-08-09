import { getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { assertWorkspaceAiEnabled, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { createClient } from "@/shared/lib/supabase/server";

export function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
        return (error as { message: string }).message;
    }

    return fallback;
}

export function asObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

export async function getSeoWorkspaceContext() {
    const context = await resolveWorkspaceContext();
    if (!context?.activeWorkspace) {
        throw new Error("No active workspace session found.");
    }

    return {
        ...context,
        activeWorkspace: context.activeWorkspace,
    };
}

export async function requireSeoExecutionAccess(mode: "read" | "write" = "read") {
    // Pro-tier gate first — SEO Control Center is Pro-only. Without this,
    // a basic-tier manager hitting these server actions directly (via curl,
    // a future client-side route, or any non-UI entry point) would bypass
    // the dashboard's UI paywall. assertWorkspaceAiEnabled throws when the
    // workspace isn't entitled, which is the right shape for a server
    // action gate.
    await assertWorkspaceAiEnabled();

    const [dashboardState, context, supabase] = await Promise.all([
        getAdminDashboardState(),
        getSeoWorkspaceContext(),
        createClient(),
    ]);

    if (!dashboardState || (dashboardState.role !== "admin" && dashboardState.role !== "manager")) {
        throw new Error("Unauthorized: SEO execution is restricted to admins and managers.");
    }

    const requiredCapability = mode === "write" ? "content.write" : "content.read";
    if (dashboardState.role !== "admin" && !dashboardState.capabilities.includes(requiredCapability)) {
        throw new Error(`Unauthorized: missing ${requiredCapability} capability for SEO execution.`);
    }

    const { data: userResult } = await supabase.auth.getUser();

    return {
        dashboardState,
        context,
        supabase,
        userId: userResult.user?.id ?? null,
    };
}
