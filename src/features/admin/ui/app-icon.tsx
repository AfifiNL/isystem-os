"use client";

import React from "react";
import { cn } from "@/shared/lib/utils";
import { ModuleIcon } from "@/features/admin/ui/module-icon";
import type { LucideIcon } from "lucide-react";

interface AppIconProps {
    moduleKey: string;
    iconName?: string;
    iconComponent?: LucideIcon;
    size?: "sm" | "md" | "lg" | "xl";
    badge?: string;
    isActive?: boolean;
    className?: string;
}

const GRADIENTS: Record<string, string> = {
    // violet/cyan
    generate: "from-violet-600/40 via-violet-500/20 to-cyan-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-cyan-950/30 text-cyan-200",

    // emerald/cyan
    seo: "from-emerald-600/40 via-emerald-500/20 to-cyan-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-emerald-950/30 text-emerald-200",
    "external-publishing": "from-emerald-600/40 via-emerald-500/20 to-cyan-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-emerald-950/30 text-emerald-200",
    analytics: "from-emerald-600/40 via-emerald-500/20 to-cyan-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-emerald-950/30 text-emerald-200",

    // purple/pink
    podcast: "from-purple-600/40 via-purple-500/20 to-pink-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-purple-950/30 text-pink-200",
    voices: "from-purple-600/40 via-purple-500/20 to-pink-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-purple-950/30 text-pink-200",
    "music-library": "from-purple-600/40 via-purple-500/20 to-pink-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-purple-950/30 text-pink-200",

    // slate/gold
    "legal-vault": "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    settings: "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    "admin-workspaces": "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    workspaces: "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    slas: "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    clients: "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    customers: "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    work: "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",
    "commercial-ops": "from-slate-600/40 via-slate-500/20 to-amber-500/35 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/20 text-amber-200",

    // orange/amber
    opportunities: "from-orange-600/40 via-orange-500/20 to-amber-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-orange-950/30 text-amber-200",
    "market-monitor": "from-orange-600/40 via-orange-500/20 to-amber-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-orange-950/30 text-amber-200",
    "source-intelligence": "from-cyan-600/40 via-slate-500/20 to-amber-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-cyan-950/30 text-cyan-200",
    inbox: "from-orange-600/40 via-orange-500/20 to-amber-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-orange-950/30 text-amber-200",
    "render-queue": "from-orange-600/40 via-orange-500/20 to-amber-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-orange-950/30 text-amber-200",

    // blue/indigo (default/fallback)
    builder: "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",
    "manual-posts": "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",
    content: "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",
    videos: "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",
    booking: "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",
    popups: "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",
    "case-snippets": "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200",

    "group-create": "from-cyan-600/35 via-blue-500/20 to-violet-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-cyan-950/30 text-cyan-100",
    "group-growth": "from-emerald-600/35 via-teal-500/20 to-lime-400/25 border-white/25 border-t-white/50 border-b-black/40 shadow-emerald-950/30 text-emerald-100",
    "group-intelligence": "from-amber-500/35 via-orange-500/20 to-cyan-400/25 border-white/25 border-t-white/50 border-b-black/40 shadow-amber-950/30 text-amber-100",
    "group-clients": "from-slate-600/40 via-zinc-500/20 to-amber-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-slate-950/30 text-amber-100",
    "group-operations": "from-rose-600/30 via-slate-500/20 to-cyan-400/25 border-white/25 border-t-white/50 border-b-black/40 shadow-rose-950/25 text-rose-100",
    "group-media": "from-fuchsia-600/35 via-purple-500/20 to-sky-400/25 border-white/25 border-t-white/50 border-b-black/40 shadow-fuchsia-950/30 text-fuchsia-100",
    "group-control": "from-zinc-600/40 via-slate-500/20 to-cyan-400/25 border-white/25 border-t-white/50 border-b-black/40 shadow-slate-950/30 text-slate-100",
    "group-more": "from-blue-600/35 via-slate-500/20 to-cyan-400/25 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-cyan-100",
};

export function AppIcon({
    moduleKey,
    iconName,
    iconComponent: IconComponent,
    size = "md",
    badge,
    isActive = false,
    className,
}: AppIconProps) {
    const gradient = GRADIENTS[moduleKey] || "from-blue-600/40 via-blue-500/20 to-indigo-400/30 border-white/25 border-t-white/50 border-b-black/40 shadow-blue-950/30 text-blue-200";

    const sizeClasses = {
        sm: "h-8 w-8 rounded-lg text-xs",
        md: "h-10 w-10 rounded-xl text-sm",
        lg: "h-12 w-12 rounded-2xl text-base",
        xl: "h-14 w-14 rounded-[1.25rem] text-lg",
    };

    const iconSizeClasses = {
        sm: "h-4 w-4",
        md: "h-5 w-5",
        lg: "h-6 w-6",
        xl: "h-7 w-7",
    };

    return (
        <span
            className={cn(
                "relative flex items-center justify-center bg-gradient-to-tr backdrop-blur-md border transition-all duration-200 select-none shadow-[inset_0_1.5px_0_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.35)]",
                // Hover reflection highlight simulation
                "after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-tr after:from-white/0 after:via-white/5 after:to-white/15 after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-300",
                gradient,
                sizeClasses[size],
                isActive && "ring-2 ring-cyan-400/80 ring-offset-2 ring-offset-slate-950/40",
                className
            )}
        >
            {/* The icon glyph inside */}
            {IconComponent ? (
                <IconComponent className={cn("text-white drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.7)]", iconSizeClasses[size])} />
            ) : iconName ? (
                <ModuleIcon
                    name={iconName}
                    className={cn("text-white drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.7)]", iconSizeClasses[size])}
                />
            ) : null}

            {/* Premium badge */}
            {badge === "PRO" && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-cyan-500 px-1 py-0.5 text-[8px] font-black uppercase leading-none tracking-wider text-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.3)] border border-cyan-300/40">
                    PRO
                </span>
            )}
        </span>
    );
}
