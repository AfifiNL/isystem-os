"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Download, RefreshCw, Trash2, XCircle } from "lucide-react";
import {
    deleteRenderQueueJobs,
    setRenderQueueJobStatus,
    type RenderQueueJobRow,
} from "@/features/admin/actions/render-queue";
import { Button } from "@/shared/ui/button";
import { RenderJobUpload } from "@/features/admin/ui/render-job-upload";
import {
    BulkActionButton,
    BulkActionToolbar,
    FilterChip,
    PageSizeSelect,
    Pagination,
    PaginationStatus,
    RowActionButton,
    SearchInput,
    SelectionCheckbox,
    useUrlFilters,
} from "@/shared/ui/list-controls";

interface RenderQueueListProps {
    jobs: RenderQueueJobRow[];
    total: number;
    page: number;
    pageSize: number;
    statuses: string[];
    search: string;
    statusCounts: Record<string, number>;
}

const ALL_STATUSES = ["pending_admin", "pending", "processing", "completed", "failed"] as const;
const STATUS_LABEL: Record<string, string> = {
    pending_admin: "Pending admin",
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
};
const STATUS_TONE: Record<string, string> = {
    pending_admin: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    failed: "bg-destructive/10 text-destructive",
};

function workspaceName(job: RenderQueueJobRow): string {
    const ws = job.workspaces;
    if (!ws) return job.workspace_id;
    if (Array.isArray(ws)) return ws[0]?.name ?? job.workspace_id;
    return ws.name ?? job.workspace_id;
}

export function RenderQueueList({
    jobs,
    total,
    page,
    pageSize,
    statuses,
    search,
    statusCounts,
}: RenderQueueListProps) {
    const router = useRouter();
    const { updateParams } = useUrlFilters();
    const [searchDraft, setSearchDraft] = useState(search);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isBulkPending, startBulk] = useTransition();
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionInfo, setActionInfo] = useState<string | null>(null);

    useEffect(() => setSearchDraft(search), [search]);

    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(jobs.map((j) => j.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [jobs]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const allSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleStatus = (status: string) => {
        const next = statuses.includes(status)
            ? statuses.filter((s) => s !== status)
            : [...statuses, status];
        updateParams({ status: next.length ? next.join(",") : null, page: null });
    };

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(jobs.map((j) => j.id)));
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} render job${ids.length === 1 ? "" : "s"}? This cannot be undone.`))
            return;
        setActionError(null);
        setActionInfo(null);
        startBulk(async () => {
            const res = await deleteRenderQueueJobs(ids);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            setActionInfo(`Deleted ${res.deleted} render job${res.deleted === 1 ? "" : "s"}.`);
            setSelected(new Set());
            router.refresh();
        });
    };

    return (
        <div className="rounded-md border bg-card space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    value={searchDraft}
                    onChange={setSearchDraft}
                    onSubmit={(v) => updateParams({ q: v.trim() || null, page: null })}
                    placeholder="Search storage path or result URL…"
                />
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Status</span>
                {ALL_STATUSES.map((s) => (
                    <FilterChip
                        key={s}
                        active={statuses.includes(s)}
                        onClick={() => toggleStatus(s)}
                        label={
                            <span className="inline-flex items-center gap-1">
                                {STATUS_LABEL[s]}
                                <span className="rounded-full bg-black/10 px-1.5 text-[13px] font-semibold">
                                    {statusCounts[s] ?? 0}
                                </span>
                            </span>
                        }
                    />
                ))}
            </div>

            <BulkActionToolbar count={selected.size} onClear={() => setSelected(new Set())}>
                <BulkActionButton
                    onClick={bulkDelete}
                    pending={isBulkPending}
                    icon={<Trash2 className="h-3 w-3" />}
                    label="Delete"
                    tone="destructive"
                />
            </BulkActionToolbar>

            {actionError ? (
                <p className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[15px] text-destructive">
                    <AlertTriangle className="h-3 w-3" /> {actionError}
                </p>
            ) : null}
            {actionInfo ? (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[15px] text-emerald-700 dark:text-emerald-300">
                    {actionInfo}
                </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 text-[15px]">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <SelectionCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={jobs.length === 0}
                        label="Select all render jobs on this page"
                    />
                    <span>Select page</span>
                </div>
                <div className="flex items-center gap-3">
                    <PaginationStatus page={page} pageSize={pageSize} total={total} />
                    <PageSizeSelect
                        value={pageSize}
                        onChange={(v) => updateParams({ pageSize: String(v), page: null })}
                    />
                </div>
            </div>

            {jobs.length === 0 ? (
                <div className="text-center py-10">
                    <h3 className="text-[21px] font-medium">No render jobs match the current filters</h3>
                    <p className="text-muted-foreground mt-1 text-[17px]">
                        Adjust filters, or grab a coffee — the servers may be caught up.
                    </p>
                </div>
            ) : (
                <div className="relative w-full overflow-auto">
                    <table className="w-full caption-bottom text-[17px]">
                        <thead>
                            <tr className="border-b">
                                <th className="h-10 px-3 text-left w-8" />
                                <th className="h-10 px-3 text-left font-medium text-muted-foreground">Workspace</th>
                                <th className="h-10 px-3 text-left font-medium text-muted-foreground">Status</th>
                                <th className="h-10 px-3 text-left font-medium text-muted-foreground">Requested</th>
                                <th className="h-10 px-3 text-left font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job) => (
                                <JobRow
                                    key={job.id}
                                    job={job}
                                    selected={selected.has(job.id)}
                                    onToggleSelected={(checked) => {
                                        setSelected((prev) => {
                                            const next = new Set(prev);
                                            if (checked) next.add(job.id);
                                            else next.delete(job.id);
                                            return next;
                                        });
                                    }}
                                    onActionError={setActionError}
                                    onActionInfo={setActionInfo}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Pagination
                page={page}
                totalPages={totalPages}
                onChange={(p) => updateParams({ page: p === 1 ? null : String(p) })}
            />
        </div>
    );
}

function JobRow({
    job,
    selected,
    onToggleSelected,
    onActionError,
    onActionInfo,
}: {
    job: RenderQueueJobRow;
    selected: boolean;
    onToggleSelected: (checked: boolean) => void;
    onActionError: (msg: string | null) => void;
    onActionInfo: (msg: string | null) => void;
}) {
    const router = useRouter();
    const [isPending, start] = useTransition();

    const runAction = (runner: () => Promise<{ error: string | null }>, info?: string) => {
        onActionError(null);
        onActionInfo(null);
        start(async () => {
            const res = await runner();
            if (res.error) {
                onActionError(res.error);
                return;
            }
            if (info) onActionInfo(info);
            router.refresh();
        });
    };

    const remove = () => {
        if (!confirm("Delete this render job? This cannot be undone.")) return;
        runAction(async () => await deleteRenderQueueJobs([job.id]));
    };

    const markFailed = () =>
        runAction(() => setRenderQueueJobStatus(job.id, "failed"), "Marked job as failed.");

    const markCompleted = () =>
        runAction(() => setRenderQueueJobStatus(job.id, "completed"), "Marked job as completed.");

    const reopen = () =>
        runAction(() => setRenderQueueJobStatus(job.id, "pending_admin"), "Moved back to pending admin.");

    const status = job.status;
    const tone = STATUS_TONE[status] ?? STATUS_TONE.pending;

    return (
        <tr className="border-b transition-colors hover:bg-muted/50">
            <td className="p-3">
                <SelectionCheckbox
                    checked={selected}
                    onCheckedChange={onToggleSelected}
                    label={`Select render job for ${workspaceName(job)}`}
                />
            </td>
            <td className="p-3 align-middle">
                <span className="font-medium">{workspaceName(job)}</span>
            </td>
            <td className="p-3 align-middle">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[15px] font-semibold ${tone}`}>
                    {STATUS_LABEL[status] ?? status}
                </span>
            </td>
            <td className="p-3 align-middle text-muted-foreground">
                {new Date(job.created_at).toLocaleString()}
            </td>
            <td className="p-3 align-middle">
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" asChild>
                        <a
                            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/batch-queues/${job.storage_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            JSON
                        </a>
                    </Button>
                    {status === "pending_admin" ? (
                        <RenderJobUpload jobId={job.id} workspaceId={job.workspace_id} />
                    ) : null}
                    {status !== "completed" ? (
                        <RowActionButton
                            onClick={markCompleted}
                            pending={isPending}
                            icon={<Check className="h-3 w-3" />}
                            label="Complete"
                        />
                    ) : null}
                    {status !== "failed" ? (
                        <RowActionButton
                            onClick={markFailed}
                            pending={isPending}
                            icon={<XCircle className="h-3 w-3" />}
                            label="Mark failed"
                        />
                    ) : null}
                    {status === "completed" || status === "failed" ? (
                        <RowActionButton
                            onClick={reopen}
                            pending={isPending}
                            icon={<RefreshCw className="h-3 w-3" />}
                            label="Reopen"
                        />
                    ) : null}
                    <RowActionButton
                        onClick={remove}
                        pending={isPending}
                        icon={<Trash2 className="h-3 w-3" />}
                        label="Delete"
                        tone="destructive"
                    />
                </div>
            </td>
        </tr>
    );
}
