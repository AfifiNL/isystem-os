"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Layers3, Trash2 } from "lucide-react";
import { deleteContentItems } from "@/features/content-engine/actions";
import { Button } from "@/shared/ui/button";
import {
    BulkActionButton,
    BulkActionToolbar,
    FilterChip,
    PageSizeSelect,
    Pagination,
    PaginationStatus,
    RowActionButton,
    SearchInput,
    useUrlFilters,
} from "@/shared/ui/list-controls";

interface BuilderPageRow {
    id: string;
    title: string;
    slug: string | null;
    type: string | null;
    status: string | null;
    updated_at: string | null;
}

interface BuilderPagesListProps {
    pages: BuilderPageRow[];
    total: number;
    page: number;
    pageSize: number;
    statuses: string[];
    search: string;
    statusCounts: Record<string, number>;
}

const ALL_STATUSES = ["draft", "ready", "published"] as const;
const STATUS_LABEL: Record<string, string> = {
    draft: "Draft",
    ready: "Ready",
    published: "Published",
};
const STATUS_TONE: Record<string, string> = {
    draft: "bg-amber-500/10 text-amber-700",
    ready: "bg-sky-500/10 text-sky-700",
    published: "bg-emerald-500/10 text-emerald-700",
};

export function BuilderPagesList({
    pages,
    total,
    page,
    pageSize,
    statuses,
    search,
    statusCounts,
}: BuilderPagesListProps) {
    const router = useRouter();
    const { updateParams } = useUrlFilters();
    const [searchDraft, setSearchDraft] = useState(search);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isBulkPending, startBulk] = useTransition();
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => setSearchDraft(search), [search]);

    useEffect(() => {
        setSelected((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set(pages.map((p) => p.id));
            const next = new Set<string>();
            prev.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === prev.size ? prev : next;
        });
    }, [pages]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const allSelected = pages.length > 0 && pages.every((p) => selected.has(p.id));
    const someSelected = selected.size > 0 && !allSelected;

    const toggleStatus = (s: string) => {
        const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
        updateParams({ status: next.length ? next.join(",") : null, page: null });
    };

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(pages.map((p) => p.id)));
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} page${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
        setActionError(null);
        startBulk(async () => {
            const res = await deleteContentItems(ids);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            setSelected(new Set());
            router.refresh();
        });
    };

    const deleteOne = (id: string) => {
        if (!confirm("Delete this page? This cannot be undone.")) return;
        setActionError(null);
        startBulk(async () => {
            const res = await deleteContentItems([id]);
            if (res.error) {
                setActionError(res.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-[#002f58]" />
                <h2 className="text-[17px] font-semibold text-foreground">Pages</h2>
                <span className="ml-auto text-[15px] text-muted-foreground">{total} total</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    value={searchDraft}
                    onChange={setSearchDraft}
                    onSubmit={(v) => updateParams({ q: v.trim() || null, page: null })}
                    placeholder="Search pages by title or slug…"
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

            <div className="flex items-center justify-between gap-3 text-[15px]">
                <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleSelectAll}
                        disabled={pages.length === 0}
                        className="h-4 w-4 rounded border-input"
                    />
                    <span>Select page</span>
                </label>
                <div className="flex items-center gap-3">
                    <PaginationStatus page={page} pageSize={pageSize} total={total} />
                    <PageSizeSelect
                        value={pageSize}
                        onChange={(v) => updateParams({ pageSize: String(v), page: null })}
                    />
                </div>
            </div>

            {pages.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
                    <p className="text-[17px] font-medium text-foreground">No pages match the current filters</p>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {pages.map((p) => {
                        const tone = STATUS_TONE[p.status ?? "draft"] ?? STATUS_TONE.draft;
                        const checked = selected.has(p.id);
                        const slug = p.slug ?? "";
                        return (
                            <article key={p.id} className="rounded-md border border-border/60 bg-card p-4 text-[17px]">
                                <div className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                            setSelected((prev) => {
                                                const next = new Set(prev);
                                                if (e.target.checked) next.add(p.id);
                                                else next.delete(p.id);
                                                return next;
                                            });
                                        }}
                                        className="mt-1 h-4 w-4 rounded border-input"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="truncate font-medium text-foreground">{p.title}</p>
                                        <p className="truncate text-[15px] text-muted-foreground">/{slug}</p>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold uppercase ${tone}`}>
                                        {STATUS_LABEL[p.status ?? "draft"] ?? p.status}
                                    </span>
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-2 text-[15px] text-muted-foreground">
                                    <div>
                                        <dt>Updated</dt>
                                        <dd>{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}</dd>
                                    </div>
                                </dl>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Button asChild size="sm" className="bg-[#002f58] text-white hover:bg-[#0a3d69]">
                                        <Link href={`/dashboard/builder/${p.id}`}>Edit</Link>
                                    </Button>
                                    <Button asChild size="sm" variant="outline">
                                        <Link
                                            href={slug === "home" ? "/" : `/${slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            View
                                        </Link>
                                    </Button>
                                    <RowActionButton
                                        onClick={() => deleteOne(p.id)}
                                        pending={isBulkPending}
                                        icon={<Trash2 className="h-3 w-3" />}
                                        label="Delete"
                                        tone="destructive"
                                    />
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <Pagination
                page={page}
                totalPages={totalPages}
                onChange={(p) => updateParams({ page: p === 1 ? null : String(p) })}
            />
        </section>
    );
}
