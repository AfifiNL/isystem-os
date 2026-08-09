import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { loadDashboardInbox } from "@/features/admin/lib/dashboard-inbox";
import { ArrowRight, AlertTriangle, Sparkles, Inbox, CircleAlert, CalendarClock, ClipboardCheck, Flag, Mail, Network, Zap } from "lucide-react";
import Link from "next/link";
import { DashboardAppWorkbench, AppSectionHeader, AppFeedbackLoop } from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Attention Inbox",
    description: "Review all workspace action items, opportunities, pending bookings, and lead captures.",
};

const KIND_ICON = {
    low_credits: Zap,
    pending_opportunity: Sparkles,
    stale_draft: Inbox,
    market_signal: CircleAlert,
    pending_booking: CalendarClock,
    sla_overdue: ClipboardCheck,
    sla_client_flag: Flag,
    business_work_item: ClipboardCheck,
    integration_failure: Network,
    contact_submission: Mail,
    seo_automation_summary: Network,
};

const SEVERITY_TONE = {
    critical: "border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300",
    info: "border-border bg-background/50 text-foreground",
};

export default async function DashboardInboxPage() {
    const state = await requireDashboardModuleAccess("inbox");
    const inbox = await loadDashboardInbox(state.workspace.id);
    const critical = inbox.items.filter((item) => item.severity === "critical").length;
    const warnings = inbox.items.filter((item) => item.severity === "warning").length;
    const signalKinds = new Set(inbox.items.map((item) => item.kind)).size;

    return (
        <DashboardAppWorkbench>
            <AppFeedbackLoop
                title="Attention recovery loop"
                description="Signals enter one queue, get prioritized by severity, and return as routing evidence after resolution."
                stages={[
                    { label: "Signals", value: inbox.items.length, detail: "open items", tone: "info" },
                    { label: "Critical", value: critical, detail: "act first", tone: critical > 0 ? "danger" : "success" },
                    { label: "Warning", value: warnings, detail: "watch closely", tone: warnings > 0 ? "warning" : "default" },
                    { label: "Kinds", value: signalKinds, detail: "source lanes", tone: "info" },
                ]}
                feedbackLabel="Resolution patterns should change routing and priority rules; a quiet queue is only healthy when the underlying signals are explained."
            />

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                <AppSectionHeader
                    title="Action Required"
                    description="Centralized workspace notifications and items requiring action."
                />

                {inbox.items.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/50 bg-background/40 p-12 text-center text-muted-foreground">
                        <Sparkles className="mx-auto h-8 w-8 text-emerald-500 mb-3" />
                        <h3 className="font-semibold text-foreground text-[17px]">All Clear</h3>
                        <p className="text-[15px] text-muted-foreground mt-1">No pending notifications or review items.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {inbox.items.map((item) => {
                            const Icon = KIND_ICON[item.kind as keyof typeof KIND_ICON] || AlertTriangle;
                            const tone = SEVERITY_TONE[item.severity as keyof typeof SEVERITY_TONE] || SEVERITY_TONE.info;
                            return (
                                <div
                                    key={item.id}
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border p-4 transition-colors ${tone}`}
                                >
                                    <div className="flex gap-3">
                                        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                                        <div>
                                            <h3 className="font-semibold text-[17px]">{item.title}</h3>
                                            <p className="text-[15px] text-muted-foreground mt-0.5">{item.summary}</p>
                                        </div>
                                    </div>
                                    <Link
                                        href={item.href}
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                                    >
                                        {item.cta}
                                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardAppWorkbench>
    );
}
