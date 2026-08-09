"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { X } from "lucide-react";
import type { DashboardAppGroup, DashboardLauncherItem } from "@/features/admin/lib/dashboard-launcher";
import { AppIcon } from "@/features/admin/ui/app-icon";

interface AppGroupPanelProps {
    group: DashboardAppGroup;
    titleSuffix?: string;
    onClose: () => void;
    onNavigate?: () => void;
    onAppContextMenu?: (event: MouseEvent, app: DashboardLauncherItem) => void;
}

export function AppGroupPanel({
    group,
    titleSuffix,
    onClose,
    onNavigate,
    onAppContextMenu,
}: AppGroupPanelProps) {
    const Icon = group.icon;

    return (
        <section
            data-desktop-ignore-context="true"
            aria-label={`${group.title} apps`}
            className="w-[min(380px,calc(100vw-5rem))] overflow-hidden rounded-xl border border-white/10 bg-slate-950/94 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl"
        >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-cyan-100">
                        <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold text-slate-50">
                            {group.title}
                            {titleSuffix ? <span className="font-medium text-slate-400"> / {titleSuffix}</span> : null}
                        </h2>
                        <p className="truncate text-xs text-slate-400">{group.description}</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={`Close ${group.title}`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-slate-50"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </header>

            <div className="grid max-h-[min(68vh,620px)] gap-0.5 overflow-y-auto p-1.5">
                {group.apps.map((app) => (
                    <Link
                        key={app.key}
                        href={app.href}
                        onClick={onNavigate}
                        onContextMenu={(event) => onAppContextMenu?.(event, app)}
                        className="group flex min-w-0 items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-cyan-300/20 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
                    >
                        <AppIcon moduleKey={app.key} iconName={app.icon} badge={app.badge} size="sm" />
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[13px] font-semibold leading-tight text-slate-100">{app.label}</h3>
                            <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-400">{app.description}</p>
                        </div>
                        <span className="text-[10px] text-slate-600 transition-colors group-hover:text-cyan-200">↗</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
