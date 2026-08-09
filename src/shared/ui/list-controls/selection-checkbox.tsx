"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface SelectionCheckboxProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label: string;
    indeterminate?: boolean;
    disabled?: boolean;
    title?: string;
    size?: "sm" | "md";
    className?: string;
}

/**
 * A stable, explicitly-rendered checkbox for selectable dashboard lists.
 *
 * Native checkbox appearance varied across the desktop window surface and a
 * changing surrounding label made browser automation lose the control during
 * state transitions. This button keeps a stable accessible name while making
 * checked, mixed, disabled, hover, and focus states visible in every theme.
 */
export function SelectionCheckbox({
    checked,
    onCheckedChange,
    label,
    indeterminate = false,
    disabled = false,
    title,
    size = "md",
    className,
}: SelectionCheckboxProps) {
    const ariaChecked: boolean | "mixed" = indeterminate ? "mixed" : checked;
    const compact = size === "sm";

    return (
        <button
            type="button"
            role="checkbox"
            aria-label={label}
            aria-checked={ariaChecked}
            data-state={ariaChecked === "mixed" ? "indeterminate" : checked ? "checked" : "unchecked"}
            disabled={disabled}
            title={title}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-md outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "disabled:cursor-not-allowed disabled:opacity-40",
                compact ? "size-6" : "size-7",
                className,
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "inline-flex items-center justify-center rounded border shadow-xs transition-colors",
                    compact ? "size-3.5" : "size-4",
                    ariaChecked === true || ariaChecked === "mixed"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-transparent hover:border-primary/60",
                )}
            >
                {ariaChecked === "mixed" ? (
                    <Minus className={compact ? "size-2.5" : "size-3"} strokeWidth={3} />
                ) : (
                    <Check className={compact ? "size-2.5" : "size-3"} strokeWidth={3} />
                )}
            </span>
        </button>
    );
}
