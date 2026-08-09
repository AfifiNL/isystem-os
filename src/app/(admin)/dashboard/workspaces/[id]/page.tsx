import { notFound } from "next/navigation";
import { getWorkspaceById, getAllWorkspaces } from "@/features/admin/actions/workspaces";
import {
    getManagerProfilesForWorkspace,
    getWorkspaceManagerAssignments,
} from "@/features/admin/actions/workspace-managers";
import { getWorkspaceThemeVersions } from "@/features/admin/actions/workspace-theme";
import { getWorkspaceAiSnapshot } from "@/features/admin/actions/ai-balance";
import { getActiveThemeVersion } from "@/shared/lib/workspace/context";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { WorkspaceDetailForm } from "@/features/admin/ui/workspace-detail-form";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AdminWorkspaceDetailPage({ params }: PageProps) {
    await requireDashboardModuleAccess("admin-workspaces");

    // params is a Promise in Next 15+ 
    const { id } = await params;

    const { data: workspace, error: workspaceError } = await getWorkspaceById(id);
    if (workspaceError || !workspace) {
        notFound();
    }

    const [
        { data: allWorkspaces },
        { data: themeVersions },
        { data: assignments },
        { data: managerProfiles },
        activeTheme,
        aiSnapshot,
    ] = await Promise.all([
        getAllWorkspaces(),
        getWorkspaceThemeVersions(workspace.id),
        getWorkspaceManagerAssignments(workspace.id),
        getManagerProfilesForWorkspace(workspace.id),
        getActiveThemeVersion(workspace.id),
        getWorkspaceAiSnapshot(workspace.id),
    ]);

    const accessibleWorkspaces = ((allWorkspaces ?? []) as Array<{ id: string; name: string }>).map(w => ({ id: w.id, name: w.name }));

    const mappedActiveTheme = activeTheme ? {
        id: activeTheme.id,
        themeKey: activeTheme.theme_key,
        themeName: activeTheme.theme_name,
        version: activeTheme.version,
        status: activeTheme.status,
    } : null;

    return (
        <WorkspaceDetailForm
            workspace={workspace}
            aiSnapshot={aiSnapshot}
            activeTheme={mappedActiveTheme}
            themeVersions={themeVersions ?? []}
            managerAssignments={assignments ?? []}
            managerProfiles={managerProfiles ?? []}
            accessibleWorkspaces={accessibleWorkspaces}
        />
    );
}
