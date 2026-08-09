import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { listCaseSnippets } from "@/features/content-engine/case-snippets";
import { CaseSnippetsControlCenter } from "@/features/content-engine/ui/case-snippets-control-center";
import {
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Case Snippets",
};

export default async function CaseSnippetsPage() {
    const state = await requireDashboardModuleAccess("case-snippets");
    const { data, error } = await listCaseSnippets();

    return (
        <DashboardAppWorkbench>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <CaseSnippetsControlCenter
                    initialSnippets={data}
                    initialError={error}
                    canManage={state.role === "admin" || state.role === "manager"}
                />
            </div>
        </DashboardAppWorkbench>
    );
}
