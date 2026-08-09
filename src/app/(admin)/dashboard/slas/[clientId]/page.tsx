import { notFound } from "next/navigation";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import {
    fetchAvailableProfiles,
    fetchPortalClientById
} from "@/features/portal/actions/facility-operations-actions";
import { SlaOpsDashboard } from "@/features/portal/ui/sla-ops-dashboard";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";

interface PageProps {
    params: Promise<{ clientId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { clientId } = await params;
    return { title: `SLA Operations — ${clientId.slice(0, 8)} | Admin` };
}

export default async function ClientSlaOpsPage({ params }: PageProps) {
    const { clientId } = await params;
    const state = await requireAdminDashboardState();

    if (state.workspace.workspace_tier === "basic") {
        notFound();
    }

    const [
        { data: client, error: clientError },
        { data: profiles, error: profilesError }
    ] = await Promise.all([
        fetchPortalClientById(clientId),
        fetchAvailableProfiles()
    ]);

    if (clientError === "Client not found" || !client) {
        notFound();
    }

    if (clientError || profilesError) {
        return (
            <DashboardAppWorkbench>
                <div className="p-4">
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-[17px] text-destructive">
                        {clientError || profilesError}
                    </div>
                </div>
            </DashboardAppWorkbench>
        );
    }

    return (
        <DashboardAppWorkbench>
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
                <SlaOpsDashboard client={client} profiles={profiles ?? []} />
            </div>
        </DashboardAppWorkbench>
    );
}
