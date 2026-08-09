import React from "react";
import { cn } from "@/shared/lib/utils";
import { AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";

interface AppStatusBannerProps {
    children: React.ReactNode;
    variant?: "default" | "success" | "warning" | "destructive" | "info";
    className?: string;
}

export function AppStatusBanner({
    children,
    variant = "default",
    className
}: AppStatusBannerProps) {
    const icons = {
        default: Info,
        success: CheckCircle,
        warning: AlertTriangle,
        destructive: AlertCircle,
        info: Info
    };

    const variantStyles = {
        default: "border-border/60 bg-muted/20 text-muted-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-850 dark:text-emerald-300",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-850 dark:text-amber-300",
        destructive: "border-rose-500/30 bg-rose-500/10 text-rose-850 dark:text-rose-300",
        info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-850 dark:text-cyan-300"
    };

    const Icon = icons[variant];

    return (
        <div
            className={cn(
                "flex shrink-0 items-start gap-2 border-y px-3 py-1.5 text-[13px] font-medium tracking-wide",
                variantStyles[variant],
                className
            )}
        >
            <Icon className="mt-0.5 size-3.5 shrink-0" />
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </div>
    );
}
