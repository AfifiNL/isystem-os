import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles, Target } from "lucide-react";
import type { ExternalPublicationPackageRow } from "@/features/external-publishing/types";
import { cn } from "@/shared/lib/utils";

function scoreTone(score: number) {
    if (score >= 80) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    if (score >= 60) return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    return "border-destructive/30 bg-destructive/10 text-destructive";
}

export function PackageQualityScorecard({ pkg }: { pkg: ExternalPublicationPackageRow }) {
    const items = [
        { label: "Quality", value: pkg.quality_score, icon: Sparkles },
        { label: "Usefulness", value: pkg.usefulness_score, icon: Target },
        { label: "Link safety", value: pkg.backlink_safety_score, icon: ShieldCheck },
    ];
    const warnings = Array.isArray(pkg.compliance_warnings) ? pkg.compliance_warnings.filter((item): item is string => typeof item === "string") : [];

    return (
        <section aria-labelledby="external-publishing-scorecard-title" className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 id="external-publishing-scorecard-title" className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quality scorecard</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Use these scores as review signals, not as permission to auto-post.</p>
                </div>
                {warnings.length === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-label="No compliance warnings" /> : <AlertTriangle className="h-5 w-5 text-amber-500" aria-label="Compliance warnings present" />}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <div key={item.label} className={cn("rounded-xl border p-3", scoreTone(item.value))}>
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]">
                                <Icon className="h-4 w-4" aria-hidden="true" />
                                {item.label}
                            </div>
                            <p className="mt-2 text-2xl font-semibold">{item.value}<span className="text-sm font-medium">/100</span></p>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm font-semibold text-foreground">Compliance notes</p>
                {warnings.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">No stored warnings. Still verify community rules, disclosure needs, and source claims manually.</p>
                ) : (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                    </ul>
                )}
            </div>
        </section>
    );
}
