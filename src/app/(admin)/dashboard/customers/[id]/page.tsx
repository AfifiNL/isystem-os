import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, CreditCard, FileSignature, Link2, ReceiptText, UserRoundCheck } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { getBusinessCustomerDetail, listBusinessAssignees } from "@/features/business-spine/service";
import {
    assignBusinessCustomerOwnerFormAction,
    addBusinessCustomerNoteFormAction,
    transitionBusinessCustomerLifecycleFormAction,
} from "@/features/business-spine/actions";
import { BUSINESS_LIFECYCLE_STATUSES } from "@/features/business-spine/account-record";
import { getClientAgreementSummary } from "@/features/legal-vault/actions/integrations";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppMetricStrip,
    AppMetric,
    AppSectionHeader
} from "@/features/admin/ui/app-workbench";
import { Button } from "@/shared/ui/button";

export const metadata = {
    title: "Customer Detail | Admin",
    description: "Unified customer timeline, work, legal, and commercial context.",
};

function formatDate(value: string | null) {
    if (!value) return "Not set";
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function formatDiagnosticValue(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") return "Not set";
    return String(value);
}

function formatCountMap(counts: Record<string, number>) {
    const entries = Object.entries(counts);
    if (entries.length === 0) return "0";
    return entries.map(([type, count]) => `${type.replace(/_/g, " ")}: ${count}`).join(" · ");
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const [{ id }, state] = await Promise.all([params, requireDashboardModuleAccess("customers")]);
    const [detail, assignees] = await Promise.all([
        getBusinessCustomerDetail(state.workspace.id, id),
        listBusinessAssignees(state.workspace.id),
    ]);
    if (!detail) notFound();

    const legalSummary = detail.customer.portalClientId
        ? await getClientAgreementSummary(detail.customer.portalClientId).catch(() => null)
        : null;
    const latestSourceEvent = detail.timeline[0] ?? null;
    const commercialSummary = detail.commercialSummary;

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex items-center gap-3">
                    <Button size="xs" variant="ghost" asChild className="cursor-pointer">
                        <Link href="/dashboard/customers" className="flex items-center gap-1.5 text-[15px]">
                            <ArrowLeft className="h-4 w-4" />
                            <span>Customers</span>
                        </Link>
                    </Button>
                    <span className="text-[15px] text-muted-foreground">/</span>
                    <span className="text-[15px] font-bold text-foreground">{detail.customer.displayName}</span>
                </div>
                <Button size="xs" variant="outline" asChild className="cursor-pointer">
                    <Link href="/dashboard/work">
                        Open Work Queue
                    </Link>
                </Button>
            </AppCommandBar>

            <AppMetricStrip>
                <AppMetric
                    label="Customer Identity"
                    value={detail.customer.primaryEmail ? "Active Email" : "No Email"}
                    icon={UserRoundCheck}
                    description={detail.customer.primaryEmail ?? undefined}
                />
                <AppMetric label="Open Work" value={detail.openWorkItems.length} icon={Briefcase} variant={detail.openWorkItems.length > 0 ? "warning" : "default"} />
                <AppMetric label="Legal Agreements" value={legalSummary?.success ? legalSummary.data.total : 0} icon={FileSignature} />
                <AppMetric label="Commercial Links" value={commercialSummary.totalCommercialLinks} icon={Link2} />
            </AppMetricStrip>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                <AppSectionHeader
                    title={detail.customer.displayName}
                    description={`Lifecycle Status: ${detail.customer.lifecycleStatus.replace(/_/g, " ")}`}
                />

                <div className="grid gap-4 lg:grid-cols-3">
                    <form action={transitionBusinessCustomerLifecycleFormAction} className="rounded-md border border-border/60 bg-card/40 p-4">
                        <input type="hidden" name="customerId" value={detail.customer.id} />
                        <label className="block text-[13px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="customer-lifecycle-status">Lifecycle</label>
                        <select
                            id="customer-lifecycle-status"
                            name="lifecycleStatus"
                            defaultValue={detail.customer.lifecycleStatus}
                            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-[15px] capitalize text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {BUSINESS_LIFECYCLE_STATUSES.map((status) => (
                                <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                            ))}
                        </select>
                        <Button type="submit" size="sm" className="mt-3 w-full cursor-pointer">Save lifecycle</Button>
                    </form>

                    <form action={assignBusinessCustomerOwnerFormAction} className="rounded-md border border-border/60 bg-card/40 p-4">
                        <input type="hidden" name="customerId" value={detail.customer.id} />
                        <label className="block text-[13px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="customer-owner-profile-id">Owner</label>
                        <select
                            id="customer-owner-profile-id"
                            name="ownerProfileId"
                            defaultValue={detail.customer.ownerProfileId ?? ""}
                            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-[15px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            <option value="">Unassigned</option>
                            {assignees.map((assignee) => (
                                <option key={assignee.profileId} value={assignee.profileId}>{assignee.email}</option>
                            ))}
                        </select>
                        <Button type="submit" size="sm" className="mt-3 w-full cursor-pointer">Save owner</Button>
                    </form>

                    <form action={addBusinessCustomerNoteFormAction} className="rounded-md border border-border/60 bg-card/40 p-4">
                        <input type="hidden" name="customerId" value={detail.customer.id} />
                        <label className="block text-[13px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="customer-note">Operator note</label>
                        <textarea
                            id="customer-note"
                            name="note"
                            rows={3}
                            required
                            maxLength={4000}
                            placeholder="Add internal customer context..."
                            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <Button type="submit" size="sm" className="mt-3 w-full cursor-pointer">Add note</Button>
                    </form>
                </div>

                <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
                    <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                        <h2 className="text-[15px] font-semibold text-foreground">Account Truth Diagnostics</h2>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            Read-only identity bridge: Customer Spine account record plus Partner Portal membership link when present.
                        </p>
                    </div>
                    <dl className="grid gap-px bg-border/30 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            ["Customer ID", detail.customer.id],
                            ["Portal client ID", detail.customer.portalClientId],
                            ["Source module", detail.customer.sourceModule],
                            ["Owner profile ID", detail.customer.ownerProfileId],
                            ["Latest source event", latestSourceEvent ? `${latestSourceEvent.eventType} · ${latestSourceEvent.sourceModule} · ${formatDate(latestSourceEvent.occurredAt)}` : null],
                            ["Commercial link counts", formatCountMap(commercialSummary.linkCountsByType)],
                        ].map(([label, value]) => (
                            <div key={label} className="bg-card/80 px-4 py-3">
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="mt-1 break-all font-mono text-[12px] text-foreground">{formatDiagnosticValue(value)}</dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
                    <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                        <h2 className="text-[15px] font-semibold text-foreground">Commercial Status</h2>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                            Read-only account-level status derived from Business Spine commercial links and invoice/payment timeline events. Revenue totals are intentionally omitted until source currency and amount semantics are safe to aggregate.
                        </p>
                    </div>
                    <div className="grid gap-px bg-border/30 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                        <div className="bg-card/80 px-4 py-3">
                            <div className="flex items-center gap-2 text-muted-foreground"><ReceiptText className="h-4 w-4" /> Invoice links</div>
                            <p className="mt-2 text-2xl font-bold text-foreground">{commercialSummary.invoiceLinkCount}</p>
                            <p className="mt-1 text-muted-foreground">Statuses: {formatCountMap(commercialSummary.invoiceStatusCounts)}</p>
                        </div>
                        <div className="bg-card/80 px-4 py-3">
                            <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-4 w-4" /> Payment links</div>
                            <p className="mt-2 text-2xl font-bold text-foreground">{commercialSummary.paymentLinkCount}</p>
                            <p className="mt-1 text-muted-foreground">Events: {formatCountMap(commercialSummary.paymentEventCounts)}</p>
                        </div>
                        <div className="bg-card/80 px-4 py-3 lg:col-span-2">
                            <div className="flex items-center gap-2 text-muted-foreground"><Link2 className="h-4 w-4" /> Last commercial activity</div>
                            <p className="mt-2 text-lg font-semibold text-foreground">{formatDate(commercialSummary.lastCommercialActivityAt)}</p>
                            <p className="mt-1 text-muted-foreground">Link types: {formatCountMap(commercialSummary.linkCountsByType)}</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[15px] font-semibold text-foreground">Timeline Event Log</h2>
                        </div>
                        <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
                            {detail.timeline.map((event) => (
                                <div key={event.id} className="px-4 py-3 text-[15px]">
                                    <p className="font-semibold text-foreground">{event.summary}</p>
                                    <p className="mt-1 text-[13px] text-muted-foreground">{event.eventType} · {event.sourceModule} · {formatDate(event.occurredAt)}</p>
                                    {event.body ? <p className="mt-1.5 text-muted-foreground">{event.body}</p> : null}
                                </div>
                            ))}
                            {detail.timeline.length === 0 ? <p className="px-4 py-4 text-muted-foreground text-center">No timeline events yet.</p> : null}
                        </div>
                    </div>

                    <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[15px] font-semibold text-foreground">Active Work Tasks</h2>
                        </div>
                        <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
                            {detail.openWorkItems.map((item) => (
                                <Link key={item.id} href={`/dashboard/work?item=${item.id}`} className="block px-4 py-3 hover:bg-muted/40 transition-colors text-[15px]">
                                    <p className="font-semibold text-foreground hover:underline">{item.title}</p>
                                    <p className="mt-1 text-[13px] capitalize text-muted-foreground">{item.status.replace(/_/g, " ")} · {item.priority} · due {formatDate(item.dueAt)}</p>
                                </Link>
                            ))}
                            {detail.openWorkItems.length === 0 ? <p className="px-4 py-4 text-muted-foreground text-center">No open work items for this customer.</p> : null}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[15px] font-semibold text-foreground">Legal Agreements Overview</h2>
                        </div>
                        <div className="px-4 py-4 text-[15px] text-muted-foreground space-y-2">
                            {detail.customer.portalClientId ? (
                                <>
                                    <p>Portal client link: <span className="font-mono text-foreground">{detail.portalClient?.email ?? detail.customer.portalClientId}</span></p>
                                    <p>
                                        Status counts: <span className="text-foreground font-semibold">Signed ({legalSummary?.success ? legalSummary.data.signed : 0})</span> · Sent ({legalSummary?.success ? legalSummary.data.sent : 0}) · Draft ({legalSummary?.success ? legalSummary.data.draft : 0})
                                    </p>
                                    <div className="pt-2">
                                        <Button size="xs" variant="outline" asChild className="cursor-pointer">
                                            <Link href="/dashboard/legal-vault">
                                                Open Legal Vault
                                            </Link>
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <p className="italic text-muted-foreground">No linked portal client. Legal Vault agreement summary becomes available once this customer is linked to a portal client.</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded-md border border-border/60 bg-card/40 overflow-hidden">
                        <div className="border-b border-border/60 px-4 py-3 bg-muted/20">
                            <h2 className="text-[15px] font-semibold text-foreground">Associated Commercial Links</h2>
                        </div>
                        <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
                            {detail.commercialLinks.map((link) => (
                                <div key={link.id} className="px-4 py-3 text-[15px]">
                                    <p className="font-semibold text-foreground capitalize">{link.linkType.replace(/_/g, " ")}</p>
                                    <p className="mt-1 text-[13px] text-muted-foreground">{link.linkedRecordType} · {link.linkedRecordRef ?? link.linkedRecordId} · {formatDate(link.createdAt)}</p>
                                </div>
                            ))}
                            {detail.commercialLinks.length === 0 ? <p className="px-4 py-4 text-muted-foreground text-center">No commercial links yet.</p> : null}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardAppWorkbench>
    );
}
