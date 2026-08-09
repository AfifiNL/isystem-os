import type { ReactNode } from "react";
import { Sparkles, Bot, BarChart3, FileText, Layers3, Network, Search, WandSparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type LoadingTone = "default" | "orchestrator" | "analytics" | "builder" | "seo" | "content";

const toneClasses: Record<LoadingTone, { badge: string; glow: string; bar: string }> = {
    default: {
        badge: "border-primary/20 bg-primary/10 text-primary",
        glow: "from-primary/20 via-primary/5 to-transparent",
        bar: "from-primary/70 via-primary to-chart-2/70",
    },
    orchestrator: {
        badge: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300",
        glow: "from-fuchsia-500/20 via-cyan-500/10 to-transparent",
        bar: "from-fuchsia-500/70 via-cyan-500 to-primary/70",
    },
    analytics: {
        badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
        glow: "from-emerald-500/20 via-chart-2/10 to-transparent",
        bar: "from-emerald-500/70 via-chart-2 to-primary/60",
    },
    builder: {
        badge: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        glow: "from-sky-500/20 via-primary/10 to-transparent",
        bar: "from-sky-500/70 via-primary to-cyan-500/70",
    },
    seo: {
        badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        glow: "from-amber-500/20 via-primary/10 to-transparent",
        bar: "from-amber-500/70 via-primary to-orange-500/70",
    },
    content: {
        badge: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
        glow: "from-violet-500/20 via-primary/10 to-transparent",
        bar: "from-violet-500/70 via-primary to-fuchsia-500/70",
    },
};

function PremiumSkeletonBlock({ className }: { className?: string }) {
    return <div aria-hidden="true" className={cn("premium-skeleton rounded-2xl", className)} />;
}

export function PremiumInlinePending({
    label,
    description,
    className,
}: {
    label: string;
    description?: string;
    className?: string;
}) {
    return (
        <span
            role="status"
            aria-live="polite"
            className={cn(
                "inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary",
                className,
            )}
        >
            <span className="premium-orb h-2.5 w-2.5 rounded-full bg-current" />
            <span>{label}</span>
            {description ? <span className="hidden text-primary/70 sm:inline">· {description}</span> : null}
        </span>
    );
}

export function AiOperationPendingCard({
    title,
    description,
    steps,
    activeStep = 0,
    tone = "default",
    className,
}: {
    title: string;
    description: string;
    steps: string[];
    activeStep?: number;
    tone?: LoadingTone;
    className?: string;
}) {
    const toneStyle = toneClasses[tone];

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "premium-panel premium-glow relative overflow-hidden rounded-3xl border p-6 shadow-sm",
                className,
            )}
        >
            <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br opacity-80", toneStyle.glow)} />
            <div className="relative space-y-5">
                <div className="flex items-start gap-4">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl border", toneStyle.badge)}>
                        <WandSparkles className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                        <PremiumInlinePending label={title} description="AI operation in progress" />
                        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    {steps.map((step, index) => {
                        const isActive = index === activeStep;
                        const isComplete = index < activeStep;
                        return (
                            <div
                                key={step}
                                className={cn(
                                    "rounded-2xl border border-border/60 bg-background/60 p-4 transition-colors",
                                    isActive && "border-primary/30 bg-primary/5",
                                    isComplete && "border-emerald-500/20 bg-emerald-500/5",
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <span
                                        className={cn(
                                            "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold",
                                            isComplete && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                                            isActive && "border-primary/30 bg-primary/10 text-primary",
                                            !isActive && !isComplete && "border-border/70 bg-muted/50 text-muted-foreground",
                                        )}
                                    >
                                        {index + 1}
                                    </span>
                                    <p className="text-sm font-medium text-foreground">{step}</p>
                                </div>
                                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={cn(
                                            "h-full rounded-full bg-gradient-to-r premium-progress-motion",
                                            toneStyle.bar,
                                            isComplete ? "w-full" : isActive ? "w-2/3" : "w-1/4 opacity-60",
                                        )}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function PremiumMetricSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("premium-panel rounded-3xl p-5", className)}>
            <div className="flex items-center justify-between gap-3">
                <PremiumSkeletonBlock className="h-4 w-24 rounded-full" />
                <PremiumSkeletonBlock className="h-9 w-9 rounded-2xl" />
            </div>
            <PremiumSkeletonBlock className="mt-5 h-10 w-24" />
            <PremiumSkeletonBlock className="mt-3 h-3 w-40 rounded-full" />
        </div>
    );
}

export function PremiumTableSkeleton({
    rows = 5,
    columns = 4,
    className,
}: {
    rows?: number;
    columns?: number;
    className?: string;
}) {
    return (
        <div className={cn("premium-panel rounded-3xl p-4", className)}>
            <div className="space-y-3">
                <div className="grid gap-3 border-b border-border/60 px-3 pb-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                    {Array.from({ length: columns }).map((_, index) => (
                        <PremiumSkeletonBlock key={`header-${index}`} className="h-3.5 w-20 rounded-full" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, row) => (
                    <div key={`row-${row}`} className="grid gap-3 px-3 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {Array.from({ length: columns }).map((__, column) => (
                            <PremiumSkeletonBlock key={`cell-${row}-${column}`} className={cn("h-10 rounded-xl", column === 0 && "w-[85%]")} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function PremiumPanelSkeleton({
    lines = 3,
    className,
    children,
}: {
    lines?: number;
    className?: string;
    children?: ReactNode;
}) {
    return (
        <div className={cn("premium-panel premium-glow rounded-3xl p-6", className)}>
            <div className="space-y-4">
                {children}
                {Array.from({ length: lines }).map((_, index) => (
                    <PremiumSkeletonBlock
                        key={index}
                        className={cn(
                            "h-4 rounded-full",
                            index === 0 && "w-2/5",
                            index === 1 && "w-full",
                            index === 2 && "w-4/5",
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

export function PremiumPageLoading({
    eyebrow,
    title,
    description,
    tone = "default",
    metrics = 3,
    panels = 2,
    className,
    children,
}: {
    eyebrow: string;
    title: string;
    description: string;
    tone?: LoadingTone;
    metrics?: number;
    panels?: number;
    className?: string;
    children?: ReactNode;
}) {
    const toneStyle = toneClasses[tone];

    return (
        <div className={cn("mx-auto w-full max-w-7xl space-y-8 px-4 py-6 lg:px-6", className)}>
            <section className="premium-panel premium-glow relative overflow-hidden rounded-[2rem] p-8">
                <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-r opacity-80", toneStyle.glow)} />
                <div className="relative space-y-5">
                    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", toneStyle.badge)}>
                        <Sparkles className="h-3.5 w-3.5" /> {eyebrow}
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{title}</h1>
                        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: metrics }).map((_, index) => (
                            <PremiumMetricSkeleton key={index} />
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                {children ? (
                    <div className="xl:col-span-2 space-y-6">{children}</div>
                ) : (
                    <>
                        <div className="space-y-6">
                            {Array.from({ length: panels }).map((_, index) => (
                                <PremiumPanelSkeleton key={index} lines={4 + index} />
                            ))}
                        </div>
                        <div className="space-y-6">
                            <PremiumPanelSkeleton lines={5} />
                            <PremiumPanelSkeleton lines={4} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export function PremiumRouteLoading({
    title,
    description,
    tone = "default",
    icon,
    children,
}: {
    title: string;
    description: string;
    tone?: LoadingTone;
    icon?: "orchestrator" | "analytics" | "builder" | "seo" | "content" | "research";
    children?: ReactNode;
}) {
    const resolvedIcon = icon ?? (tone === "default" ? "content" : tone);
    const Icon = {
        orchestrator: Bot,
        analytics: BarChart3,
        builder: Layers3,
        seo: Network,
        content: FileText,
        research: Search,
    }[resolvedIcon];

    return (
        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6 lg:px-6">
            <div className="premium-panel premium-glow rounded-[2rem] p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                            <Icon className="h-3.5 w-3.5" /> Route transition
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
                        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
                    </div>
                    <PremiumInlinePending label="Preparing data" description="Loading structured workspace context" />
                </div>
            </div>
            {children}
        </div>
    );
}
