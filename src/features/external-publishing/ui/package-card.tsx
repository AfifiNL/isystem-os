"use client";

import { CheckCircle2, Clock, ExternalLink, FileText, Send, ShieldAlert } from "lucide-react";
import type { ExternalPublicationPackageRow } from "@/features/external-publishing/types";
import { cn } from "@/shared/lib/utils";

const STATUS_META: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300" },
    generated: { label: "Generated", className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
    needs_review: { label: "Needs review", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    approved: { label: "Approved", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    exported: { label: "Exported", className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    published_manual: { label: "Published manually", className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300" },
    rejected: { label: "Rejected", className: "border-destructive/30 bg-destructive/10 text-destructive" },
    archived: { label: "Archived", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300" },
};

export function formatPlatform(platform: string) {
    return platform.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function PackageCard({ pkg, selected, onSelect }: { pkg: ExternalPublicationPackageRow; selected: boolean; onSelect: () => void }) {
    const meta = STATUS_META[pkg.status] ?? STATUS_META.draft;
    const hasWarnings = Array.isArray(pkg.compliance_warnings) && pkg.compliance_warnings.length > 0;

    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
                "w-full rounded-2xl border bg-card/70 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
                selected ? "border-primary/70 ring-1 ring-primary/30" : "border-border/60",
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatPlatform(pkg.platform)} · {pkg.locale.toUpperCase()}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold text-foreground">{pkg.topic}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{pkg.primary_query || pkg.target_slug || pkg.target_url}</p>
                </div>
                {hasWarnings ? <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" aria-label="Has compliance warnings" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="No compliance warnings stored" />}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", meta.className)}>{meta.label}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" aria-hidden="true" />
                    Q {pkg.quality_score}/100
                </span>
                {pkg.manual_published_url ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-700 dark:text-violet-300">
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        URL stored
                    </span>
                ) : null}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Updated {new Date(pkg.updated_at).toLocaleString()}
            </p>
        </button>
    );
}
