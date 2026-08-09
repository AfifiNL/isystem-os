"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, Monitor } from "lucide-react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import type { WindowMeta } from "@/features/admin/lib/window-meta";
import {
    buildDashboardAppGroups,
    type DashboardAppGroup,
} from "@/features/admin/lib/dashboard-launcher";
import { StartMenu } from "@/features/admin/ui/shell/start-menu";
import { AppGroupPanel } from "@/features/admin/ui/shell/app-group-panel";

interface DockProps {
    state: AdminDashboardState;
    activeWindow: WindowMeta | null;
}

export function Dock({ state }: DockProps) {
    const pathname = usePathname();
    const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
    const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
    const startMenuRef = useRef<HTMLDivElement>(null);
    const groupMenuRef = useRef<HTMLDivElement>(null);
    const groups = useMemo(() => buildDashboardAppGroups(state.modules), [state.modules]);
    const activeRouteKey = pathname.startsWith("/dashboard/")
        ? pathname.slice("/dashboard/".length).split("/")[0]
        : null;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const node = event.target as Node;
            if (startMenuRef.current && !startMenuRef.current.contains(node)) {
                setIsStartMenuOpen(false);
            }
            if (groupMenuRef.current && !groupMenuRef.current.contains(node)) {
                setOpenGroupKey(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const openGroup = groups.find((group) => group.key === openGroupKey) ?? null;

    return (
        <nav aria-label="Dashboard focus rail" className="fixed bottom-2 left-2 top-9 z-40 flex w-12 flex-col items-center pointer-events-none">
            <div className="relative flex min-h-0 w-full flex-1 flex-col items-center pointer-events-auto">
                {isStartMenuOpen && (
                    <div ref={startMenuRef} className="absolute left-14 top-0 z-50">
                        <StartMenu
                            state={state}
                            onClose={() => setIsStartMenuOpen(false)}
                        />
                    </div>
                )}

                {openGroup ? (
                    <div ref={groupMenuRef} className="absolute left-14 top-0 z-50">
                        <AppGroupPanel
                            group={openGroup}
                            onClose={() => setOpenGroupKey(null)}
                            onNavigate={() => setOpenGroupKey(null)}
                        />
                    </div>
                ) : null}

                <div
                    className="flex min-h-0 w-12 flex-1 flex-col items-center gap-1 overflow-x-hidden overflow-y-auto rounded-xl border border-white/10 bg-slate-950/72 px-1.5 py-1.5 shadow-[0_16px_42px_rgba(0,0,0,0.38)] backdrop-blur-2xl [scrollbar-width:none]"
                >
                    <div className="relative flex-shrink-0">
                        <motion.button
                            type="button"
                            onClick={() => {
                                setIsStartMenuOpen((open) => !open);
                                setOpenGroupKey(null);
                            }}
                            whileHover={{ x: 2 }}
                            transition={{ duration: 0.15 }}
                            title="Launchpad"
                            aria-label="Open Start menu"
                            aria-expanded={isStartMenuOpen}
                            className={`flex h-9 w-9 cursor-pointer select-none items-center justify-center rounded-lg border transition-colors ${
                                isStartMenuOpen
                                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                                    : "border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                            }`}
                        >
                            <LayoutGrid className="h-4.5 w-4.5" />
                        </motion.button>
                        {isStartMenuOpen && <DockDot />}
                    </div>

                    <Link href="/dashboard" passHref legacyBehavior>
                        <motion.a
                            whileHover={{ x: 2 }}
                            transition={{ duration: 0.15 }}
                            title="Desktop"
                            className="flex h-9 w-9 flex-shrink-0 select-none items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                            onClick={() => setOpenGroupKey(null)}
                        >
                            <Monitor className="h-4.5 w-4.5" />
                        </motion.a>
                    </Link>

                    <div className="my-0.5 h-px w-7 flex-shrink-0 bg-white/10" aria-hidden="true" />

                    <div className="flex flex-col items-center gap-1">
                        {groups.map((group) => (
                            <DockGroupButton
                                key={group.key}
                                group={group}
                                isOpen={openGroupKey === group.key}
                                isActive={group.apps.some((app) => app.routeKey === activeRouteKey)}
                                onClick={() => {
                                    setIsStartMenuOpen(false);
                                    setOpenGroupKey(openGroupKey === group.key ? null : group.key);
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}

function DockGroupButton({
    group,
    isOpen,
    isActive,
    onClick,
}: {
    group: DashboardAppGroup;
    isOpen: boolean;
    isActive: boolean;
    onClick: () => void;
}) {
    const Icon = group.icon;
    return (
        <div className="relative flex-shrink-0">
            <motion.button
                type="button"
                onClick={onClick}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
                title={group.title}
                aria-label={`Open ${group.title}`}
                aria-expanded={isOpen}
                className="block select-none"
            >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    isOpen || isActive
                        ? "border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
                        : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-100"
                }`}>
                    <Icon className="h-4 w-4" />
                </span>
            </motion.button>
            {(isOpen || isActive) && <DockDot />}
        </div>
    );
}

function DockDot() {
    return (
        <span className="absolute -right-1 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.75)]" />
    );
}
