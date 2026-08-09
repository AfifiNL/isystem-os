"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, Sparkles, X } from "lucide-react";
import { ModuleIcon } from "@/features/admin/ui/module-icon";
import {
    advanceOnboardingStep,
    completeOnboarding,
    skipOnboarding,
} from "@/features/admin/actions/onboarding";
import type { OnboardingStep } from "@/features/admin/lib/onboarding";

interface WelcomeWindowProps {
    workspaceId: string;
    workspaceName: string;
    steps: OnboardingStep[];
    initialStepIndex: number;
}

// First-run guided tour. Renders inside the desktop view as a centered
// modal-style window that matches the OS-shell aesthetic (translucent
// border, slate-950 surface, subtle backdrop). Designed to be obviously
// dismissable so it never blocks the inbox or the desktop launcher.
export function WelcomeWindow({
    workspaceId,
    workspaceName,
    steps,
    initialStepIndex,
}: WelcomeWindowProps) {
    const safeInitial = Math.min(Math.max(initialStepIndex, 0), Math.max(steps.length - 1, 0));
    const [stepIndex, setStepIndex] = useState(safeInitial);
    const [dismissed, setDismissed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const totalSteps = steps.length;
    const step = steps[stepIndex];
    const progress = useMemo(() => {
        if (totalSteps <= 1) return 100;
        return Math.round(((stepIndex + 1) / totalSteps) * 100);
    }, [stepIndex, totalSteps]);

    if (dismissed || !step) return null;

    const isFirst = stepIndex === 0;
    const isLast = stepIndex === totalSteps - 1;

    const handleNext = () => {
        setError(null);
        startTransition(async () => {
            const result = await advanceOnboardingStep({
                workspaceId,
                stepIndex,
                stepKey: step.key,
            });
            if (!result.success) {
                setError(result.error ?? "Could not save progress");
                return;
            }
            if (isLast) {
                const finishResult = await completeOnboarding(workspaceId);
                if (!finishResult.success) {
                    setError(finishResult.error ?? "Could not finish tour");
                    return;
                }
                setDismissed(true);
                return;
            }
            setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
        });
    };

    const handleBack = () => {
        setError(null);
        if (isFirst) return;
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const handleSkip = () => {
        setError(null);
        startTransition(async () => {
            const result = await skipOnboarding(workspaceId);
            if (!result.success) {
                setError(result.error ?? "Could not skip tour");
                return;
            }
            setDismissed(true);
        });
    };

    return (
        <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="welcome-window-title"
            className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-4 pb-20 pt-8"
        >
            <div className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950/85 text-slate-100 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/15 text-cyan-200">
                            <Sparkles className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                                Welcome tour
                            </span>
                            <span className="text-xs font-medium text-slate-100">
                                {workspaceName}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
                        aria-label="Skip onboarding"
                    >
                        <X className="h-3 w-3" />
                        Skip
                    </button>
                </header>

                <div className="px-5 pb-2 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                            Step {stepIndex + 1} of {totalSteps}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">{progress}%</span>
                    </div>
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={totalSteps}
                        aria-valuenow={stepIndex + 1}
                        className="h-1 overflow-hidden rounded-full bg-white/5"
                    >
                        <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-[width] duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <section className="px-5 py-5">
                    <div className="flex items-start gap-3">
                        {step.icon ? (
                            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-100">
                                <ModuleIcon name={step.icon} className="h-5 w-5" />
                            </span>
                        ) : (
                            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
                                <Sparkles className="h-5 w-5" />
                            </span>
                        )}
                        <div className="flex-1">
                            <h2
                                id="welcome-window-title"
                                className="flex items-center gap-2 text-base font-semibold text-slate-50"
                            >
                                {step.title}
                                {step.badge === "PRO" ? (
                                    <span className="rounded-full bg-cyan-500/90 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wider text-slate-950">
                                        PRO
                                    </span>
                                ) : null}
                                {step.locked ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                                        <Lock className="h-2.5 w-2.5" />
                                        Locked
                                    </span>
                                ) : null}
                            </h2>
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{step.body}</p>
                            {step.href && !step.locked ? (
                                <Link
                                    href={step.href}
                                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                                >
                                    {step.primaryCta ?? "Open"}
                                    <ChevronRight className="h-3 w-3" />
                                </Link>
                            ) : null}
                        </div>
                    </div>
                </section>

                {error ? (
                    <p
                        role="alert"
                        className="mx-5 mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200"
                    >
                        {error}
                    </p>
                ) : null}

                <footer className="flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/40 px-5 py-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={isFirst || isPending}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Back
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSkip}
                            disabled={isPending}
                            className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-50"
                        >
                            Skip tour
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-cyan-400 to-emerald-300 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-[0_4px_14px_rgba(34,211,238,0.35)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLast ? "Finish" : "Next"}
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
