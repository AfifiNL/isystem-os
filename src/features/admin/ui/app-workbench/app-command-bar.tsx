import React from "react";
import { cn } from "@/shared/lib/utils";

interface AppCommandBarProps {
    children?: React.ReactNode;
    leading?: React.ReactNode;
    /** Opt into a page identity only for a genuinely standalone surface. */
    showLeading?: boolean;
    tabs?: React.ReactNode;
    filters?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}

export function AppCommandBar({
    children,
    leading,
    showLeading = false,
    tabs,
    filters,
    actions,
    className
}: AppCommandBarProps) {
    if ((showLeading && leading) || tabs || filters || actions) {
        return (
            <div
                data-dashboard-command-bar="true"
                data-dashboard-command-rail="true"
                className={cn(
                    "app-command-bar sticky top-0 z-20 flex shrink-0 flex-col gap-1.5 border-b border-border/55 bg-background/92 px-2.5 py-1.5 pl-3 backdrop-blur-xl select-none sm:px-3 lg:min-h-10 lg:flex-row lg:items-center lg:justify-between lg:gap-2",
                    className
                )}
            >
                {(tabs || (leading && showLeading)) ? (
                    <div className="flex min-w-0 flex-col gap-2 lg:flex-1 lg:flex-row lg:items-center">
                        {leading && showLeading ? (
                            <div className="min-w-0">
                                {leading}
                            </div>
                        ) : null}
                        {tabs ? (
                            <div className="min-w-0 lg:flex-1">
                                {tabs}
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {(filters || actions) ? (
                    <div className="grid min-w-0 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                        {filters ? <div className="min-w-0">{filters}</div> : null}
                        {actions ? <div className="grid min-w-0 gap-2 sm:flex sm:items-center">{actions}</div> : null}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div
            data-dashboard-command-bar="true"
            data-dashboard-command-rail="true"
            className={cn(
                "app-command-bar sticky top-0 z-20 flex min-h-10 shrink-0 flex-col items-stretch gap-1.5 border-b border-border/55 bg-background/92 px-2.5 py-1.5 pl-3 backdrop-blur-xl select-none sm:px-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-2",
                className
            )}
        >
            {children}
        </div>
    );
}
