// Read-time SLA overdue engine. All computation derives from
// (frequency_kind, frequency_value_days, last_completed_at, grace_period_days)
// against `now`. Nothing is persisted — the same inputs always produce the
// same outputs, so there is no possibility of "the DB says compliant but the
// reality is overdue" drift.
//
// Pure module: no imports from Supabase, React, or Next. Trivially testable.

export type FrequencyKind =
    | "daily"
    | "weekly"
    | "biweekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | "on_demand"
    | "custom";

export interface DueStateInput {
    frequency_kind: FrequencyKind;
    frequency_value_days: number | null;
    last_completed_at: string | null;
    grace_period_days: number;
    status: "compliant" | "completed" | "pending" | "issue";
}

export interface DueState {
    /** Days the cadence permits between completions. null = no schedule (on_demand). */
    intervalDays: number | null;
    /** When the task is next due, derived from last_completed_at + interval. null when no schedule or never completed. */
    dueAt: string | null;
    /** True iff dueAt is in the past by more than grace_period_days. */
    isOverdue: boolean;
    /** Whole days past due (after grace). 0 when not overdue. */
    daysOverdue: number;
    /** Whole days until due (negative or zero when overdue or past due-without-grace). null when no schedule. */
    daysUntilDue: number | null;
    /** Composite check used by SLA % math: status is compliant or completed AND not overdue. */
    isOnTrack: boolean;
}

const MS_PER_DAY = 86_400_000;

export function computeIntervalDays(kind: FrequencyKind, value: number | null): number | null {
    switch (kind) {
        case "daily":
            return 1;
        case "weekly":
            return 7;
        case "biweekly":
            return 14;
        case "monthly":
            return 30;
        case "quarterly":
            return 91;
        case "yearly":
            return 365;
        case "custom":
            return value && value > 0 ? value : null;
        case "on_demand":
            return null;
    }
}

export function computeTaskDueState(task: DueStateInput, now: Date = new Date()): DueState {
    const intervalDays = computeIntervalDays(task.frequency_kind, task.frequency_value_days);

    if (intervalDays === null || !task.last_completed_at) {
        // No schedule (on_demand) or never completed yet — there is no
        // computable due date. A task that's never been marked compliant
        // can be `pending` or `issue` but cannot be "overdue" in the
        // deadline sense.
        return {
            intervalDays,
            dueAt: null,
            isOverdue: false,
            daysOverdue: 0,
            daysUntilDue: null,
            isOnTrack: task.status === "compliant" || task.status === "completed",
        };
    }

    const lastCompletedMs = new Date(task.last_completed_at).getTime();
    const dueMs = lastCompletedMs + intervalDays * MS_PER_DAY;
    const graceMs = Math.max(task.grace_period_days, 0) * MS_PER_DAY;
    const overdueThresholdMs = dueMs + graceMs;
    const nowMs = now.getTime();

    const isOverdue = nowMs > overdueThresholdMs;
    // Days past the *due* date, not the grace cutoff — that's the number a
    // manager actually wants to see ("3 days late") even when a small grace
    // is configured.
    const daysOverdue = isOverdue
        ? Math.max(1, Math.floor((nowMs - dueMs) / MS_PER_DAY))
        : 0;
    const daysUntilDue = Math.ceil((dueMs - nowMs) / MS_PER_DAY);

    return {
        intervalDays,
        dueAt: new Date(dueMs).toISOString(),
        isOverdue,
        daysOverdue,
        daysUntilDue,
        isOnTrack: (task.status === "compliant" || task.status === "completed") && !isOverdue,
    };
}

/** Convenience: short-circuit version used in SLA % aggregation. */
export function isTaskOnTrack(task: DueStateInput, now: Date = new Date()): boolean {
    return computeTaskDueState(task, now).isOnTrack;
}

/** Map a free-text frequency label (used by the AddTaskForm dropdown) to a structured kind. */
export function frequencyLabelToKind(label: string | null | undefined): FrequencyKind {
    const normalized = (label ?? "").trim().toLowerCase();
    if (!normalized) return "on_demand";
    if (["daily", "every day"].includes(normalized)) return "daily";
    if (["weekly", "every week"].includes(normalized)) return "weekly";
    if (["bi-weekly", "biweekly", "fortnightly"].includes(normalized)) return "biweekly";
    if (["monthly", "every month"].includes(normalized)) return "monthly";
    if (["quarterly", "every quarter"].includes(normalized)) return "quarterly";
    if (["yearly", "annually", "every year"].includes(normalized)) return "yearly";
    return "on_demand";
}
