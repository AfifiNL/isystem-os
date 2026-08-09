"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { AddClientButton } from "@/features/portal/ui/add-client-button";
import {
    bulkDeletePortalClients,
    type PortalClientListItem,
    type ProfileOption,
} from "@/features/portal/actions/facility-operations-actions";
import {
    BulkActionButton,
    BulkActionToolbar,
    SelectionCheckbox,
} from "@/shared/ui/list-controls";
import { Button } from "@/shared/ui/button";
import { AppSectionHeader, AppMetricStrip, AppMetric } from "@/features/admin/ui/app-workbench";

interface ClientManagementListProps {
    clients: PortalClientListItem[];
    profiles: ProfileOption[];
    workspaceName: string;
    workspaceTier: "basic" | "pro";
    error?: string | null;
}

function formatSince(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

function getHealthTone(slaPercentage: number) {
    if (slaPercentage >= 90) {
        return {
            text: "text-emerald-600 dark:text-emerald-300",
            bar: "from-emerald-400 via-emerald-500 to-teal-500",
            badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            label: "Healthy",
        };
    }

    if (slaPercentage >= 70) {
        return {
            text: "text-amber-600 dark:text-amber-300",
            bar: "from-amber-400 via-amber-500 to-orange-500",
            badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            label: "Watching",
        };
    }

    return {
        text: "text-rose-600 dark:text-rose-300",
        bar: "from-rose-400 via-rose-500 to-red-500",
        badge: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        label: "Needs action",
    };
}

function getRiskTone(riskLevel: "low" | "medium" | "high" | "critical" | null) {
    switch (riskLevel) {
        case "critical":
            return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
        case "high":
            return "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300";
        case "medium":
            return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
        case "low":
            return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
        default:
            return "border-border/60 bg-background/70 text-muted-foreground";
    }
}

export function ClientManagementList({
    clients,
    profiles,
    workspaceName,
    error,
}: ClientManagementListProps) {
    const router = useRouter();
    const totalLocations = clients.reduce((sum, client) => sum + client.locations.length, 0);
    const totalTasks = clients.reduce((sum, client) => sum + client.totalTasks, 0);
    const totalOnTrack = clients.reduce((sum, client) => sum + client.onTrackTasks, 0);
    const totalOverdue = clients.reduce((sum, client) => sum + client.overdueTasks, 0);
    const workspaceSla = totalTasks > 0 ? Math.round((totalOnTrack / totalTasks) * 1000) / 10 : 100;
    const linkedAccounts = clients.filter((client) => Boolean(client.profile_id)).length;

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionInfo, setActionInfo] = useState<string | null>(null);

    // Drop ids that are no longer in the rendered list (e.g. after a refresh
    // that paginated past them) so "select all" stays in sync.
    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(clients.map((c) => c.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [clients]);

    // Only clients with zero locations / tasks are safe to delete in bulk —
    // matches the safety contract of the single-row delete. Non-eligible
    // rows show a checkbox in the disabled state with an explanatory title.
    const isEligible = (client: PortalClientListItem) =>
        client.locations.length === 0 && client.totalTasks === 0;
    const eligibleIds = clients.filter(isEligible).map((c) => c.id);
    const allSelected =
        eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(eligibleIds));
    };
    const toggleOne = (id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleBulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (
            !confirm(
                `Delete ${ids.length} client account${ids.length === 1 ? "" : "s"}? Clients still attached to locations or SLA tasks will be skipped.`,
            )
        )
            return;
        setActionError(null);
        setActionInfo(null);
        startTransition(async () => {
            const res = await bulkDeletePortalClients(ids);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            const parts: string[] = [];
            parts.push(
                `Deleted ${res.deleted} client${res.deleted === 1 ? "" : "s"}.`,
            );
            if (res.skipped > 0) {
                parts.push(
                    `${res.skipped} skipped${res.skippedReason ? ` — ${res.skippedReason}` : "."}`,
                );
            }
            setActionInfo(parts.join(" "));
            setSelected(new Set());
            router.refresh();
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <AppSectionHeader
                    title="Client Accounts"
                    description={`Manage client accounts for ${workspaceName}, maintain ownership continuity, and link SLA templates.`}
                />
                <div className="flex flex-wrap gap-2">
                    <Button size="xs" variant="outline" asChild className="cursor-pointer">
                        <Link href="/dashboard/slas">
                            Open SLA Workspaces
                        </Link>
                    </Button>
                    <AddClientButton profiles={profiles} variant="panel" />
                </div>
            </div>

            <AppMetricStrip>
                <AppMetric label="Client Accounts" value={clients.length} description={`${linkedAccounts} linked owners`} />
                <AppMetric label="Delivery Scopes" value={totalLocations} description="Across managed client accounts" />
                <AppMetric
                    label="SLA Health"
                    value={`${workspaceSla}%`}
                    variant={workspaceSla >= 90 ? "success" : workspaceSla >= 70 ? "warning" : "destructive"}
                    description={totalOverdue > 0 ? `${totalOnTrack}/${totalTasks} on track · ${totalOverdue} overdue` : `${totalOnTrack}/${totalTasks} items on track`}
                />
                <AppMetric label="Profiles Ready" value={profiles.length} description="Available owners for linking" />
            </AppMetricStrip>

            {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-[15px] text-destructive">
                    {error}
                </div>
            ) : null}

            {!error && clients.length === 0 ? (
                <section className="rounded-md border border-dashed border-border/60 bg-background/40 p-12 text-center">
                    <div className="mx-auto max-w-2xl space-y-4 text-[15px]">
                        <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
                            No client accounts yet
                        </h2>
                        <p className="text-muted-foreground">
                            Create the first client account to establish ownership, connect the right workspace profile, and prepare SLA templates.
                        </p>
                        <div className="flex justify-center pt-2">
                            <AddClientButton profiles={profiles} variant="panel" />
                        </div>
                    </div>
                </section>
            ) : null}

            {clients.length > 0 ? (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3.5 py-2.5 text-[15px]">
                        <div className="inline-flex items-center gap-2 text-muted-foreground">
                            <SelectionCheckbox
                                checked={allSelected}
                                indeterminate={someSelected}
                                onCheckedChange={toggleSelectAll}
                                disabled={eligibleIds.length === 0}
                                label="Select all deletable clients on this page"
                                title={eligibleIds.length === 0 ? "No clients on this page can be deleted" : "Select all deletable clients"}
                            />
                            <span>
                                {selected.size === 0
                                    ? "Select clients"
                                    : selected.size === eligibleIds.length
                                        ? "All eligible chosen"
                                        : `${selected.size} selected`}
                            </span>
                        </div>
                        {eligibleIds.length < clients.length ? (
                            <span className="text-muted-foreground text-[13px]">
                                {clients.length - eligibleIds.length} client
                                {clients.length - eligibleIds.length === 1 ? "" : "s"} excluded — clear locations/tasks first
                            </span>
                        ) : null}
                    </div>

                    <BulkActionToolbar count={selected.size} onClear={() => setSelected(new Set())}>
                        <BulkActionButton
                            onClick={handleBulkDelete}
                            pending={isPending}
                            icon={<Trash2 className="h-3 w-3" />}
                            label="Delete selected"
                            tone="destructive"
                        />
                    </BulkActionToolbar>

                    {actionError ? (
                        <p
                            role="alert"
                            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[15px] text-destructive"
                        >
                            <AlertTriangle className="h-3 w-3" /> {actionError}
                        </p>
                    ) : null}
                    {actionInfo ? (
                        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[15px] text-emerald-700 dark:text-emerald-300">
                            {actionInfo}
                        </p>
                    ) : null}

                    <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                        {clients.map((client) => {
                            const tone = getHealthTone(client.slaPercentage);
                            const eligible = isEligible(client);
                            const checked = selected.has(client.id);

                            return (
                                <article
                                    key={client.id}
                                    className="relative rounded-md border border-border/60 bg-card/40 p-5 shadow-2xs group"
                                >
                                    <div
                                        className={`absolute left-3 top-3 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border bg-background/95 shadow-sm ${
                                            eligible
                                                ? "border-border/60 hover:border-primary/40"
                                                : "cursor-not-allowed border-border/30 opacity-50"
                                        }`}
                                    >
                                        <SelectionCheckbox
                                            checked={checked}
                                            disabled={!eligible}
                                            onCheckedChange={(nextChecked) => toggleOne(client.id, nextChecked)}
                                            label={`Select ${client.company_name ?? "client"}`}
                                            title={eligible ? "Select for bulk delete" : "Has attached locations or SLA tasks — clear those first to enable bulk delete"}
                                            size="sm"
                                        />
                                    </div>

                                    <div className="relative flex flex-col gap-5 pt-2">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-2.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[13px] font-semibold uppercase ${tone.badge}`}>
                                                        {tone.label}
                                                    </span>
                                                    {client.antiAbuseRiskLevel ? (
                                                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[13px] font-semibold uppercase ${getRiskTone(client.antiAbuseRiskLevel)}`}>
                                                            Public risk · {client.antiAbuseRiskLevel}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div>
                                                    <h2 className="text-[19px] font-semibold tracking-tight text-foreground transition group-hover:text-primary">
                                                        {client.company_name ?? "Unnamed account"}
                                                    </h2>
                                                    <p className="mt-1 text-[13px] text-muted-foreground">
                                                        Added {formatSince(client.created_at)} · {client.linked_profile_email ?? "No linked owner yet"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-right shadow-2xs">
                                                <p className="text-[13px] uppercase text-muted-foreground font-semibold">SLA Health</p>
                                                <p className={`mt-1 text-[23px] font-bold tracking-tight ${tone.text}`}>
                                                    {client.slaPercentage}%
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 grid-cols-3">
                                            <div className="rounded-md border border-border/50 bg-background/60 p-3">
                                                <p className="text-[13px] uppercase text-muted-foreground font-semibold">Scopes</p>
                                                <p className="mt-1.5 text-[21px] font-semibold text-foreground">{client.locations.length}</p>
                                            </div>
                                            <div className="rounded-md border border-border/50 bg-background/60 p-3">
                                                <p className="text-[13px] uppercase text-muted-foreground font-semibold">Items</p>
                                                <p className="mt-1.5 text-[21px] font-semibold text-foreground">{client.totalTasks}</p>
                                            </div>
                                            <div className="rounded-md border border-border/50 bg-background/60 p-3">
                                                <p className="text-[13px] uppercase text-muted-foreground font-semibold">Owner Role</p>
                                                <p className="mt-1.5 text-[15px] font-semibold text-foreground truncate">{client.linked_profile_role ?? "Pending"}</p>
                                            </div>
                                        </div>

                                        {client.antiAbuseRiskLevel ? (
                                            <div className="rounded-md border border-border/60 bg-background/60 p-3.5 text-[15px] text-muted-foreground">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Public submission risk</span>
                                                    <span className="font-semibold text-foreground">{client.antiAbuseRiskScore ?? 0}/100</span>
                                                </div>
                                                <p className="mt-1.5 text-[13px] leading-relaxed">
                                                    {client.antiAbuseFlaggedSubmissions} flagged public submission{client.antiAbuseFlaggedSubmissions === 1 ? "" : "s"} linked.
                                                </p>
                                            </div>
                                        ) : null}

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                                                <span>SLA continuity</span>
                                                <span>
                                                    {client.onTrackTasks}/{client.totalTasks} on track
                                                    {client.overdueTasks > 0 ? (
                                                        <span className="ml-1.5 inline-flex items-center rounded bg-red-100 dark:bg-red-900/35 px-1.5 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                                                            {client.overdueTasks} overdue
                                                        </span>
                                                    ) : null}
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${client.slaPercentage}%` }} />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                            <Button size="xs" asChild className="cursor-pointer text-[13px]">
                                                <Link href={`/dashboard/clients/${client.id}`}>
                                                    Open Account
                                                </Link>
                                            </Button>
                                            <Button size="xs" variant="outline" asChild className="cursor-pointer text-[13px]">
                                                <Link href={`/dashboard/slas/${client.id}`}>
                                                    SLA Template
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                </>
            ) : null}
        </div>
    );
}
