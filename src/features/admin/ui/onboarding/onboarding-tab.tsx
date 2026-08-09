"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { restartOnboarding } from "@/features/admin/actions/onboarding";

interface OnboardingTabProps {
    workspaceId: string;
    workspaceName: string;
    completedAt: string | null;
    skippedAt: string | null;
}

function formatStatus(completedAt: string | null, skippedAt: string | null): {
    label: string;
    tone: "success" | "muted" | "info";
} {
    if (completedAt) {
        return { label: `Completed on ${new Date(completedAt).toLocaleDateString()}`, tone: "success" };
    }
    if (skippedAt) {
        return { label: `Skipped on ${new Date(skippedAt).toLocaleDateString()}`, tone: "muted" };
    }
    return { label: "Not yet started", tone: "info" };
}

// Settings panel for the first-run guided tour. Mirrors the "premium-panel"
// styling used by sibling tabs so it feels native to the Settings surface.
// Restart resets per-membership progress (steps + coach marks) and clears
// the suppression timestamps, so the Welcome window auto-launches again
// the next time the user lands on /dashboard.
export function OnboardingTab({
    workspaceId,
    workspaceName,
    completedAt,
    skippedAt,
}: OnboardingTabProps) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    const status = formatStatus(completedAt, skippedAt);

    const handleRestart = () => {
        setError(null);
        setSuccess(false);
        startTransition(async () => {
            const result = await restartOnboarding(workspaceId);
            if (!result.success) {
                setError(result.error ?? "Could not restart the tour");
                return;
            }
            setSuccess(true);
            router.refresh();
        });
    };

    return (
        <section
            aria-labelledby="onboarding-settings-heading"
            className="premium-panel space-y-6 rounded-2xl p-6"
        >
            <header className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                        <h2
                            id="onboarding-settings-heading"
                            className="text-base font-semibold text-foreground"
                        >
                            Welcome tour
                        </h2>
                        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                            The first-run guided tour walks managers through every workspace
                            app on the desktop. Restarting it for{" "}
                            <span className="font-medium text-foreground">{workspaceName}</span>{" "}
                            resets your progress and re-enables the per-app coach marks.
                        </p>
                    </div>
                </div>
                <span
                    className={
                        status.tone === "success"
                            ? "inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300"
                            : status.tone === "muted"
                                ? "inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                                : "inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                    }
                >
                    {status.label}
                </span>
            </header>

            <dl className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        What restart does
                    </dt>
                    <dd className="mt-2 text-sm text-foreground">
                        Clears your completed steps, resets the current step to 1, and
                        re-enables every app coach mark for this workspace.
                    </dd>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Scope
                    </dt>
                    <dd className="mt-2 text-sm text-foreground">
                        Per-membership. Other managers and other workspaces you belong to
                        are not affected.
                    </dd>
                </div>
            </dl>

            {error ? (
                <p
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                    {error}
                </p>
            ) : null}

            {success ? (
                <p
                    role="status"
                    className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300"
                >
                    Tour reset. Open the desktop to start it again.
                </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleRestart} disabled={isPending} className="gap-2">
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RotateCcw className="h-4 w-4" />
                    )}
                    Restart tour
                </Button>
                <Link
                    href="/dashboard"
                    className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                    Open desktop
                </Link>
            </div>
        </section>
    );
}
