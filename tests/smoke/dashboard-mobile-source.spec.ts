import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

function source(path: string) {
    return readFileSync(join(process.cwd(), path), "utf8");
}

test.describe("dashboard mobile responsive source contracts", () => {
    test("authenticated dashboard shell contains mobile overflow instead of viewport overflow", () => {
        const mobileShell = source("src/features/admin/ui/shell/mobile-shell.tsx");
        const globals = source("src/app/globals.css");

        expect(mobileShell).toContain("dashboardAppSurfaceClass");
        expect(mobileShell).toContain("h-[100svh]");
        expect(mobileShell).toContain("max-h-[100dvh]");
        expect(mobileShell).toContain("pb-[max(env(safe-area-inset-bottom),2rem)]");
        expect(globals).toContain(".dashboard-app-surface");
        expect(globals).toContain("overflow-x: hidden");
        expect(globals).toContain("overscroll-behavior: contain");
        expect(globals).toContain(".dashboard-mobile-stack");
        expect(globals).not.toContain(':where([class*="grid-cols-"])');
    });

    test("mobile dashboard home is app-first with grouped search and inbox context", () => {
        const desktopView = source("src/features/admin/ui/shell/desktop-view.tsx");
        const mobileShell = source("src/features/admin/ui/shell/mobile-shell.tsx");

        expect(desktopView).toContain("MobileDashboardHome");
        expect(desktopView).toContain("Search apps");
        expect(desktopView).toContain("DashboardInboxView");
        expect(desktopView).toContain("min-[420px]:grid-cols-2");
        expect(desktopView).toContain("lg:hidden");
        expect(desktopView).toContain("hidden h-full");
        expect(mobileShell).toContain("Search apps");
        expect(mobileShell).toContain("filteredGroups");
    });

    test("representative data routes expose phone card lists and keep tables desktop-only", () => {
        const analyticsLog = source("src/features/analytics/ui/analytics-events-log.tsx");
        const videosPage = source("src/app/(admin)/dashboard/videos/page.tsx");
        const customersPage = source("src/app/(admin)/dashboard/customers/page.tsx");
        const workPage = source("src/app/(admin)/dashboard/work/page.tsx");
        const legalVault = source("src/features/legal-vault/ui/legal-vault-overview.tsx");
        const bookkeeping = source("src/features/legal-vault/ui/bookkeeping-ledger.tsx");
        const queueTable = source("src/features/admin/ui/app-workbench/app-queue-table.tsx");

        expect(analyticsLog).toContain("EventCard");
        expect(analyticsLog).toContain("md:hidden");
        expect(analyticsLog).toContain("hidden md:block");
        expect(videosPage).toContain("space-y-3 md:hidden");
        expect(videosPage).toContain("hidden overflow-x-auto");
        expect(queueTable).toContain("mobileCards");
        expect(queueTable).toContain("md:hidden");
        expect(queueTable).toContain("hidden md:block");
        expect(customersPage).toContain("mobileCards={customers.map");
        expect(workPage).toContain("mobileCards={items.map");
        expect(legalVault).toContain("mobileCards={documents.map");
        expect(bookkeeping).toContain("mobileCards={visibleEntries.map");
    });

    test("shared workbench primitives expose mobile-safe structured APIs", () => {
        const commandBar = source("src/features/admin/ui/app-workbench/app-command-bar.tsx");
        const tabList = source("src/features/admin/ui/app-workbench/app-tab-list.tsx");
        const metricStrip = source("src/features/admin/ui/app-workbench/app-metric-strip.tsx");
        const splitPane = source("src/features/admin/ui/app-workbench/app-split-pane.tsx");

        expect(commandBar).toContain("leading?: React.ReactNode");
        expect(commandBar).toContain("actions?: React.ReactNode");
        expect(commandBar).toContain("lg:flex-row");
        expect(tabList).toContain("snap-x");
        expect(tabList).toContain("role=\"tablist\"");
        expect(metricStrip).toContain("grid-cols-2");
        expect(metricStrip).toContain("lg:grid-flow-col");
        expect(splitPane).toContain("inspectorLabel");
        expect(splitPane).toContain("max-h-[55svh]");
    });

    test("wide editor apps declare deliberate mobile contained-scroll policy", () => {
        const shell = source("src/features/builder/puck-editor-shell.tsx");

        expect(shell).toContain("DashboardMobileEditorNotice");
        expect(shell).toContain("dashboard-wide-workspace");
        expect(shell).toContain("overflow-auto");
    });

    test("content hub and content studio declare phone-width layout contracts", () => {
        const contentPage = source("src/app/(admin)/dashboard/content/page.tsx");
        const contentFeed = source("src/features/content-engine/ui/content-feed.tsx");
        const cmsWorkspace = source("src/features/content-engine/ui/cms-workspace.tsx");
        const blogEditor = source("src/features/content-engine/ui/blog-post-editor.tsx");

        expect(contentPage).toContain("min-w-0");
        expect(contentPage).toContain("AppCommandBar");
        expect(contentFeed).toContain("mx-auto flex w-full max-w-7xl min-w-0 flex-col");
        expect(cmsWorkspace).toContain("flex w-full h-full min-w-0 flex-col");
        expect(cmsWorkspace).toContain("overflow-x-auto");
        expect(cmsWorkspace).toContain("lg:flex-row");
        expect(blogEditor).toContain("flex min-w-0 flex-col gap-6");
        expect(blogEditor).toContain("grid w-full gap-2 sm:flex");
    });

    test("AI draft generator controls stay stacked and reachable on narrow phones", () => {
        const draftForm = source("src/features/content-engine/ui/draft-generator-form.tsx");

        expect(draftForm).toContain("mx-auto grid w-full max-w-6xl min-w-0");
        expect(draftForm).toContain("flex min-w-0 flex-col gap-2 sm:flex-row");
        expect(draftForm).toContain("w-full");
        expect(draftForm).toContain("min-h-12 h-auto w-full");
        expect(draftForm).toContain("whitespace-normal");
    });

    test("booking, settings, and intelligence apps declare mobile-safe control layouts", () => {
        const booking = source("src/features/booking/ui/admin-booking-control-center.tsx");
        const settings = source("src/features/admin/ui/settings-form.tsx");
        const sourceIntelligence = source("src/features/source-intelligence/ui/source-intelligence-dashboard.tsx");
        const marketMonitor = source("src/features/market-monitor/ui/market-monitor-dashboard.tsx");

        expect(booking).toContain("leading={<span");
        expect(booking).toContain("text-[21px]");
        expect(booking).toContain("dashboard-mobile-stack");
        expect(settings).toContain("actions={");
        expect(settings).toContain("snap-x");
        expect(settings).toContain("pb-[max(env(safe-area-inset-bottom),1rem)]");
        expect(sourceIntelligence).toContain("dashboard-mobile-stack");
        expect(marketMonitor).toContain("sm:min-w-[200px]");
    });

    test("source intelligence is wired into OS desktop, dock, start menu, and mobile launchers", () => {
        const dashboardState = source("src/features/admin/lib/dashboard-state.ts");
        const windowMeta = source("src/features/admin/lib/window-meta.ts");
        const appIcon = source("src/features/admin/ui/app-icon.tsx");
        const moduleIcon = source("src/features/admin/ui/module-icon.tsx");
        const desktopView = source("src/features/admin/ui/shell/desktop-view.tsx");
        const dock = source("src/features/admin/ui/shell/dock.tsx");
        const startMenu = source("src/features/admin/ui/shell/start-menu.tsx");
        const mobileShell = source("src/features/admin/ui/shell/mobile-shell.tsx");
        const dashboardLauncher = source("src/features/admin/lib/dashboard-launcher.ts");

        expect(dashboardState).toContain('"source-intelligence": {');
        expect(dashboardState).toContain('href: "/dashboard/source-intelligence"');
        expect(dashboardState).toContain('icon: "database-zap"');
        expect(dashboardLauncher).toContain('moduleKeys: ["inbox", "opportunities", "market-monitor", "source-intelligence", "analytics", "legibility-hub"]');
        expect(windowMeta).toContain('"source-intelligence": {');
        expect(windowMeta).toContain('title: "Source Intelligence"');
        expect(appIcon).toContain('"source-intelligence"');
        expect(moduleIcon).toContain('"database-zap": DatabaseZap');
        expect(desktopView).toContain("buildDashboardAppGroups");
        expect(dock).toContain("buildDashboardAppGroups");
        expect(startMenu).toContain("buildDashboardAppGroups");
        expect(startMenu).toContain('badge={app.badge}');
        expect(mobileShell).toContain("buildDashboardAppGroups");
        expect(dashboardLauncher).toContain('!moduleEntry.enabled && moduleEntry.lockedReason !== "pro"');
    });
});
