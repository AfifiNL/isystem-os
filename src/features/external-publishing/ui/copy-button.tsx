"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/shared/ui/button";

interface CopyButtonProps {
    value: string;
    label?: string;
    disabled?: boolean;
    className?: string;
}

export function CopyButton({ value, label = "Copy", disabled = false, className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const statusId = useId();

    useEffect(() => {
        if (!copied) return;
        const timeout = window.setTimeout(() => setCopied(false), 2200);
        return () => window.clearTimeout(timeout);
    }, [copied]);

    return (
        <>
            <Button
                type="button"
                size="sm"
                variant="outline"
                className={className}
                disabled={disabled || value.trim().length === 0}
                aria-describedby={statusId}
                onClick={async () => {
                    await navigator.clipboard.writeText(value);
                    setCopied(true);
                }}
            >
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : label}
            </Button>
            <span id={statusId} className="sr-only" aria-live="polite">
                {copied ? "Copied to clipboard." : ""}
            </span>
        </>
    );
}
