import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listPopupsForCurrentWorkspace } from "@/features/popups/actions";
import { PopupsControlCenter } from "@/features/popups/ui/popups-control-center";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Popups",
};

export default async function PopupsPage() {
    const state = await requireDashboardModuleAccess("popups");
    const { data, error } = await listPopupsForCurrentWorkspace();

    return (
        <PopupsControlCenter
            initialPopups={data}
            initialError={error}
            canManage={state.role === "admin" || state.role === "manager"}
            dashboardLocale={state.locale}
        />
    );
}
