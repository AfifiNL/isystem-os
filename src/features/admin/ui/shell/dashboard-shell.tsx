"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { resolveWindowMeta } from "@/features/admin/lib/window-meta";
import { WindowManagerProvider } from "@/features/admin/ui/window-manager";
import { MDIDesktopView } from "@/features/admin/ui/shell/mdi-desktop-view";
import { WorkspaceWallpaper } from "@/features/admin/ui/shell/workspace-wallpaper";
import { Taskbar } from "@/features/admin/ui/shell/taskbar";
import { MobileShell } from "@/features/admin/ui/shell/mobile-shell";
import { DashboardRouteThread, resolveDashboardRouteFamily } from "@/features/admin/ui/app-workbench";

interface DashboardShellProps {
    state: AdminDashboardState;
    children: React.ReactNode;
}

// Top-level OS shell. The shell owns a full viewport: wallpaper in the
// background, taskbar pinned to the bottom, and a workspace area between
// them. Two content modes share that workspace area:
//
//   - Desktop view (at /dashboard): children render in a scrollable area
//     directly over the wallpaper — icons and widgets intentionally show
//     the wallpaper as their backdrop.
//
//   - Window (at /dashboard/<app>): WindowFrame wraps children in an
//     opaque, inset card. The card's solid background is what makes the
//     sub-route pages readable — they were designed for a normal theme-
//     aware background, not a dark wallpaper.
//
// The shell never scrolls as a whole. Either the desktop area scrolls
// internally (for inbox overflow) or the window scrolls internally (for
// long pages). This keeps the taskbar and the window chrome always pinned,
// matching real-OS behavior.
//
// Mobile (<lg): MobileShell renders the OS metaphor in phone form —
// top bar, sheet-based Start/menu, full-bleed app surface. Uses the same
// state, wallpaper, and module registry as desktop so there's no feature
// divergence.
export function DashboardShell({ state, children }: DashboardShellProps) {
    const pathname = usePathname();
    const meta = resolveWindowMeta(pathname);
    const isDesktopHome = pathname === "/dashboard" || pathname === "/dashboard/";
    const routeKey = pathname.startsWith("/dashboard/")
        ? pathname.slice("/dashboard/".length).split("/")[0] ?? "dashboard"
        : "dashboard";
    const routeFamily = resolveDashboardRouteFamily(pathname);

    const [isIframe, setIsIframe] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsIframe(window.self !== window.top);
        }
    }, []);

    // If loaded inside an iframe (e.g. background MDI window), strip out the outer shell elements
    if (isIframe) {
        return (
            <div
                className="dashboard-app-surface dashboard-workbench dashboard-cardless h-screen w-screen overflow-y-auto overflow-x-auto bg-background"
                data-dashboard-route-key={routeKey}
                data-dashboard-route-family={routeFamily}
            >
                <DashboardRouteThread />
                {children}
            </div>
        );
    }

    return (
        <WindowManagerProvider>
            <MobileShell state={state} activeWindow={meta} isDesktopHome={isDesktopHome}>
                {children}
            </MobileShell>

            <div className="relative isolate hidden h-screen overflow-hidden lg:block">
                <WorkspaceWallpaper url={state.workspace.wallpaper_url} alt={`${state.workspace.name} desktop`} />

                {!isDesktopHome && !meta ? (
                    // Sub-route without window meta (edge case — every app
                    // should be registered). Fall back to a full-workspace
                    // opaque surface so content never renders unreadable.
                    <div
                        className="dashboard-app-surface dashboard-workbench dashboard-cardless absolute bottom-2 left-[3.75rem] right-2 top-7 z-10 overflow-y-auto overflow-x-auto bg-background"
                        data-dashboard-route-key={routeKey}
                        data-dashboard-route-family={routeFamily}
                    >
                        <DashboardRouteThread />
                        {children}
                    </div>
                ) : (
                    <MDIDesktopView isDesktopHome={isDesktopHome}>
                        {children}
                    </MDIDesktopView>
                )}

                <Taskbar state={state} activeWindow={meta} />
            </div>
        </WindowManagerProvider>
    );
}
