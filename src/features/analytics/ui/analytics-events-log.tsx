"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Filter, Trash2 } from "lucide-react";
import type { AnalyticsEventRow } from "@/features/analytics/actions";
import { deleteAnalyticsEvents, pruneAnalyticsEventsByFilter } from "@/features/analytics/actions";
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
import { AppQueueTable, AppSectionHeader, AppStatusBanner } from "@/features/admin/ui/app-workbench";

interface AnalyticsEventsLogProps {
    workspaceId: string;
    rows: AnalyticsEventRow[];
    total: number;
    page: number;
    pageSize: number;
    eventTypes: string[];
    search: string;
    sinceDays: number | null;
    availableEventTypes: string[];
}

const DATE_RANGES: Array<{ value: number | null; label: string }> = [
    { value: null, label: "All time" },
    { value: 1, label: "24h" },
    { value: 7, label: "7 days" },
    { value: 30, label: "30 days" },
    { value: 90, label: "90 days" },
];

export function AnalyticsEventsLog({
    workspaceId,
    rows,
    total,
    page,
    pageSize,
    eventTypes,
    search,
    sinceDays,
    availableEventTypes,
}: AnalyticsEventsLogProps) {
    const router = useRouter();
    const { updateParams } = useUrlFilters();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [searchDraft, setSearchDraft] = useState(search);
    const [isBulkPending, startBulk] = useTransition();
    const [isPrunePending, startPrune] = useTransition();
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionInfo, setActionInfo] = useState<string | null>(null);

    useEffect(() => setSearchDraft(search), [search]);

    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(rows.map((r) => r.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [rows]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleEventType = (type: string) => {
        const next = eventTypes.includes(type)
            ? eventTypes.filter((t) => t !== type)
            : [...eventTypes, type];
        updateParams({ eventType: next.length ? next.join(",") : null, eventsPage: null });
    };

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} event${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
        setActionError(null);
        setActionInfo(null);
        startBulk(async () => {
            const res = await deleteAnalyticsEvents(ids, workspaceId);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            setActionInfo(`Deleted ${res.deleted} event${res.deleted === 1 ? "" : "s"}.`);
            setSelected(new Set());
            router.refresh();
        });
    };

    const prune = () => {
        const input = window.prompt(
            "Delete events older than how many days?\n\nThis deletes ALL events older than the value you enter in the current workspace. Cannot be undone.",
            "90",
        );
        if (!input) return;
        const olderThanDays = Number.parseInt(input, 10);
        if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
            setActionError("Invalid retention window.");
            return;
        }
        if (!confirm(`Delete all events older than ${olderThanDays} days in this workspace?`)) return;
        setActionError(null);
        setActionInfo(null);
        startPrune(async () => {
            const res = await pruneAnalyticsEventsByFilter({
                workspaceId,
                olderThanDays,
                eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
            });
            if (res.error) {
                setActionError(res.error);
                return;
            }
            setActionInfo(`Pruned ${res.deleted} event${res.deleted === 1 ? "" : "s"} older than ${olderThanDays} days.`);
            router.refresh();
        });
    };

    const tableHeaders = (
        <tr className="border-b border-border/50">
            <th className="px-3 py-2 w-8" />
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Event</th>
            <th className="px-3 py-2">Page</th>
            <th className="px-3 py-2 w-24 text-right" />
        </tr>
    );

    return (
        <section className="space-y-3 rounded-md border border-border/60 bg-card/40 p-4 shadow-2xs">
            <AppSectionHeader
                title="Event log"
                description="Raw analytics events for this workspace. Filter, delete, or prune by retention window."
                actions={
                    <BulkActionButton
                        onClick={prune}
                        pending={isPrunePending}
                        icon={<CalendarClock className="h-3 w-3" />}
                        label="Prune by age"
                        tone="default"
                    />
                }
            />

            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    value={searchDraft}
                    onChange={setSearchDraft}
                    onSubmit={(v) => updateParams({ q: v.trim() || null, eventsPage: null })}
                    placeholder="Search event name, slug, or type…"
                />
                <select
                    value={String(sinceDays ?? "")}
                    onChange={(e) => updateParams({ eventDays: e.target.value || null, eventsPage: null })}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                    {DATE_RANGES.map((r) => (
                        <option key={r.label} value={r.value ?? ""}>
                            {r.label}
                        </option>
                    ))}
                </select>
            </div>

            {availableEventTypes.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        <Filter className="h-3 w-3" /> Type
                    </span>
                    {availableEventTypes.map((t) => (
                        <FilterChip
                            key={t}
                            active={eventTypes.includes(t)}
                            onClick={() => toggleEventType(t)}
                            label={t}
                        />
                    ))}
                </div>
            ) : null}

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
                <AppStatusBanner variant="destructive">
                    {actionError}
                </AppStatusBanner>
            ) : null}
            {actionInfo ? (
                <AppStatusBanner variant="success">
                    {actionInfo}
                </AppStatusBanner>
            ) : null}

            <div className="flex flex-col gap-3 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2 text-muted-foreground select-none">
                    <SelectionCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={rows.length === 0}
                        label="Select all analytics events on this page"
                        size="sm"
                    />
                    <span>Select page</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <PaginationStatus page={page} pageSize={pageSize} total={total} />
                    <PageSizeSelect
                        value={pageSize}
                        onChange={(v) => updateParams({ eventsPageSize: String(v), eventsPage: null })}
                    />
                </div>
            </div>

            <div className="md:hidden space-y-2">
                {rows.map((row) => (
                    <EventCard
                        key={row.id}
                        row={row}
                        workspaceId={workspaceId}
                        selected={selected.has(row.id)}
                        onToggleSelected={(checked) => {
                            setSelected((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(row.id);
                                else next.delete(row.id);
                                return next;
                            });
                        }}
                        onActionError={setActionError}
                        onActionInfo={setActionInfo}
                    />
                ))}
            </div>

            <div className="hidden md:block">
                <AppQueueTable
                    headers={tableHeaders}
                    empty={rows.length === 0}
                    pagination={
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            onChange={(p) => updateParams({ eventsPage: p === 1 ? null : String(p) })}
                        />
                    }
                >
                    {rows.map((row) => (
                        <EventRow
                            key={row.id}
                            row={row}
                            workspaceId={workspaceId}
                            selected={selected.has(row.id)}
                            onToggleSelected={(checked) => {
                                setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (checked) next.add(row.id);
                                    else next.delete(row.id);
                                    return next;
                                });
                            }}
                            onActionError={setActionError}
                            onActionInfo={setActionInfo}
                        />
                    ))}
                </AppQueueTable>
            </div>
        </section>
    );
}

function EventCard(props: Parameters<typeof EventRow>[0]) {
    const { row, selected, onToggleSelected } = props;

    return (
        <article className="rounded-xl border border-border/60 bg-background/60 p-3 text-[15px] shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                    <SelectionCheckbox
                        checked={selected}
                        onCheckedChange={onToggleSelected}
                        label={`Select analytics event ${row.event_name}`}
                        className="mt-0.5"
                    />
                    <span className="min-w-0">
                        <span className="block break-words font-medium text-foreground">{row.event_name}</span>
                        <span className="mt-1 block text-[13px] text-muted-foreground">
                            {new Date(row.created_at).toLocaleString()}
                        </span>
                    </span>
                </div>
                <EventDeleteButton {...props} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center rounded-full border border-border/60 bg-card px-2 py-0.5 text-[13px] font-medium uppercase tracking-wider text-foreground">
                    {row.event_type}
                </span>
                <span className="break-all">/{row.page_slug ? row.page_slug : ""}</span>
            </div>
        </article>
    );
}

function EventDeleteButton({
    row,
    workspaceId,
    onActionError,
    onActionInfo,
}: Pick<Parameters<typeof EventRow>[0], "row" | "workspaceId" | "onActionError" | "onActionInfo">) {
    const router = useRouter();
    const [isPending, start] = useTransition();

    const remove = () => {
        if (!confirm("Delete this event?")) return;
        onActionError(null);
        onActionInfo(null);
        start(async () => {
            const res = await deleteAnalyticsEvents([row.id], workspaceId);
            if (res.error) {
                onActionError(res.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <RowActionButton
            onClick={remove}
            pending={isPending}
            icon={<Trash2 className="h-3 w-3" />}
            label="Delete"
            tone="destructive"
        />
    );
}

function EventRow({
    row,
    workspaceId,
    selected,
    onToggleSelected,
    onActionError,
    onActionInfo,
}: {
    row: AnalyticsEventRow;
    workspaceId: string;
    selected: boolean;
    onToggleSelected: (checked: boolean) => void;
    onActionError: (msg: string | null) => void;
    onActionInfo: (msg: string | null) => void;
}) {
    return (
        <tr className="border-b border-border/30 hover:bg-muted/30">
            <td className="px-2 py-2">
                <SelectionCheckbox
                    checked={selected}
                    onCheckedChange={onToggleSelected}
                    label={`Select analytics event ${row.event_name}`}
                />
            </td>
            <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                {new Date(row.created_at).toLocaleString()}
            </td>
            <td className="px-2 py-2">
                <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[13px] font-medium uppercase tracking-wider">
                    {row.event_type}
                </span>
            </td>
            <td className="px-2 py-2 font-semibold text-foreground">{row.event_name}</td>
            <td className="px-2 py-2 text-muted-foreground">
                {row.page_slug ? `/${row.page_slug}` : <span className="italic">—</span>}
            </td>
            <td className="px-2 py-2 text-right">
                <EventDeleteButton row={row} workspaceId={workspaceId} onActionError={onActionError} onActionInfo={onActionInfo} />
            </td>
        </tr>
    );
}
