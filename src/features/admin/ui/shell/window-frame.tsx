"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { WindowMeta } from "@/features/admin/lib/window-meta";
import type { DashboardModule } from "@/features/admin/lib/dashboard-state";
import { AppIcon } from "@/features/admin/ui/app-icon";
import { dashboardAppSurfaceClass } from "@/features/admin/ui/responsive-dashboard";
import { CoachMark } from "@/features/admin/ui/onboarding/coach-mark";
import { COACH_MARK_COPY } from "@/features/admin/ui/onboarding/coach-mark-copy";

interface WindowFrameProps {
    meta: WindowMeta;
    modules: DashboardModule[];
    workspaceId: string;
    seenCoachMarks: string[];
    children: React.ReactNode;
}

// OS-style window floating above the workspace wallpaper. The window header
// doubles as an app switcher: a compact row of icons (one per enabled
// workspace app) lets users jump directly between features without going
// back to the desktop. The active app is highlighted; all others are muted.
//
// Layout: the header is flex-none so it never scrolls away; the content
// div below owns vertical scroll for long pages.
//
// Keybinding: Escape closes the window unless focus is inside a form field.
export function WindowFrame({
    meta,
    workspaceId,
    seenCoachMarks,
    children,
}: WindowFrameProps) {
    const router = useRouter();
    const pathname = usePathname();
    const Icon = meta.icon;

    // Derive current app key from the first segment after /dashboard/
    const currentKey = pathname.startsWith("/dashboard/")
        ? (pathname.slice("/dashboard/".length).split("/")[0] ?? "")
        : "";

    // Coach mark fires once per (user, workspace, app) — first time the
    // window is opened. After dismissal (manual or auto-timeout) the seen
    // flag is persisted server-side, so the tip never reappears.
    const coachMarkCopy = COACH_MARK_COPY[currentKey];
    const showCoachMark =
        Boolean(coachMarkCopy) && currentKey.length > 0 && !seenCoachMarks.includes(currentKey);

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
            if (event.key !== "Escape") return;
            router.push(meta.closeHref);
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [router, meta.closeHref]);

    return (
        <div className="absolute inset-x-3 top-12 bottom-[5.5rem] z-10 flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <header
                role="banner"
                className="flex flex-none items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md"
            >
                {/* Active window identity */}
                <div className="flex shrink-0 items-center gap-3">
                    <AppIcon
                        moduleKey={currentKey}
                        iconComponent={Icon}
                        size="sm"
                    />
                    <h1 className="whitespace-nowrap text-sm font-semibold tracking-tight text-foreground">
                        {meta.title}
                    </h1>
                </div>

                {/* Close */}
                <Link
                    href={meta.closeHref}
                    aria-label={`Close ${meta.title}`}
                    title="Close (Esc)"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border/60 hover:bg-destructive/10 hover:text-destructive"
                >
                    <X className="h-5 w-5" />
                </Link>
            </header>

            {/* Content — owns vertical scroll; pb-6 keeps last elements off the rounded corner.
                min-w-0 stops flex children from expanding the window horizontally, and
                overflow-x-auto lets pages with wide tables/grids scroll internally
                instead of pushing the layout past the viewport. */}
            <div className={`${dashboardAppSurfaceClass} flex-1 overflow-y-auto overflow-x-auto pb-6`}>
                {children}
            </div>

            {showCoachMark && coachMarkCopy ? (
                <CoachMark
                    workspaceId={workspaceId}
                    coachMarkKey={currentKey}
                    title={coachMarkCopy.title}
                    body={coachMarkCopy.body}
                />
            ) : null}
        </div>
    );
}
