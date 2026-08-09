"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

interface PendingFormButtonProps extends Omit<ButtonProps, "children"> {
    children: ReactNode;
    pendingLabel?: string;
    idleIcon?: ReactNode;
}

/**
 * Drop-in replacement for a form submit Button. Uses useFormStatus to disable
 * itself and swap the icon/label to a spinner whenever the parent form is
 * submitting. Works for both server-action forms and async client handlers.
 */
export function PendingFormButton({
    children,
    pendingLabel,
    idleIcon,
    disabled,
    className,
    ...rest
}: PendingFormButtonProps) {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            disabled={disabled || pending}
            aria-busy={pending || undefined}
            className={cn(className)}
            {...rest}
        >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : idleIcon}
            <span>{pending ? pendingLabel ?? "Working…" : children}</span>
        </Button>
    );
}
