"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Minus } from "lucide-react";
import type { DashboardInbox } from "@/features/admin/lib/dashboard-inbox";
import { DashboardInboxView } from "@/features/admin/ui/dashboard-inbox";

interface DesktopInboxWidgetProps {
    inbox: DashboardInbox;
}

const STORAGE_KEY = "isystem:desktop-inbox-open";

// Collapsible desktop inbox. Defaults to minimized — renders as a bell icon
// with an attention badge. Clicking expands to the full inbox view in the
// same position and size it occupied before. Open/minimized state persists
// per-user via localStorage so the choice survives reloads.
//
// Severity tint on the bell: rose if any critical item, amber if any
// warning, slate if only informational items. The badge shows the number
// of visible inbox entries (not pending across the whole workspace — that's
// the expanded view's job).
export function DesktopInboxWidget({ inbox }: DesktopInboxWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved === "true") setIsOpen(true);
        } catch {
            // Storage unavailable (incognito / blocked) — defaults hold.
        }
        setIsHydrated(true);
    }, []);

    const persist = (next: boolean) => {
        setIsOpen(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
        } catch {
            // Ignore storage failure — UI still toggles.
        }
    };

    // `items.length` is capped at MAX_INBOX_PER_KIND per source. The badge
    // shows the true total across all sources so the indicator matches the
    // counts surfaced inside the panel and on /dashboard/market-monitor.
    const totalUnread = inbox.counts.pendingOpportunities + inbox.counts.staleDrafts + inbox.counts.unreadMarketSignals + inbox.counts.pendingBookings + inbox.counts.overdueSlaTasks + inbox.counts.unresolvedClientFlags + inbox.counts.businessWorkItems + inbox.counts.integrationFailures + inbox.counts.contactSubmissions + inbox.counts.seoAutomationSummaries;
    const totalItems = Math.max(inbox.items.length, totalUnread);
    const hasCritical = inbox.items.some((item) => item.severity === "critical");
    const hasWarning = inbox.items.some((item) => item.severity === "warning");

    // Avoid rendering with default-closed state during hydration when the
    // saved preference would re-open — prevents a flash of the bell on
    // initial paint for users who had it open. Nothing visible until we
    // know their preference.
    if (!isHydrated) return null;

    if (!isOpen) {
        return (
            <div ref={containerRef} className="flex justify-end">
                <button
                    type="button"
                    onClick={() => persist(true)}
                    aria-label={totalItems > 0 ? `Open inbox (${totalItems} item${totalItems === 1 ? "" : "s"})` : "Open inbox"}
                    title={totalItems > 0 ? `${totalItems} inbox item${totalItems === 1 ? "" : "s"}` : "Inbox · all clear"}
                    className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-slate-950/75 text-slate-200 shadow-[0_8px_20px_rgba(0,0,0,0.4)] backdrop-blur-lg transition-colors ${
                        hasCritical
                            ? "border-rose-400/50 text-rose-300 hover:border-rose-300/70 hover:bg-rose-500/15"
                            : hasWarning
                                ? "border-amber-400/50 text-amber-300 hover:border-amber-300/70 hover:bg-amber-500/15"
                                : "border-white/15 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                    }`}
                >
                    <Bell className="h-4 w-4" />
                    {totalItems > 0 ? (
                        <span
                            className={`absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full border border-slate-950 px-1 py-0.5 text-[10px] font-bold leading-none ${
                                hasCritical
                                    ? "bg-rose-500 text-slate-950"
                                    : hasWarning
                                        ? "bg-amber-400 text-slate-950"
                                        : "bg-cyan-400 text-slate-950"
                            }`}
                            aria-hidden="true"
                        >
                            {totalItems > 9 ? "9+" : totalItems}
                        </span>
                    ) : null}
                </button>
            </div>
        );
    }

    return (
        <aside
            ref={containerRef}
            aria-label="Task inbox"
            className="relative w-[min(20rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-white/10 bg-slate-950/75 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-lg"
        >
            <button
                type="button"
                onClick={() => persist(false)}
                aria-label="Minimize inbox"
                title="Minimize"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-slate-100"
            >
                <Minus className="h-3 w-3" />
            </button>
            <DashboardInboxView inbox={inbox} />
        </aside>
    );
}
