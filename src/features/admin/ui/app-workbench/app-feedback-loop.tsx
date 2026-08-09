import React, { useId } from "react";
import { ArrowDown, ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface AppFeedbackStage {
    label: string;
    value: React.ReactNode;
    detail?: string;
    tone?: "default" | "success" | "warning" | "danger" | "info";
}

interface AppFeedbackLoopProps {
    title: string;
    description?: string;
    stages: AppFeedbackStage[];
    feedbackLabel: string;
    action?: React.ReactNode;
    className?: string;
}

const toneClass: Record<NonNullable<AppFeedbackStage["tone"]>, string> = {
    default: "[--stage-accent:var(--muted-foreground)]",
    success: "[--stage-accent:var(--color-emerald-500)]",
    warning: "[--stage-accent:var(--color-amber-500)]",
    danger: "[--stage-accent:var(--color-rose-500)]",
    info: "[--stage-accent:var(--dashboard-accent)]",
};

export function AppFeedbackLoop({
    title,
    description,
    stages,
    feedbackLabel,
    action,
    className,
}: AppFeedbackLoopProps) {
    const titleId = useId();
    return (
        <section className={cn("app-feedback-loop app-visual-panel overflow-hidden border-y border-border/55 bg-transparent", className)} aria-labelledby={titleId}>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-3 py-2">
                <div>
                    <h3 id={titleId} className="text-[14px] font-semibold text-foreground">{title}</h3>
                    {description ? <p className="mt-0.5 max-w-3xl text-[12px] text-muted-foreground">{description}</p> : null}
                </div>
                {action}
            </header>
            <div className="p-3">
                <ol className="flex min-w-0 flex-col items-stretch sm:flex-row" aria-label={title}>
                    {stages.map((stage, index) => (
                        <React.Fragment key={`${stage.label}-${index}`}>
                            <li className={cn("relative flex min-w-0 flex-1 flex-col justify-between border-l-2 border-border/50 bg-transparent px-3 py-2 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--stage-accent)] sm:w-36 sm:flex-none", toneClass[stage.tone ?? "default"])}>
                                <span className="text-[11px] font-medium text-muted-foreground">{stage.label}</span>
                                <span className="mt-1 text-[19px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{stage.value}</span>
                                {stage.detail ? <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{stage.detail}</span> : null}
                            </li>
                            {index < stages.length - 1 ? (
                                <span className="flex h-5 shrink-0 items-center justify-center text-muted-foreground/60 sm:h-auto sm:w-8" aria-hidden>
                                    <ArrowDown className="size-3.5 sm:hidden" />
                                    <ArrowRight className="hidden size-3.5 sm:block" />
                                </span>
                            ) : null}
                        </React.Fragment>
                    ))}
                </ol>
            </div>
            <div className="flex items-center gap-2 border-t border-border/40 bg-muted/[0.12] px-3 py-1.5 text-[11px] text-muted-foreground">
                <RotateCcw className="size-3 shrink-0 text-primary" aria-hidden />
                <span><strong className="font-semibold text-foreground">Feedback:</strong> {feedbackLabel}</span>
            </div>
        </section>
    );
}
