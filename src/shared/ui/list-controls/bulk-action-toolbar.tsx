"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface BulkActionToolbarProps {
    count: number;
    onClear: () => void;
    children: ReactNode;
    className?: string;
}

export function BulkActionToolbar({ count, onClear, children, className = "" }: BulkActionToolbarProps) {
    if (count === 0) return null;
    return (
        <section
            role="toolbar"
            aria-label={`${count} item${count === 1 ? "" : "s"} selected`}
            className={`premium-panel flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 ${className}`}
        >
            <span className="text-xs font-medium text-primary">{count} selected</span>
            {children}
            <button
                type="button"
                onClick={onClear}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
                Clear selection
            </button>
        </section>
    );
}

interface BulkActionButtonProps {
    onClick: () => void;
    pending: boolean;
    icon: ReactNode;
    label: string;
    tone?: "default" | "destructive";
    disabled?: boolean;
}

export function BulkActionButton({
    onClick,
    pending,
    icon,
    label,
    tone = "default",
    disabled = false,
}: BulkActionButtonProps) {
    const toneClass =
        tone === "destructive"
            ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "border-border/60 bg-background/60 hover:text-foreground";
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending || disabled}
            aria-busy={pending || undefined}
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${toneClass}`}
        >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
            {label}
        </button>
    );
}

interface RowActionButtonProps {
    onClick: () => void;
    pending: boolean;
    icon: ReactNode;
    label: string;
    tone?: "default" | "destructive";
    disabled?: boolean;
}

export function RowActionButton({
    onClick,
    pending,
    icon,
    label,
    tone = "default",
    disabled = false,
}: RowActionButtonProps) {
    const toneClass =
        tone === "destructive"
            ? "hover:border-destructive/40 hover:text-destructive"
            : "hover:border-primary/40 hover:text-primary";
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending || disabled}
            aria-busy={pending || undefined}
            className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${toneClass}`}
        >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
            {label}
        </button>
    );
}
