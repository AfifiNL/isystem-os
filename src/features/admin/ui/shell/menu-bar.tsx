"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Globe, LogOut, User, Zap, Terminal } from "lucide-react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import type { WindowMeta } from "@/features/admin/lib/window-meta";
import { logout } from "@/features/auth/actions";
import { setActiveWorkspace } from "@/features/admin/actions/workspaces";
import { setLocale } from "@/features/templates/actions";
import { AiBalanceIndicator } from "@/features/admin/ui/ai-balance-indicator";

interface MenuBarProps {
    state: AdminDashboardState;
    activeWindow: WindowMeta | null;
}

export function MenuBar({ state, activeWindow }: MenuBarProps) {
    const router = useRouter();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
    const [isSwitching, startSwitch] = useTransition();

    // Client-side ticking clock string
    const [timeString, setTimeString] = useState<string>("");

    const menuRef = useRef<HTMLDivElement>(null);
    const workspaceMenuRef = useRef<HTMLDivElement>(null);

    const currentLocale = state.locale;

    useEffect(() => {
        // Ticking clock
        const updateClock = () => {
            const now = new Date();
            setTimeString(
                now.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                })
            );
        };
        updateClock();
        const interval = setInterval(updateClock, 10000); // Update every 10 seconds is plenty for HH:MM
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const node = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(node)) setIsUserMenuOpen(false);
            if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(node)) setIsWorkspaceMenuOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSwitchWorkspace = (workspaceId: string) => {
        if (workspaceId === state.workspace.id) {
            setIsWorkspaceMenuOpen(false);
            return;
        }
        startSwitch(async () => {
            await setActiveWorkspace(workspaceId);
            setIsWorkspaceMenuOpen(false);
            router.refresh();
        });
    };

    const handleSwitchLocale = (next: "en" | "nl") => {
        if (next === currentLocale) {
            setIsUserMenuOpen(false);
            return;
        }
        startSwitch(async () => {
            await setLocale(next);
            setIsUserMenuOpen(false);
            router.refresh();
        });
    };

    const hasMultipleWorkspaces = state.accessibleWorkspaces.length > 1;
    const activeAppName = activeWindow ? activeWindow.title : "Desktop";

    return (
        <header
            role="banner"
            aria-label={`Workspace · ${activeAppName}`}
            className="fixed inset-x-0 top-0 z-50 flex h-7 items-center justify-between border-b border-white/10 bg-slate-950/82 px-2.5 text-[10px] font-medium text-slate-200 backdrop-blur-xl select-none"
        >
            {/* Left Side: System/App name + Static menus */}
            <div className="flex min-w-0 items-center gap-3">
                {/* System Logo Icon / Monogram */}
                <Link
                    href="/dashboard"
                    title="Go to desktop"
                    className="flex items-center gap-1.5 font-bold tracking-wider text-slate-100 hover:text-white transition-colors"
                >
                    <Terminal className="h-4 w-4 text-cyan-400" />
                    <span>Workspace</span>
                </Link>

                <span className="text-slate-600 font-normal">/</span>
                <span className="truncate text-slate-400">Systems workspace</span>
            </div>

            {/* Right Side: AI credits, Switchers, Profile, Clock */}
            <div className="flex items-center gap-2.5">
                {/* AI Balance Indicator */}
                <div className="scale-90">
                    <AiBalanceIndicator />
                </div>

                {/* Workspace Switcher */}
                <div className="relative" ref={workspaceMenuRef}>
                    <button
                        type="button"
                        onClick={() => hasMultipleWorkspaces && setIsWorkspaceMenuOpen((open) => !open)}
                        disabled={!hasMultipleWorkspaces || isSwitching}
                        className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 ${
                            hasMultipleWorkspaces ? "cursor-pointer hover:border-cyan-400/40 hover:bg-cyan-500/10" : "cursor-default"
                        }`}
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span className="max-w-[100px] truncate">{state.workspace.name}</span>
                    </button>
                    {isWorkspaceMenuOpen ? (
                        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                Switch workspace
                            </p>
                            <div className="grid gap-0.5">
                                {state.accessibleWorkspaces.map((workspace) => {
                                    const isActive = workspace.id === state.workspace.id;
                                    return (
                                        <button
                                            key={workspace.id}
                                            type="button"
                                            onClick={() => handleSwitchWorkspace(workspace.id)}
                                            disabled={isSwitching}
                                            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
                                                isActive
                                                    ? "bg-cyan-500/10 text-cyan-100"
                                                    : "text-slate-200 hover:bg-white/5"
                                            }`}
                                        >
                                            <span className="truncate">{workspace.name}</span>
                                            {isActive ? <Check className="h-3 w-3" /> : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* User Settings Dropdown */}
                <div className="relative" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => setIsUserMenuOpen((open) => !open)}
                        aria-label="Open user menu"
                        aria-expanded={isUserMenuOpen}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
                    >
                        <User className="h-3.5 w-3.5" />
                    </button>
                    {isUserMenuOpen ? (
                        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-white/10 bg-slate-950/95 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <div className="mb-1 border-b border-white/10 px-3 py-2">
                                <p className="text-xs font-semibold text-slate-100 truncate">{state.workspace.name}</p>
                                <p className="mt-0.5 text-[10px] capitalize text-slate-400">{state.role} access</p>
                            </div>
                            <div className="grid gap-0.5">
                                <Link
                                    href="/dashboard/settings"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 transition-colors"
                                >
                                    <Zap className="h-3.5 w-3.5 text-cyan-400" />
                                    Workspace settings
                                </Link>
                                <Link
                                    href="/"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5 transition-colors"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Back to site
                                </Link>
                                <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-200">
                                    <Globe className="h-3.5 w-3.5" />
                                    <span className="flex-1">Language</span>
                                    <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => handleSwitchLocale("en")}
                                            disabled={isSwitching}
                                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
                                                currentLocale === "en"
                                                    ? "bg-cyan-500/20 text-cyan-100"
                                                    : "text-slate-400 hover:text-slate-100"
                                            }`}
                                        >
                                            EN
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSwitchLocale("nl")}
                                            disabled={isSwitching}
                                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors disabled:opacity-50 ${
                                                currentLocale === "nl"
                                                    ? "bg-cyan-500/20 text-cyan-100"
                                                    : "text-slate-400 hover:text-slate-100"
                                            }`}
                                        >
                                            NL
                                        </button>
                                    </div>
                                </div>
                                <form action={logout}>
                                    <button
                                        type="submit"
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-rose-450 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        Log out
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Clock */}
                {timeString && (
                    <span className="ml-1 text-slate-350 select-none tabular-nums font-medium tracking-wide">
                        {timeString}
                    </span>
                )}
            </div>
        </header>
    );
}
