"use client";

import type { ReactNode } from "react";
import { DashboardMobileEditorNotice } from "@/features/admin/ui/responsive-dashboard";

interface PuckEditorShellProps {
    editor: ReactNode;
    saveState?: ReactNode;
}

export function PuckEditorShell({ editor, saveState }: PuckEditorShellProps) {
    return (
        <div className="flex h-[calc(100dvh-8rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:h-[calc(100vh-4rem)]">
            <DashboardMobileEditorNotice className="m-3 md:hidden">
                The visual builder uses a wide drag-and-drop canvas. On phones it stays fully accessible inside a contained horizontal workspace; use landscape or a desktop viewport for precise block editing.
            </DashboardMobileEditorNotice>
            {saveState ? (
                <div className="shrink-0 border-b border-border/60 bg-card px-4 py-2">
                    {saveState}
                </div>
            ) : null}
            <div className="puck-themed flex-1 overflow-auto bg-background overscroll-contain">
                <div className="dashboard-wide-workspace min-h-full md:min-w-0">
                    {editor}
                </div>
            </div>
        </div>
    );
}
