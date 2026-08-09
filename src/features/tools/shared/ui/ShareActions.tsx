"use client";

import { useState } from "react";
import { Printer, Link as LinkIcon } from "lucide-react";

export function ShareActions() {
    const [copied, setCopied] = useState(false);

    function handlePrint() {
        if (typeof window !== "undefined") window.print();
    }

    async function copy() {
        if (typeof window === "undefined") return;
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handlePrint}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white hover:border-cyan-400/40 hover:bg-white/10"
            >
                <Printer className="size-4" aria-hidden /> Download as PDF
            </button>
            <button
                type="button"
                onClick={copy}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-medium text-white hover:border-cyan-400/40 hover:bg-white/10"
            >
                <LinkIcon className="size-4" aria-hidden /> {copied ? "Copied" : "Copy link"}
            </button>
        </>
    );
}
