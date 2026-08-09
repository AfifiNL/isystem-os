import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { isApifyOutreachEnabled, loadOutreachDashboard } from "@/features/outreach/service";
import { OutreachControlCenter } from "@/features/outreach/ui/outreach-control-center";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Outreach Control Center",
    description: "Governed outreach intelligence, prospect review, dispatch controls, and analytics.",
};

export default async function OutreachPage() {
    const state = await requireDashboardModuleAccess("outreach");
    const data = await loadOutreachDashboard(state.workspace.id);
    return <OutreachControlCenter data={data} apifyEnabled={await isApifyOutreachEnabled()} />;
}
