"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { AdminDashboardState } from "@/features/admin/lib/dashboard-state";
import { buildDashboardAppGroups } from "@/features/admin/lib/dashboard-launcher";
import { listProductivityApps } from "@/features/admin/lib/window-meta";
import { AppIcon } from "@/features/admin/ui/app-icon";

interface StartMenuProps {
    state: AdminDashboardState;
    onClose: () => void;
}

// OS-style Start menu. Two sections:
//
//   - Productivity: personal apps (notes, calculator, voice memo). Always
//     available. Kept at the top because they're small utilities a user
//     reaches for many times per session.
//
//   - Workspace apps: the same list that renders on the desktop grid,
//     filtered against state.modules for role/tier/capability. Useful when
//     a window is already open and the user wants to switch apps without
//     returning to the desktop first.
//
// Closes via click-outside handled by the parent Taskbar.
export function StartMenu({ state, onClose }: StartMenuProps) {
    const [query, setQuery] = useState("");
    const productivityApps = listProductivityApps();
    const groups = buildDashboardAppGroups(state.modules);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredProductivityApps = normalizedQuery
        ? productivityApps.filter((app) => `${app.title} ${app.description}`.toLowerCase().includes(normalizedQuery))
        : productivityApps;
    const filteredGroups = normalizedQuery
        ? groups
            .map((group) => ({
                ...group,
                apps: group.apps.filter((app) => (
                    `${app.label} ${app.description} ${group.title}`.toLowerCase().includes(normalizedQuery)
                )),
            }))
            .filter((group) => group.apps.length > 0)
        : groups;
    const appCount = productivityApps.length + groups.reduce((total, group) => total + group.apps.length, 0);

    return (
        <div
            role="menu"
            className="w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
            <div className="space-y-2 border-b border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                        Launchpad
                    </p>
                    <span className="text-[10px] text-slate-500">{appCount} apps</span>
                </div>
                <label className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-slate-300 focus-within:border-cyan-300/40">
                    <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="sr-only">Search all apps</span>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search all apps"
                        autoFocus
                        className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    />
                </label>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
                {filteredProductivityApps.length > 0 ? (
                    <>
                        <div className="px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Productivity
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                            {filteredProductivityApps.map((app) => (
                                <Link
                                    key={app.slug}
                                    href={app.href}
                                    onClick={onClose}
                                    className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-center transition-colors hover:bg-white/5"
                                >
                                    <AppIcon
                                        size="md"
                                        moduleKey={app.slug}
                                        iconComponent={app.icon}
                                    />
                                    <span className="w-full truncate text-[11px] font-medium text-slate-200">
                                        {app.title}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </>
                ) : null}

                {filteredGroups.length > 0 ? (
                    <>
                        <div className="border-t border-white/10 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Workspace
                            </p>
                        </div>
                        <div className="p-1">
                            {filteredGroups.map((group) => (
                                <section key={group.key} className="py-1">
                                    <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                        {group.title}
                                    </p>
                                    <ul className="grid gap-0.5">
                                        {group.apps.map((app) => (
                                            <li key={app.key}>
                                                <Link
                                                    href={app.href}
                                                    onClick={onClose}
                                                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/5"
                                                >
                                                    <AppIcon
                                                        size="sm"
                                                        moduleKey={app.key}
                                                        iconName={app.icon}
                                                        badge={app.badge}
                                                    />
                                                    {app.label}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    </>
                ) : null}

                {filteredGroups.length === 0 && filteredProductivityApps.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-400">
                        No apps match &quot;{query}&quot;.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
