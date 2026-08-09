import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { getDuplicateCandidates } from "@/features/business-spine/service";
import { CustomerMergeQueue } from "@/features/business-spine/ui/customer-merge-queue";
import { AppCommandBar, DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import { RefreshCcw } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ResolutionQueuePage() {
    const state = await requireDashboardModuleAccess("customers");
    const candidates = await getDuplicateCandidates(state.workspace.id);

    return (
        <DashboardAppWorkbench>
            <AppCommandBar
                leading={<h1 className="text-[17px] font-semibold text-foreground">Identity Resolution</h1>}
                actions={
                    <Link
                        href="/dashboard/customers/resolution"
                        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Link>
                }
            />

            <div className="flex-1 overflow-auto bg-muted/10 p-6 lg:p-8">
                <div className="mx-auto max-w-4xl space-y-8">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Identity Resolution Queue</h2>
                        <p className="text-[15px] text-muted-foreground mt-1">
                            Review and merge customer records that share the same email address or portal client ID.
                            Merging will safely migrate timeline events, work items, and commercial links.
                        </p>
                    </div>

                    <CustomerMergeQueue candidates={candidates} />
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}
