import React from "react";
import { cn } from "@/shared/lib/utils";

interface AppSectionHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function AppSectionHeader({
    title,
    description,
    actions,
    className
}: AppSectionHeaderProps) {
    return (
        <div
            className={cn(
                "mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-1.5 select-none",
                className
            )}
        >
            <div className="flex flex-col">
                <h3 className="text-[14px] font-semibold leading-tight text-foreground">
                    {title}
                </h3>
                {description && (
                    <p className="mt-0.5 max-w-xl text-[12px] leading-normal text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-1.5 shrink-0">
                    {actions}
                </div>
            )}
        </div>
    );
}
