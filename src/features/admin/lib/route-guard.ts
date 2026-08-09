import { redirect } from "next/navigation";
import { canAccessDashboardModule, getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { getCurrentUserRole, resolveWorkspaceContext } from "@/shared/lib/workspace/context";

export async function requireAdminDashboardState() {
    const state = await getAdminDashboardState();

    if (!state) {
        const roleContext = await getCurrentUserRole();
        const workspaceContext = roleContext?.role === "admin"
            ? await resolveWorkspaceContext()
            : null;

        if (roleContext?.role === "admin" && (workspaceContext?.accessibleWorkspaces.length ?? 0) === 0) {
            redirect("/setup/workspace");
        }

        redirect("/login");
    }

    return state;
}

export async function requireDashboardModuleAccess(moduleKey: string) {
    const state = await requireAdminDashboardState();

    if (!canAccessDashboardModule(state, moduleKey)) {
        redirect(`/dashboard?denied=${encodeURIComponent(moduleKey)}`);
    }

    return state;
}
