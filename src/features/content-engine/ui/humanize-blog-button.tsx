"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, ShieldCheck, X } from "lucide-react";
import type { FingerprintHit } from "@/shared/lib/ai/ai-detection-rewrite";
import { Button } from "@/shared/ui/button";

interface HumanizePreview {
    contentId: string;
    fingerprints: FingerprintHit[];
    originalLength: number;
    revisedLength: number;
    revisedMarkdown: string;
    applied: boolean;
}

interface HumanizeBlogButtonProps {
    contentId: string;
    onApplied?: () => void;
}

/**
 * Manual on-demand "humanize against AI detectors" pass. Distinct from the
 * SEO enhance button (which improves search ranking) — this layer focuses
 * purely on prose rhythm and AI-fingerprint removal.
 *
 * UX is a two-step preview→apply rather than one-click apply, because the
 * rewrite touches every paragraph and operators want to glance at the diff
 * before committing.
 */
export function HumanizeBlogButton({ contentId, onApplied }: HumanizeBlogButtonProps) {
    const [isAnalyzing, startAnalyzing] = useTransition();
    const [isApplying, startApplying] = useTransition();
    const [preview, setPreview] = useState<HumanizePreview | null>(null);
    const [error, setError] = useState<string | null>(null);

    function handleAnalyze() {
        setError(null);
        startAnalyzing(async () => {
            try {
                const res = await fetch(`/api/humanize-blog/${contentId}`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error ?? "Humanize preview failed.");
                    return;
                }
                setPreview(data as HumanizePreview);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Network error.");
            }
        });
    }

    function handleApply() {
        if (!preview) return;
        setError(null);
        startApplying(async () => {
            try {
                const res = await fetch(`/api/humanize-blog/${contentId}?apply=true`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error ?? "Apply failed.");
                    return;
                }
                setPreview(null);
                onApplied?.();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Network error.");
            }
        });
    }

    return (
        <>
            <div className="inline-flex flex-col items-start gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || isApplying}
                    title="Detect AI writing tells in this post and rewrite to reduce them"
                >
                    {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldCheck className="h-4 w-4" />
                    )}
                    {isAnalyzing ? "Scanning…" : "Humanize"}
                </Button>
                {error ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-destructive max-w-sm">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        {error}
                    </span>
                ) : null}
            </div>

            {preview ? (
                <HumanizePreviewModal
                    preview={preview}
                    isApplying={isApplying}
                    onApply={handleApply}
                    onClose={() => setPreview(null)}
                />
            ) : null}
        </>
    );
}

interface HumanizePreviewModalProps {
    preview: HumanizePreview;
    isApplying: boolean;
    onApply: () => void;
    onClose: () => void;
}

function HumanizePreviewModal({ preview, isApplying, onApply, onClose }: HumanizePreviewModalProps) {
    const lengthDelta = preview.revisedLength - preview.originalLength;
    const lengthPercent = preview.originalLength > 0
        ? Math.round((preview.revisedLength / preview.originalLength) * 100)
        : 100;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="humanize-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
                    <div>
                        <h2 id="humanize-modal-title" className="text-lg font-semibold text-foreground">
                            Humanize against AI detectors
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Static scan found <span className="font-semibold text-foreground">{preview.fingerprints.length}</span> fingerprint{preview.fingerprints.length === 1 ? "" : "s"} in the current draft. The rewrite below targets every one of them while preserving headings, links, lists, shortcodes, and facts.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-5">
                    {preview.fingerprints.length > 0 ? (
                        <section className="mb-6">
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Fingerprints addressed
                            </h3>
                            <ul className="grid gap-2">
                                {preview.fingerprints.map((hit) => (
                                    <li
                                        key={hit.id}
                                        className="rounded-xl border border-border/60 bg-muted/30 p-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-foreground">{hit.label}</p>
                                            <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                {hit.count} {hit.count === 1 ? "hit" : "hits"}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">{hit.rationale}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : (
                        <p className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                            No specific AI-detection fingerprints were flagged by the static scan. The rewrite below applied a general voice-variance pass anyway — apply or close.
                        </p>
                    )}

                    <section className="mb-2">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Length change
                        </h3>
                        <p className="text-sm text-foreground">
                            {preview.originalLength.toLocaleString()} → {preview.revisedLength.toLocaleString()} characters
                            <span className="ml-2 text-xs text-muted-foreground">
                                ({lengthPercent}% of original, {lengthDelta >= 0 ? "+" : ""}{lengthDelta.toLocaleString()})
                            </span>
                        </p>
                    </section>

                    <section>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Revised draft (preview)
                        </h3>
                        <pre className="max-h-[40vh] overflow-auto rounded-xl border border-border/60 bg-muted/40 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-mono">
                            {preview.revisedMarkdown}
                        </pre>
                    </section>
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isApplying}
                        className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={isApplying}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/60 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                        {isApplying ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Applying…
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" />
                                Apply rewrite
                            </>
                        )}
                    </button>
                </footer>
            </div>
        </div>
    );
}
