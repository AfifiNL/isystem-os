"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ComponentType } from "react";
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    Link2,
    Radar,
    Trash2,
    XCircle,
} from "lucide-react";
import type {
    OpportunityCategory,
    OpportunityRecord,
    OpportunitySeverity,
    OpportunityStatus,
} from "../types";
import { bulkUpdateOpportunityStatus, deleteOpportunities } from "../actions";
import { StatusActions } from "./status-actions";
import {
    BulkActionButton,
    BulkActionToolbar,
    FilterChip,
    PageSizeSelect,
    Pagination,
    PaginationStatus,
    SearchInput,
    SelectionCheckbox,
    useUrlFilters,
} from "@/shared/ui/list-controls";

const CATEGORY_META: Record<
    OpportunityCategory,
    { label: string; Icon: ComponentType<{ className?: string }>; tone: string }
> = {
    seo: { label: "SEO", Icon: Link2, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300" },
    content: { label: "Content", Icon: BarChart3, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
    conversion: { label: "Conversion", Icon: Activity, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
    market: { label: "Market", Icon: Radar, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
};

const SEVERITY_META: Record<OpportunitySeverity, { label: string; tone: string }> = {
    high: { label: "High", tone: "border-destructive/40 text-destructive" },
    medium: { label: "Medium", tone: "border-amber-400/40 text-amber-600 dark:text-amber-300" },
    low: { label: "Low", tone: "border-muted-foreground/30 text-muted-foreground" },
};

const STATUS_META: Record<OpportunityStatus, { label: string; tone: string }> = {
    pending: { label: "Pending", tone: "bg-primary/10 text-primary" },
    approved: { label: "Approved", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    implemented: { label: "Implemented", tone: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" },
    dismissed: { label: "Dismissed", tone: "bg-muted text-muted-foreground" },
    superseded: { label: "Superseded", tone: "bg-muted text-muted-foreground" },
};

const CATEGORIES: OpportunityCategory[] = ["seo", "content", "conversion", "market"];
const SEVERITIES: OpportunitySeverity[] = ["high", "medium", "low"];
const STATUSES: OpportunityStatus[] = ["pending", "approved", "implemented", "dismissed", "superseded"];

interface OpportunityListProps {
    opportunities: OpportunityRecord[];
    total: number;
    page: number;
    pageSize: number;
    statuses: OpportunityStatus[];
    severities: OpportunitySeverity[];
    categories: OpportunityCategory[];
    search: string;
    statusCounts: Record<OpportunityStatus, number>;
}

export function OpportunityList({
    opportunities,
    total,
    page,
    pageSize,
    statuses,
    severities,
    categories,
    search,
    statusCounts,
}: OpportunityListProps) {
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
            const visible = new Set(opportunities.map((o) => o.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [opportunities]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const allSelected = opportunities.length > 0 && opportunities.every((o) => selected.has(o.id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleCategory = (c: OpportunityCategory) => {
        const next = categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c];
        updateParams({ category: next.length ? next.join(",") : null, page: null });
    };
    const toggleSeverity = (s: OpportunitySeverity) => {
        const next = severities.includes(s) ? severities.filter((x) => x !== s) : [...severities, s];
        updateParams({ severity: next.length ? next.join(",") : null, page: null });
    };
    const toggleStatus = (s: OpportunityStatus) => {
        const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
        updateParams({ status: next.length ? next.join(",") : null, page: null });
    };

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(opportunities.map((o) => o.id)));
    };

    const runBulk = (runner: () => Promise<{ error: string | null }>, info?: string) => {
        setActionError(null);
        setActionInfo(null);
        startBulk(async () => {
            const res = await runner();
            if (res.error) {
                setActionError(res.error);
                return;
            }
            if (info) setActionInfo(info);
            setSelected(new Set());
            router.refresh();
        });
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} opportunit${ids.length === 1 ? "y" : "ies"}? This cannot be undone.`)) return;
        runBulk(async () => {
            const res = await deleteOpportunities(ids);
            return { error: res.error };
        }, `Deleted ${ids.length} opportunit${ids.length === 1 ? "y" : "ies"}.`);
    };

    const bulkSetStatus = (next: OpportunityStatus) => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        runBulk(async () => {
            const res = await bulkUpdateOpportunityStatus(ids, next);
            return { error: res.error };
        }, `Marked ${ids.length} as ${next}.`);
    };

    const firstIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const lastIndex = Math.min(total, page * pageSize);
    void firstIndex;
    void lastIndex;

    return (
        <div className="grid gap-4">
            <section className="border-y border-border/50 bg-transparent">
                <header className="border-b border-border/45 py-2">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filter queue</h2>
                </header>
                <div className="space-y-4 py-3">
                    <SearchInput
                        value={searchDraft}
                        onChange={setSearchDraft}
                        onSubmit={(v) => updateParams({ q: v.trim() || null, page: null })}
                        placeholder="Search title, summary, or narration"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Status</span>
                        {STATUSES.map((s) => (
                            <FilterChip
                                key={s}
                                active={statuses.includes(s)}
                                onClick={() => toggleStatus(s)}
                                label={
                                    <span className="inline-flex items-center gap-1">
                                        {STATUS_META[s].label}
                                        <span className="rounded-full bg-black/10 px-1.5 text-[13px] font-semibold">
                                            {statusCounts[s] ?? 0}
                                        </span>
                                    </span>
                                }
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Category</span>
                        {CATEGORIES.map((c) => (
                            <FilterChip
                                key={c}
                                active={categories.includes(c)}
                                onClick={() => toggleCategory(c)}
                                label={CATEGORY_META[c].label}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] uppercase tracking-wider text-muted-foreground">Severity</span>
                        {SEVERITIES.map((s) => (
                            <FilterChip
                                key={s}
                                active={severities.includes(s)}
                                onClick={() => toggleSeverity(s)}
                                label={SEVERITY_META[s].label}
                            />
                        ))}
                    </div>
                </div>
            </section>

            <BulkActionToolbar count={selected.size} onClear={() => setSelected(new Set())}>
                <BulkActionButton
                    onClick={() => bulkSetStatus("approved")}
                    pending={isBulkPending}
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label="Approve"
                />
                <BulkActionButton
                    onClick={() => bulkSetStatus("implemented")}
                    pending={isBulkPending}
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label="Implemented"
                />
                <BulkActionButton
                    onClick={() => bulkSetStatus("dismissed")}
                    pending={isBulkPending}
                    icon={<XCircle className="h-3 w-3" />}
                    label="Dismiss"
                />
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
                        disabled={opportunities.length === 0}
                        label="Select all opportunities on this page"
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

            {opportunities.length === 0 ? (
                <div className="border-y border-dashed border-border/50 py-10 text-[17px] text-muted-foreground">
                        {total === 0
                            ? "No opportunities yet. Run a scan to surface under-performing content and conversion weak points."
                            : "No opportunities match the current filter set."}
                </div>
            ) : (
                opportunities.map((opp) => {
                    const category = CATEGORY_META[opp.category];
                    const severity = SEVERITY_META[opp.severity];
                    const status = STATUS_META[opp.status];
                    const CategoryIcon = category.Icon;
                    const checked = selected.has(opp.id);

                    return (
                        <article key={opp.id} className="border-y border-border/50 py-3">
                            <header className="flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2 text-[15px]">
                                    <SelectionCheckbox
                                        checked={checked}
                                        onCheckedChange={(nextChecked) => {
                                            setSelected((prev) => {
                                                const next = new Set(prev);
                                                if (nextChecked) next.add(opp.id);
                                                else next.delete(opp.id);
                                                return next;
                                            });
                                        }}
                                        label={`Select opportunity ${opp.title}`}
                                    />
                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${category.tone}`}>
                                        <CategoryIcon className="h-3.5 w-3.5" />
                                        {category.label}
                                    </span>
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 font-medium ${severity.tone}`}>
                                        {severity.label} severity
                                    </span>
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 font-medium ${status.tone}`}>
                                        {status.label}
                                    </span>
                                    <span className="text-muted-foreground">Priority {Math.round(opp.priorityScore)}</span>
                                </div>
                                <h2 className="text-[19px] font-semibold text-foreground">{opp.title}</h2>
                                {opp.summary && <p className="text-[17px] text-muted-foreground">{opp.summary}</p>}
                            </header>
                            <div className="space-y-4 pt-3">
                                {opp.recommendationMarkdown ? (
                                    <article className="rounded-lg border bg-muted/30 p-4 text-[17px] leading-6 whitespace-pre-wrap">
                                        {opp.recommendationMarkdown}
                                    </article>
                                ) : (
                                    <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-[17px] text-muted-foreground">
                                        Narration pending. The detector has the signal but the narrative model did not
                                        respond — re-running the scan will retry.
                                    </p>
                                )}
                                <StatusActions opportunityId={opp.id} status={opp.status} signalData={opp.signalData} />
                            </div>
                        </article>
                    );
                })
            )}

            <Pagination
                page={page}
                totalPages={totalPages}
                onChange={(p) => updateParams({ page: p === 1 ? null : String(p) })}
            />
        </div>
    );
}
