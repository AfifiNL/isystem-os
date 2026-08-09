"use client";

import React, { useRef } from "react";
import { usePathname } from "next/navigation";
import { useWindowManager } from "@/features/admin/ui/window-manager";
import { MDIWindowFrame } from "./mdi-window-frame";

interface MDIDesktopViewProps {
    isDesktopHome: boolean;
    children: React.ReactNode;
}

export function MDIDesktopView({ isDesktopHome, children }: MDIDesktopViewProps) {
    const { openWindows, activeWindowKey } = useWindowManager();
    const pathname = usePathname();
    const containerRef = useRef<HTMLDivElement>(null);

    // Get active key from current path (e.g., /dashboard/outreach -> outreach)
    const activeRouteKey = pathname.startsWith("/dashboard/")
        ? pathname.slice("/dashboard/".length).split("/")[0]
        : null;

    return (
        <div
            ref={containerRef}
            className="absolute bottom-2 left-[3.75rem] right-2 top-7 overflow-hidden"
        >
            {/* Desktop Home Layer (Icons/Grid) - Rendered natively when at /dashboard */}
            {isDesktopHome && (
                <div className="absolute inset-0 z-0 overflow-y-auto overflow-x-auto pb-4">
                    {children}
                </div>
            )}

            {/* MDI Windows Overlay */}
            {openWindows.map((win) => {
                const isActive = activeWindowKey === win.key;

                // Active route window gets native children component, others load via iframe
                const isCurrentRouteWindow = win.key === activeRouteKey;

                return (
                    <MDIWindowFrame
                        key={win.key}
                        windowInstance={win}
                        isActive={isActive}
                        containerRef={containerRef}
                    >
                        {isCurrentRouteWindow ? children : null}
                    </MDIWindowFrame>
                );
            })}
        </div>
    );
}
