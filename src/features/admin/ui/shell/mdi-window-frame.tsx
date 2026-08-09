"use client";

import React, { useRef, useEffect } from "react";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import { Minus, Square, Copy, X } from "lucide-react";
import { useWindowManager, type WindowInstance } from "@/features/admin/ui/window-manager";
import { AppIcon } from "@/features/admin/ui/app-icon";
import { WINDOW_META } from "@/features/admin/lib/window-meta";
import { DashboardRouteThread, resolveDashboardRouteFamily } from "@/features/admin/ui/app-workbench";

interface MDIWindowFrameProps {
    windowInstance: WindowInstance;
    isActive: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    children?: React.ReactNode;
}

export function MDIWindowFrame({ windowInstance, isActive, containerRef, children }: MDIWindowFrameProps) {
    const {
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        focusWindow,
        updateWindowPosition,
        updateWindowSize
    } = useWindowManager();

    const winRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();

    const { key, title, x, y, width, height, isMinimized, isMaximized, zIndex } = windowInstance;
    const meta = WINDOW_META[key];

    // Use motion values bound to transforms for smooth coordinate dragging without layout shifting
    const dragX = useMotionValue(x);
    const dragY = useMotionValue(y);

    // Sync motion values when coordinate props change
    useEffect(() => {
        dragX.set(x);
    }, [x, dragX]);

    useEffect(() => {
        dragY.set(y);
    }, [y, dragY]);

    if (isMinimized) return null;

    // Handle drag end to persist position
    const handleDragEnd = () => {
        updateWindowPosition(key, dragX.get(), dragY.get());
    };

    // Header double click toggles maximize
    const handleHeaderDoubleClick = (e: React.MouseEvent) => {
        // Only trigger on header container clicks, not on buttons
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("a")) return;
        maximizeWindow(key);
    };

    // Custom pointer-based resizer logic for bottom-right corner
    const handleResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        focusWindow(key);

        const startWidth = width;
        const startHeight = height;
        const startX = e.clientX;
        const startY = e.clientY;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            const newWidth = Math.max(400, startWidth + deltaX);
            const newHeight = Math.max(300, startHeight + deltaY);
            updateWindowSize(key, newWidth, newHeight);
        };

        const handlePointerUp = () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
        };

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
    };

    const windowStyle: React.CSSProperties = isMaximized
        ? {
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              zIndex,
          }
        : {
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              zIndex,
          };

    return (
        <motion.div
            ref={winRef}
            style={{
                ...windowStyle,
                x: isMaximized ? 0 : dragX,
                y: isMaximized ? 0 : dragY,
            }}
            drag={!isMaximized}
            dragConstraints={containerRef}
            dragElastic={0}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            onPointerDown={() => focusWindow(key)}
            className={`flex flex-col overflow-hidden rounded-lg border bg-background shadow-[0_16px_50px_rgba(0,0,0,0.32)] ${
                isActive
                    ? "border-cyan-500/40 shadow-cyan-950/10"
                    : "border-border/60 shadow-black/30"
            }`}
            data-dashboard-window={key}
            data-dashboard-route-key={key}
            data-dashboard-route-family={resolveDashboardRouteFamily(`/dashboard/${key}`)}
        >
            {/* Header bar */}
            <header
                onPointerDown={(e) => {
                    // Only start drag if clicking directly on the header background/title
                    const target = e.target as HTMLElement;
                    if (!target.closest("button") && !target.closest("a")) {
                        dragControls.start(e);
                        focusWindow(key);
                    }
                }}
                onDoubleClick={handleHeaderDoubleClick}
                className={`flex h-7 flex-none items-center justify-between gap-2 border-b border-border/55 px-2 select-none ${
                    isActive ? "bg-slate-900/32" : "bg-slate-950/16"
                }`}
            >
                <div className="flex shrink-0 items-center gap-2">
                    <AppIcon moduleKey={key} iconComponent={meta?.icon} size="sm" className="!h-5 !w-5 !rounded shadow-none [&_svg]:!h-3 [&_svg]:!w-3" />
                    <span className="text-[10px] font-medium tracking-wide text-foreground">
                        {title}
                    </span>
                </div>

                {/* Window Actions */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Minimize */}
                    <button
                        type="button"
                        onClick={() => minimizeWindow(key)}
                        title="Minimize"
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </button>

                    {/* Maximize / Restore */}
                    <button
                        type="button"
                        onClick={() => maximizeWindow(key)}
                        title={isMaximized ? "Restore" : "Maximize"}
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isMaximized ? (
                            <Copy className="h-3 w-3" />
                        ) : (
                            <Square className="h-3 w-3" />
                        )}
                    </button>

                    {/* Close */}
                    <button
                        type="button"
                        onClick={() => closeWindow(key)}
                        title="Close"
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </header>

            <DashboardRouteThread routeKey={key} />

            {/* Inner Content Area */}
            <div
                className="dashboard-app-surface dashboard-workbench dashboard-cardless flex-1 min-h-0 w-full relative bg-slate-950/20"
                data-dashboard-route-key={key}
                data-dashboard-route-family={resolveDashboardRouteFamily(`/dashboard/${key}`)}
            >
                {children ? (
                    // Native page children (for the active route window)
                    <div className="absolute inset-0 overflow-y-auto overflow-x-auto pb-4">
                        {children}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => focusWindow(key)}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40"
                    >
                        <AppIcon moduleKey={key} iconComponent={meta?.icon} size="lg" />
                        <span className="font-medium text-foreground">{title}</span>
                        <span>Focus this window to load the live app surface.</span>
                    </button>
                )}
            </div>

            {/* Bottom-right resize handle (disabled when maximized) */}
            {!isMaximized && (
                <div
                    onPointerDown={handleResizeStart}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize flex items-end justify-end p-0.5 z-50 group"
                    title="Resize Window"
                >
                    <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        className="text-muted-foreground/40 group-hover:text-cyan-400 transition-colors"
                    >
                        <path
                            d="M6 0 L8 0 L8 8 L0 8 L0 6 L4 6 L4 4 L6 4 Z"
                            fill="currentColor"
                            opacity="0.6"
                        />
                    </svg>
                </div>
            )}
        </motion.div>
    );
}
