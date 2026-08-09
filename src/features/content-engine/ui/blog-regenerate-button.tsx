"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { AiBalanceIndicator } from "@/features/admin/ui/ai-balance-indicator";
import {
    previewBlogPostRegeneration,
    type BlogRegenerationPreview,
} from "@/features/seo/blog-regeneration-actions";
import { BlogRegenerationModal } from "@/features/content-engine/ui/blog-regeneration-modal";

interface BlogRegenerateButtonProps {
    contentId: string;
    onApplied?: () => void;
}

export function BlogRegenerateButton({ contentId, onApplied }: BlogRegenerateButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [preview, setPreview] = useState<BlogRegenerationPreview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [applied, setApplied] = useState(false);

    const handleClick = () => {
        setError(null);
        setApplied(false);
        startTransition(async () => {
            const result = await previewBlogPostRegeneration(contentId);
            if (result.error || !result.data) {
                setError(result.error ?? "Failed to regenerate this post.");
                return;
            }
            setPreview(result.data);
        });
    };

    return (
        <>
            <div className="inline-flex flex-col items-start gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClick}
                    disabled={isPending}
                    title="Regenerate this published blog post with Search Console signals"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isPending ? "Regenerating..." : "Regenerate"}
                </Button>
                <AiBalanceIndicator compact />
                {error ? (
                    <span className="inline-flex max-w-sm items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {error}
                    </span>
                ) : null}
                {applied ? (
                    <span className="inline-flex max-w-sm items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <Check className="h-3 w-3 shrink-0" />
                        Regenerated post applied.
                    </span>
                ) : null}
            </div>
            {preview ? (
                <BlogRegenerationModal
                    preview={preview}
                    onClose={() => setPreview(null)}
                    onApplied={() => {
                        setPreview(null);
                        setApplied(true);
                        onApplied?.();
                    }}
                />
            ) : null}
        </>
    );
}
