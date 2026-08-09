"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import { markCoachMarkSeen } from "@/features/admin/actions/onboarding";

interface CoachMarkProps {
    workspaceId: string;
    coachMarkKey: string;
    title: string;
    body: string;
}

// Lightweight, non-blocking tooltip shown the first time a user opens an
// app window after onboarding (or for users who skipped onboarding). Once
// dismissed, the per-key flag is persisted to onboarding_state.coachMarksSeen
// so it never reappears for that user/workspace pair.
export function CoachMark({ workspaceId, coachMarkKey, title, body }: CoachMarkProps) {
    const [visible, setVisible] = useState(true);
    const [isPending, startTransition] = useTransition();

    const dismiss = () => {
        if (!visible) return;
        setVisible(false);
        startTransition(async () => {
            await markCoachMarkSeen(workspaceId, coachMarkKey);
        });
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            // Auto-dismiss after 12 seconds so a user who walks away
            // doesn't see a stale tooltip on return. The seen flag is
            // still recorded so it doesn't reappear.
            dismiss();
        }, 12000);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!visible) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute right-4 top-16 z-20 max-w-sm"
        >
            <div className="pointer-events-auto rounded-xl border border-cyan-400/30 bg-slate-950/90 px-4 py-3 text-slate-100 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-cyan-400/30 bg-cyan-500/15 text-cyan-200">
                        <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
                            Tip
                        </p>
                        <h3 className="mt-0.5 text-sm font-semibold text-slate-50">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">{body}</p>
                    </div>
                    <button
                        type="button"
                        onClick={dismiss}
                        disabled={isPending}
                        aria-label="Dismiss tip"
                        className="rounded-md p-1 text-slate-400 transition-colors hover:text-white disabled:opacity-50"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
