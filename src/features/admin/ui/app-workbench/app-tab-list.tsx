import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface TabItem {
    label: string;
    value: string;
    href?: string;
    active?: boolean;
    icon?: LucideIcon;
    ariaLabel?: string;
}

interface AppTabListProps {
    tabs: TabItem[];
    selectedValue?: string;
    onSelect?: (value: string) => void;
    className?: string;
}

export function AppTabList({ tabs, selectedValue, onSelect, className }: AppTabListProps) {
    return (
        <div
            className={cn(
                "dashboard-app-tabs flex max-w-full shrink-0 snap-x items-center gap-0.5 overflow-x-auto overscroll-x-contain scrollbar-none pb-0.5 select-none",
                className
            )}
            role="tablist"
            data-dashboard-tab-list="true"
        >
            {tabs.map((tab) => {
                const isActive = tab.active ?? (selectedValue !== undefined && tab.value === selectedValue);
                const Icon = tab.icon;
                const buttonClass = cn(
                    "relative inline-flex h-8 snap-start items-center justify-center gap-1.5 border-b-2 border-transparent px-2.5 text-[13px] font-medium transition-colors whitespace-nowrap outline-none cursor-pointer after:absolute after:inset-x-2 after:-bottom-0.5 after:h-px after:scale-x-0 after:bg-[var(--dashboard-accent)] after:transition-transform",
                    isActive
                        ? "text-foreground after:scale-x-100"
                        : "text-muted-foreground hover:border-border/70 hover:text-foreground"
                );
                const content = (
                    <>
                        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                        <span>{tab.label}</span>
                    </>
                );

                if (tab.href) {
                    return (
                        <Link
                            key={tab.value}
                            href={tab.href}
                            className={buttonClass}
                            data-dashboard-tab-value={tab.value}
                            data-dashboard-tab-active={isActive ? "true" : "false"}
                            role="tab"
                            aria-selected={isActive}
                            aria-label={tab.ariaLabel ?? tab.label}
                        >
                            {content}
                        </Link>
                    );
                }

                return (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => onSelect?.(tab.value)}
                        className={buttonClass}
                        data-dashboard-tab-value={tab.value}
                        data-dashboard-tab-active={isActive ? "true" : "false"}
                        role="tab"
                        aria-selected={isActive}
                        aria-label={tab.ariaLabel ?? tab.label}
                    >
                        {content}
                    </button>
                );
            })}
        </div>
    );
}
