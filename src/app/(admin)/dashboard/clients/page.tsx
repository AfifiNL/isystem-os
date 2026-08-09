import Link from "next/link";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { fetchAvailableProfiles, listWorkspacePortalClients } from "@/features/portal/actions/facility-operations-actions";
import { ClientManagementList } from "@/features/portal/ui/client-management-list";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppTabList
} from "@/features/admin/ui/app-workbench";

export const metadata = {
    title: "Client Management | Admin",
    description: "Manage portal clients, account linkage, and SLA workflow continuity.",
};

function parseInt10(v: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function str(v: string | string[] | undefined): string {
    if (!v) return "";
    return Array.isArray(v) ? v[0] ?? "" : v;
}
function buildHref(
    base: string,
    current: Record<string, string | string[] | undefined>,
    patch: Record<string, string | null>,
): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) {
        if (v == null) continue;
        const s = Array.isArray(v) ? v.join(",") : v;
        if (s) params.set(k, s);
    }
    for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
}

interface ClientsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
    const state = await requireAdminDashboardState();

    if (state.role !== "admin" && state.role !== "manager") {
        return null;
    }

    const tabs = [
        { label: "Clients", value: "clients", href: "/dashboard/clients", active: true },
        { label: "SLA Operations", value: "slas", href: "/dashboard/slas" },
    ];

    if (state.workspace.workspace_tier === "basic") {
        return (
            <DashboardAppWorkbench>
                <AppCommandBar>
                    <AppTabList tabs={tabs} />
                </AppCommandBar>
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                    <div>
                        <p className="mt-2 text-muted-foreground text-[15px]">
                            Manage workspace client accounts, account linkage, and SLA handoff in one operations surface.
                        </p>
                    </div>

                    <ProFeatureNotice
                        title="Client Management requires Pro"
                        description="Centralize client accounts, keep portal identities linked, and move directly into SLA detail without losing account context."
                        ctaLabel="Activate Pro for Client Management"
                        benefits={[
                            "Manage portal client accounts in one console.",
                            "Keep profile linkage and workspace identity clean.",
                            "Move from account context directly into SLA operations.",
                        ]}
                    />
                </div>
            </DashboardAppWorkbench>
        );
    }

    const params = await searchParams;
    const search = str(params.q);
    const page = Math.max(1, parseInt10(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 20)));

    const [clientsResult, profilesResult] = await Promise.all([
        listWorkspacePortalClients({ search, page, pageSize }),
        fetchAvailableProfiles(),
    ]);

    const totalPages = Math.max(1, Math.ceil(clientsResult.total / pageSize));
    const first = clientsResult.total === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(clientsResult.total, page * pageSize);

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <AppTabList tabs={tabs} />
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                <form action="/dashboard/clients" className="flex flex-wrap items-center gap-2">
                    {Object.entries(params).map(([k, v]) => {
                        if (k === "q" || k === "page") return null;
                        const s = Array.isArray(v) ? v.join(",") : v;
                        if (!s) return null;
                        return <input key={k} type="hidden" name={k} value={s} />;
                    })}
                    <input
                        type="search"
                        name="q"
                        defaultValue={search}
                        placeholder="Search clients by company name…"
                        className="h-9 flex-1 min-w-[240px] rounded-md border border-input bg-background px-3 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button type="submit" className="h-9 rounded-md bg-primary px-3 text-[15px] font-medium text-primary-foreground cursor-pointer">
                        Search
                    </button>
                    <span className="text-[15px] text-muted-foreground ml-2">
                        {clientsResult.total === 0 ? "0 clients" : `${first}–${last} of ${clientsResult.total}`}
                    </span>
                </form>

                <ClientManagementList
                    clients={clientsResult.data}
                    profiles={profilesResult.data ?? []}
                    workspaceName={state.workspace.name}
                    workspaceTier={state.workspace.workspace_tier}
                    error={clientsResult.error ?? profilesResult.error}
                />

                {totalPages > 1 ? (
                    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 text-[15px]">
                        <Link
                            href={buildHref("/dashboard/clients", params, { page: page <= 1 ? null : String(page - 1) })}
                            aria-disabled={page <= 1}
                            className={`inline-flex h-8 items-center rounded-md border border-border/60 px-3 cursor-pointer ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                        >
                            Prev
                        </Link>
                        <span>
                            Page {page} / {totalPages}
                        </span>
                        <Link
                            href={buildHref("/dashboard/clients", params, { page: page >= totalPages ? null : String(page + 1) })}
                            aria-disabled={page >= totalPages}
                            className={`inline-flex h-8 items-center rounded-md border border-border/60 px-3 cursor-pointer ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
                        >
                            Next
                        </Link>
                    </nav>
                ) : null}
            </div>
        </DashboardAppWorkbench>
    );
}
