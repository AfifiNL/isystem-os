"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Zap } from "lucide-react";
import { getWorkspaceAiBalanceSummary, type AiBalanceSummary } from "@/features/admin/actions/ai-balance";

interface AiBalanceIndicatorProps {
    /** Compact mode hides the balance number and shows only the status chip. */
    compact?: boolean;
}

// Contextual AI-balance chip for client components next to AI action buttons.
// Renders a warning when the workspace is close to the minimum balance floor
// and a blocking message when balance is below the floor. Keeps the home-page
// balance badge in sync with action surfaces so users are not surprised
// mid-workflow.
export function AiBalanceIndicator({ compact = false }: AiBalanceIndicatorProps) {
    const [summary, setSummary] = useState<AiBalanceSummary | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await getWorkspaceAiBalanceSummary();
            if (!cancelled && result.data) setSummary(result.data);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (!summary || summary.status === "ok") return null;

    const euros = (summary.balanceMillicents / 10_000).toFixed(2);
    const floor = (summary.floorMillicents / 10_000).toFixed(2);
    const isBlocked = summary.status === "blocked";

    const title = isBlocked
        ? `AI credits exhausted (€${euros}). Top up to run AI actions.`
        : `Low AI credits: €${euros}. Top up before they drop below €${floor}.`;

    return (
        <Link
            href="/dashboard/settings?section=ai-credits"
            title={title}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isBlocked
                    ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
            }`}
        >
            {isBlocked ? <AlertTriangle className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
            {compact ? (
                <span>{isBlocked ? "AI blocked" : "Low AI credits"}</span>
            ) : (
                <span>{isBlocked ? "AI blocked" : "Low credits"} · €{euros}</span>
            )}
        </Link>
    );
}
