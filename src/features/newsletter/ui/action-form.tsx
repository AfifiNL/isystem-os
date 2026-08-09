"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { NewsletterActionResult } from "@/features/newsletter/actions";
import { cn } from "@/shared/lib/utils";

type ActionFn = (
    prev: NewsletterActionResult | null,
    formData: FormData,
) => Promise<NewsletterActionResult>;

interface NewsletterActionFormProps {
    action: ActionFn;
    className?: string;
    children: ReactNode;
    pendingLabel?: string;
}

export function NewsletterActionForm({ action, className, children, pendingLabel = "Working…" }: NewsletterActionFormProps) {
    const [state, formAction, pending] = useActionState<NewsletterActionResult | null, FormData>(action, null);

    return (
        <form action={formAction} className={cn("relative", className)} aria-busy={pending}>
            <fieldset
                disabled={pending}
                className={cn(
                    "contents transition-opacity",
                    pending && "[&_button[type=submit]]:opacity-70 [&_button[type=submit]]:cursor-wait",
                )}
            >
                {children}
            </fieldset>
            {pending ? (
                <span
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-primary shadow-sm backdrop-blur"
                >
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>{pendingLabel}</span>
                </span>
            ) : null}
            {state?.error ? (
                <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                    {state.error}
                </p>
            ) : null}
        </form>
    );
}
