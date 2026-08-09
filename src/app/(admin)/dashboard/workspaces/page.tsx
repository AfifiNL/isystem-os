import { listAllWorkspaces } from "@/features/admin/actions/workspaces";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import { WorkspacesList } from "@/features/admin/ui/workspaces-list";

const ALLOWED_TIERS = new Set(["basic", "pro"]);

function parseList(v: string | string[] | undefined): string[] {
    if (!v) return [];
    const raw = Array.isArray(v) ? v.join(",") : v;
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInt10(v: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

interface WorkspacesPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminWorkspacesPage({ searchParams }: WorkspacesPageProps) {
    await requireDashboardModuleAccess("admin-workspaces");
    const params = await searchParams;

    const search = Array.isArray(params.q) ? params.q[0] : params.q;
    const tiers = parseList(params.tier).filter((t) => ALLOWED_TIERS.has(t));
    const activeRaw = Array.isArray(params.active) ? params.active[0] : params.active;
    const isActive: "all" | "active" | "inactive" =
        activeRaw === "active" || activeRaw === "inactive" ? activeRaw : "all";
    const page = Math.max(1, parseInt10(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 25)));

    const res = await listAllWorkspaces({ search, tiers, isActive, page, pageSize });

    if (res.error) {
        return (
            <DashboardAppWorkbench>
                <div className="m-4 rounded-md border border-destructive/20 bg-destructive/10 p-8 text-center text-[15px] text-destructive">
                    Failed to load workspaces: {res.error}
                </div>
            </DashboardAppWorkbench>
        );
    }

    return (
        <DashboardAppWorkbench>
            <WorkspacesList
                workspaces={(res.data ?? []) as never}
                total={res.total}
                page={res.page}
                pageSize={res.pageSize}
                search={search ?? ""}
                tiers={tiers}
                isActive={isActive}
                tierCounts={res.tierCounts}
            />
        </DashboardAppWorkbench>
    );
}
