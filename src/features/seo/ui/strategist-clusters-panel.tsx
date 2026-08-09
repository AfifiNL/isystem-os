"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import type { SeoTopicClusterRecord } from "@/features/seo/types";
import { bulkDeleteSeoTopicClusters } from "@/features/seo/actions";
import { BulkActionButton, BulkActionToolbar, SelectionCheckbox } from "@/shared/ui/list-controls";

interface StrategistClustersPanelProps {
    items: SeoTopicClusterRecord[];
    /** Pre-rendered row nodes, one per item, in the same order as `items`. */
    renderedRows: ReactNode[];
}

export function StrategistClustersPanel({ items, renderedRows }: StrategistClustersPanelProps) {
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

    const selectableIds = items.map((i) => i.id);
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
                `Delete ${ids.length} topic cluster${ids.length === 1 ? "" : "s"}? Linked opportunities and plans will be detached but kept.`,
            )
        )
            return;
        setActionError(null);
        setActionInfo(null);
        startBulk(async () => {
            const res = await bulkDeleteSeoTopicClusters(ids);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            setActionInfo(`Deleted ${res.deleted} cluster${res.deleted === 1 ? "" : "s"}.`);
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
                        label="Select all topic clusters on this page"
                    />
                    <span>
                        {selected.size === 0
                            ? "Select"
                            : selected.size === selectableIds.length
                                ? "All chosen"
                                : `${selected.size} selected`}
                    </span>
                </div>
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
                const checked = selected.has(item.id);
                return (
                    <div key={item.id} className="relative">
                        <div className="absolute -left-1 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background/90 shadow-sm hover:border-primary/40">
                            <SelectionCheckbox
                                checked={checked}
                                onCheckedChange={(nextChecked) => toggleOne(item.id, nextChecked)}
                                label={`Select topic cluster ${item.name}`}
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
