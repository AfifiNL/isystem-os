import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CircleAlert, ClipboardCheck, Flag, Inbox, Mail, Network, Sparkles, Zap } from "lucide-react";
import type { DashboardInbox, InboxItem, InboxItemKind } from "@/features/admin/lib/dashboard-inbox";

interface DashboardInboxViewProps {
    inbox: DashboardInbox;
}

// The inbox is rendered as a compact desktop widget floating over the
// wallpaper, so this component commits to a **dark palette** regardless of
// the workspace theme. Theme-neutral tokens (`text-foreground`, etc.) would
// resolve to dark text against the dark widget surface — unreadable.
//
// Density: one line per item. Summary is the title only. Long rationales
// live in the target surface (Opportunity Engine, Settings → AI Credits,
// Content Library). The widget's job is to route, not to explain.

const KIND_ICON: Record<InboxItemKind, typeof AlertTriangle> = {
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

const SEVERITY_STYLE: Record<InboxItem["severity"], string> = {
    critical: "border-rose-500/40 bg-rose-500/10 text-rose-200 hover:border-rose-400/60 hover:bg-rose-500/15",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400/60 hover:bg-amber-500/15",
    info: "border-white/10 bg-white/[0.04] text-slate-100 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-100",
};

const MAX_VISIBLE_ITEMS = 4;

export function DashboardInboxView({ inbox }: DashboardInboxViewProps) {
    if (inbox.items.length === 0) {
        return (
            <section aria-labelledby="dashboard-inbox-title" className="space-y-2">
                <h2
                    id="dashboard-inbox-title"
                    className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"
                >
                    Inbox
                </h2>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                        All clear — no pending items.
                    </span>
                </div>
            </section>
        );
    }

    const visibleItems = inbox.items.slice(0, MAX_VISIBLE_ITEMS);
    // `items` is capped per kind in loadDashboardInbox; counts hold the real
    // totals so overflow reflects the actual queue size.
    const totalUnread = inbox.counts.pendingOpportunities + inbox.counts.staleDrafts + inbox.counts.unreadMarketSignals + inbox.counts.pendingBookings + inbox.counts.overdueSlaTasks + inbox.counts.unresolvedClientFlags + inbox.counts.businessWorkItems + inbox.counts.integrationFailures + inbox.counts.contactSubmissions + inbox.counts.seoAutomationSummaries;
    const overflowCount = Math.max(totalUnread, inbox.items.length) - visibleItems.length;

    return (
        <section aria-labelledby="dashboard-inbox-title" className="space-y-2">
            <div className="flex items-start justify-between gap-3">
                <h2
                    id="dashboard-inbox-title"
                    className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"
                >
                    Inbox
                </h2>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                    {inbox.counts.pendingOpportunities > 0 ? (
                        <CountPill icon={Sparkles} value={inbox.counts.pendingOpportunities} title="Pending opportunities" />
                    ) : null}
                    {inbox.counts.staleDrafts > 0 ? (
                        <CountPill icon={Inbox} value={inbox.counts.staleDrafts} title="Stale drafts" />
                    ) : null}
                    {inbox.counts.unreadMarketSignals > 0 ? (
                        <CountPill icon={CircleAlert} value={inbox.counts.unreadMarketSignals} title="Unread market signals" />
                    ) : null}
                    {inbox.counts.pendingBookings > 0 ? (
                        <CountPill icon={CalendarClock} value={inbox.counts.pendingBookings} title="Bookings awaiting review" />
                    ) : null}
                    {inbox.counts.overdueSlaTasks > 0 ? (
                        <CountPill icon={ClipboardCheck} value={inbox.counts.overdueSlaTasks} title="Overdue SLA tasks" />
                    ) : null}
                    {inbox.counts.unresolvedClientFlags > 0 ? (
                        <CountPill icon={Flag} value={inbox.counts.unresolvedClientFlags} title="Unresolved client flags" />
                    ) : null}
                    {inbox.counts.businessWorkItems > 0 ? (
                        <CountPill icon={ClipboardCheck} value={inbox.counts.businessWorkItems} title="Business OS work items" />
                    ) : null}
                    {inbox.counts.integrationFailures > 0 ? (
                        <CountPill icon={Network} value={inbox.counts.integrationFailures} title="Integration failures" />
                    ) : null}
                    {inbox.counts.contactSubmissions > 0 ? (
                        <CountPill icon={Mail} value={inbox.counts.contactSubmissions} title="Contact submissions" />
                    ) : null}
                    {inbox.counts.seoAutomationSummaries > 0 ? (
                        <CountPill icon={Network} value={inbox.counts.seoAutomationSummaries} title="SEO automation summaries" />
                    ) : null}
                </div>
            </div>

            <ul className="space-y-1.5">
                {visibleItems.map((item) => {
                    const Icon = KIND_ICON[item.kind];
                    return (
                        <li key={item.id}>
                            <Link
                                href={item.href}
                                className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition-colors ${SEVERITY_STYLE[item.severity]}`}
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                <span className="flex-1 truncate font-medium leading-tight">{item.title}</span>
                                <ArrowRight className="h-3 w-3 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {overflowCount > 0 ? (
                <Link
                    href="/dashboard/inbox"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-cyan-300"
                >
                    {overflowCount} more
                    <ArrowRight className="h-3 w-3" />
                </Link>
            ) : null}
        </section>
    );
}

function CountPill({
    icon: Icon,
    value,
    title,
}: {
    icon: typeof AlertTriangle;
    value: number;
    title: string;
}) {
    return (
        <span
            title={title}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200"
        >
            <Icon className="h-2.5 w-2.5" />
            {value}
        </span>
    );
}
