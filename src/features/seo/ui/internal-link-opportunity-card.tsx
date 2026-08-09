"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, History, RotateCcw, ShieldCheck, WandSparkles } from "lucide-react";
import type { SeoExecutionActionResult, SeoExecutionEventRecord, SeoExecutionPreview, SeoInternalLinkOpportunityRecord, SeoRecommendationStatus } from "@/features/seo/types";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { PremiumInlinePending } from "@/shared/ui/loading";

type ActionResult = Promise<SeoExecutionActionResult>;

interface InternalLinkOpportunityCardProps {
    item: SeoInternalLinkOpportunityRecord;
    executionEvents: SeoExecutionEventRecord[];
    updateStatusAction: (id: string, status: string) => Promise<{ ok: true; status: string }>;
    generatePreviewAction: (recommendationId: string) => ActionResult;
    applyRecommendationAction: (recommendationId: string) => ActionResult;
    rollbackExecutionAction: (executionId: string) => ActionResult;
}

function StatusPill({ value }: { value: string }) {
    const tone = value === "approved" || value === "ready_to_apply" || value === "applied"
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : value === "manual_review_required" || value === "failed"
            ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : value === "dismissed" || value === "rolled_back"
                ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "border-border bg-muted/50 text-muted-foreground";

    return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[13px] font-semibold uppercase tracking-[0.18em]", tone)}>{value.replace(/_/g, " ")}</span>;
}

function RiskCheckList({ preview }: { preview: SeoExecutionPreview }) {
    return (
        <div className="grid gap-2">
            {preview.riskChecks.map((risk) => (
                <div key={risk.key} className="rounded-md border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center gap-2 text-[17px] font-medium text-foreground">
                        {risk.passed ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        {risk.label}
                    </div>
                    <p className="mt-1 text-[15px] leading-6 text-muted-foreground">{risk.message}</p>
                </div>
            ))}
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="rounded-md border border-border/60 bg-background/60 p-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-[17px] text-foreground">{value && value.trim().length > 0 ? value : "—"}</p>
        </div>
    );
}

function DetailList({ label, values }: { label: string; values: string[] }) {
    return (
        <div className="rounded-md border border-border/60 bg-background/60 p-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            {values.length === 0 ? <p className="mt-1 text-[17px] text-foreground">—</p> : (
                <ul className="mt-2 space-y-2 text-[17px] text-foreground">
                    {values.map((value) => <li key={value} className="leading-6">• {value}</li>)}
                </ul>
            )}
        </div>
    );
}

export function InternalLinkOpportunityCard({
    item,
    executionEvents,
    updateStatusAction,
    generatePreviewAction,
    applyRecommendationAction,
    rollbackExecutionAction,
}: InternalLinkOpportunityCardProps) {
    const [currentStatus, setCurrentStatus] = useState(item.status);
    const [preview, setPreview] = useState<SeoExecutionPreview | null>(() => {
        const payload = item.last_preview_payload as SeoExecutionPreview | null;
        return payload && typeof payload === "object" && "recommendationId" in payload ? payload : null;
    });
    const [feedback, setFeedback] = useState<
        | { kind: "info" | "error" | "conflict"; message: string; resolution?: string }
        | null
    >(
        item.manual_review_reason || item.failed_reason
            ? { kind: "error", message: item.manual_review_reason || item.failed_reason || "" }
            : null,
    );
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const history = useMemo(
        () => executionEvents.filter((event) => event.recommendation_id === item.id),
        [executionEvents, item.id],
    );

    const latestAppliedEvent = history.find((event) => event.execution_status === "applied" && event.rollback_status === "not_requested");
    const canPreview = ["approved", "ready_to_apply", "manual_review_required", "failed"].includes(currentStatus);
    const canApply = currentStatus === "ready_to_apply" || (currentStatus === "approved" && Boolean(preview?.supported));

    const previewMutationStrategyLabel = (preview?.mutationStrategy ?? "manual_review").replace(/_/g, " ");
    const previewMutationStepLabel = (preview?.mutationStep ?? "not_available").replace(/_/g, " ");
    const previewAutomationTierLabel = (preview?.automationTier ?? "manual_review").replace(/_/g, " ");
    const previewSkippedFallbacks = Array.isArray(preview?.skippedFallbacks) ? preview.skippedFallbacks : [];
    const previewCandidateDiagnostics = Array.isArray(preview?.candidateDiagnostics) ? preview.candidateDiagnostics : [];

    const runAction = (runner: () => ActionResult | Promise<{ ok: true; status: string }>) => {
        setFeedback(null);
        startTransition(async () => {
            try {
                const result = await runner();
                if ("message" in result) {
                    if (result.preview) {
                        setPreview(result.preview);
                    }
                    if (result.recommendationStatus) {
                        setCurrentStatus(result.recommendationStatus);
                    }
                    const kind = result.ok
                        ? "info"
                        : result.errorKind === "conflict"
                            ? "conflict"
                            : "error";
                    setFeedback({
                        kind,
                        message: result.message,
                        resolution: result.resolution,
                    });
                    // Server-side cascades (auto-preview siblings, claim
                    // counters, history events) are invisible without a
                    // refresh. Refresh on success only — no point invalidating
                    // the route tree on a known-failed mutation.
                    if (result.ok) router.refresh();
                    return;
                }

                setCurrentStatus(result.status as SeoRecommendationStatus);
                setFeedback({
                    kind: "info",
                    message: `Recommendation status updated to ${result.status.replace(/_/g, " ")}.`,
                });
                router.refresh();
            } catch (error) {
                setFeedback({
                    kind: "error",
                    message: error instanceof Error ? error.message : "The SEO action failed.",
                });
            }
        });
    };

    return (
        <div className="rounded-md border border-border/70 bg-card/70 p-6 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-[21px] font-semibold text-foreground">{item.source_title} <ArrowRight className="mx-1 inline h-4 w-4" /> {item.target_title}</p>
                        <StatusPill value={currentStatus} />
                        {item.is_orphan_target ? <span className="inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[13px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Orphan target</span> : null}
                    </div>
                    <p className="text-[17px] leading-6 text-muted-foreground">{item.rationale}</p>
                    <div className="grid gap-2 text-[17px] text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Anchor</span><p className="mt-1 font-medium text-foreground">{item.anchor_text}</p></div>
                        <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Priority</span><p className="mt-1 font-medium text-foreground">{item.priority_score}</p></div>
                        <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Source traffic</span><p className="mt-1 font-medium text-foreground">{item.source_traffic}</p></div>
                        <div className="rounded-md border border-border/60 bg-background/60 p-3"><span className="text-[15px] uppercase tracking-[0.18em]">Target conversions</span><p className="mt-1 font-medium text-foreground">{item.target_conversions}</p></div>
                    </div>
                    <p className="text-[15px] text-muted-foreground">Semantic fit {item.semantic_fit_score} · Analytics {item.analytics_score} · Strategic importance {item.strategic_importance_score} · Existing support {item.existing_link_count}</p>
                    {isPending ? <PremiumInlinePending label="Executing SEO action" description="Reviewing preview or mutating content safely" /> : null}
                    {feedback ? (
                        <div
                            role={feedback.kind === "info" ? undefined : "alert"}
                            className={
                                feedback.kind === "conflict"
                                    ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[17px] text-amber-900 dark:text-amber-200"
                                    : feedback.kind === "error"
                                        ? "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[17px] text-destructive"
                                        : "rounded-md border border-border/60 bg-background/60 px-4 py-3 text-[17px] text-muted-foreground"
                            }
                        >
                            <p className="font-medium">
                                {feedback.kind === "conflict" ? "Rollback conflict · " : null}
                                {feedback.message}
                            </p>
                            {feedback.resolution ? (
                                <p className="mt-1 text-[15px] opacity-80">{feedback.resolution}</p>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                <div className="flex flex-wrap gap-2 xl:w-[320px] xl:justify-end">
                    <Button type="button" size="sm" className="rounded-md" disabled={isPending || currentStatus === "approved" || currentStatus === "ready_to_apply" || currentStatus === "applied"} onClick={() => runAction(() => updateStatusAction(item.id, "approved"))}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-md" disabled={isPending || !canPreview} onClick={() => runAction(() => generatePreviewAction(item.id))}><Eye className="h-4 w-4" /> Preview</Button>
                    <Button type="button" variant="secondary" size="sm" className="rounded-md" disabled={isPending || !canApply} onClick={() => runAction(() => applyRecommendationAction(item.id))}><WandSparkles className="h-4 w-4" /> Apply</Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-md" disabled={isPending || !latestAppliedEvent} onClick={() => latestAppliedEvent && runAction(() => rollbackExecutionAction(latestAppliedEvent.id))}><RotateCcw className="h-4 w-4" /> Roll back</Button>
                    <Button type="button" variant="ghost" size="sm" className="rounded-md" disabled={isPending || currentStatus === "dismissed"} onClick={() => runAction(() => updateStatusAction(item.id, "dismissed"))}>Dismiss</Button>
                </div>
            </div>

            <details className="group mt-4 rounded-md border border-border/60 bg-background/35">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold text-foreground outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2"><History className="h-4 w-4" /> Review execution details</span>
                    <span className="text-[13px] font-normal text-muted-foreground group-open:hidden">
                        {preview ? "Preview and history collapsed" : `${history.length} history event${history.length === 1 ? "" : "s"}`}
                    </span>
                    <span className="hidden text-[13px] font-normal text-muted-foreground group-open:inline">Hide details</span>
                </summary>
                <div className="border-t border-border/60 p-4">
            {preview ? (
                <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
                    <div className="rounded-md border border-border/60 bg-background/60 p-4">
                        <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Before</p>
                        <pre className="mt-3 whitespace-pre-wrap text-[17px] leading-6 text-foreground">{preview.beforeSnippet || preview.originalValue || "No safe preview snippet was available."}</pre>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/60 p-4">
                        <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">After</p>
                        <pre className="mt-3 whitespace-pre-wrap text-[17px] leading-6 text-foreground">{preview.afterSnippet || preview.updatedValue || preview.manualReviewReason || "No automatic mutation output was produced."}</pre>
                    </div>
                    <div className="space-y-3 rounded-md border border-border/60 bg-background/60 p-4">
                        <div>
                            <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Execution notes</p>
                            <p className="mt-2 text-[17px] leading-6 text-muted-foreground">{preview.locationRationale}</p>
                            <p className="mt-2 text-[15px] leading-6 text-muted-foreground">Renderer: <span className="font-medium text-foreground">{preview.renderer}</span> · Format: <span className="font-medium text-foreground">{preview.contentFormat}</span></p>
                            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">Strategy: <span className="font-medium text-foreground">{previewMutationStrategyLabel}</span> · Step: <span className="font-medium text-foreground">{previewMutationStepLabel}</span></p>
                            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">Automation tier: <span className="font-medium text-foreground">{previewAutomationTierLabel}</span></p>
                            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">Compatibility: {preview.rendererCompatibility}</p>
                            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">Why chosen: {preview.strategyReason}</p>
                        </div>
                        <div className="grid gap-2">
                            <DetailRow label="Block ID" value={preview.blockId} />
                            <DetailRow label="Block type" value={preview.blockType} />
                            <DetailRow label="Field path" value={preview.fieldPath} />
                            <DetailRow label="Locale" value={preview.locale} />
                            <DetailRow label="Reason" value={preview.targetReason} />
                        </div>
                        <DetailList label="Skipped fallbacks" values={previewSkippedFallbacks} />
                        <DetailList label="Candidate diagnostics" values={previewCandidateDiagnostics.map((candidate) => `${(candidate.status ?? "unknown").replace(/_/g, " ")}: ${candidate.blockType}.${candidate.fieldPath}${candidate.locale ? ` (${candidate.locale})` : ""} — ${candidate.summary}`)} />
                        {preview.manualReviewReason ? <div className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[15px] leading-6 text-amber-800 dark:text-amber-200">Manual review required: {preview.manualReviewReason}</div> : null}
                    </div>
                    <div className="xl:col-span-3">
                        <RiskCheckList preview={preview} />
                    </div>
                </div>
            ) : null}

            <div className="mt-4 rounded-md border border-border/60 bg-background/60 p-4">
                <div className="flex items-center gap-2 text-[17px] font-semibold text-foreground"><History className="h-4 w-4" /> Execution history</div>
                <div className="mt-4 space-y-3">
                    {history.length === 0 ? <p className="text-[17px] text-muted-foreground">No execution events have been recorded for this recommendation yet.</p> : history.map((event) => (
                        <div key={event.id} className="rounded-md border border-border/60 bg-card/80 p-3">
                            {(() => {
                                const payload = event.preview_payload as SeoExecutionPreview | null;
                                return (
                                    <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <StatusPill value={event.execution_status} />
                                    <span className="text-[15px] uppercase tracking-[0.18em] text-muted-foreground">Rollback {event.rollback_status.replace(/_/g, " ")}</span>
                                </div>
                                <span className="text-[15px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span>
                            </div>
                                    <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{event.error_message || `Mutation strategy ${event.mutation_strategy.replace(/_/g, " ")} on ${event.content_field_mutated}.`}</p>
                                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                                        <DetailRow label="Block ID" value={payload?.blockId ?? null} />
                                        <DetailRow label="Field path" value={payload?.fieldPath ?? event.content_field_mutated} />
                                        <DetailRow label="Locale" value={payload?.locale ?? null} />
                                        <DetailRow label="Original value" value={payload?.originalValue ?? null} />
                                        <DetailRow label="Updated value" value={payload?.updatedValue ?? null} />
                                    </div>
                                    </>
                                );
                            })()}
                        </div>
                    ))}
                </div>
            </div>
                </div>
            </details>
        </div>
    );
}
