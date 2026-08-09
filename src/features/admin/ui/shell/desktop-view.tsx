"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, Search, X } from "lucide-react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import type { DashboardInbox } from "@/features/admin/lib/dashboard-inbox";
import type { OnboardingStep } from "@/features/admin/lib/onboarding";
import {
    buildDashboardAppGroups,
    flattenDashboardAppGroups,
    type DashboardAppGroup,
    type DashboardLauncherItem,
} from "@/features/admin/lib/dashboard-launcher";
import { DesktopInboxWidget } from "@/features/admin/ui/shell/desktop-inbox-widget";
import { AppIcon } from "@/features/admin/ui/app-icon";
import { DashboardInboxView } from "@/features/admin/ui/dashboard-inbox";
import { WelcomeWindow } from "@/features/admin/ui/onboarding/welcome-window";

interface DesktopViewProps {
    state: AdminDashboardState;
    inbox: DashboardInbox;
    onboarding: {
        steps: OnboardingStep[];
        initialStepIndex: number;
    } | null;
}

/**
 * The desktop surface is intentionally a calm canvas. The persistent focus rail
 * owns navigation; this surface only offers app search, the inbox pulse, and
 * onboarding. Keeping one navigation model prevents the old icon desktop from
 * competing with the rail and consuming a scroll column.
 */
export function DesktopView({ state, inbox, onboarding }: DesktopViewProps) {
    const groups = useMemo(() => buildDashboardAppGroups(state.modules), [state.modules]);
    const allApps = useMemo(() => flattenDashboardAppGroups(groups), [groups]);
    const [appQuery, setAppQuery] = useState("");
    const normalizedAppQuery = appQuery.trim().toLowerCase();
    const groupTitles = useMemo(
        () => new Map(groups.map((group) => [group.key, group.title])),
        [groups],
    );
    const searchedApps = useMemo(() => {
        if (!normalizedAppQuery) return [];
        return allApps.filter((app) => {
            const groupTitle = groupTitles.get(app.groupKey) ?? "";
            return `${app.label} ${app.description} ${groupTitle}`.toLowerCase().includes(normalizedAppQuery);
        });
    }, [allApps, groupTitles, normalizedAppQuery]);

    return (
        <>
            <MobileDashboardHome state={state} inbox={inbox} groups={groups} />

            <div
                data-dashboard-desktop-home="true"
                className="relative hidden h-full min-h-[calc(100vh-3.5rem)] flex-col overflow-hidden px-5 pb-24 pt-4 text-foreground sm:px-8 sm:pt-6 lg:flex"
            >
                <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="inline-flex min-w-0 max-w-[40vw] items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        <span className="truncate">{state.workspace.name}</span>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="shrink-0 capitalize text-muted-foreground/75">{state.role}</span>
                    </div>

                    <label className="flex h-9 w-[min(28rem,42vw)] shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 text-sm text-muted-foreground shadow-sm transition-colors focus-within:border-primary/45">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="sr-only">Find any workspace app</span>
                        <input
                            value={appQuery}
                            onChange={(event) => setAppQuery(event.target.value)}
                            placeholder={`Find any of ${allApps.length} workspace apps`}
                            className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                        {appQuery ? (
                            <button
                                type="button"
                                onClick={() => setAppQuery("")}
                                aria-label="Clear app search"
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                    </label>
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {normalizedAppQuery ? (
                        <DesktopAppSearchPanel
                            query={appQuery}
                            apps={searchedApps}
                            onClear={() => setAppQuery("")}
                        />
                    ) : (
                        <section
                            data-dashboard-desktop-canvas="true"
                            className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-20 text-center"
                        >
                            <div className="max-w-xl">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Focus rail ready</p>
                                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{state.workspace.name}</h1>
                                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                                    Choose a workspace surface from the left toolbar, or search the command surface above. Your dashboard stays open, calm, and task-first.
                                </p>
                                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                                    <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">{groups.length} focus areas</span>
                                    <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">{allApps.length} workspace apps</span>
                                    <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5">{state.role} access</span>
                                </div>
                            </div>
                        </section>
                    )}
                </div>

                <div className="pointer-events-none absolute bottom-20 right-5 z-20 flex w-[min(20rem,calc(100vw-2.5rem))] justify-end sm:right-8">
                    <div className="pointer-events-auto">
                        <DesktopInboxWidget inbox={inbox} />
                    </div>
                </div>

                {onboarding ? (
                    <WelcomeWindow
                        workspaceId={state.workspace.id}
                        workspaceName={state.workspace.name}
                        steps={onboarding.steps}
                        initialStepIndex={onboarding.initialStepIndex}
                    />
                ) : null}
            </div>
        </>
    );
}

function DesktopAppSearchPanel({
    query,
    apps,
    onClear,
}: {
    query: string;
    apps: DashboardLauncherItem[];
    onClear: () => void;
}) {
    return (
        <section
            data-dashboard-desktop-search="true"
            aria-label="App search results"
            className="w-[min(720px,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-border/60 bg-card/90 text-foreground shadow-xl backdrop-blur-2xl"
        >
            <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Search className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold">All workspace apps</h2>
                        <p className="truncate text-xs text-muted-foreground">
                            {apps.length} {apps.length === 1 ? "result" : "results"} for &quot;{query.trim()}&quot;
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Close app search"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </header>

            {apps.length > 0 ? (
                <div className="grid max-h-[min(56vh,520px)] grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
                    {apps.map((app) => (
                        <Link
                            key={app.key}
                            href={app.href}
                            className="group flex min-h-28 flex-col justify-between rounded-xl border border-border/60 bg-background/55 p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <AppIcon moduleKey={app.key} iconName={app.icon} badge={app.badge} size="md" />
                                <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    App
                                </span>
                            </div>
                            <div className="mt-3 min-w-0">
                                <h3 className="text-sm font-semibold leading-tight">{app.label}</h3>
                                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{app.description}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="px-4 py-12 text-center">
                    <p className="text-sm font-medium">No matching workspace apps</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try a feature, workflow, or group name.</p>
                </div>
            )}
        </section>
    );
}

function MobileDashboardHome({
    state,
    inbox,
    groups,
}: {
    state: AdminDashboardState;
    inbox: DashboardInbox;
    groups: DashboardAppGroup[];
}) {
    const [query, setQuery] = useState("");
    const normalizedQuery = query.trim().toLowerCase();
    const totalInboxItems = inbox.counts.pendingOpportunities
        + inbox.counts.staleDrafts
        + inbox.counts.unreadMarketSignals
        + inbox.counts.pendingBookings
        + inbox.counts.overdueSlaTasks
        + inbox.counts.unresolvedClientFlags
        + inbox.counts.businessWorkItems
        + inbox.counts.integrationFailures
        + inbox.counts.contactSubmissions
        + inbox.counts.seoAutomationSummaries;

    const filteredGroups = normalizedQuery
        ? groups
            .map((group) => ({
                ...group,
                apps: group.apps.filter((app) => {
                    const haystack = `${app.label} ${app.description} ${group.title}`.toLowerCase();
                    return haystack.includes(normalizedQuery);
                }),
            }))
            .filter((group) => group.apps.length > 0)
        : groups;

    return (
        <div className="relative z-10 flex min-h-full flex-col gap-4 px-3 pb-6 pt-3 text-slate-100 lg:hidden">
            <section className="rounded-xl border border-white/10 bg-slate-950/72 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.32)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                            Mobile OS
                        </p>
                        <h1 className="mt-1 truncate text-lg font-bold tracking-tight text-slate-50">
                            {state.workspace.name}
                        </h1>
                        <p className="text-xs capitalize text-slate-400">
                            {state.role} workspace
                        </p>
                    </div>
                    <Link
                        href="/dashboard/inbox"
                        className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-slate-200 active:scale-95"
                        aria-label={`Open inbox${totalInboxItems > 0 ? `, ${totalInboxItems} items` : ""}`}
                    >
                        <Bell className="h-4 w-4" />
                        {totalInboxItems > 0 ? (
                            <span className="rounded-full bg-cyan-300 px-1.5 text-[10px] font-bold text-slate-950">
                                {totalInboxItems > 99 ? "99+" : totalInboxItems}
                            </span>
                        ) : null}
                    </Link>
                </div>

                <label className="mt-3 flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/75 px-3 text-sm text-slate-300">
                    <Search className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="sr-only">Search apps</span>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search apps"
                        className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    />
                </label>
            </section>

            <section className="rounded-xl border border-white/10 bg-slate-950/72 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <DashboardInboxView inbox={inbox} />
            </section>

            <div className="space-y-4">
                {filteredGroups.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-8 text-center text-sm text-slate-400 backdrop-blur-xl">
                        No apps match &quot;{query}&quot;.
                    </div>
                ) : (
                    filteredGroups.map((group) => {
                        const Icon = group.icon;
                        return (
                            <section key={group.key} className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-slate-950/70 text-cyan-100">
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-200">
                                            {group.title}
                                        </h2>
                                        <p className="truncate text-[11px] text-slate-500">{group.description}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                                    {group.apps.map((app) => (
                                        <Link
                                            key={app.key}
                                            href={app.href}
                                            className="group flex min-h-20 items-center gap-3 rounded-xl border border-white/10 bg-slate-950/72 p-3 text-left shadow-[0_12px_28px_rgba(0,0,0,0.24)] backdrop-blur-xl active:scale-[0.99]"
                                        >
                                            <AppIcon moduleKey={app.key} iconName={app.icon} badge={app.badge} size="md" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-slate-50">{app.label}</span>
                                                <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-400">{app.description}</span>
                                            </span>
                                            <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-active:translate-x-0.5" />
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}
            </div>
        </div>
    );
}
