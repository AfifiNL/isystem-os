"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { SeoContentOpportunityRecord } from "@/features/seo/types";
import { bulkDeleteSeoContentOpportunities } from "@/features/seo/actions";
import { BulkActionButton, BulkActionToolbar, SelectionCheckbox } from "@/shared/ui/list-controls";

interface StrategistOpportunitiesPanelProps {
    items: SeoContentOpportunityRecord[];
    /** Pre-rendered row nodes, one per item, in the same order as `items`. */
    renderedRows: ReactNode[];
}

export function StrategistOpportunitiesPanel({ items, renderedRows }: StrategistOpportunitiesPanelProps) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isBulkPending, startBulk] = useTransition();
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionInfo, setActionInfo] = useState<string | null>(null);

    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(items.map((i) => i.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [items]);

    const isSelectable = (item: SeoContentOpportunityRecord) => !item.draft_content_item_id;
    const selectableIds = items.filter(isSelectable).map((i) => i.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(selectableIds));
        }
    };

    const toggleOne = (id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (
            !confirm(
                `Delete ${ids.length} opportunity${ids.length === 1 ? "" : "ies"}? Opportunities with a generated draft will be skipped.`,
            )
        )
            return;
        setActionError(null);
        setActionInfo(null);
        startBulk(async () => {
            const res = await bulkDeleteSeoContentOpportunities(ids);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            const parts: string[] = [];
            parts.push(`Deleted ${res.deleted} opportunity${res.deleted === 1 ? "" : "ies"}.`);
            if (res.skipped > 0) {
                parts.push(`${res.skipped} skipped${res.skippedReason ? ` — ${res.skippedReason}` : "."}`);
            }
            setActionInfo(parts.join(" "));
            setSelected(new Set());
            router.refresh();
        });
    };

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3 text-[15px]">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <SelectionCheckbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={selectableIds.length === 0}
                        label="Select all deletable content opportunities on this page"
                    />
                    <span>
                        {selected.size === 0
                            ? "Select"
                            : selected.size === selectableIds.length
                                ? "All selectable chosen"
                                : `${selected.size} selected`}
                    </span>
                </div>
                {selectableIds.length < items.length ? (
                    <span className="text-muted-foreground">
                        {items.length - selectableIds.length} drafted row{items.length - selectableIds.length === 1 ? "" : "s"} excluded
                    </span>
                ) : null}
            </div>

            <BulkActionToolbar count={selected.size} onClear={() => setSelected(new Set())}>
                <BulkActionButton
                    onClick={bulkDelete}
                    pending={isBulkPending}
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
                    <AlertTriangle className="h-3 w-3" />
                    {actionError}
                </p>
            ) : null}
            {actionInfo ? (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[15px] text-emerald-700 dark:text-emerald-300">
                    {actionInfo}
                </p>
            ) : null}

            {items.map((item, index) => {
                const selectable = isSelectable(item);
                const checked = selected.has(item.id);
                return (
                    <div key={item.id} className="relative">
                        <div
                            className={`absolute -left-1 top-5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border bg-background/90 shadow-sm ${
                                selectable
                                    ? "border-border/60 hover:border-primary/40"
                                    : "border-border/30 opacity-40 cursor-not-allowed"
                            }`}
                        >
                            <SelectionCheckbox
                                checked={checked}
                                disabled={!selectable}
                                onCheckedChange={(nextChecked) => toggleOne(item.id, nextChecked)}
                                label={`Select content opportunity ${item.title}`}
                                title={selectable ? "Select for bulk actions" : "Draft already generated — open and remove the draft first"}
                                size="sm"
                            />
                        </div>
                        {renderedRows[index]}
                    </div>
                );
            })}
        </>
    );
}
