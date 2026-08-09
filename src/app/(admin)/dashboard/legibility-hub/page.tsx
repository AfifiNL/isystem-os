import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { LegibilityHubApp } from "@/features/admin/ui/legibility-hub-app";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Legibility Hub",
};

export default async function LegibilityHubPage() {
    await requireDashboardModuleAccess("legibility-hub");
    return <LegibilityHubApp />;
}
