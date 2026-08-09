"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { installWorkflowTemplatesStateAction } from "@/features/business-spine/actions";
import { Button } from "@/shared/ui/button";

const initialState = { ok: false, message: "" };

export function InstallWorkflowTemplatesForm() {
    const [state, formAction, isPending] = useActionState(installWorkflowTemplatesStateAction, initialState);
    const hasMessage = state.message.length > 0;

    return (
        <form action={formAction} className="flex flex-col items-end gap-2">
            <Button type="submit" size="sm" disabled={isPending} aria-busy={isPending} className="gap-1.5 cursor-pointer">
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isPending ? "Installing…" : "Install templates"}
            </Button>
            <p
                aria-live="polite"
                className={`max-w-[22rem] text-right text-[13px] font-medium ${hasMessage ? "" : "sr-only"} ${state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
            >
                {hasMessage ? (
                    <span className="inline-flex items-start justify-end gap-1.5">
                        {state.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                        <span>{state.message}</span>
                    </span>
                ) : (
                    "Install workflow templates status will appear here."
                )}
            </p>
        </form>
    );
}
