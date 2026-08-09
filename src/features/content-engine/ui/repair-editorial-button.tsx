"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, Wrench } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface RepairResponse {
    applied?: boolean;
    fullyRepaired?: boolean;
    publicationReady?: boolean;
    savedProgress?: boolean;
    issuesAddressed?: number;
    remainingIssues?: Array<{ code?: string; message?: string }>;
    irreparableIssues?: Array<{ code?: string; message?: string }>;
    error?: string;
}

interface RepairEditorialButtonProps {
    contentId: string;
    onApplied?: () => void;
}

export function RepairEditorialButton({ contentId, onApplied }: RepairEditorialButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    function handleFixAll() {
        setError(null);
        setSuccess(null);
        startTransition(async () => {
            try {
                const res = await fetch(`/api/repair-editorial/${contentId}?apply=true`, { method: "POST" });
                const data = await res.json() as RepairResponse;
                if (!data.publicationReady) {
                    const remainingIssues = data.irreparableIssues?.length ? data.irreparableIssues : data.remainingIssues;
                    const remaining = remainingIssues?.length
                        ? ` Remaining: ${remainingIssues.slice(0, 3).map((issue) => issue.code ?? issue.message ?? "diagnostic").join(", ")}.`
                        : "";
                    const progress = data.savedProgress ? " Safe fixes were saved, but source-backed diagnostics still need source data." : "";
                    setError(`${data.error ?? "Repair could not clear every diagnostic."}${progress}${remaining}`);
                    return;
                }

                const fixed = typeof data.issuesAddressed === "number" ? data.issuesAddressed : 0;
                const recommendations = data.remainingIssues?.length ?? 0;
                setSuccess(data.fullyRepaired
                    ? `Fixed all diagnostics (${fixed}).`
                    : `Cleared all publication blockers (${fixed}); ${recommendations} non-blocking recommendation${recommendations === 1 ? "" : "s"} remain.`);
                onApplied?.();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Network error.");
            }
        });
    }

    return (
        <div className="inline-flex flex-col items-start gap-1">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFixAll}
                disabled={isPending}
                title="Automatically repair and save all editorial diagnostics for this blog post."
                className="h-7 gap-1 border-primary/20 bg-primary/5 text-[13px] text-primary hover:bg-primary/10 hover:text-primary"
            >
                {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : success ? (
                    <Check className="h-3 w-3" />
                ) : (
                    <Wrench className="h-3 w-3" />
                )}
                {isPending ? "Fixing..." : "Fix all issues"}
            </Button>
            {success ? (
                <span className="inline-flex max-w-sm items-center gap-1 text-[11px] text-emerald-600">
                    <Check className="h-3 w-3 flex-shrink-0" />
                    {success}
                </span>
            ) : null}
            {error ? (
                <span className="inline-flex max-w-sm items-start gap-1 text-[11px] text-destructive">
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    {error}
                </span>
            ) : null}
        </div>
    );
}
