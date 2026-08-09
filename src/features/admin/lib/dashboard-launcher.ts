import type { LucideIcon } from "lucide-react";
import {
    BarChart3,
    BriefcaseBusiness,
    Clapperboard,
    Gauge,
    LayoutGrid,
    PenTool,
    Settings,
    Sparkles,
} from "lucide-react";
import type { DashboardModule } from "@/features/admin/lib/dashboard-state";
import { WINDOW_META } from "@/features/admin/lib/window-meta";

export type DashboardAppGroupKey =
    | "create"
    | "growth"
    | "intelligence"
    | "clients"
    | "operations"
    | "media"
    | "control"
    | "more";

export interface DashboardLauncherItem {
    key: string;
    routeKey: string;
    href: string;
    label: string;
    description: string;
    icon: string;
    badge?: "PRO";
    groupKey: DashboardAppGroupKey;
}

export interface DashboardAppGroupDefinition {
    key: DashboardAppGroupKey;
    title: string;
    description: string;
    icon: LucideIcon;
    moduleKeys: string[];
}

export interface DashboardAppGroup extends DashboardAppGroupDefinition {
    apps: DashboardLauncherItem[];
}

export const DASHBOARD_APP_GROUPS: DashboardAppGroupDefinition[] = [
    {
        key: "create",
        title: "Create",
        description: "Draft, compose, publish.",
        icon: PenTool,
        moduleKeys: ["generate", "creative-studio", "content", "builder", "case-snippets"],
    },
    {
        key: "growth",
        title: "Growth",
        description: "SEO, campaigns, outreach.",
        icon: Sparkles,
        moduleKeys: ["seo", "external-publishing", "newsletter", "popups", "outreach"],
    },
    {
        key: "intelligence",
        title: "Intelligence",
        description: "Signals, analytics, search.",
        icon: BarChart3,
        moduleKeys: ["inbox", "opportunities", "market-monitor", "source-intelligence", "analytics", "legibility-hub"],
    },
    {
        key: "clients",
        title: "Clients",
        description: "Relationships, work, legal.",
        icon: BriefcaseBusiness,
        moduleKeys: ["clients", "customers", "slas", "work", "legal-vault", "commercial-ops"],
    },
    {
        key: "operations",
        title: "Operations",
        description: "Booking, automation, health.",
        icon: Gauge,
        moduleKeys: ["booking", "automations", "integrations", "health", "render-queue"],
    },
    {
        key: "media",
        title: "Media",
        description: "Podcast, audio, video.",
        icon: Clapperboard,
        moduleKeys: ["podcast", "music-library", "voices", "videos"],
    },
    {
        key: "control",
        title: "Control",
        description: "Workspace configuration.",
        icon: Settings,
        moduleKeys: ["settings", "admin-workspaces"],
    },
];

const MORE_APPS_GROUP: DashboardAppGroupDefinition = {
    key: "more",
    title: "More Apps",
    description: "Additional workspace tools.",
    icon: LayoutGrid,
    moduleKeys: [],
};

const GROUP_BY_MODULE = new Map<string, DashboardAppGroupKey>(
    DASHBOARD_APP_GROUPS.flatMap((group) => group.moduleKeys.map((moduleKey) => [moduleKey, group.key] as const)),
);

const LABEL_OVERRIDES: Record<string, string> = {
    clients: "Portal Clients",
    customers: "Customer Spine",
    slas: "SLA Operations",
    work: "Work Queue",
    "admin-workspaces": "Workspaces",
    "commercial-ops": "Commercial Ops",
};

const DESCRIPTION_OVERRIDES: Record<string, string> = {
    clients: "Portal accounts, profile linkage, and SLA continuity.",
    customers: "Business OS customer records, lifecycle, and follow-up.",
    slas: "Project commitments, deliverables, and client-facing tasks.",
    work: "Active work, blockers, SLA pressure, and next actions.",
    "admin-workspaces": "Manage workspaces, themes, and manager access.",
    "commercial-ops": "Aggregate metrics from active workspace commercial links and legal invoices.",
};

export function getDashboardRouteKey(href: string) {
    const path = href.split("?")[0]?.split("#")[0] ?? href;
    const remainder = path.startsWith("/dashboard/") ? path.slice("/dashboard/".length) : "";
    return remainder.split("/")[0] || "";
}

export function buildDashboardAppGroups(modules: DashboardModule[]): DashboardAppGroup[] {
    const appsByKey = new Map<string, DashboardLauncherItem>();
    const ungroupedApps: DashboardLauncherItem[] = [];

    for (const moduleEntry of modules) {
        if (!moduleEntry.enabled && moduleEntry.lockedReason !== "pro") continue;
        if (moduleEntry.key === "manual-posts") continue;

        const meta = WINDOW_META[moduleEntry.key];
        if (!meta || meta.category !== "workspace") continue;

        const groupKey = GROUP_BY_MODULE.get(moduleEntry.key) ?? MORE_APPS_GROUP.key;
        const launcherItem: DashboardLauncherItem = {
            key: moduleEntry.key,
            routeKey: getDashboardRouteKey(moduleEntry.href),
            href: moduleEntry.href,
            label: LABEL_OVERRIDES[moduleEntry.key] ?? meta.title,
            description: DESCRIPTION_OVERRIDES[moduleEntry.key] ?? meta.description,
            icon: moduleEntry.icon,
            badge: moduleEntry.badge,
            groupKey,
        };

        if (groupKey === MORE_APPS_GROUP.key) {
            ungroupedApps.push(launcherItem);
        } else {
            appsByKey.set(moduleEntry.key, launcherItem);
        }
    }

    const configuredGroups = DASHBOARD_APP_GROUPS.map((group) => ({
        ...group,
        apps: group.moduleKeys.map((moduleKey) => appsByKey.get(moduleKey)).filter((app): app is DashboardLauncherItem => Boolean(app)),
    })).filter((group) => group.apps.length > 0);

    if (ungroupedApps.length === 0) {
        return configuredGroups;
    }

    return [
        ...configuredGroups,
        {
            ...MORE_APPS_GROUP,
            apps: ungroupedApps.sort((a, b) => a.label.localeCompare(b.label)),
        },
    ];
}

export function flattenDashboardAppGroups(groups: DashboardAppGroup[]) {
    return groups.flatMap((group) => group.apps);
}
