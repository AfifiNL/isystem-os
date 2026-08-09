import { ReactNode } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { DashboardShell } from "@/features/admin/ui/shell/dashboard-shell";

// Force per-request rendering. The dashboard reads workspace state
// (wallpaper URL, AI balance, modules, etc.) that mutates from elsewhere
// in the app — uploading a new desktop wallpaper from /dashboard/settings
// must show up immediately on /dashboard. Marking the segment dynamic
// stops Next from holding any rendered RSC payload between requests.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Dashboard layout: the OS shell. Wraps every /dashboard/* route in the
// wallpaper + taskbar, and forks between the desktop view (at /dashboard)
// and window chrome (at /dashboard/*) via pathname in DashboardShell.
//
// Every sub-route's existing page content becomes the body of a window. No
// sub-route needs to know about the shell — it pulls WindowMeta from the
// route-segment registry in lib/window-meta.ts.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
    // Belt-and-braces with the export const dynamic above — also opts every
    // upstream fetch out of any Data Cache so a freshly-saved wallpaper URL
    // never gets read out of a stale cached entry.
    noStore();
    const state = await requireAdminDashboardState();

    return (
        <DashboardShell
            state={state}
        >
            {children}
        </DashboardShell>
    );
}
