"use client";

import { useState } from "react";
import { Check, Printer, Share2 } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface BlogPostActionsProps {
    title: string;
}

export function BlogPostActions({ title }: BlogPostActionsProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        const shareUrl = window.location.href;

        try {
            if (navigator.share) {
                await navigator.share({
                    title,
                    url: shareUrl,
                });
                return;
            }

            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("[blog-post-actions] Share failed:", error);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleShare}>
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="hidden h-8 w-8 text-muted-foreground sm:inline-flex" onClick={handlePrint}>
                <Printer className="h-4 w-4" />
            </Button>
        </div>
    );
}
