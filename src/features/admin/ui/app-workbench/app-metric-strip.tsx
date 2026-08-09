import React from "react";
import { cn } from "@/shared/lib/utils";

interface AppMetricStripProps {
    children: React.ReactNode;
    className?: string;
}

export function AppMetricStrip({ children, className }: AppMetricStripProps) {
    return (
        <div
            className={cn(
                "app-metric-strip grid shrink-0 grid-cols-2 border-y border-border/45 bg-muted/[0.08] sm:grid-cols-4 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none",
                className
            )}
        >
            {children}
        </div>
    );
}

interface AppMetricProps {
    label: string;
    value: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    description?: React.ReactNode;
    className?: string;
    variant?: "default" | "success" | "warning" | "destructive" | "info";
}

export function AppMetric({
    label,
    value,
    icon: Icon,
    description,
    className,
    variant = "default"
}: AppMetricProps) {
    const variantStyles = {
        default: "[--metric-accent:var(--muted-foreground)]",
        success: "[--metric-accent:var(--color-emerald-500)]",
        warning: "[--metric-accent:var(--color-amber-500)]",
        destructive: "[--metric-accent:var(--color-rose-500)]",
        info: "[--metric-accent:var(--color-cyan-500)]"
    };

    return (
        <div
            className={cn(
                "group relative flex min-h-12 min-w-0 items-center justify-between gap-2 border-r border-border/40 px-3 py-1.5 last:border-r-0 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--metric-accent)] before:opacity-0 before:transition-opacity hover:bg-muted/20 hover:before:opacity-70",
                variantStyles[variant],
                className
            )}
        >
            <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground">
                    {label}
                </span>
                <span className="shrink-0 truncate text-[17px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                    {value}
                </span>
                {description && (
                    <span className="hidden truncate text-[11px] text-muted-foreground xl:inline">
                        {description}
                    </span>
                )}
            </div>
            {Icon && (
                <div className="shrink-0 text-[var(--metric-accent)] opacity-45 transition-opacity group-hover:opacity-80">
                    <Icon className="size-3.5" />
                </div>
            )}
        </div>
    );
}
