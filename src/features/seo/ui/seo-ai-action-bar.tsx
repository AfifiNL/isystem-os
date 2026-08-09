"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Languages, Lightbulb, Network, Clock } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { AiOperationPendingCard } from "@/shared/ui/loading";
import { SUPPORTED_LOCALES, getLocaleNativeLabel, isSupportedLocale } from "@/shared/lib/i18n/routing";
import type { Locale } from "@/features/templates/types";

type SeoAiAction = "specialist" | "strategist" | "background-scan";

interface SeoAiActionBarProps {
    runSeoSpecialistAuditAction: (locale: string) => Promise<void>;
    runSeoStrategistAnalysisAction: (locale: string) => Promise<void>;
    enqueueAllPublishedContentJobsAction: (locale: string) => Promise<{ enqueuedCount: number }>;
    /** Active dashboard locale, sourced from URL `?locale=` (single source of truth). */
    activeLocale: string;
    disabled?: boolean;
}

const ACTION_META: Record<SeoAiAction, { title: string; description: string; steps: readonly string[] }> = {
    specialist: {
        title: "Running SEO specialist audit",
        description:
            "Inventorying published content, extracting internal-link signals, and persisting recommendations. This can take 20–60 seconds on a large workspace.",
        steps: [
            "Read published content inventory",
            "Score internal-link candidates with Gemini",
            "Persist recommendations and refresh the dashboard",
        ],
    },
    strategist: {
        title: "Generating SEO strategist plan",
        description:
            "Clustering topics, building blue-ocean opportunities, and producing ready-to-edit plans. This is the heaviest SEO job — 30–90 seconds is normal.",
        steps: [
            "Analyze analytics, inventory, and coverage gaps",
            "Generate clusters, opportunities, and plan briefs",
            "Persist the strategist output and refresh the dashboard",
        ],
    },
    "background-scan": {
        title: "Queueing automated SEO scan + safe fixes",
        description:
            "Enqueuing server-side analysis jobs for published blog posts. The worker previews safe edits and auto-applies only internal-link fixes that pass guardrails.",
        steps: [
            "Fetch published blog posts for this language",
            "Register worker jobs for analysis and safe automated fixing",
            "Return the queued count; completed results appear in dashboard summaries.",
        ],
    },
};

export function SeoAiActionBar({
    runSeoSpecialistAuditAction,
    runSeoStrategistAnalysisAction,
    enqueueAllPublishedContentJobsAction,
    activeLocale,
    disabled,
}: SeoAiActionBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const selectedLocale: Locale = isSupportedLocale(activeLocale) ? activeLocale : "en";
    const [activeAction, setActiveAction] = useState<SeoAiAction | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    // Locale is URL-driven so the dashboard view, the picker, and the run
    // parameter are always in sync (single source of truth). Switching the
    // picker navigates; running uses whatever the URL currently says.
    const switchLocale = (locale: Locale) => {
        if (locale === selectedLocale) return;
        const next = new URLSearchParams(searchParams?.toString() ?? "");
        next.set("locale", locale);
        // Reset paginated lists when switching locale — page 2 of EN
        // opportunities is meaningless against the NL list.
        for (const key of ["linksPage", "oppsPage", "clustersPage", "plansPage"]) {
            next.delete(key);
        }
        router.push(`${pathname}?${next.toString()}`);
    };

    const trigger = (action: SeoAiAction, fn: (locale: string) => Promise<void>) => {
        if (disabled || isPending) return;
        setActiveAction(action);
        setActionError(null);
        setActionSuccess(null);
        startTransition(async () => {
            try {
                await fn(selectedLocale);
            } catch (err) {
                if (err instanceof Error && err.message === "NEXT_REDIRECT") {
                    throw err;
                }
                // Without this catch the spinner clears on the `finally` and
                // the operator sees nothing — they think the action succeeded.
                // Surface a concise message so they know to retry / inspect.
                const message = err instanceof Error ? err.message : "Action failed.";
                setActionError(message);
            } finally {
                setActiveAction(null);
            }
        });
    };

    const triggerQueue = () => {
        if (disabled || isPending) return;
        setActiveAction("background-scan");
        setActionError(null);
        setActionSuccess(null);
        startTransition(async () => {
            try {
                const res = await enqueueAllPublishedContentJobsAction(selectedLocale);
                setActionSuccess(
                    res.enqueuedCount > 0
                        ? `Queued ${res.enqueuedCount} server-side SEO job${res.enqueuedCount === 1 ? "" : "s"}. The worker will analyze posts, auto-apply only safe internal-link fixes, and publish results in dashboard summaries when complete.`
                        : "No new server-side SEO jobs were queued. Existing jobs may already be pending, and completed worker results will appear in dashboard summaries.",
                );
            } catch (err) {
                if (err instanceof Error && err.message === "NEXT_REDIRECT") {
                    throw err;
                }
                const message = err instanceof Error ? err.message : "Action failed.";
                setActionError(message);
            } finally {
                setActiveAction(null);
            }
        });
    };

    const meta = activeAction ? ACTION_META[activeAction] : null;

    return (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <div className="flex h-8 items-center gap-1 rounded-md border border-border/55 bg-muted/25 p-0.5" title="Content language for this view and the next SEO run">
                <span className="flex h-6 w-6 items-center justify-center text-muted-foreground" aria-hidden>
                    <Languages className="h-3.5 w-3.5" />
                </span>
                <div role="radiogroup" aria-label="SEO content language" className="flex items-center gap-0.5">
                    {SUPPORTED_LOCALES.map((locale) => (
                        <button
                            key={locale}
                            type="button"
                            role="radio"
                            aria-checked={selectedLocale === locale}
                            onClick={() => switchLocale(locale)}
                            disabled={isPending}
                            className={`h-6 rounded px-2 text-[11px] font-medium transition-colors ${
                                selectedLocale === locale
                                    ? "bg-foreground text-background"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}
                        >
                            {getLocaleNativeLabel(locale)}
                        </button>
                    ))}
                </div>
            </div>

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-md text-[12px]"
                title="Audit published content and persist internal-link recommendations"
                disabled={disabled || isPending}
                aria-busy={isPending && activeAction === "specialist" ? true : undefined}
                onClick={() => trigger("specialist", runSeoSpecialistAuditAction)}
            >
                <Network className="h-3.5 w-3.5" />
                {isPending && activeAction === "specialist" ? "Auditing…" : "Audit"}
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-md border-dashed text-[12px]"
                title="Queue asynchronous scanning and guardrail-approved safe fixes"
                disabled={disabled || isPending}
                aria-busy={isPending && activeAction === "background-scan" ? true : undefined}
                onClick={triggerQueue}
            >
                <Clock className="h-3.5 w-3.5 text-primary" />
                {isPending && activeAction === "background-scan" ? "Queueing…" : "Auto-scan"}
            </Button>
            <Button
                type="button"
                size="sm"
                className="gap-1.5 rounded-md text-[12px]"
                title="Generate clusters, opportunities, and plan-ready briefs"
                disabled={disabled || isPending}
                aria-busy={isPending && activeAction === "strategist" ? true : undefined}
                onClick={() => trigger("strategist", runSeoStrategistAnalysisAction)}
            >
                <Lightbulb className="h-3.5 w-3.5" />
                {isPending && activeAction === "strategist" ? "Planning…" : "Strategist"}
            </Button>

            {meta && (
                <div className="basis-full pt-1">
                    <AiOperationPendingCard
                        tone="seo"
                        title={meta.title}
                        description={meta.description}
                        steps={[...meta.steps]}
                        activeStep={1}
                    />
                </div>
            )}

            {actionError && (
                <div
                    role="alert"
                    className="basis-full flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-[13px] text-destructive"
                >
                    <span>{actionError}</span>
                    <button
                        type="button"
                        onClick={() => setActionError(null)}
                        className="text-[12px] font-medium underline-offset-2 hover:underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {actionSuccess && (
                <div
                    role="alert"
                    className="basis-full flex items-start justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-1.5 text-[13px] text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-300"
                >
                    <span>{actionSuccess}</span>
                    <button
                        type="button"
                        onClick={() => setActionSuccess(null)}
                        className="text-[12px] font-medium underline-offset-2 hover:underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}
