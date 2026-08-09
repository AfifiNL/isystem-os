"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface AnalyticsFilterFormProps {
    selectedWorkspaceId: string;
    selectedDays: number;
    workspaces: Array<{ id: string; name: string }>;
}

export function AnalyticsFilterForm({ selectedWorkspaceId, selectedDays, workspaces }: AnalyticsFilterFormProps) {
    const router = useRouter();

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const workspaceId = data.get("workspaceId") as string;
        const days = data.get("days") as string;
        router.push(`/dashboard/analytics?workspaceId=${encodeURIComponent(workspaceId)}&days=${encodeURIComponent(days)}`);
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
                <select name="workspaceId" aria-label="Workspace" defaultValue={selectedWorkspaceId} className="h-8 rounded-md border border-input bg-background px-2 py-1 text-[12px] select-none cursor-pointer">
                    {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                    ))}
                </select>
                <select name="days" aria-label="Time range" defaultValue={String(selectedDays)} className="h-8 rounded-md border border-input bg-background px-2 py-1 text-[12px] select-none cursor-pointer">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                </select>
                <button type="submit" className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-2.5 text-[12px] font-medium text-primary-foreground cursor-pointer">
                    Apply
                </button>
            </form>
            <Link
                href={`/api/analytics/export?workspaceId=${encodeURIComponent(selectedWorkspaceId)}&days=${selectedDays}`}
                className="inline-flex h-8 items-center justify-center rounded-md border border-input px-2.5 text-[12px] font-medium text-foreground hover:bg-muted cursor-pointer"
            >
                Export CSV
            </Link>
        </div>
    );
}
