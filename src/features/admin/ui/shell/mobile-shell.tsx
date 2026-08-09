"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Check,
    Globe,
    LayoutGrid,
    LogOut,
    Menu,
    Monitor,
    Search,
    User,
    X,
    Zap,
} from "lucide-react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import type { WindowMeta } from "@/features/admin/lib/window-meta";
import { listProductivityApps } from "@/features/admin/lib/window-meta";
import { buildDashboardAppGroups } from "@/features/admin/lib/dashboard-launcher";
import { AiBalanceIndicator } from "@/features/admin/ui/ai-balance-indicator";
import { ModuleIcon } from "@/features/admin/ui/module-icon";
import { dashboardAppSurfaceClass } from "@/features/admin/ui/responsive-dashboard";
import { DashboardRouteThread, resolveDashboardRouteFamily } from "@/features/admin/ui/app-workbench";
import { WorkspaceWallpaper } from "@/features/admin/ui/shell/workspace-wallpaper";
import { logout } from "@/features/auth/actions";
import { setActiveWorkspace } from "@/features/admin/actions/workspaces";
import { setLocale } from "@/features/templates/actions";

interface MobileShellProps {
    state: AdminDashboardState;
    activeWindow: WindowMeta | null;
    isDesktopHome: boolean;
    children: React.ReactNode;
}

// Mobile OS shell rendered below lg (<1024px). Mirrors the desktop shell's
// three zones — wallpaper, app surface, chrome — collapsed into a phone-
// friendly layout:
//
//   - Top bar (h-12): Start/apps button, workspace chip or active-app title,
//     user menu. Pinned so the OS metaphor is always reachable.
//   - App surface: on /dashboard the wallpaper shows through and the page
//     children (DesktopView) render over it; on a sub-route the content
//     renders on solid bg-background with a slim back-bar, so detail
//     screens are legible on small viewports.
//   - No bottom dock: vertical space is scarce on phones; the top bar
//     already carries Start and user-menu affordances.
//
// All functionality (workspace switch, locale, logout, AI balance,
// productivity apps, workspace apps) is reachable without duplicating the
// desktop shell's components.
export function MobileShell({ state, activeWindow, isDesktopHome, children }: MobileShellProps) {
    const pathname = usePathname();
    const routeKey = pathname.startsWith("/dashboard/")
        ? pathname.slice("/dashboard/".length).split("/")[0] ?? "dashboard"
        : "dashboard";

    return (
        <div className="relative isolate flex h-[100svh] max-h-[100dvh] min-w-0 flex-col overflow-hidden overscroll-none bg-background text-foreground lg:hidden">
            {isDesktopHome ? (
                <WorkspaceWallpaper
                    url={state.workspace.wallpaper_url}
                    alt={`${state.workspace.name} desktop`}
                />
            ) : null}

            {isDesktopHome ? <MobileTopBar state={state} activeWindow={null} /> : null}

            {isDesktopHome ? (
                <main
                    className={`${dashboardAppSurfaceClass} relative z-10 flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),0.75rem)]`}
                    data-dashboard-route-key="dashboard"
                    data-dashboard-route-family="governance"
                >
                    {children}
                </main>
            ) : (
                <main
                    className={`${dashboardAppSurfaceClass} flex-1 overflow-y-auto bg-background`}
                    data-dashboard-route-key={routeKey}
                    data-dashboard-route-family={activeWindow ? resolveDashboardRouteFamily(`/dashboard/${routeKey}`) : "governance"}
                >
                    {activeWindow ? <MobileAppHeader meta={activeWindow} state={state} routeKey={routeKey} /> : null}
                    <div className="min-w-0 pb-[max(env(safe-area-inset-bottom),2rem)]">{children}</div>
                </main>
            )}
        </div>
    );
}

function MobileTopBar({ state, activeWindow }: { state: AdminDashboardState; activeWindow: WindowMeta | null }) {
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <header
                role="banner"
                className="z-30 flex h-[calc(3rem+env(safe-area-inset-top))] min-h-12 flex-none items-center justify-between gap-2 border-b border-white/10 bg-slate-950/90 px-3 pt-[env(safe-area-inset-top)] text-slate-100 backdrop-blur-xl"
            >
                <button
                    type="button"
                    onClick={() => setIsStartOpen(true)}
                    aria-label="Open Start menu"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 active:scale-95"
                >
                    <LayoutGrid className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-xs">
                    {activeWindow ? (
                        <>
                            <activeWindow.icon className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                            <span className="truncate font-semibold text-slate-100">
                                {activeWindow.title}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                            <span className="truncate font-semibold text-slate-100">
                                {state.workspace.name}
                            </span>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsMenuOpen(true)}
                    aria-label="Open menu"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 active:scale-95"
                >
                    <Menu className="h-5 w-5" />
                </button>
            </header>

            {isStartOpen ? (
                <MobileSheet title="Apps" onClose={() => setIsStartOpen(false)}>
                    <MobileStartContent state={state} onNavigate={() => setIsStartOpen(false)} />
                </MobileSheet>
            ) : null}

            {isMenuOpen ? (
                <MobileSheet title="Menu" onClose={() => setIsMenuOpen(false)}>
                    <MobileMenuContent state={state} onClose={() => setIsMenuOpen(false)} />
                </MobileSheet>
            ) : null}
        </>
    );
}

function MobileAppHeader({ meta, state, routeKey }: { meta: WindowMeta; state: AdminDashboardState; routeKey: string }) {
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const Icon = meta.icon;
    return (
        <>
            <div
                className="sticky top-0 z-30 flex h-10 min-w-0 items-center gap-2 border-b border-border/60 bg-background/95 px-2 backdrop-blur-xl"
                data-dashboard-route-key={routeKey}
                data-dashboard-route-family={resolveDashboardRouteFamily(`/dashboard/${routeKey}`)}
            >
                <Link
                    href={meta.closeHref}
                    aria-label={`Close ${meta.title}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground active:scale-95"
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                </span>
                <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-foreground">
                    {meta.title}
                </h1>
                <button
                    type="button"
                    onClick={() => setIsStartOpen(true)}
                    aria-label="Open apps"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground active:scale-95"
                >
                    <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => setIsMenuOpen(true)}
                    aria-label="Open menu"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground active:scale-95"
                >
                    <Menu className="h-3.5 w-3.5" />
                </button>
            </div>
            <DashboardRouteThread />
            {isStartOpen ? (
                <MobileSheet title="Apps" onClose={() => setIsStartOpen(false)}>
                    <MobileStartContent state={state} onNavigate={() => setIsStartOpen(false)} />
                </MobileSheet>
            ) : null}
            {isMenuOpen ? (
                <MobileSheet title="Menu" onClose={() => setIsMenuOpen(false)}>
                    <MobileMenuContent state={state} onClose={() => setIsMenuOpen(false)} />
                </MobileSheet>
            ) : null}
        </>
    );
}

function MobileSheet({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex-1 bg-slate-950/70 backdrop-blur-sm"
            />
            <div className="flex max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top)-1rem))] min-w-0 flex-col rounded-t-2xl border-t border-white/10 bg-slate-950 pb-[env(safe-area-inset-bottom)] text-slate-100 shadow-[0_-20px_50px_rgba(0,0,0,0.6)]">
                <div className="flex flex-none items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {title}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close menu"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-slate-300 active:scale-95"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
                <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
            </div>
        </div>
    );
}

function MobileStartContent({ state, onNavigate }: { state: AdminDashboardState; onNavigate: () => void }) {
    const [query, setQuery] = useState("");
    const productivityApps = listProductivityApps();
    const groups = buildDashboardAppGroups(state.modules);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredProductivityApps = normalizedQuery
        ? productivityApps.filter((app) => `${app.title} ${app.description}`.toLowerCase().includes(normalizedQuery))
        : productivityApps;
    const filteredGroups = normalizedQuery
        ? groups
            .map((group) => ({
                ...group,
                apps: group.apps.filter((app) => `${app.label} ${app.description} ${group.title}`.toLowerCase().includes(normalizedQuery)),
            }))
            .filter((group) => group.apps.length > 0)
        : groups;

    return (
        <div className="space-y-5 p-4">
            <label className="flex h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="sr-only">Search apps</span>
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search apps"
                    className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
            </label>

            <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Productivity
                </p>
                <div className="grid grid-cols-4 gap-2">
                    {filteredProductivityApps.map((app) => {
                        const Icon = app.icon;
                        return (
                            <Link
                                key={app.slug}
                                href={app.href}
                                onClick={onNavigate}
                                className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-center active:scale-95"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200">
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="truncate text-[10px] font-medium text-slate-200">
                                    {app.title}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <p className="border-b border-white/5 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Workspace Apps
                </p>

                {filteredGroups.length === 0 && filteredProductivityApps.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-6 text-center text-sm text-slate-400">
                        No apps match &quot;{query}&quot;.
                    </div>
                ) : null}

                {filteredGroups.map((group) => {
                    return (
                        <div key={group.key} className="space-y-1.5">
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 pl-1">
                                {group.title}
                            </p>
                            <ul className="grid grid-cols-1 gap-1">
                                {group.apps.map((app) => (
                                    <li key={app.key}>
                                        <Link
                                            href={app.href}
                                            onClick={onNavigate}
                                            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-200 active:bg-white/5 transition-colors"
                                        >
                                            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-200">
                                                <ModuleIcon name={app.icon} className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="flex-1 truncate">{app.label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            <Link
                href="/dashboard"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 active:bg-white/10"
            >
                <Monitor className="h-4 w-4" />
                Go to desktop
            </Link>
        </div>
    );
}

function MobileMenuContent({ state, onClose }: { state: AdminDashboardState; onClose: () => void }) {
    const router = useRouter();
    const [isSwitching, startSwitch] = useTransition();
    const hasMultipleWorkspaces = state.accessibleWorkspaces.length > 1;

    const handleSwitchWorkspace = (workspaceId: string) => {
        if (workspaceId === state.workspace.id) {
            onClose();
            return;
        }
        startSwitch(async () => {
            await setActiveWorkspace(workspaceId);
            onClose();
            router.refresh();
        });
    };

    const handleSwitchLocale = (next: "en" | "nl") => {
        if (next === state.locale) return;
        startSwitch(async () => {
            await setLocale(next);
            router.refresh();
        });
    };

    return (
        <div className="space-y-5 p-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-100">
                        <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                            {state.workspace.name}
                        </p>
                        <p className="text-[11px] capitalize text-slate-400">{state.role} access</p>
                    </div>
                </div>
                <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                    <AiBalanceIndicator />
                </div>
            </div>

            {hasMultipleWorkspaces ? (
                <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Switch workspace
                    </p>
                    <ul className="grid gap-1">
                        {state.accessibleWorkspaces.map((workspace) => {
                            const isActive = workspace.id === state.workspace.id;
                            return (
                                <li key={workspace.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchWorkspace(workspace.id)}
                                        disabled={isSwitching}
                                        className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                                            isActive ? "bg-cyan-500/10 text-cyan-100" : "text-slate-200 active:bg-white/5"
                                        }`}
                                    >
                                        <span className="truncate">{workspace.name}</span>
                                        {isActive ? <Check className="h-3.5 w-3.5" /> : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}

            <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Preferences
                </p>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200">
                    <Globe className="h-4 w-4" />
                    <span className="flex-1">Language</span>
                    <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-slate-950/60 p-0.5">
                        <button
                            type="button"
                            onClick={() => handleSwitchLocale("en")}
                            disabled={isSwitching}
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                state.locale === "en" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400"
                            }`}
                        >
                            EN
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSwitchLocale("nl")}
                            disabled={isSwitching}
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                                state.locale === "nl" ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400"
                            }`}
                        >
                            NL
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-1">
                <Link
                    href="/dashboard/settings"
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-200 active:bg-white/5"
                >
                    <Zap className="h-4 w-4" />
                    Workspace settings
                </Link>
                <Link
                    href="/"
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-200 active:bg-white/5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to site
                </Link>
                <form action={logout}>
                    <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-rose-300 active:bg-rose-500/10"
                    >
                        <LogOut className="h-4 w-4" />
                        Log out
                    </button>
                </form>
            </div>
        </div>
    );
}
