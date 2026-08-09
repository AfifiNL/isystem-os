"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { DashboardSection, DashboardRole } from "@/features/admin/lib/dashboard-state";
import { ModuleIcon } from "@/features/admin/ui/module-icon";
import { logout } from "@/features/auth/actions";
import type { Dictionary } from "@/shared/lib/i18n/get-dictionary";

interface AdminSidebarProps {
    sections: DashboardSection[];
    workspaceName: string;
    themeName: string;
    role: DashboardRole;
    homeHref: string;
    dict: Dictionary;
}

export function AdminSidebar({ sections, workspaceName, themeName, role, homeHref, dict }: AdminSidebarProps) {
    const pathname = usePathname();

    return (
        <aside className="premium-sidebar-surface fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-sidebar-border shadow-[0_24px_80px_rgba(15,23,42,0.34)] sm:flex">
            <div className="flex h-16 items-center border-b border-sidebar-border/80 px-6">
                <Link href={homeHref} className="flex items-center gap-2 font-bold transition-all duration-200 group">
                    <span className="max-w-[200px] truncate text-base font-semibold text-sidebar-foreground" title={workspaceName}>
                        {workspaceName}
                    </span>
                </Link>
            </div>

            <div className="border-b border-sidebar-border/80 px-6 py-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-sidebar-foreground/45">
                    {dict["dashboard.sidebar.workspace"] ?? "Workspace"}
                </p>
                <p className="mt-2 truncate text-sm font-semibold text-sidebar-foreground" title={workspaceName}>{workspaceName}</p>
                <p className="truncate text-xs text-sidebar-foreground/60" title={themeName}>{themeName}</p>
                <span className="mt-3 inline-flex rounded-full border border-sidebar-primary/25 bg-sidebar-primary/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    {role}
                </span>
            </div>

            <div className="flex-1 overflow-auto py-4">
                {sections.map((section) => (
                    <div key={section.section} className="mb-4 px-4">
                        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/35">
                            {section.section}
                        </p>
                        <nav className="grid gap-1">
                            {section.modules.map(({ href, label, icon, enabled, badge }) => {
                                const isActive = pathname === href || pathname.startsWith(href + "/");
                                return (
                                    <Link
                                        key={href}
                                        href={href}
                                        aria-disabled={!enabled}
                                        onClick={!enabled ? (event) => event.preventDefault() : undefined}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-300",
                                            !enabled && "cursor-not-allowed opacity-60",
                                            isActive
                                                ? "border-sidebar-primary/35 bg-sidebar-primary/18 text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(37,99,235,0.18)]"
                                                : "border-transparent text-sidebar-foreground/65 hover:border-sidebar-border hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
                                        )}
                                    >
                                        <span className={cn(
                                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-300",
                                            isActive
                                                ? "border-sidebar-primary/40 bg-sidebar-primary/18 text-sidebar-primary-foreground"
                                                : "border-sidebar-border/60 bg-white/5 text-sidebar-foreground/70 group-hover:border-sidebar-primary/25 group-hover:text-sidebar-foreground"
                                        )}>
                                            <ModuleIcon name={icon} className="h-4 w-4 shrink-0" />
                                        </span>
                                        <span className="flex-1">{label}</span>
                                        {badge ? (
                                            <span className="rounded-full border border-sidebar-primary/25 bg-sidebar-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-primary-foreground">
                                                {badge}
                                            </span>
                                        ) : null}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                ))}
            </div>

            <div className="border-t border-sidebar-border/80 p-4">
                <form action={logout}>
                    <button
                        type="submit"
                        className="mb-2 flex w-full items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-xs text-sidebar-foreground/68 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                    >
                        <LogOut className="h-3 w-3" />
                        {dict["dashboard.sidebar.logout"] ?? "Logout"}
                    </button>
                </form>
                <Link
                    href="/"
                    className="flex items-center gap-2 rounded-xl border border-transparent px-3 py-2.5 text-xs text-sidebar-foreground/68 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                >
                    <ArrowLeft className="h-3 w-3" />
                    {dict["dashboard.sidebar.backToSite"] ?? "Back to site"}
                </Link>
            </div>
        </aside>
    );
}
