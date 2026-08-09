import { redirect } from "next/navigation";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";

// Manual posts are now a filter on the unified content library. This page
// exists only for legacy bookmarks — the nav item now points directly to
// /dashboard/content?source=manual.
export default async function ManualPostsPage() {
    await requireDashboardModuleAccess("manual-posts");
    redirect("/dashboard/content?source=manual");
}
