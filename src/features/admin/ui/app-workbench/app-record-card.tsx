import React from "react";
import { cn } from "@/shared/lib/utils";

interface AppRecordCardProps {
    children: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
    className?: string;
}

export function AppRecordCard({
    children,
    onClick,
    active = false,
    className
}: AppRecordCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "border-b border-border/50 px-2.5 py-2 text-[14px] transition-colors select-none",
                onClick ? "cursor-pointer" : "",
                active
                    ? "border-cyan-500/40 bg-cyan-500/5 dark:bg-cyan-950/10"
                    : "bg-transparent hover:bg-muted/20",
                className
            )}
        >
            {children}
        </div>
    );
}
