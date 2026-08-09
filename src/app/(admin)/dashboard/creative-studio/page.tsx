import { getAdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { loadCreativeStudioDashboard } from "@/features/creative-studio/actions";
import { CreativeStudioShell, CreativeStudioUnavailable } from "@/features/creative-studio/ui/creative-studio-shell";

export default async function CreativeStudioDashboardPage() {
    const state = await getAdminDashboardState();
    const creativeStudioModule = state?.modules.find((module) => module.key === "creative-studio");

    if (state?.workspace.workspace_tier === "basic" || creativeStudioModule?.lockedReason === "pro") {
        return <CreativeStudioUnavailable reason="Creative Studio is a Pro module. Basic workspaces can see the locked shell, but server-side Creative Studio records stay unread." />;
    }

    await requireDashboardModuleAccess("creative-studio");
    const result = await loadCreativeStudioDashboard();

    if (!result.ok) {
        return <CreativeStudioUnavailable reason={result.error} />;
    }

    return <CreativeStudioShell data={result.data} />;
}
