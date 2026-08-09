"use client";

import React from "react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import type { WindowMeta } from "@/features/admin/lib/window-meta";
import { MenuBar } from "@/features/admin/ui/shell/menu-bar";
import { Dock } from "@/features/admin/ui/shell/dock";

interface TaskbarProps {
    state: AdminDashboardState;
    activeWindow: WindowMeta | null;
}

export function Taskbar({ state, activeWindow }: TaskbarProps) {
    return (
        <>
            <MenuBar state={state} activeWindow={activeWindow} />
            <Dock state={state} activeWindow={activeWindow} />
        </>
    );
}
