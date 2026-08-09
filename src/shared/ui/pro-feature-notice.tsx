import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Lock, Sparkles, Zap } from "lucide-react";
import { ProBadge } from "@/shared/ui/pro-badge";

interface ProFeatureNoticeProps {
    title?: string;
    description: string;
    compact?: boolean;
    ctaHref?: string;
    ctaLabel?: string;
    benefits?: string[];
}

export function ProFeatureNotice({
    title = "This feature requires a Pro workspace",
    description,
    compact = false,
    ctaHref = "/dashboard/settings",
    ctaLabel = "Open workspace settings",
    benefits = [
        "Unlock guided AI workflows tailored to your workspace.",
        "Enable generation, orchestration, and premium operations modules.",
        "Configure the Pro workspace for your deployment.",
    ],
}: ProFeatureNoticeProps) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background ${compact ? "p-4" : "p-6"}`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.12),transparent_32%)]" />

            <div className="relative space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl border border-primary/20 bg-primary/10 p-2.5 text-primary shadow-sm">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className={`${compact ? "text-base" : "text-lg"} font-semibold text-foreground`}>{title}</h3>
                                <ProBadge />
                            </div>
                            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
                        </div>
                    </div>

                    <div className="grid min-w-[220px] gap-2 rounded-2xl border border-primary/15 bg-background/80 p-3 shadow-sm backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                            <Zap className="h-3.5 w-3.5" />
                            Pro unlock includes
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                AI generation engine
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                Premium operations modules
                            </div>
                            <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-primary" />
                                Workspace Pro activation
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`grid gap-3 ${compact ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
                    {benefits.map((benefit) => (
                        <div key={benefit} className="rounded-xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span>{benefit}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Open workspace settings to review the configured tier and available modules.
                    </p>
                    <Link
                        href={ctaHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:translate-y-[-1px] hover:opacity-95"
                    >
                        {ctaLabel}
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
