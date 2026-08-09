"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ExternalLink, PencilLine, Rocket, X } from "lucide-react";
import { updateOpportunityStatus, type UpdateOpportunityResult } from "../actions";
import { Button } from "@/shared/ui/button";
import type { OpportunityStatus } from "../types";

interface StatusActionsProps {
    opportunityId: string;
    status: OpportunityStatus;
    signalData: Record<string, unknown>;
}

function isHistoricalSeoRow(signalData: Record<string, unknown>): boolean {
    const source = signalData.source;
    return source === "seo_internal_link_opportunities" || source === "seo_content_opportunities";
}

// Detectors that identify a specific piece of content (e.g. a low-traffic
// article) put the content id in signalData. Surfacing a direct deep link
// turns "review this opportunity" into a one-click remediation — user lands
// in the editor with the SEO enhance modal pre-opened.
function getContentTargetHref(signalData: Record<string, unknown>): string | null {
    const contentId = signalData.contentId ?? signalData.content_id;
    if (typeof contentId !== "string" || contentId.length === 0) return null;
    return `/dashboard/content/${contentId}?enhance=1`;
}

function isMarketMonitorSignal(signalData: Record<string, unknown>): boolean {
    return (
        signalData.source === "workspace_market_monitor_results"
        && typeof signalData.marketMonitorResultId === "string"
    );
}

export function StatusActions({ opportunityId, status, signalData }: StatusActionsProps) {
    const [isPending, startTransition] = useTransition();
    const [lastResult, setLastResult] = useState<UpdateOpportunityResult | null>(null);

    const transition = (next: OpportunityStatus) => {
        startTransition(async () => {
            const result = await updateOpportunityStatus(opportunityId, next);
            setLastResult(result);
        });
    };

    if (isHistoricalSeoRow(signalData)) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        href="/dashboard/seo"
                        className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-[15px] font-medium text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Manage in SEO Control Center
                    </Link>
                    {status === "pending" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => transition("dismissed")}
                            className="gap-1.5 text-muted-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                        </Button>
                    )}
                </div>
                {lastResult?.error && (
                    <p className="text-[15px] text-destructive">{lastResult.error}</p>
                )}
            </div>
        );
    }

    if (status !== "pending" && status !== "approved") {
        return (
            <div className="flex flex-col gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => transition("pending")}
                >
                    Reopen
                </Button>
                {lastResult?.error && (
                    <p className="text-[15px] text-destructive">{lastResult.error}</p>
                )}
            </div>
        );
    }

    const contentHref = getContentTargetHref(signalData);
    const isMarketSignal = isMarketMonitorSignal(signalData);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                {contentHref ? (
                    <Link
                        href={contentHref}
                        className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-[15px] font-medium text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
                    >
                        <PencilLine className="h-3.5 w-3.5" />
                        Open in editor
                    </Link>
                ) : null}
                {isMarketSignal && status === "approved" ? (
                    <Link
                        href="/dashboard/external-publishing"
                        className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-[15px] font-medium text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Use in External Publishing
                    </Link>
                ) : null}
                {status === "pending" && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => transition("approved")}
                        className="gap-1.5"
                        aria-busy={isPending || undefined}
                    >
                        <Check className="h-3.5 w-3.5" />
                        {isPending ? "Saving…" : "Approve"}
                    </Button>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => transition("implemented")}
                    className="gap-1.5"
                >
                    <Rocket className="h-3.5 w-3.5" />
                    Mark implemented
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => transition("dismissed")}
                    className="gap-1.5 text-muted-foreground"
                >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                </Button>
            </div>
            {lastResult?.error && (
                <p className="text-[15px] text-destructive">{lastResult.error}</p>
            )}
        </div>
    );
}
