"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import { resolveDashboardRouteFamily } from "./app-route-thread";

interface DashboardAppWorkbenchProps {
    children: React.ReactNode;
    className?: string;
}

export function DashboardAppWorkbench({ children, className }: DashboardAppWorkbenchProps) {
    const pathname = usePathname();
    const routeKey = pathname.startsWith("/dashboard/")
        ? pathname.slice("/dashboard/".length).split("/")[0] ?? "dashboard"
        : "dashboard";

    return (
        <div
            data-dashboard-workbench="focus-rail"
            data-dashboard-route-key={routeKey}
            data-dashboard-route-family={resolveDashboardRouteFamily(pathname)}
            className={cn(
                "dashboard-workbench dashboard-cardless flex min-h-full w-full min-w-0 flex-col bg-background text-foreground md:h-full md:min-h-0 md:overflow-hidden",
                className
            )}
        >
            {children}
        </div>
    );
}
