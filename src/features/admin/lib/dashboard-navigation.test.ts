import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { DashboardModule } from "@/features/admin/lib/dashboard-state";
import {
    DASHBOARD_APP_GROUPS,
    buildDashboardAppGroups,
    flattenDashboardAppGroups,
} from "@/features/admin/lib/dashboard-launcher";
import { WINDOW_META } from "@/features/admin/lib/window-meta";
import { listDashboardRouteThreadKeys, resolveDashboardRouteThread } from "@/features/admin/ui/app-workbench/app-route-thread";

const dashboardDirectory = join(process.cwd(), "src/app/(admin)/dashboard");

function listDashboardPages(directory: string, prefix = ""): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) return listDashboardPages(absolutePath, nextPrefix);
        return entry.name === "page.tsx" ? [prefix] : [];
    });
}

test("every direct dashboard route has desktop window metadata", () => {
    const directRoutes = readdirSync(dashboardDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((routeKey) => existsSync(join(dashboardDirectory, routeKey, "page.tsx")))
        .sort();

    const missingWindowMetadata = directRoutes.filter((routeKey) => !WINDOW_META[routeKey]);

    assert.deepEqual(
        missingWindowMetadata,
        [],
        `Dashboard routes missing WINDOW_META entries: ${missingWindowMetadata.join(", ")}`,
    );
});

test("every current workspace module is intentionally assigned to a launcher group", () => {
    const dashboardStateSource = readFileSync(
        join(process.cwd(), "src/features/admin/lib/dashboard-state.ts"),
        "utf8",
    );
    const defaultModulesBlock = dashboardStateSource.slice(
        dashboardStateSource.indexOf("const DEFAULT_MODULES"),
        dashboardStateSource.indexOf("const PRO_LOCKED_MODULES"),
    );
    const defaultModuleKeys = Array.from(
        defaultModulesBlock.matchAll(/^    (?:"([^"]+)"|([a-z][a-z0-9-]*)): \{$/gm),
        (match) => match[1] ?? match[2],
    ).filter((key): key is string => Boolean(key));
    const groupedModuleKeys = new Set(DASHBOARD_APP_GROUPS.flatMap((group) => group.moduleKeys));
    const intentionallyConsolidatedModules = new Set(["manual-posts"]);
    const missingGroupAssignments = defaultModuleKeys.filter(
        (key) => !intentionallyConsolidatedModules.has(key) && !groupedModuleKeys.has(key),
    );
    const missingWindowMetadata = defaultModuleKeys.filter((key) => !WINDOW_META[key]);

    assert.deepEqual(
        missingGroupAssignments,
        [],
        `Dashboard modules missing launcher groups: ${missingGroupAssignments.join(", ")}`,
    );
    assert.deepEqual(
        missingWindowMetadata,
        [],
        `Dashboard modules missing WINDOW_META entries: ${missingWindowMetadata.join(", ")}`,
    );
    assert.match(
        dashboardStateSource,
        /for \(const key of Object\.keys\(DEFAULT_MODULES\)\)/,
        "Theme merging must evaluate the complete default module catalog.",
    );
});

test("new registered apps fall back to More Apps instead of disappearing", () => {
    const key = "navigation-contract-fixture";
    WINDOW_META[key] = {
        ...WINDOW_META.content,
        title: "Navigation Contract Fixture",
        description: "Verifies the launcher fallback.",
    };

    const moduleEntry: DashboardModule = {
        key,
        href: `/dashboard/${key}`,
        label: "Navigation Contract Fixture",
        description: "Verifies the launcher fallback.",
        section: "Workspace",
        icon: "layout-grid",
        order: 999,
        requiredCapabilities: [],
        allowedRoles: ["admin"],
        enabled: true,
    };

    try {
        const groups = buildDashboardAppGroups([moduleEntry]);
        const apps = flattenDashboardAppGroups(groups);

        assert.equal(groups[0]?.key, "more");
        assert.equal(apps[0]?.key, key);
        assert.equal(apps[0]?.href, `/dashboard/${key}`);
    } finally {
        delete WINDOW_META[key];
    }
});

test("every dashboard page route has an operating thread and cardless surface contract", () => {
    const pageRoutes = listDashboardPages(dashboardDirectory)
        .filter((route) => route.length > 0)
        .map((route) => `/dashboard/${route.replace(/\/page\.tsx$/, "")}`)
        .sort();
    const missingThreads = pageRoutes.filter((route) => !resolveDashboardRouteThread(route));
    const threadKeys = listDashboardRouteThreadKeys();

    assert.deepEqual(
        missingThreads,
        [],
        `Dashboard routes missing systems-thinking thread definitions: ${missingThreads.join(", ")}`,
    );
    assert.ok(threadKeys.length >= 30, "The route thread registry should cover every dashboard app family.");
    assert.ok(pageRoutes.length >= 50, "The route audit should include the complete dashboard page inventory.");
});
