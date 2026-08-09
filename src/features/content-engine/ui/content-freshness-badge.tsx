"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { verifyContentFreshness, type ContentVerificationStatus } from "@/features/content-engine/verify-freshness";

interface FreshnessBadgeProps {
    contentId: string;
    /** Pass metadata.provenance.last_freshness_check — if present, the badge shows the cached state */
    lastCheck: {
        checked_at: string;
        verification_status: ContentVerificationStatus;
        stale_indicators?: string[];
    } | null;
}

const STATUS_LABEL: Record<ContentVerificationStatus, string> = {
    fresh: "Fresh",
    stale: "Stale claims",
    uncertain: "Uncertain",
    evergreen: "Evergreen",
    error: "Check failed",
};

const STATUS_TONE: Record<ContentVerificationStatus, string> = {
    fresh: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    evergreen: "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
    uncertain: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    stale: "border-destructive/40 bg-destructive/10 text-destructive",
    error: "border-muted/40 bg-muted/10 text-muted-foreground",
};

// Surfaces the cached result of verify-freshness for a content item and lets
// the author trigger a fresh check on demand. Uses Tavily under the hood, so
// re-verification is billed — we gate it behind an explicit click and do not
// re-run automatically on each render.
export function ContentFreshnessBadge({ contentId, lastCheck }: FreshnessBadgeProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const runCheck = () => {
        setError(null);
        setInfo(null);
        startTransition(async () => {
            const result = await verifyContentFreshness(contentId);
            if (result.verification_status === "error") {
                setError(result.error ?? "Freshness check failed.");
                router.refresh();
                return;
            }
            if (result.error) {
                setError(`Saved partial result: ${result.error}`);
            }
            setInfo(`Checked · ${STATUS_LABEL[result.verification_status]}.`);
            router.refresh();
        });
    };

    if (!lastCheck) {
        return (
            <div className="inline-flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={runCheck}
                    disabled={isPending}
                    title="Verify whether the claims in this article match current public sources. Uses Tavily (metered)."
                    aria-busy={isPending || undefined}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                    {isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <HelpCircle className="h-3 w-3" />}
                    {isPending ? "Verifying…" : "Verify freshness"}
                </button>
                {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
                {info ? <span className="text-[11px] text-emerald-600 dark:text-emerald-300">{info}</span> : null}
            </div>
        );
    }

    const status = lastCheck.verification_status;
    const checkedAt = new Date(lastCheck.checked_at);
    const daysAgo = Math.max(0, Math.floor((Date.now() - checkedAt.getTime()) / 86_400_000));
    const stale = status === "stale";
    const Icon = stale ? AlertTriangle : status === "uncertain" ? HelpCircle : Check;

    return (
        <div className="inline-flex items-center gap-2">
            <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium ${STATUS_TONE[status]}`}
                title={stale && lastCheck.stale_indicators?.length
                    ? `Stale indicators:\n${lastCheck.stale_indicators.join("\n")}`
                    : `Last verified ${checkedAt.toLocaleString()}`}
            >
                <Icon className="h-3 w-3" />
                {STATUS_LABEL[status]}
                <span className="text-[10px] opacity-75">
                    <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                    {daysAgo === 0 ? "today" : `${daysAgo}d ago`}
                </span>
            </span>
            <button
                type="button"
                onClick={runCheck}
                disabled={isPending}
                title="Re-verify against current sources (metered)"
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
                <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
                {isPending ? "Verifying" : "Re-check"}
            </button>
            {error ? <span className="text-[11px] text-destructive">{error}</span> : null}
            {info ? <span className="text-[11px] text-emerald-600 dark:text-emerald-300">{info}</span> : null}
        </div>
    );
}
