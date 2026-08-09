"use client";

import { Loader2 } from "lucide-react";
import { useTransition, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

type ButtonProps = ComponentProps<typeof Button>;

interface ActionButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
    children: ReactNode;
    onAction: () => void | Promise<void>;
    pendingLabel?: string;
    idleIcon?: ReactNode;
}

/**
 * Wraps an async click handler with a React transition so the button shows a
 * spinner and disables itself while the action is in flight. Use for any
 * non-form action that hits the database or an AI route.
 */
export function ActionButton({
    children,
    onAction,
    pendingLabel,
    idleIcon,
    disabled,
    className,
    ...rest
}: ActionButtonProps) {
    const [pending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            await onAction();
        });
    };

    return (
        <Button
            type="button"
            onClick={handleClick}
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
