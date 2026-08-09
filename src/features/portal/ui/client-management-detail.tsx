"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
    deletePortalClient,
    updatePortalClient,
    type PortalClientBookingSummary,
    type PortalClientDetail,
    type ProfileOption,
} from "@/features/portal/actions/facility-operations-actions";
import { PremiumInlinePending } from "@/shared/ui/loading";

interface ClientManagementDetailProps {
    client: PortalClientDetail;
    profiles: ProfileOption[];
    recentBookings?: PortalClientBookingSummary[];
}

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function formatReservationStatus(status: string): string {
    return status.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

function getSlaTone(slaPercentage: number) {
    if (slaPercentage >= 90) {
        return {
            text: "text-emerald-600 dark:text-emerald-300",
            badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            bar: "from-emerald-400 via-emerald-500 to-teal-500",
            label: "Stable",
        };
    }

    if (slaPercentage >= 70) {
        return {
            text: "text-amber-600 dark:text-amber-300",
            badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            bar: "from-amber-400 via-amber-500 to-orange-500",
            label: "Monitor",
        };
    }

    return {
        text: "text-rose-600 dark:text-rose-300",
        badge: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
        bar: "from-rose-400 via-rose-500 to-red-500",
        label: "Intervene",
    };
}

export function ClientManagementDetail({ client, profiles, recentBookings = [] }: ClientManagementDetailProps) {
    const router = useRouter();
    const [companyName, setCompanyName] = useState(client.company_name ?? "");
    const [profileId, setProfileId] = useState(client.profile_id ?? "unassigned");
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, startSaving] = useTransition();
    const [isDeleting, startDeleting] = useTransition();

    const tone = useMemo(() => getSlaTone(client.slaPercentage), [client.slaPercentage]);
    const hasChanges = companyName.trim() !== (client.company_name ?? "") || profileId !== (client.profile_id ?? "unassigned");

    function handleSave() {
        setError(null);
        setFeedback(null);

        startSaving(async () => {
            const result = await updatePortalClient(client.id, {
                companyName,
                profileId: profileId === "unassigned" ? null : profileId,
            });

            if (result.error) {
                setError(result.error);
                return;
            }

            setFeedback("Client account updated.");
            router.refresh();
        });
    }

    function handleDelete() {
        setError(null);
        setFeedback(null);

        startDeleting(async () => {
            const result = await deletePortalClient(client.id);

            if (result.error) {
                setError(result.error);
                return;
            }

            router.push("/dashboard/clients");
            router.refresh();
        });
    }

    return (
        <div className="space-y-6">
            <section className="premium-panel premium-glow relative overflow-hidden rounded-md border p-6 shadow-xs">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
                <div className="relative space-y-5">
                    <div className="flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
                        <Link href="/dashboard/clients" className="transition hover:text-foreground">
                            Client Management
                        </Link>
                        <span>/</span>
                        <Link href="/dashboard/slas" className="transition hover:text-foreground">
                            SLA Operations
                        </Link>
                        <span>/</span>
                        <span className="font-medium text-foreground">{client.company_name ?? "Client account"}</span>
                    </div>

                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-4">
                            <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[14px] font-semibold uppercase tracking-[0.22em] ${tone.badge}`}>
                                {tone.label} · Account operations
                            </div>
                            <div>
                                <h1 className="text-[33px] font-semibold tracking-tight text-foreground md:text-[39px]">
                                    {client.company_name ?? "Unnamed client"}
                                </h1>
                                <p className="mt-3 max-w-3xl text-[17px] leading-7 text-muted-foreground">
                                    Maintain account ownership, linked portal access, SLA templates, and delivery continuity from a single manager-facing console.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href={`/dashboard/slas/${client.id}`}
                                    className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-[17px] font-medium text-primary-foreground transition hover:bg-primary/90"
                                >
                                    Open SLA template
                                </Link>
                                <Link
                                    href="/dashboard/slas"
                                    className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-4 py-2 text-[17px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                                >
                                    Back to SLA workspace queue
                                </Link>
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[440px]">
                            <div className="rounded-md border border-border/60 bg-background/75 p-5 shadow-xs">
                                <p className="text-[14px] uppercase tracking-[0.18em] text-muted-foreground">SLA health</p>
                                <p className={`mt-3 text-[33px] font-semibold tracking-tight ${tone.text}`}>{client.slaPercentage}%</p>
                                <p className="mt-2 text-[17px] text-muted-foreground">
                                    {client.onTrackTasks}/{client.totalTasks} on track
                                    {client.overdueTasks > 0 ? (
                                        <span className="ml-1.5 inline-flex items-center rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-red-800">
                                            {client.overdueTasks} overdue
                                        </span>
                                    ) : null}
                                </p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background/75 p-5 shadow-xs">
                                <p className="text-[14px] uppercase tracking-[0.18em] text-muted-foreground">Scopes</p>
                                <p className="mt-3 text-[33px] font-semibold tracking-tight text-foreground">{client.locations.length}</p>
                                <p className="mt-2 text-[17px] text-muted-foreground">Engagement scopes onboarded</p>
                            </div>
                            <div className="rounded-md border border-border/60 bg-background/75 p-5 shadow-xs">
                                <p className="text-[14px] uppercase tracking-[0.18em] text-muted-foreground">Client since</p>
                                <p className="mt-3 text-[23px] font-semibold tracking-tight text-foreground">{formatDate(client.created_at)}</p>
                                <p className="mt-2 text-[17px] text-muted-foreground">Workspace account record created</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full bg-gradient-to-r ${tone.bar}`} style={{ width: `${client.slaPercentage}%` }} />
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="premium-panel rounded-md border p-6 shadow-xs">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h2 className="text-[23px] font-semibold tracking-tight text-foreground">Account context</h2>
                            <p className="mt-2 text-[17px] leading-7 text-muted-foreground">
                                Update the client record, maintain portal access linkage, and keep the SLA workspace attached to the correct operating account and engagement owner.
                            </p>
                        </div>
                        {isSaving ? <PremiumInlinePending label="Saving changes" description="Updating client record" /> : null}
                    </div>

                    <div className="mt-6 grid gap-5">
                        <div>
                            <label className="mb-2 block text-[14px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Client or organization name
                            </label>
                            <input
                                value={companyName}
                                onChange={(event) => setCompanyName(event.target.value)}
                                className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-[17px] shadow-xs outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                                placeholder="Client account"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[14px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Linked client owner
                            </label>
                            <select
                                value={profileId}
                                onChange={(event) => setProfileId(event.target.value)}
                                className="w-full rounded-md border border-border/60 bg-background px-4 py-2.5 text-[17px] shadow-xs outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="unassigned">— No linked owner —</option>
                                {profiles.map((profile) => (
                                    <option key={profile.id} value={profile.id}>
                                        {profile.email} {profile.role !== "user" ? `(${profile.role})` : ""}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-2 text-[17px] text-muted-foreground">
                                Current owner: {client.linked_profile_email ?? "No linked owner"}
                            </p>
                        </div>

                        {feedback ? <p className="text-[17px] text-emerald-600 dark:text-emerald-300">{feedback}</p> : null}
                        {error ? <p className="text-[17px] text-destructive">{error}</p> : null}

                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || isDeleting || !companyName.trim() || !hasChanges}
                                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-[17px] font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isSaving ? "Saving…" : "Save account changes"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSaving || isDeleting}
                                className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-[17px] font-medium text-rose-700 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                            >
                                {isDeleting ? "Deleting…" : "Delete empty client"}
                            </button>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="premium-panel rounded-md border p-6 shadow-xs">
                        <h2 className="text-[23px] font-semibold tracking-tight text-foreground">Workflow continuity</h2>
                        <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
                            Use the account console to keep identity and ownership clean, then hand off into SLA execution when the team needs to update scopes, service items, or delivery compliance.
                        </p>
                        <div className="mt-5 grid gap-3">
                            <Link href={`/dashboard/slas/${client.id}`} className="rounded-md border border-border/60 bg-background/70 px-4 py-2.5 text-[17px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 text-center">
                                Continue to SLA template
                            </Link>
                            <Link href="/dashboard/slas" className="rounded-md border border-border/60 bg-background/70 px-4 py-2.5 text-[17px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 text-center">
                                Review all SLA workspaces
                            </Link>
                        </div>
                    </div>

                    <div className="premium-panel rounded-md border p-6 shadow-xs">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[23px] font-semibold tracking-tight text-foreground">Recent bookings</h2>
                                <p className="mt-1 text-[17px] text-muted-foreground">Reservations linked to this client account.</p>
                            </div>
                            <Link
                                href="/dashboard/booking"
                                className="shrink-0 rounded-md border border-border/60 bg-background/77 px-3 py-1.5 text-[14px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                            >
                                Open booking inbox
                            </Link>
                        </div>
                        <div className="mt-5 space-y-3">
                            {recentBookings.length === 0 ? (
                                <div className="rounded-md border border-dashed px-4 py-6 text-[17px] text-muted-foreground text-center">
                                    No bookings linked to this client yet.
                                </div>
                            ) : (
                                recentBookings.map((booking) => (
                                    <div key={booking.id} className="rounded-md border border-border/60 bg-background/70 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-[14px] uppercase tracking-[0.18em] text-muted-foreground">{booking.public_reference}</p>
                                                <p className="mt-1 font-medium text-foreground text-[19px]">{booking.customer_full_name}</p>
                                                <p className="text-[17px] text-muted-foreground">{booking.customer_email}</p>
                                            </div>
                                            <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[14px] font-semibold uppercase tracking-[0.16em] text-primary">
                                                {formatReservationStatus(booking.status)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-[17px] text-muted-foreground">
                                            Starts {formatDateTime(booking.scheduled_start)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="premium-panel rounded-md border p-6 shadow-xs">
                        <h2 className="text-[23px] font-semibold tracking-tight text-foreground">Scope overview</h2>
                        <div className="mt-5 space-y-3">
                            {client.locationsSummary.length === 0 ? (
                                <div className="rounded-md border border-dashed px-4 py-6 text-[17px] text-muted-foreground text-center">
                                    No scopes yet. Create the first delivery scope from the SLA template view.
                                </div>
                            ) : (
                                client.locationsSummary.map((location) => {
                                    const locationTone = getSlaTone(location.slaPercentage);

                                    return (
                                        <div key={location.id} className="rounded-md border border-border/60 bg-background/70 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium text-foreground text-[19px]">{location.name}</p>
                                                    <p className="mt-1 text-[17px] text-muted-foreground">{location.address ?? "Context not set"}</p>
                                                </div>
                                                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[14px] font-semibold uppercase tracking-[0.16em] ${locationTone.badge}`}>
                                                    {location.slaPercentage}%
                                                </span>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between text-[17px] text-muted-foreground">
                                                <span>
                                                    {location.onTrackTasks}/{location.totalTasks} on track
                                                    {location.overdueTasks > 0 ? (
                                                        <span className="ml-1.5 inline-flex items-center rounded-full border border-red-300 bg-red-100 px-1.5 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-red-800">
                                                            {location.overdueTasks} overdue
                                                        </span>
                                                    ) : null}
                                                </span>
                                                <span>Added {formatDate(location.created_at)}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
