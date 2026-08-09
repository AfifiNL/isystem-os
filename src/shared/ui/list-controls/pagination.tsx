"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
    className?: string;
}

/**
 * Page-number pagination. Renders page 1, the last page, and a window around
 * the current page, with ellipses where pages are skipped. No-op when there's
 * only one page of data.
 */
export function Pagination({ page, totalPages, onChange, className = "" }: PaginationProps) {
    const pages = useMemo(() => {
        const out = new Set<number>();
        out.add(1);
        out.add(totalPages);
        for (let i = Math.max(1, page - 1); i <= Math.min(totalPages, page + 1); i++) {
            out.add(i);
        }
        return Array.from(out)
            .filter((p) => p >= 1 && p <= totalPages)
            .sort((a, b) => a - b);
    }, [page, totalPages]);

    if (totalPages <= 1) return null;

    return (
        <nav className={`flex items-center justify-center gap-1 text-xs ${className}`} aria-label="Pagination">
            <button
                type="button"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
                <ChevronLeft className="h-3 w-3" />
                Prev
            </button>
            {pages.map((p, index) => {
                const prev = pages[index - 1];
                const gap = prev !== undefined && p - prev > 1;
                return (
                    <span key={p} className="inline-flex items-center gap-1">
                        {gap ? <span className="px-1 text-muted-foreground">…</span> : null}
                        <button
                            type="button"
                            onClick={() => onChange(p)}
                            aria-current={p === page ? "page" : undefined}
                            className={`h-8 min-w-8 rounded-md px-2 font-medium ${
                                p === page
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {p}
                        </button>
                    </span>
                );
            })}
            <button
                type="button"
                onClick={() => onChange(page + 1)}
                disabled={page >= totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
                Next
                <ChevronRight className="h-3 w-3" />
            </button>
        </nav>
    );
}

interface PageSizeSelectProps {
    value: number;
    onChange: (pageSize: number) => void;
    options?: number[];
    className?: string;
}

export function PageSizeSelect({
    value,
    onChange,
    options = [10, 25, 50, 100],
    className = "",
}: PageSizeSelectProps) {
    return (
        <label className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
            <span>Per page</span>
            <select
                value={String(value)}
                onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
                className="h-7 rounded border border-input bg-background px-1 text-xs"
            >
                {options.map((n) => (
                    <option key={n} value={n}>
                        {n}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function PaginationStatus({
    page,
    pageSize,
    total,
    className = "",
}: {
    page: number;
    pageSize: number;
    total: number;
    className?: string;
}) {
    const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(total, page * pageSize);
    return (
        <span className={`text-xs text-muted-foreground ${className}`}>
            {total === 0 ? "0 items" : `${first}–${last} of ${total}`}
        </span>
    );
}
