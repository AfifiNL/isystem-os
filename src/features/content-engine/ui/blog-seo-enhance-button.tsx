"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkles, Loader2, AlertCircle, Check, ArrowRight } from "lucide-react";
import { previewBlogPostSeoEnhancement } from "@/features/seo/actions";
import type { BlogEnhancementPreview } from "@/features/seo/types";
import { AiBalanceIndicator } from "@/features/admin/ui/ai-balance-indicator";
import { BlogSeoEnhanceModal } from "./blog-seo-enhance-modal";
import { Button } from "@/shared/ui/button";

interface BlogSeoEnhanceButtonProps {
    contentId: string;
    onEnhancementApplied?: (appliedCount: number) => void;
}

/**
 * Icon button that triggers a full-blog SEO enhancement preview. Shows a
 * review modal once the preview lands; the modal handles accept/apply.
 *
 * When the page is opened with `?enhance=1` (e.g. from the Opportunity
 * Engine "Open in editor" deep link), the preview auto-triggers on mount so
 * the reviewer lands directly in the modal. The flag is consumed only once.
 */
export function BlogSeoEnhanceButton({ contentId, onEnhancementApplied }: BlogSeoEnhanceButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [preview, setPreview] = useState<BlogEnhancementPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastAppliedCount, setLastAppliedCount] = useState<number | null>(null);
    const searchParams = useSearchParams();
    const autoTriggeredRef = useRef(false);

    const handleClick = () => {
        setError(null);
        startTransition(async () => {
            const result = await previewBlogPostSeoEnhancement(contentId);
            if (result.error || !result.data) {
                setError(result.error ?? "Failed to generate SEO enhancement preview.");
                return;
            }
            setPreview(result.data);
        });
    };

    useEffect(() => {
        if (autoTriggeredRef.current) return;
        if (searchParams?.get("enhance") !== "1") return;
        autoTriggeredRef.current = true;
        handleClick();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const handleClose = () => setPreview(null);
    const handleApplied = (appliedCount: number) => {
        setPreview(null);
        setLastAppliedCount(appliedCount);
        onEnhancementApplied?.(appliedCount);
    };
    const dismissAppliedBanner = () => setLastAppliedCount(null);

    return (
        <>
            <div className="inline-flex flex-col items-start gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClick}
                    disabled={isPending}
                    title="Run automated SEO enhancement on this post"
                >
                    {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="h-4 w-4" />
                    )}
                    {isPending ? "Analyzing…" : "SEO enhance"}
                </Button>
                <AiBalanceIndicator compact />
                {error ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-destructive max-w-sm">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />
                        {error}
                    </span>
                ) : null}
            </div>

            {preview ? (
                <BlogSeoEnhanceModal
                    preview={preview}
                    onClose={handleClose}
                    onApplied={handleApplied}
                />
            ) : null}

            {lastAppliedCount !== null ? (
                <div
                    role="status"
                    className="mt-3 inline-flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300"
                >
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                        <Check className="h-3.5 w-3.5" />
                        {lastAppliedCount} SEO enhancement{lastAppliedCount === 1 ? "" : "s"} applied.
                    </span>
                    <span className="text-emerald-700/80 dark:text-emerald-300/80">Next step:</span>
                    <Link
                        href="/dashboard/seo"
                        className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                    >
                        Open SEO Control Center
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                    <button
                        type="button"
                        onClick={dismissAppliedBanner}
                        className="ml-auto text-[11px] uppercase tracking-wider text-emerald-700/70 hover:text-emerald-700 dark:text-emerald-300/70 dark:hover:text-emerald-300"
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}
        </>
    );
}
