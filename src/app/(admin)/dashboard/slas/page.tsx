import Link from "next/link";
import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import {
    fetchAvailableProfiles,
    listWorkspacePortalClients,
} from "@/features/portal/actions/facility-operations-actions";
import { AddClientButton } from "@/features/portal/ui/add-client-button";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppTabList,
} from "@/features/admin/ui/app-workbench";

export const metadata = { title: "SLA Operations | Admin" };

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

interface SlasPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SlasIndexPage({ searchParams }: SlasPageProps) {
    await requireAdminDashboardState();
    const workspaceContext = await resolveWorkspaceContext();

    const tabs = [
        { label: "Clients", value: "clients", href: "/dashboard/clients" },
        { label: "SLA Operations", value: "slas", href: "/dashboard/slas", active: true },
    ];

    if (!workspaceContext?.productFeatures.aiGeneration) {
        return (
            <DashboardAppWorkbench>
                <AppCommandBar>
                    <AppTabList tabs={tabs} />
                </AppCommandBar>
                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <p className="text-muted-foreground text-[17px]">
                            Manage facility locations and cleaning compliance for all portal clients.
                        </p>
                    </div>

                    <ProFeatureNotice
                        title="SLA Operations is unlocked on Pro"
                        description="Track service compliance and location performance in one place."
                        ctaLabel="Activate Pro for SLA Operations"
                        benefits={[
                            "Track compliance by client and location.",
                            "Review service execution status.",
                            "Keep oversight and follow-up in one workspace.",
                        ]}
                    />
                </div>
            </DashboardAppWorkbench>
        );
    }

    const params = await searchParams;
    const search = str(params.q);
    const healthFilter = str(params.health);
    const page = Math.max(1, parseInt10(params.page, 1));
    const pageSize = Math.min(100, Math.max(5, parseInt10(params.pageSize, 18)));

    const matchHealth = (slaPercentage: number) => {
        if (healthFilter === "healthy") return slaPercentage >= 90;
        if (healthFilter === "watching") return slaPercentage >= 70 && slaPercentage < 90;
        if (healthFilter === "risk") return slaPercentage < 70;
        return true;
    };

    const [clientsResult, profilesResult] = await Promise.all([
        listWorkspacePortalClients(
            healthFilter
                ? { search, page: 1, pageSize: 1000 }
                : { search, page, pageSize },
        ),
        fetchAvailableProfiles(),
    ]);

    const profiles = profilesResult.data ?? [];

    const filteredAll = healthFilter
        ? clientsResult.data.filter((client) => matchHealth(client.slaPercentage))
        : clientsResult.data;

    const effectiveTotal = healthFilter ? filteredAll.length : clientsResult.total;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
    const safePage = Math.min(page, totalPages);
    const filteredClients = healthFilter
        ? filteredAll.slice((safePage - 1) * pageSize, safePage * pageSize)
        : filteredAll;

    const first = effectiveTotal === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const last = Math.min(effectiveTotal, safePage * pageSize);

    const FILTERS = [
        { value: "", label: "All" },
        { value: "healthy", label: "Healthy" },
        { value: "watching", label: "Watching" },
        { value: "risk", label: "At risk" },
    ] as const;

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <AppTabList tabs={tabs} />
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <p className="text-muted-foreground text-[17px]">
                        Manage facility locations and cleaning compliance for all portal clients.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <AddClientButton profiles={profiles} />
                    </div>
                </div>

                <form action="/dashboard/slas" className="flex flex-wrap items-center gap-2">
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
                        className="h-9 flex-1 min-w-[240px] rounded-md border border-input bg-background px-3 text-[17px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button type="submit" className="h-9 rounded-md bg-primary px-3 text-[17px] font-medium text-primary-foreground cursor-pointer">
                        Search
                    </button>
                    <span className="text-[17px] text-muted-foreground ml-2">
                        {effectiveTotal === 0 ? "0 clients" : `${first}–${last} of ${effectiveTotal}`}
                    </span>
                </form>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">Compliance</span>
                    {FILTERS.map((f) => {
                        const href = buildHref("/dashboard/slas", params, {
                            health: f.value || null,
                            page: null,
                        });
                        const active = (healthFilter || "") === f.value;
                        return (
                            <Link
                                key={f.label}
                                href={href}
                                className={`rounded-full px-2.5 py-1 text-[14px] font-medium transition-colors ${
                                    active
                                        ? "bg-primary text-primary-foreground"
                                        : "border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {f.label}
                            </Link>
                        );
                    })}
                </div>

                {clientsResult.error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-[17px] text-destructive">
                        {clientsResult.error}
                    </div>
                )}

                {!clientsResult.error && filteredClients.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-12 text-center text-muted-foreground">
                        <p className="font-medium text-[19px]">
                            {effectiveTotal === 0 && !healthFilter ? "No portal clients yet." : "No clients match the current filters."}
                        </p>
                        {effectiveTotal === 0 ? (
                            <p className="text-[17px] mt-1">Click &quot;+ Add Client&quot; above to create your first one.</p>
                        ) : null}
                    </div>
                )}

                {filteredClients.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredClients.map((client) => {
                            const slaColor =
                                client.slaPercentage >= 90
                                    ? "text-emerald-600 dark:text-emerald-300"
                                    : client.slaPercentage >= 70
                                        ? "text-amber-600 dark:text-amber-300"
                                        : "text-rose-600 dark:text-rose-300";

                            const progressColor =
                                client.slaPercentage >= 90
                                    ? "bg-emerald-500"
                                    : client.slaPercentage >= 70
                                        ? "bg-amber-500"
                                        : "bg-rose-500";

                            return (
                                <Link
                                    key={client.id}
                                    href={`/dashboard/slas/${client.id}`}
                                    className="group relative flex flex-col gap-4 rounded-md border bg-card/40 p-6 shadow-xs transition-all hover:shadow-sm hover:border-primary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h2 className="font-semibold text-[19px] leading-tight group-hover:text-primary transition-colors">
                                            {client.company_name ?? "Unnamed Client"}
                                        </h2>
                                        <span className="shrink-0 text-[14px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                                            {client.locations.length}{" "}
                                            {client.locations.length !== 1 ? "locations" : "location"}
                                        </span>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[14px] text-muted-foreground">Compliance</p>
                                            <p className={`text-[33px] font-bold tabular-nums ${slaColor}`}>
                                                {client.slaPercentage}%
                                            </p>
                                        </div>
                                        <div className="text-right text-[14px] text-muted-foreground">
                                            <p>
                                                {client.onTrackTasks}/{client.totalTasks} on track
                                            </p>
                                            {client.overdueTasks > 0 ? (
                                                <p className="text-rose-600 dark:text-rose-300 font-semibold">{client.overdueTasks} overdue</p>
                                            ) : (
                                                <p>no overdue items</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${progressColor}`}
                                            style={{ width: `${client.slaPercentage}%` }}
                                        />
                                    </div>
                                    <p className="text-[14px] text-muted-foreground -mt-1">Manage operations →</p>
                                    <div className="flex items-center gap-3 text-[14px] text-muted-foreground">
                                        <span>Account context</span>
                                        <span>·</span>
                                        <span>Linked SLA detail</span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {totalPages > 1 ? (
                    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 text-[17px]">
                        <Link
                            href={buildHref("/dashboard/slas", params, { page: safePage <= 1 ? null : String(safePage - 1) })}
                            aria-disabled={safePage <= 1}
                            className={`inline-flex h-8 items-center rounded-md border border-border/60 px-3 cursor-pointer ${safePage <= 1 ? "pointer-events-none opacity-40" : ""}`}
                        >
                            Prev
                        </Link>
                        <span>
                            Page {safePage} / {totalPages}
                        </span>
                        <Link
                            href={buildHref("/dashboard/slas", params, { page: safePage >= totalPages ? null : String(safePage + 1) })}
                            aria-disabled={safePage >= totalPages}
                            className={`inline-flex h-8 items-center rounded-md border border-border/60 px-3 cursor-pointer ${safePage >= totalPages ? "pointer-events-none opacity-40" : ""}`}
                        >
                            Next
                        </Link>
                    </nav>
                ) : null}
            </div>
        </DashboardAppWorkbench>
    );
}
