import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { getWorkspaceCommercialSummary } from "@/features/business-spine/commercial-summary";
import { AppCommandBar, DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import { RefreshCcw, FileText, CreditCard, Activity } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Commercial Ops",
};

export default async function CommercialOpsPage() {
    const state = await requireDashboardModuleAccess("commercial-ops");
    const summary = await getWorkspaceCommercialSummary(state.workspace.id);

    return (
        <DashboardAppWorkbench>
            <AppCommandBar
                leading={<h1 className="text-[17px] font-semibold text-foreground">Commercial Ops</h1>}
                actions={
                    <Link
                        href="/dashboard/commercial-ops"
                        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Refresh
                    </Link>
                }
            />

            <div className="flex-1 overflow-auto bg-muted/10 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-8">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Commercial Overview</h2>
                        <p className="text-[15px] text-muted-foreground mt-1">
                            Aggregate metrics from active workspace commercial links and legal invoices.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                    <Activity className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground">Total Commercial Links</h3>
                            </div>
                            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{summary.totalCommercialLinks}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground">Invoice Links</h3>
                            </div>
                            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{summary.activeInvoiceLinks}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground">Payment Links</h3>
                            </div>
                            <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{summary.activePaymentLinks}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="border-b border-border bg-muted/30 px-6 py-4">
                            <h3 className="font-semibold text-foreground">Recent Commercial Links</h3>
                        </div>
                        {summary.recentLinks.length === 0 ? (
                            <div className="p-8 text-center text-sm text-muted-foreground">No commercial links found.</div>
                        ) : (
                            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                            <table className="min-w-[44rem] w-full text-left text-sm md:min-w-0">
                                <thead className="border-b border-border bg-muted/10 text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Link Type</th>
                                        <th className="px-6 py-3 font-medium">Record Type</th>
                                        <th className="px-6 py-3 font-medium">Record Ref</th>
                                        <th className="px-6 py-3 font-medium">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {summary.recentLinks.map((link) => (
                                        <tr key={link.id} className="hover:bg-muted/50">
                                            <td className="px-6 py-4 font-medium text-foreground">{link.linkType}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{link.linkedRecordType}</td>
                                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{link.linkedRecordRef ?? "—"}</td>
                                            <td className="px-6 py-4 text-muted-foreground" suppressHydrationWarning>
                                                {link.createdAt && !isNaN(new Date(link.createdAt).getTime())
                                                    ? formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })
                                                    : "Unknown"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}
