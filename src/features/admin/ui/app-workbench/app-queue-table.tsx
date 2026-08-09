import React from "react";
import { cn } from "@/shared/lib/utils";

interface AppQueueTableProps {
    headers: React.ReactNode;
    children: React.ReactNode;
    mobileCards?: React.ReactNode;
    loading?: boolean;
    empty?: boolean;
    emptyText?: string;
    pagination?: React.ReactNode;
    className?: string;
}

export function AppQueueTable({
    headers,
    children,
    mobileCards,
    loading = false,
    empty = false,
    emptyText = "No records match the current filters.",
    pagination,
    className
}: AppQueueTableProps) {
    return (
        <div className={cn("flex flex-col flex-1 min-h-0 w-full bg-background", className)}>
            {mobileCards ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
                    {loading ? (
                        <div className="border-y border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
                            <span className="animate-pulse">Loading records...</span>
                        </div>
                    ) : empty ? (
                        <div className="border-y border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
                            {emptyText}
                        </div>
                    ) : (
                        <div className="space-y-2">{mobileCards}</div>
                    )}
                </div>
            ) : null}
            <div className={cn("min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]", mobileCards && "hidden md:block")}>
                <table className="min-w-[44rem] w-full text-left border-collapse text-[15px] select-text md:min-w-0">
                    <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-xs border-b border-border/50 text-muted-foreground font-semibold uppercase tracking-wider text-[12px]">
                        {headers}
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {loading ? (
                            <tr>
                                <td colSpan={100} className="px-6 py-12 text-center text-muted-foreground">
                                    <span className="animate-pulse">Loading records...</span>
                                </td>
                            </tr>
                        ) : empty ? (
                            <tr>
                                <td colSpan={100} className="px-6 py-12 text-center text-muted-foreground">
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            children
                        )}
                    </tbody>
                </table>
            </div>

            {pagination && (
                <div className="border-t border-border/50 bg-card/25 shrink-0">
                    {pagination}
                </div>
            )}
        </div>
    );
}
