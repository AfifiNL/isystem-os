import { notFound } from "next/navigation";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { fetchAvailableProfiles, fetchBookingsForPortalClient, fetchPortalClientById } from "@/features/portal/actions/facility-operations-actions";
import { ClientManagementDetail } from "@/features/portal/ui/client-management-detail";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";

interface ClientPageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClientPageProps) {
    const { id } = await params;

    return {
        title: `Client Management — ${id.slice(0, 8)} | Admin`,
    };
}

export default async function ClientDetailPage({ params }: ClientPageProps) {
    const { id } = await params;
    const state = await requireAdminDashboardState();

    if (state.role !== "admin" && state.role !== "manager") {
        return null;
    }

    if (state.workspace.workspace_tier === "basic") {
        return (
            <DashboardAppWorkbench>
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                    <div>
                        <h1 className="text-[33px] font-bold tracking-tight">Client Management</h1>
                        <p className="mt-2 text-muted-foreground text-[17px]">
                            Detailed client account context, profile linkage, and SLA continuity is available on Pro.
                        </p>
                    </div>

                    <ProFeatureNotice
                        title="Detailed client operations requires Pro"
                        description="Unlock the dedicated client console to manage account ownership and jump into SLA detail from the same operational flow."
                        ctaLabel="Activate Pro for Client Management"
                        benefits={[
                            "Open dedicated client account consoles.",
                            "Edit linkage and company account details.",
                            "Keep SLA follow-up connected to the right client context.",
                        ]}
                    />
                </div>
            </DashboardAppWorkbench>
        );
    }

    const [clientResult, profilesResult, bookingsResult] = await Promise.all([
        fetchPortalClientById(id),
        fetchAvailableProfiles(),
        fetchBookingsForPortalClient(id, 5),
    ]);

    if (clientResult.error === "Client not found") {
        notFound();
    }

    if (!clientResult.data) {
        return (
            <DashboardAppWorkbench>
                <div className="p-4">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-5 text-[17px] text-destructive">
                        {clientResult.error ?? "Failed to load client detail."}
                    </div>
                </div>
            </DashboardAppWorkbench>
        );
    }

    if (profilesResult.error) {
        return (
            <DashboardAppWorkbench>
                <div className="p-4">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-5 text-[17px] text-destructive">
                        {profilesResult.error}
                    </div>
                </div>
            </DashboardAppWorkbench>
        );
    }

    return (
        <DashboardAppWorkbench>
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
                <ClientManagementDetail
                    client={clientResult.data}
                    profiles={profilesResult.data ?? []}
                    recentBookings={bookingsResult.data}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
