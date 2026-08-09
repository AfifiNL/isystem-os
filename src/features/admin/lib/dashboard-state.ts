import { getWorkspaceThemeManifest } from "@/features/admin/actions/workspace-theme";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { getDictionary, type Dictionary } from "@/shared/lib/i18n/get-dictionary";
import { applyClientModuleOverrides } from "@/shared/lib/client-config/load";
import { extractPublicRuntimeConfig } from "@/shared/lib/client-config/runtime";

export type DashboardRole = "admin" | "manager" | "user";

export interface DashboardModule {
    key: string;
    href: string;
    label: string;
    description: string;
    section: string;
    icon: string;
    order: number;
    requiredCapabilities: string[];
    allowedRoles: DashboardRole[];
    enabled: boolean;
    lockedReason?: "pro" | "capability" | "role";
    badge?: "PRO";
}

export interface DashboardSection {
    section: string;
    modules: DashboardModule[];
}

export interface DashboardWidget {
    key: string;
    title: string;
    description: string;
    icon: string;
    href?: string;
    order: number;
}

export interface AdminDashboardState {
    role: DashboardRole;
    locale: "en" | "nl";
    workspace: {
        id: string;
        name: string;
        slug: string;
        compute_credits: number;
        workspace_tier: "basic" | "pro";
        wallpaper_url: string | null;
    };
    accessibleWorkspaces: Array<{
        id: string;
        name: string;
        slug: string;
    }>;
    theme: {
        id: string;
        themeKey: string;
        themeName: string;
        version: string;
        status: string;
    } | null;
    capabilities: string[];
    modules: DashboardModule[];
    sections: DashboardSection[];
    widgets: DashboardWidget[];
    quickActions: DashboardWidget[];
    themeConfig: Record<string, unknown>;
    dictionary: Dictionary;
}

interface ThemeModuleCandidate {
    key: string;
    label?: string;
    description?: string;
    href?: string;
    section?: string;
    icon?: string;
    order?: number;
    requiredCapabilities?: string[];
    allowedRoles?: DashboardRole[];
    enabled?: boolean;
}

interface ThemeWidgetCandidate {
    key: string;
    title?: string;
    description?: string;
    icon?: string;
    href?: string;
    order?: number;
    enabled?: boolean;
}

const DEFAULT_MODULES: Record<string, DashboardModule> = {
    inbox: {
        key: "inbox",
        href: "/dashboard/inbox",
        label: "Attention Inbox",
        description: "View all pending alerts, opportunities, bookings, and contact submissions needing operator attention.",
        section: "Insights",
        icon: "inbox",
        order: 10,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    opportunities: {
        key: "opportunities",
        href: "/dashboard/opportunities",
        label: "AI Opportunity Engine",
        description: "Scan SEO, content, and conversion data for the next 10–20% improvement.",
        section: "Insights",
        icon: "target",
        order: 55,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "legibility-hub": {
        key: "legibility-hub",
        href: "/dashboard/legibility-hub",
        label: "Legibility Hub",
        description: "Central semantic query engine to find relationships and context across workspace elements.",
        section: "Insights",
        icon: "search",
        order: 58,
        requiredCapabilities: [],
        allowedRoles: ["admin"],
        enabled: true,
    },
    "market-monitor": {
        key: "market-monitor",
        href: "/dashboard/market-monitor",
        label: "Market Monitor",
        description: "Track competitor posts, authority sources, and industry keyword signals.",
        section: "Insights",
        icon: "trending-up",
        order: 56,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "source-intelligence": {
        key: "source-intelligence",
        href: "/dashboard/source-intelligence",
        label: "Source Intelligence",
        description: "Govern source registry, ingestion runs, evidence claims, and public-safe proof links.",
        section: "Insights",
        icon: "database-zap",
        order: 57,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    outreach: {
        key: "outreach",
        href: "/dashboard/outreach",
        label: "Outreach Control Center",
        description: "Govern prospect discovery, account research, approvals, dispatch caps, and outreach analytics.",
        section: "Growth",
        icon: "megaphone",
        order: 61,
        requiredCapabilities: ["outreach.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "external-publishing": {
        key: "external-publishing",
        href: "/dashboard/external-publishing",
        label: "External Publishing Studio",
        description: "Package platform-native copy, evidence, links, and manual publication handoffs for reviewed external publishing.",
        section: "Growth",
        icon: "send",
        order: 63,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    generate: {
        key: "generate",
        href: "/dashboard/generate",
        label: "AI Draft Generator",
        description: "Generate long-form content drafts with guided prompts.",
        section: "Production",
        icon: "sparkles",
        order: 20,
        requiredCapabilities: ["content.write"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "creative-studio": {
        key: "creative-studio",
        href: "/dashboard/creative-studio",
        label: "Creative Studio",
        description: "Govern creative briefs, strategy, prompt manifests, render queues, assets, and audit timelines.",
        section: "Production",
        icon: "palette",
        order: 21,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    content: {
        key: "content",
        href: "/dashboard/content",
        label: "Content Library",
        description: "Manage draft and published content for this workspace.",
        section: "Production",
        icon: "file-text",
        order: 30,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager", "user"],
        enabled: true,
    },
    builder: {
        key: "builder",
        href: "/dashboard/builder",
        label: "Page Builder",
        description: "Visually compose and manage branded pages with constrained design-system blocks.",
        section: "Production",
        icon: "layout-template",
        order: 35,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "manual-posts": {
        key: "manual-posts",
        href: "/dashboard/content?source=manual",
        label: "Manual Blog Library",
        description: "Manually authored blog posts — a filtered view of the unified content library.",
        section: "Production",
        icon: "book-open",
        order: 32,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager", "user"],
        enabled: true,
    },
    videos: {
        key: "videos",
        href: "/dashboard/videos",
        label: "Videos",
        description: "Upload and publish videos that appear on the public /videos page.",
        section: "Production",
        icon: "video",
        order: 33,
        requiredCapabilities: ["content.write"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    settings: {
        key: "settings",
        href: "/dashboard/settings",
        label: "Workspace Settings",
        description: "Inspect workspace runtime configuration and governance.",
        section: "Configuration",
        icon: "settings",
        order: 90,
        requiredCapabilities: ["theme.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "admin-workspaces": {
        key: "admin-workspaces",
        href: "/dashboard/workspaces",
        label: "Workspaces",
        description: "Manage global workspaces, themes, and manager assignments.",
        section: "Configuration",
        icon: "building",
        order: 95,
        requiredCapabilities: ["theme.manage"],
        allowedRoles: ["admin"],
        enabled: true,
    },
    "render-queue": {
        key: "render-queue",
        href: "/dashboard/render-queue",
        label: "Render Queue",
        description: "Fulfill manual video rendering tasks across workspaces.",
        section: "Fulfillment",
        icon: "server",
        order: 80,
        requiredCapabilities: [],
        allowedRoles: ["admin"],
        enabled: true,
    },
    slas: {
        key: "slas",
        href: "/dashboard/slas",
        label: "SLA Operations",
        description: "Manage facility locations and cleaning SLAs.",
        section: "Operations",
        icon: "clipboard-check",
        order: 50,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    clients: {
        key: "clients",
        href: "/dashboard/clients",
        label: "Client Management",
        description: "Manage portal client accounts, workspace relationships, and SLA continuity.",
        section: "Operations",
        icon: "briefcase",
        order: 45,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    customers: {
        key: "customers",
        href: "/dashboard/customers",
        label: "Customers",
        description: "Scan customer records, relationship state, and follow-up ownership.",
        section: "Operations",
        icon: "briefcase",
        order: 41,
        requiredCapabilities: ["business_os.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    work: {
        key: "work",
        href: "/dashboard/work",
        label: "Work Queue",
        description: "Track active work, blockers, SLA pressure, and next operator actions.",
        section: "Operations",
        icon: "clipboard-check",
        order: 43,
        requiredCapabilities: ["business_os.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "legal-vault": {
        key: "legal-vault",
        href: "/dashboard/legal-vault",
        label: "Legal Vault",
        description: "Service agreements, invoices, receipts, and 7-year bewaarplicht-compliant bookkeeping.",
        section: "Operations",
        icon: "shield",
        order: 48,
        requiredCapabilities: ["legal.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "commercial-ops": {
        key: "commercial-ops",
        href: "/dashboard/commercial-ops",
        label: "Commercial Ops",
        description: "Aggregate metrics from active workspace commercial links and legal invoices.",
        section: "Operations",
        icon: "credit-card",
        order: 47,
        requiredCapabilities: ["business_os.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    analytics: {
        key: "analytics",
        href: "/dashboard/analytics",
        label: "Analytics",
        description: "Review traffic, conversions, and content performance across the workspace.",
        section: "Insights",
        icon: "bar-chart-3",
        order: 60,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    newsletter: {
        key: "newsletter",
        href: "/dashboard/newsletter",
        label: "Newsletter Control Center",
        description: "Manage audiences, campaigns, templates, analytics, and automation for newsletter operations.",
        section: "Growth",
        icon: "mail",
        order: 62,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    automations: {
        key: "automations",
        href: "/dashboard/automations",
        label: "Automations",
        description: "Review active automation lanes, triggers, handoffs, and exception handling.",
        section: "Operations",
        icon: "sparkles",
        order: 52,
        requiredCapabilities: ["workflow.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    booking: {
        key: "booking",
        href: "/dashboard/booking",
        label: "Booking Control Center",
        description: "Configure premium booking journeys, intake, availability, and reservation operations.",
        section: "Operations",
        icon: "calendar-range",
        order: 55,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    integrations: {
        key: "integrations",
        href: "/dashboard/integrations",
        label: "Integrations",
        description: "Inspect connected systems, sync direction, owner, and operational status.",
        section: "Configuration",
        icon: "database-zap",
        order: 86,
        requiredCapabilities: ["integrations.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    health: {
        key: "health",
        href: "/dashboard/health",
        label: "Workspace Health",
        description: "Monitor operating signals, risk posture, and next health checks.",
        section: "Configuration",
        icon: "shield-alert",
        order: 88,
        requiredCapabilities: ["business_os.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    seo: {
        key: "seo",
        href: "/dashboard/seo",
        label: "SEO Control Center",
        description: "Audit internal linking, detect content gaps, and manage SEO growth plans with analytics-aware prioritization.",
        section: "Growth",
        icon: "search-check",
        order: 65,
        requiredCapabilities: ["content.read"],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    podcast: {
        key: "podcast",
        href: "/dashboard/podcast",
        label: "Podcast Studio",
        description: "Generate, manage, and publish podcast episodes with reusable music beds.",
        section: "Production",
        icon: "headphones",
        order: 33,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "music-library": {
        key: "music-library",
        href: "/dashboard/music-library",
        label: "Music Library",
        description: "Reusable intros, beds, and outros for podcast episodes.",
        section: "Production",
        icon: "music",
        order: 34,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    voices: {
        key: "voices",
        href: "/dashboard/voices",
        label: "Voice Library",
        description: "Manage cloned and library voices for podcasts.",
        section: "Production",
        icon: "audio-lines",
        order: 35,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    popups: {
        key: "popups",
        href: "/dashboard/popups",
        label: "Popups",
        description: "Run timed and exit-intent popups for newsletter and booking conversions.",
        section: "Growth",
        icon: "megaphone",
        order: 36,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
    "case-snippets": {
        key: "case-snippets",
        href: "/dashboard/case-snippets",
        label: "Case Snippets",
        description: "Curate real client anecdotes the AI blog writer weaves into drafts.",
        section: "Production",
        icon: "book-open",
        order: 37,
        requiredCapabilities: [],
        allowedRoles: ["admin", "manager"],
        enabled: true,
    },
};

const PRO_LOCKED_MODULES = new Set(["generate", "creative-studio", "opportunities", "inbox", "market-monitor", "source-intelligence", "outreach", "external-publishing", "render-queue", "slas", "clients", "customers", "work", "automations", "integrations", "health", "booking", "seo", "newsletter", "podcast", "music-library", "voices", "popups", "case-snippets", "legibility-hub", "commercial-ops"]);

const MODULE_ALIASES: Record<string, string> = {
    "ai-draft-generator": "generate",
    "content-library": "content",
    "site-settings": "settings",
    "workspace-settings": "settings",
    "workspaces": "admin-workspaces",
};

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function asRole(value: unknown): DashboardRole | null {
    if (value === "admin" || value === "manager" || value === "user") {
        return value;
    }

    return null;
}

function normalizeKey(value: string): string {
    const trimmed = value.trim().toLowerCase();
    return MODULE_ALIASES[trimmed] ?? trimmed;
}

function parseThemeModule(raw: unknown): ThemeModuleCandidate | null {
    if (typeof raw === "string" && raw.trim().length > 0) {
        return { key: normalizeKey(raw) };
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
    }

    const source = raw as Record<string, unknown>;
    const keyCandidate =
        typeof source.key === "string"
            ? source.key
            : typeof source.module === "string"
                ? source.module
                : typeof source.id === "string"
                    ? source.id
                    : null;

    if (!keyCandidate) {
        return null;
    }

    const requiredCapabilities = Array.isArray(source.requiredCapabilities)
        ? source.requiredCapabilities.filter((cap): cap is string => typeof cap === "string")
        : Array.isArray(source.capabilities)
            ? source.capabilities.filter((cap): cap is string => typeof cap === "string")
            : undefined;

    const allowedRoles = Array.isArray(source.allowedRoles)
        ? source.allowedRoles
            .map(asRole)
            .filter((role): role is DashboardRole => role !== null)
        : undefined;

    return {
        key: normalizeKey(keyCandidate),
        label: typeof source.label === "string" ? source.label : undefined,
        description: typeof source.description === "string" ? source.description : undefined,
        href: typeof source.href === "string" ? source.href : undefined,
        section: typeof source.section === "string" ? source.section : undefined,
        icon: typeof source.icon === "string" ? source.icon : undefined,
        order: typeof source.order === "number" ? source.order : undefined,
        requiredCapabilities,
        allowedRoles,
        enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    };
}

function parseThemeWidget(raw: unknown): ThemeWidgetCandidate | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return null;
    }

    const source = raw as Record<string, unknown>;
    const keyCandidate =
        typeof source.key === "string"
            ? source.key
            : typeof source.id === "string"
                ? source.id
                : null;

    if (!keyCandidate) {
        return null;
    }

    return {
        key: normalizeKey(keyCandidate),
        title: typeof source.title === "string" ? source.title : undefined,
        description: typeof source.description === "string" ? source.description : undefined,
        icon: typeof source.icon === "string" ? source.icon : undefined,
        href: typeof source.href === "string" ? source.href : undefined,
        order: typeof source.order === "number" ? source.order : undefined,
        enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    };
}

function includeDefaultModuleCandidates(candidates: ThemeModuleCandidate[]) {
    // Themes and workspace manifests can predate newer universal apps.
    // Evaluate every default module so additions cannot silently disappear.
    // Explicit entries still win — including `enabled: false` — because
    // existing candidates are never replaced.
    const configuredKeys = new Set(candidates.map((candidate) => candidate.key));
    for (const key of Object.keys(DEFAULT_MODULES)) {
        if (!configuredKeys.has(key)) {
            candidates.push({ key });
        }
    }

    return candidates;
}

function resolveModuleAccess(
    module: DashboardModule,
    role: DashboardRole,
    capabilitySet: Set<string>,
    workspaceTier: "basic" | "pro",
) {
    if (!module.allowedRoles.includes(role)) {
        return { visible: false, enabled: false, lockedReason: "role" as const };
    }

    if (workspaceTier === "basic" && PRO_LOCKED_MODULES.has(module.key)) {
        return { visible: true, enabled: false, lockedReason: "pro" as const };
    }

    if (role === "admin") {
        return { visible: true, enabled: true };
    }

    const allowedByCapabilities = module.requiredCapabilities.every((capability) => capabilitySet.has(capability));

    if (!allowedByCapabilities) {
        return { visible: false, enabled: false, lockedReason: "capability" as const };
    }

    return { visible: true, enabled: true };
}

function resolveThemeModuleCandidates(
    themeConfig: Record<string, unknown>,
    fallbackModules: string[],
): ThemeModuleCandidate[] {
    const dashboardConfig = asRecord(themeConfig.dashboard);

    const dashboardModules = Array.isArray(dashboardConfig.modules)
        ? dashboardConfig.modules
        : Array.isArray(themeConfig.modules)
            ? themeConfig.modules
            : null;

    if (dashboardModules && dashboardModules.length > 0) {
        const candidates = dashboardModules.map(parseThemeModule).filter((entry): entry is ThemeModuleCandidate => Boolean(entry));
        return includeDefaultModuleCandidates(candidates);
    }

    if (fallbackModules.length === 0) {
        return Object.keys(DEFAULT_MODULES).map((key) => ({ key }));
    }

    return includeDefaultModuleCandidates(
        fallbackModules.map((moduleKey) => ({ key: normalizeKey(moduleKey) })),
    );
}

function resolveModules(
    role: DashboardRole,
    capabilities: string[],
    fallbackModules: string[],
    themeConfig: Record<string, unknown>,
    workspaceTier: "basic" | "pro",
): DashboardModule[] {
    const candidates = resolveThemeModuleCandidates(themeConfig, fallbackModules);
    const capabilitySet = new Set(capabilities);

    const modules = candidates
        .filter((candidate) => candidate.enabled !== false)
        .map((candidate) => {
            const defaultModule = DEFAULT_MODULES[candidate.key];

            if (!defaultModule && !candidate.href) {
                return null;
            }

            const merged: DashboardModule = {
                key: candidate.key,
                href: candidate.href ?? defaultModule?.href ?? `/dashboard/${candidate.key}`,
                label: candidate.label ?? defaultModule?.label ?? candidate.key,
                description:
                    candidate.description ?? defaultModule?.description ?? "Workspace module",
                section: candidate.section ?? defaultModule?.section ?? "Workspace",
                icon: candidate.icon ?? defaultModule?.icon ?? "layout-grid",
                order: candidate.order ?? defaultModule?.order ?? 100,
                requiredCapabilities: candidate.requiredCapabilities ?? defaultModule?.requiredCapabilities ?? [],
                allowedRoles: candidate.allowedRoles ?? defaultModule?.allowedRoles ?? ["admin"],
                enabled: true,
            };

            const access = resolveModuleAccess(merged, role, capabilitySet, workspaceTier);

            if (!access.visible) {
                return null;
            }

            return {
                ...merged,
                enabled: access.enabled,
                lockedReason: access.lockedReason,
                badge: access.lockedReason === "pro" ? "PRO" : undefined,
            };
        })
        .filter((entry) => Boolean(entry)) as DashboardModule[];

    const deduped = new Map<string, DashboardModule>();
    for (const moduleEntry of modules) {
        deduped.set(moduleEntry.key, moduleEntry);
    }

    return Array.from(deduped.values()).sort((a, b) => a.order - b.order);
}

function resolveSections(modules: DashboardModule[]): DashboardSection[] {
    const sectionMap = new Map<string, DashboardModule[]>();

    for (const moduleEntry of modules) {
        const existing = sectionMap.get(moduleEntry.section) ?? [];
        existing.push(moduleEntry);
        sectionMap.set(moduleEntry.section, existing);
    }

    return Array.from(sectionMap.entries()).map(([section, sectionModules]) => ({
        section,
        modules: sectionModules.sort((a, b) => a.order - b.order),
    }));
}

function translate(dict: Dictionary, key: string, fallback: string) {
    const value = dict[key];
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function resolveSectionLabel(section: string, dict: Dictionary) {
    const normalized = section.trim().toLowerCase();
    const key = `dashboard.sections.${normalized.replace(/\s+/g, "-")}`;
    return translate(dict, key, section);
}

function localizeModules(modules: DashboardModule[], dict: Dictionary): DashboardModule[] {
    return modules.map((moduleEntry) => ({
        ...moduleEntry,
        label: translate(dict, `dashboard.modules.${moduleEntry.key}.label`, moduleEntry.label),
        description: translate(dict, `dashboard.modules.${moduleEntry.key}.description`, moduleEntry.description),
        section: resolveSectionLabel(moduleEntry.section, dict),
    }));
}

function resolveWidgets(modules: DashboardModule[], themeConfig: Record<string, unknown>): DashboardWidget[] {
    const dashboardConfig = asRecord(themeConfig.dashboard);
    const rawWidgets = Array.isArray(dashboardConfig.widgets) ? dashboardConfig.widgets : [];

    const themedWidgets = rawWidgets
        .map(parseThemeWidget)
        .filter((entry): entry is ThemeWidgetCandidate => Boolean(entry))
        .filter((entry) => entry.enabled !== false)
        .map((entry) => {
            const moduleEntry = modules.find((item) => item.key === entry.key);

            return {
                key: entry.key,
                title: entry.title ?? moduleEntry?.label ?? "Workspace Widget",
                description: entry.description ?? moduleEntry?.description ?? "Workspace insight",
                icon: entry.icon ?? moduleEntry?.icon ?? "layout-grid",
                href: entry.href ?? moduleEntry?.href,
                order: entry.order ?? moduleEntry?.order ?? 100,
            } satisfies DashboardWidget;
        });

    if (themedWidgets.length > 0) {
        return themedWidgets.sort((a, b) => a.order - b.order);
    }

    return modules.slice(0, 4).map((moduleEntry) => ({
        key: moduleEntry.key,
        title: moduleEntry.label,
        description: moduleEntry.description,
        icon: moduleEntry.icon,
        href: moduleEntry.href,
        order: moduleEntry.order,
    }));
}

function resolveQuickActions(
    modules: DashboardModule[],
    themeConfig: Record<string, unknown>,
    fallbackWidgets: DashboardWidget[],
): DashboardWidget[] {
    const dashboardConfig = asRecord(themeConfig.dashboard);
    const rawQuickActions = Array.isArray(dashboardConfig.quick_actions)
        ? dashboardConfig.quick_actions
        : Array.isArray(dashboardConfig.quickActions)
            ? dashboardConfig.quickActions
            : [];

    const themedQuickActions = rawQuickActions
        .map(parseThemeWidget)
        .filter((entry): entry is ThemeWidgetCandidate => Boolean(entry))
        .filter((entry) => entry.enabled !== false)
        .map((entry) => {
            const moduleEntry = modules.find((item) => item.key === entry.key);

            return {
                key: entry.key,
                title: entry.title ?? moduleEntry?.label ?? "Workspace Action",
                description: entry.description ?? moduleEntry?.description ?? "Workspace action",
                icon: entry.icon ?? moduleEntry?.icon ?? "layout-grid",
                href: entry.href ?? moduleEntry?.href,
                order: entry.order ?? moduleEntry?.order ?? 100,
            } satisfies DashboardWidget;
        });

    if (themedQuickActions.length > 0) {
        return themedQuickActions.sort((a, b) => a.order - b.order);
    }

    return fallbackWidgets;
}

export async function getAdminDashboardState(): Promise<AdminDashboardState | null> {
    const manifest = await getWorkspaceThemeManifest();

    if (manifest.error || !manifest.data) {
        return null;
    }

    const role = manifest.data.role;
    if (role !== "admin" && role !== "manager" && role !== "user") {
        return null;
    }

    const context = await resolveWorkspaceContext({ workspaceId: manifest.data.workspace.id });
    const themeConfig = asRecord(context?.activeThemeVersion?.config ?? {});
    const locale = context?.activeWorkspace?.default_locale ?? "en";
    const dictionary = await getDictionary(locale);

    const modules = localizeModules(applyClientModuleOverrides(resolveModules(
        role,
        manifest.data.capabilities,
        manifest.data.modules,
        themeConfig,
        manifest.data.workspace.workspaceTier,
    ), extractPublicRuntimeConfig(context?.activeWorkspace?.metadata).modules), dictionary);

    const widgets = resolveWidgets(modules, themeConfig);
    const quickActions = resolveQuickActions(modules, themeConfig, widgets);

    return {
        role,
        locale: (locale === "nl" ? "nl" : "en") as "en" | "nl",
        workspace: {
            id: manifest.data.workspace.id,
            name: manifest.data.workspace.name,
            slug: manifest.data.workspace.slug,
            compute_credits: context?.activeWorkspace?.compute_credits ?? 0,
            workspace_tier: context?.activeWorkspace?.workspace_tier ?? "pro",
            wallpaper_url: context?.activeWorkspace?.wallpaper_url ?? null,
        },
        accessibleWorkspaces: (context?.accessibleWorkspaces ?? []).map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
        })),
        theme: manifest.data.theme
            ? {
                id: manifest.data.theme.id,
                themeKey: manifest.data.theme.themeKey,
                themeName: manifest.data.theme.themeName,
                version: manifest.data.theme.version,
                status: manifest.data.theme.status,
            }
            : null,
        capabilities: manifest.data.capabilities,
        modules,
        sections: resolveSections(modules),
        widgets,
        quickActions,
        themeConfig,
        dictionary,
    };
}

export function canAccessDashboardModule(state: AdminDashboardState, moduleKey: string) {
    return state.modules.some((module) => module.key === moduleKey && module.enabled);
}

export function hasDashboardCapability(state: AdminDashboardState, capability: string) {
    return state.capabilities.includes(capability);
}
