import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, Eye } from "lucide-react";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listBusinessAssignees, listBusinessWorkItems } from "@/features/business-spine/service";
import { updateBusinessWorkItemFormAction } from "@/features/business-spine/actions";
import type { BusinessWorkItem } from "@/features/business-spine/types";
import {
    DashboardAppWorkbench,
    AppMetricStrip,
    AppMetric,
    AppFeedbackLoop,
    AppSplitPane,
    AppQueueTable,
    AppRecordCard,
    AppSectionHeader
} from "@/features/admin/ui/app-workbench";
import { Button } from "@/shared/ui/button";

export const metadata = {
    title: "Work Queue | Admin",
    description: "Operational work queue for blockers, ownership, and next actions.",
};

function formatDate(value: string | null) {
    if (!value) return "No due date";
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function dueInputValue(value: string | null) {
    if (!value) return "";
    return new Date(value).toISOString().slice(0, 16);
}

function itemHref(item: BusinessWorkItem) {
    return `/dashboard/work?item=${encodeURIComponent(item.id)}`;
}

interface WorkPageProps {
    searchParams: Promise<{ item?: string }>;
}

const STATUS_BADGE = {
    open: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/20",
    in_progress: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20",
    blocked: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20",
    done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
    dismissed: "bg-muted text-muted-foreground border border-border/50",
};

const PRIORITY_BADGE = {
    low: "bg-muted text-muted-foreground",
    normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    high: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
    urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-bold",
};

export default async function WorkPage({ searchParams }: WorkPageProps) {
    const state = await requireDashboardModuleAccess("work");
    const params = await searchParams;
    const selectedItemId = params.item;

    const [items, assignees] = await Promise.all([
        listBusinessWorkItems(state.workspace.id),
        listBusinessAssignees(state.workspace.id),
    ]);

    const blocked = items.filter((item) => item.status === "blocked").length;
    const urgent = items.filter((item) => item.priority === "urgent").length;
    const overdue = items.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now()).length;

    const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;

    const tableHeaders = (
        <tr className="border-b border-border/50 text-[13px]">
            <th className="px-3 py-2">Task Title &amp; Description</th>
            <th className="px-3 py-2 w-24">Priority</th>
            <th className="px-3 py-2 w-28">Status</th>
            <th className="px-3 py-2 w-40">Due Date</th>
            <th className="px-3 py-2 w-16 text-right" />
        </tr>
    );

    return (
        <DashboardAppWorkbench>
            <AppMetricStrip>
                <AppMetric label="Open Tasks" value={items.length} icon={ClipboardCheck} />
                <AppMetric label="Blocked" value={blocked} icon={AlertTriangle} variant={blocked > 0 ? "warning" : "default"} />
                <AppMetric label="Urgent Priority" value={urgent} icon={CheckCircle2} variant={urgent > 0 ? "destructive" : "default"} />
                <AppMetric label="Past Due" value={overdue} icon={Clock3} variant={overdue > 0 ? "destructive" : "default"} />
            </AppMetricStrip>

            <AppFeedbackLoop
                title="Work recovery loop"
                description="Signals become owned work, blockers become escalation, and completed work returns evidence to the next priority decision."
                stages={[
                    { label: "Open", value: items.length, detail: "current queue", tone: "info" },
                    { label: "Urgent", value: urgent, detail: "capacity risk", tone: urgent > 0 ? "danger" : "default" },
                    { label: "Blocked", value: blocked, detail: "needs escalation", tone: blocked > 0 ? "warning" : "success" },
                    { label: "Past due", value: overdue, detail: "deadline drift", tone: overdue > 0 ? "danger" : "success" },
                ]}
                feedbackLabel="Blockers and deadline drift should change assignment and capacity before more work enters the queue."
            />

            <AppSplitPane
                main={
                    <div className="flex flex-col flex-1 h-full min-h-0">
                        <div className="px-4 pt-3 flex-none">
                            <AppSectionHeader
                                title="Active Queue"
                                description={`Unified operational checklist for ${state.workspace.name}. Click a row to configure metadata or snooze items.`}
                            />
                        </div>
                        <AppQueueTable
                            headers={tableHeaders}
                            empty={items.length === 0}
                            emptyText="No open Business OS work items. New signals will appear here when human action is needed."
                            mobileCards={items.map((item) => {
                                const isSelected = item.id === selectedItemId;
                                return (
                                    <AppRecordCard key={item.id} active={isSelected}>
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link href={itemHref(item)} className="block truncate font-semibold text-foreground">
                                                    {item.title}
                                                </Link>
                                                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                                                    {item.description ?? item.kind.replace(/_/g, " ")}
                                                </p>
                                            </div>
                                            <Button size="xs" variant="ghost" asChild className="h-7 w-7 shrink-0 p-0">
                                                <Link href={itemHref(item)} aria-label={`Open ${item.title}`}>
                                                    <Eye className="size-3.5" />
                                                </Link>
                                            </Button>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                                            <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${PRIORITY_BADGE[item.priority]}`}>
                                                {item.priority}
                                            </span>
                                            <span className={`rounded px-1.5 py-0.5 font-semibold uppercase ${STATUS_BADGE[item.status]}`}>
                                                {item.status.replace(/_/g, " ")}
                                            </span>
                                            <span className="font-mono text-muted-foreground">{formatDate(item.dueAt)}</span>
                                        </div>
                                    </AppRecordCard>
                                );
                            })}
                        >
                            {items.map((item) => {
                                const isSelected = item.id === selectedItemId;
                                return (
                                    <tr
                                        key={item.id}
                                        className={`border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors ${
                                            isSelected ? "bg-muted/50 font-medium" : ""
                                        }`}
                                    >
                                        <td className="px-3 py-2.5 max-w-md">
                                            <Link href={itemHref(item)} className="font-semibold text-foreground hover:underline block truncate">
                                                {item.title}
                                            </Link>
                                            <div className="text-[13px] text-muted-foreground truncate mt-0.5">
                                                {item.description ?? item.kind.replace(/_/g, " ")}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            <span className={`rounded px-1.5 py-0.5 text-[13px] uppercase font-semibold ${PRIORITY_BADGE[item.priority]}`}>
                                                {item.priority}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            <span className={`rounded px-1.5 py-0.5 text-[13px] uppercase font-semibold ${STATUS_BADGE[item.status]}`}>
                                                {item.status.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[13px] text-muted-foreground">
                                            {formatDate(item.dueAt)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                            <Button size="xs" variant="ghost" asChild className="h-6 w-6 p-0 cursor-pointer">
                                                <Link href={itemHref(item)}>
                                                    <Eye className="size-3.5" />
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </AppQueueTable>
                    </div>
                }
                inspectorLabel="Task inspector"
                inspector={
                    <div className="flex flex-col h-full min-h-0 p-4 space-y-4 text-[15px]">
                        {selectedItem ? (
                            <div className="space-y-4">
                                <AppSectionHeader title="Inspector Pane" description="Edit task properties and assignees." />

                                <div className="rounded-md border border-border/50 bg-background/30 p-3 space-y-2">
                                    <p className="font-semibold text-foreground leading-tight text-[17px]">{selectedItem.title}</p>
                                    <p className="text-[15px] text-muted-foreground">{selectedItem.description ?? "No description provided."}</p>

                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[13px] text-muted-foreground pt-2 border-t border-border/30">
                                        <div>Module:</div>
                                        <div className="text-foreground font-medium capitalize">{selectedItem.sourceModule ?? "business"}</div>
                                        <div>Entity:</div>
                                        <div className="text-foreground font-medium capitalize">{selectedItem.sourceEntityType ?? "work"}</div>
                                        {selectedItem.customerId ? (
                                            <>
                                                <div>Customer:</div>
                                                <div>
                                                    <Link href={`/dashboard/customers/${selectedItem.customerId}`} className="text-primary hover:underline font-medium">
                                                        Open Customer
                                                    </Link>
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                <form action={updateBusinessWorkItemFormAction} className="space-y-3 pt-2 border-t border-border/40">
                                    <input type="hidden" name="workItemId" value={selectedItem.id} />
                                    <input type="hidden" name="customerId" value={selectedItem.customerId ?? ""} />

                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Status</label>
                                        <select
                                            name="status"
                                            defaultValue={selectedItem.status}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <option value="open">Open</option>
                                            <option value="in_progress">In progress</option>
                                            <option value="blocked">Blocked</option>
                                            <option value="done">Done</option>
                                            <option value="dismissed">Dismissed</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Priority</label>
                                        <select
                                            name="priority"
                                            defaultValue={selectedItem.priority}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <option value="low">Low</option>
                                            <option value="normal">Normal</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Owner</label>
                                        <select
                                            name="assignedToProfileId"
                                            defaultValue={selectedItem.assignedToProfileId ?? ""}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] select-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                                        >
                                            <option value="">Unassigned</option>
                                            {assignees.map((assignee) => (
                                                <option key={assignee.profileId} value={assignee.profileId}>{assignee.email}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Due</label>
                                        <input
                                            name="dueAt"
                                            type="datetime-local"
                                            defaultValue={dueInputValue(selectedItem.dueAt)}
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Snooze until</label>
                                        <input
                                            name="snoozedUntil"
                                            type="datetime-local"
                                            className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <Button type="submit" size="sm" className="w-full cursor-pointer">
                                            Save Changes
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-6 h-full text-muted-foreground space-y-2">
                                <ClipboardCheck className="size-8 text-muted-foreground/40" />
                                <span className="font-semibold text-foreground">No task selected</span>
                                <span>Choose a task from the active queue to inspect details and modify properties.</span>
                            </div>
                        )}
                    </div>
                }
            />
        </DashboardAppWorkbench>
    );
}
