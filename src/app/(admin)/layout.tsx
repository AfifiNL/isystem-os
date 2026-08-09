import { ReactNode } from "react";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";

// The admin layout only owns auth/access gating. The visual shell
// (wallpaper, taskbar, window chrome, desktop view) is the dashboard
// layout's responsibility so the OS metaphor lives close to the routes it
// wraps. This keeps non-dashboard admin routes — if any are added later —
// free of the desktop-OS chrome.
export default async function AdminLayout({ children }: { children: ReactNode }) {
    await requireAdminDashboardState();
    return children;
}
