import React from "react";
import { cn } from "@/shared/lib/utils";

interface AppSplitPaneProps {
    main: React.ReactNode;
    inspector?: React.ReactNode;
    showInspector?: boolean;
    inspectorLabel?: string;
    className?: string;
}

export function AppSplitPane({
    main,
    inspector,
    showInspector = true,
    inspectorLabel = "Inspector",
    className
}: AppSplitPaneProps) {
    return (
        <div className={cn("flex-1 flex flex-col lg:flex-row min-h-0 w-full overflow-hidden", className)}>
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto">
                {main}
            </div>

            {/* Right Inspector Panel */}
            {inspector && showInspector && (
                <div
                    className="flex max-h-[55svh] min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-border/60 bg-card/45 lg:max-h-none lg:w-96 lg:border-l lg:border-t-0"
                    aria-label={inspectorLabel}
                >
                    <div className="sticky top-0 z-10 border-b border-border/50 bg-card/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur lg:hidden">
                        {inspectorLabel}
                    </div>
                    {inspector}
                </div>
            )}
        </div>
    );
}
