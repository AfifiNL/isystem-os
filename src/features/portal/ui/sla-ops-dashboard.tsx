"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
    updateTaskStatus,
    createFacilityLocation as createClientProject,
    createCleaningTask as createSlaTask,
    updatePortalClientProfile,
    type PortalClientWithLocations,
    type FacilityLocation,
    type CleaningSchedule,
    type ProfileOption,
} from "@/features/portal/actions/facility-operations-actions";
import {
    computeTaskDueState,
    frequencyLabelToKind,
    isTaskOnTrack,
} from "@/features/portal/lib/sla-overdue";
import { ManagerTaskNotes } from "@/features/portal/ui/manager-task-notes";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
    compliant: {
        label: "On track",
        emoji: "✅",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/35 dark:text-emerald-300 dark:border-emerald-900/50",
        dot: "bg-emerald-500",
    },
    pending: {
        label: "At risk",
        emoji: "⏳",
        badge: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-900/50",
        dot: "bg-amber-500",
    },
    issue: {
        label: "Blocked",
        emoji: "🚨",
        badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/50",
        dot: "bg-red-500",
    },
} as const;

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[15px] font-medium ${cfg.badge}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    );
}

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Task row with quick-action buttons
// ---------------------------------------------------------------------------

interface TaskRowProps {
    task: CleaningSchedule;
    onStatusChange: (taskId: string, status: "compliant" | "pending" | "issue") => Promise<void>;
    isPending: boolean;
}

function TaskRow({ task, onStatusChange, isPending }: TaskRowProps) {
    const [local, setLocal] = useState<CleaningSchedule>(task);

    async function handleChange(status: "compliant" | "pending" | "issue") {
        // Optimistic update
        setLocal((prev) => ({
            ...prev,
            status,
            last_completed_at:
                status === "compliant" ? new Date().toISOString() : prev.last_completed_at,
        }));
        await onStatusChange(task.id, status);
    }

    const statuses = ["compliant", "pending", "issue"] as const;

    const dueState = computeTaskDueState(local);

    return (
        <tr className="border-b last:border-0 hover:bg-muted/40 transition-colors">
            <td className="py-3 pl-4 pr-2 text-[17px] font-medium text-foreground">
                {local.task_name}
                {dueState.isOverdue ? (
                    <span className="ml-2 inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-red-800 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/50">
                        Overdue · {dueState.daysOverdue}d
                    </span>
                ) : dueState.dueAt && dueState.daysUntilDue !== null && dueState.daysUntilDue <= 3 ? (
                    <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-900/50">
                        Due in {dueState.daysUntilDue}d
                    </span>
                ) : null}
            </td>
            <td className="py-3 px-2 text-[17px] text-muted-foreground">{local.frequency ?? "—"}</td>
            <td className="py-3 px-2">
                <StatusBadge status={local.status} />
            </td>
            <td className="py-3 px-2 text-[15px] text-muted-foreground whitespace-nowrap">
                {formatDate(local.last_completed_at)}
                {dueState.dueAt ? (
                    <div className="text-[13px] mt-0.5 opacity-70">
                        Next due {formatDate(dueState.dueAt)}
                    </div>
                ) : null}
                <div className="mt-1">
                    <ManagerTaskNotes scheduleId={task.id} />
                </div>
            </td>
            <td className="py-3 pl-2 pr-4">
                <div className="flex items-center gap-1">
                    {statuses.map((s) => {
                        const cfg = STATUS_CONFIG[s];
                        const isActive = local.status === s;
                        return (
                            <button
                                key={s}
                                onClick={() => handleChange(s)}
                                disabled={isPending || isActive}
                                title={cfg.label}
                                className={`rounded px-1.5 py-0.5 text-[17px] transition-all ${isActive
                                    ? "opacity-40 cursor-default"
                                    : "hover:scale-110 hover:shadow"
                                    } disabled:pointer-events-none`}
                            >
                                {cfg.emoji}
                            </button>
                        );
                    })}
                </div>
            </td>
        </tr>
    );
}

// ---------------------------------------------------------------------------
// Inline "Add Task" form
// ---------------------------------------------------------------------------

interface AddTaskFormProps {
    projectId: string;
    onDone: () => void;
}

function AddTaskForm({ projectId, onDone }: AddTaskFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [taskName, setTaskName] = useState("");
    const [frequency, setFrequency] = useState("Daily");
    const [error, setError] = useState<string | null>(null);

    function submit() {
        if (!taskName.trim()) return;
        startTransition(async () => {
            const { error: err } = await createSlaTask(
                projectId,
                taskName,
                frequency,
                { frequencyKind: frequencyLabelToKind(frequency) },
            );
            if (err) {
                setError(err);
                return;
            }
            router.refresh();
            onDone();
        });
    }

    return (
        <div className="flex flex-wrap items-end gap-2 px-4 py-3 bg-muted/60 border-t">
            <div className="flex-1 min-w-40">
                <label className="block text-[14px] text-muted-foreground mb-1 font-semibold">Task name</label>
                <input
                    type="text"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="e.g. Monthly SEO review"
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-[17px] focus:outline-none focus:ring-1 focus:ring-ring"
                />
            </div>
            <div className="w-36">
                <label className="block text-[14px] text-muted-foreground mb-1 font-semibold">Frequency</label>
                <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-[17px] focus:outline-none focus:ring-1 focus:ring-ring"
                >
                    {["Daily", "Weekly", "Bi-weekly", "Monthly", "Quarterly", "On-demand"].map(
                        (f) => <option key={f}>{f}</option>
                    )}
                </select>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={submit}
                    disabled={isPending || !taskName.trim()}
                    aria-busy={isPending || undefined}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {isPending ? "Adding…" : "Add SLA Item"}
                </button>
                <button
                    onClick={onDone}
                    disabled={isPending}
                    className="rounded-md border px-3 py-1.5 text-[17px] hover:bg-muted transition-colors cursor-pointer"
                >
                    Cancel
                </button>
            </div>
            {error && <p className="w-full text-[15px] text-destructive">{error}</p>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Client project accordion card
// ---------------------------------------------------------------------------

interface LocationCardProps {
    location: FacilityLocation;
    clientId: string;
}

function ClientProjectCard({ location }: LocationCardProps) {
    const router = useRouter();
    const [open, setOpen] = useState(true);
    const [showAddTask, setShowAddTask] = useState(false);
    const [isPending, startTransition] = useTransition();

    async function handleStatusChange(
        taskId: string,
        status: "compliant" | "pending" | "issue"
    ) {
        await new Promise<void>((resolve) => {
            startTransition(async () => {
                await updateTaskStatus(taskId, status);
                router.refresh();
                resolve();
            });
        });
    }

    const now = new Date();
    const total = location.cleaning_schedules.length;
    const onTrack = location.cleaning_schedules.filter((s) => isTaskOnTrack(s, now)).length;
    const overdue = location.cleaning_schedules.filter((s) => computeTaskDueState(s, now).isOverdue).length;
    const pct = total > 0 ? Math.round((onTrack / total) * 100) : 100;
    const pctColor = pct >= 90 ? "text-emerald-600 dark:text-emerald-300" : pct >= 70 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300";

    return (
        <div className="rounded-md border border-border/60 bg-card/40 shadow-2xs overflow-hidden">
            {/* Client project header */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left cursor-pointer"
            >
                <div className="min-w-0">
                    <p className="font-semibold text-[17px] truncate text-foreground">{location.name}</p>
                    {location.address && (
                        <p className="text-[15px] text-muted-foreground truncate">{location.address}</p>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[17px] font-bold tabular-nums ${pctColor}`}>{pct}%</span>
                    <span className="text-[15px] text-muted-foreground">{onTrack}/{total}</span>
                    {overdue > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-wider text-red-800 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/50">
                            {overdue} overdue
                        </span>
                    ) : null}
                    <svg
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Collapsible table */}
            {open && (
                <>
                    {total === 0 ? (
                        <div className="px-4 py-6 text-center text-[17px] text-muted-foreground border-t border-border/50 bg-background/20">
                            No SLA items yet for this scope.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border-t border-border/50">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 border-b border-border/50">
                                    <tr>
                                        <th className="py-2 pl-4 pr-2 text-left text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">SLA item</th>
                                        <th className="py-2 px-2 text-left text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Frequency</th>
                                        <th className="py-2 px-2 text-left text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                        <th className="py-2 px-2 text-left text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Last Completed</th>
                                        <th className="py-2 pl-2 pr-4 text-left text-[14px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {location.cleaning_schedules.map((task) => (
                                        <TaskRow
                                            key={task.id}
                                            task={task}
                                            onStatusChange={handleStatusChange}
                                            isPending={isPending}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Add Task form / button */}
                    {showAddTask ? (
                        <AddTaskForm
                            projectId={location.id}
                            onDone={() => setShowAddTask(false)}
                        />
                    ) : (
                        <div className="px-4 py-2.5 border-t border-border/50 bg-muted/10">
                            <button
                                onClick={() => setShowAddTask(true)}
                                className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
                            >
                                <span className="text-[17px] leading-none">+</span> Add SLA Item
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// "Add Client Project" inline form
// ---------------------------------------------------------------------------

interface AddLocationFormProps {
    clientId: string;
    onDone: () => void;
}

function AddClientProjectForm({ clientId, onDone }: AddLocationFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [error, setError] = useState<string | null>(null);

    function submit() {
        if (!name.trim()) return;
        startTransition(async () => {
            const { error: err } = await createClientProject(clientId, name, address);
            if (err) {
                setError(err);
                return;
            }
            router.refresh();
            onDone();
        });
    }

    return (
        <div className="rounded-md border border-border/60 bg-card/40 shadow-2xs p-6 space-y-4">
            <h3 className="font-semibold text-[17px] text-foreground">New Delivery Scope</h3>
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-[14px] text-muted-foreground mb-1 font-semibold">Scope name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Legal content retainer"
                        className="w-full rounded-md border bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
                <div>
                    <label className="block text-[14px] text-muted-foreground mb-1 font-semibold">Context / notes</label>
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. Monthly advisory + SEO operations for legal practice website"
                        className="w-full rounded-md border bg-background px-3 py-2 text-[17px] focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
            </div>
            {error && <p className="text-[15px] text-destructive">{error}</p>}
            <div className="flex gap-2">
                <button
                    onClick={submit}
                    disabled={isPending || !name.trim()}
                    aria-busy={isPending || undefined}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isPending ? "Creating…" : "Create Scope"}
                </button>
                <button
                    onClick={onDone}
                    disabled={isPending}
                    className="rounded-md border px-4 py-2 text-[17px] hover:bg-muted transition-colors cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------

interface SlaOpsDashboardProps {
    client: PortalClientWithLocations;
    profiles: ProfileOption[];
}

export function SlaOpsDashboard({ client, profiles }: SlaOpsDashboardProps) {
    const router = useRouter();
    const [showAddProject, setShowAddProject] = useState(false);
    const [isUpdatingProfile, startUpdatingProfile] = useTransition();

    function handleProfileChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const newProfileId = e.target.value;
        startUpdatingProfile(async () => {
            await updatePortalClientProfile(client.id, newProfileId === "unassigned" ? null : newProfileId);
            router.refresh();
        });
    }

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
        <div className="space-y-6">
            {/* Header / Info section */}
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                    <div>
                        <h1 className="text-[33px] font-bold tracking-tight text-foreground">
                            {client.company_name ?? "Client Operations"}
                        </h1>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                                href={`/dashboard/clients/${client.id}`}
                                className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-1.5 text-[15px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                            >
                                Open client console
                            </Link>
                            <Link
                                href="/dashboard/clients"
                                className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-1.5 text-[15px] font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                            >
                                Back to Client Ops
                            </Link>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <label className="text-[15px] text-muted-foreground font-semibold">Linked Owner:</label>
                            <select
                                value={client.profile_id ?? "unassigned"}
                                onChange={handleProfileChange}
                                disabled={isUpdatingProfile}
                                className="h-8 rounded-md border border-input bg-transparent px-2.5 py-1 text-[15px] shadow-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                            >
                                <option value="unassigned">— Unassigned —</option>
                                {profiles.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.email} {p.role === "admin" ? "(Admin)" : ""}
                                    </option>
                                ))}
                            </select>
                            {isUpdatingProfile && <span className="text-[15px] text-muted-foreground animate-pulse">Saving...</span>}
                        </div>
                        <p className="text-[17px] text-muted-foreground mt-3">
                            {client.locations.length} scope{client.locations.length !== 1 ? "s" : ""} ·{" "}
                            {client.totalTasks} item{client.totalTasks !== 1 ? "s" : ""} total
                        </p>
                    </div>
                </div>

                {/* SLA summary */}
                <div className="grid gap-4 grid-cols-3 xl:min-w-[440px]">
                    <div className="rounded-md border border-border/60 bg-background/75 p-5 shadow-xs text-center">
                        <p className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">SLA Health</p>
                        <p className={`mt-3 text-[33px] font-bold tabular-nums ${slaColor}`}>
                            {client.slaPercentage}%
                        </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/75 p-5 shadow-xs text-center">
                        <p className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">On track</p>
                        <p className="mt-3 text-[33px] font-bold tabular-nums text-emerald-600 dark:text-emerald-300">
                            {client.compliantTasks}
                        </p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/75 p-5 shadow-xs text-center">
                        <p className="text-[14px] uppercase tracking-wider text-muted-foreground font-semibold">Total Items</p>
                        <p className="mt-3 text-[33px] font-bold tabular-nums text-foreground">
                            {client.totalTasks}
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                    style={{ width: `${client.slaPercentage}%` }}
                />
            </div>

            {/* Client projects section + Add project */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-[21px] font-semibold text-foreground">Delivery Scopes</h2>
                    {!showAddProject && (
                        <button
                            onClick={() => setShowAddProject(true)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-[15px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                            <span className="text-[17px] leading-none">+</span> Add Scope
                        </button>
                    )}
                </div>

                {showAddProject && (
                    <AddClientProjectForm
                        clientId={client.id}
                        onDone={() => setShowAddProject(false)}
                    />
                )}

                {client.locations.length === 0 && !showAddProject ? (
                    <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-12 text-center text-muted-foreground">
                        <p className="font-semibold text-[19px]">No scopes for this client yet.</p>
                        <p className="text-[17px] mt-1">Click &quot;Add Scope&quot; to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {client.locations.map((location) => (
                            <ClientProjectCard
                                key={location.id}
                                location={location}
                                clientId={client.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
