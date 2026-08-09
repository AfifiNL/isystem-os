import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export const dashboardAppSurfaceClass =
    "dashboard-app-surface dashboard-workbench dashboard-cardless min-w-0 w-full overflow-x-hidden overscroll-contain";

export function DashboardMobileEditorNotice({
    title = "Desktop workspace recommended",
    children,
    className,
}: {
    title?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "border-y border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100",
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0 space-y-1">
                    <p className="font-semibold">{title}</p>
                    <div className="text-xs leading-6 text-amber-900/80 dark:text-amber-100/80">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
