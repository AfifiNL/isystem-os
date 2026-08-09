import Link from "next/link";
import { ArrowRight, Briefcase, Mail, Phone, UserRoundCheck } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listBusinessCustomers } from "@/features/business-spine/service";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
    AppQueueTable,
    AppRecordCard,
    AppSectionHeader
} from "@/features/admin/ui/app-workbench";
import { Button } from "@/shared/ui/button";

export const metadata = {
    title: "Customers | Admin",
    description: "Customer operating view for records, status, ownership, and follow-up.",
};

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export default async function CustomersPage() {
    const state = await requireDashboardModuleAccess("customers");
    const customers = await listBusinessCustomers(state.workspace.id);
    const active = customers.filter((customer) => customer.lifecycleStatus === "customer" || customer.lifecycleStatus === "active").length;
    const leads = customers.filter((customer) => ["prospect", "lead", "qualified"].includes(customer.lifecycleStatus)).length;

    const tableHeaders = (
        <tr className="border-b border-border/50 text-[13px]">
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Identity</th>
            <th className="px-3 py-2 w-36">Lifecycle</th>
            <th className="px-3 py-2 w-28">Portal</th>
            <th className="px-3 py-2 w-44">Updated</th>
            <th className="px-3 py-2 w-16 text-right" />
        </tr>
    );

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                    <Button size="xs" variant="outline" asChild className="cursor-pointer">
                        <Link href="/dashboard/work">
                            Open Work Queue
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>
            </AppCommandBar>

            <AppMetricStrip>
                <AppMetric label="Total Customers" value={customers.length} icon={UserRoundCheck} />
                <AppMetric label="Active Lifecycle" value={active} icon={Briefcase} variant="success" />
                <AppMetric label="Leads &amp; Prospects" value={leads} icon={Mail} />
            </AppMetricStrip>

            <AppFeedbackLoop
                title="Customer lifecycle loop"
                description="Identity and lifecycle signals become a next action, then feed the next relationship decision."
                stages={[
                    { label: "Records", value: customers.length, detail: "known contacts", tone: "info" },
                    { label: "Leads", value: leads, detail: "qualification queue", tone: leads > 0 ? "warning" : "default" },
                    { label: "Active", value: active, detail: "current customers", tone: active > 0 ? "success" : "default" },
                    { label: "Portal", value: customers.filter((customer) => customer.portalClientId).length, detail: "linked context", tone: "info" },
                ]}
                feedbackLabel="Lifecycle movement and portal linkage should change the next work item, owner, or renewal action."
            />

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                <AppSectionHeader
                    title="Customer Records"
                    description={`Unified customer spine for ${state.workspace.name}: contact identity, lifecycle, portal linkage, timeline, work, and commercial context.`}
                />

                <AppQueueTable
                    headers={tableHeaders}
                    empty={customers.length === 0}
                    emptyText="No Business OS customer records yet. New signals will populate this spine."
                    mobileCards={customers.map((customer) => (
                        <AppRecordCard key={customer.id}>
                            <div className="flex min-w-0 items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link href={`/dashboard/customers/${customer.id}`} className="block truncate font-semibold text-foreground">
                                        {customer.displayName}
                                    </Link>
                                    <p className="mt-1 text-[13px] capitalize text-muted-foreground">
                                        {customer.lifecycleStatus.replace(/_/g, " ")} · {customer.portalClientId ? "portal linked" : "no portal"}
                                    </p>
                                </div>
                                <Button size="xs" variant="ghost" asChild className="h-7 shrink-0 cursor-pointer text-[13px]">
                                    <Link href={`/dashboard/customers/${customer.id}`}>Open</Link>
                                </Button>
                            </div>
                            <div className="mt-3 grid gap-1.5 text-[13px] text-muted-foreground">
                                {customer.primaryEmail ? <span className="inline-flex min-w-0 items-center gap-1"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{customer.primaryEmail}</span></span> : null}
                                {customer.primaryPhone ? <span className="inline-flex min-w-0 items-center gap-1"><Phone className="h-3 w-3 shrink-0" /><span className="truncate">{customer.primaryPhone}</span></span> : null}
                                {!customer.primaryEmail && !customer.primaryPhone ? <span>No direct contact</span> : null}
                                <span>Updated {formatDate(customer.updatedAt)}</span>
                            </div>
                        </AppRecordCard>
                    ))}
                >
                    {customers.map((customer) => (
                        <tr key={customer.id} className="border-b border-border/30 hover:bg-muted/30">
                            <td className="px-3 py-2.5 font-medium text-foreground">{customer.displayName}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                                <div className="flex flex-col gap-1 text-[13px]">
                                    {customer.primaryEmail ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{customer.primaryEmail}</span> : null}
                                    {customer.primaryPhone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{customer.primaryPhone}</span> : null}
                                    {!customer.primaryEmail && !customer.primaryPhone ? "No direct contact" : null}
                                </div>
                            </td>
                            <td className="px-3 py-2.5 capitalize text-muted-foreground text-[13px]">{customer.lifecycleStatus.replace(/_/g, " ")}</td>
                            <td className="px-3 py-2.5 text-muted-foreground text-[13px]">{customer.portalClientId ? "Linked" : "Not linked"}</td>
                            <td className="px-3 py-2.5 text-muted-foreground text-[13px]">{formatDate(customer.updatedAt)}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                <Button size="xs" variant="ghost" asChild className="h-7 cursor-pointer text-[13px]">
                                    <Link href={`/dashboard/customers/${customer.id}`}>
                                        Open
                                    </Link>
                                </Button>
                            </td>
                        </tr>
                    ))}
                </AppQueueTable>
            </div>
        </DashboardAppWorkbench>
    );
}
