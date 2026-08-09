import { getSettings } from "@/features/admin/actions/settings";
import {
    getManagerProfilesForWorkspace,
    getWorkspaceManagerAssignments,
} from "@/features/admin/actions/workspace-managers";
import { getWorkspaceThemeVersions } from "@/features/admin/actions/workspace-theme";
import { canAccessDashboardModule } from "@/features/admin/lib/dashboard-state";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { SettingsForm } from "@/features/admin/ui/settings-form";
import { getWorkspaceAiBalanceSummary, listWorkspaceAiCreditLedger } from "@/features/admin/actions/ai-balance";
import { loadMarketMonitorDashboard } from "@/features/market-monitor/actions";
import { MIN_BALANCE_FLOOR_MILLICENTS } from "@/shared/lib/ai/pricing";
import { getGdprSettings, listGdprRequests } from "@/features/gdpr/actions";
import type { GdprRequestStatus, GdprRequestType } from "@/features/gdpr/types";
import { loadOnboardingMembershipStatus } from "@/features/admin/lib/onboarding";
import { createClient } from "@/shared/lib/supabase/server";

const ALLOWED_STATUSES: GdprRequestStatus[] = ["open", "in_progress", "completed", "rejected"];
const ALLOWED_TYPES: GdprRequestType[] = [
    "access",
    "export",
    "portability",
    "rectification",
    "restriction",
    "deletion",
];

function parseList(v: string | string[] | undefined): string[] {
    if (!v) return [];
    const raw = Array.isArray(v) ? v.join(",") : v;
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
}
function parseInt10(v: string | string[] | undefined, fallback: number): number {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

interface SettingsPageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
    const dashboardState = await requireDashboardModuleAccess("settings");
    const { data: settings } = await getSettings();
    const canAccessMarketMonitor = canAccessDashboardModule(dashboardState, "market-monitor");

    const initialSettings = settings ?? {
        active_template: "personal-brand",
        locale: "en",
        workspace_default_locale: "en",
        site_name: "",
        site_description: "",
        site_description_i18n: {},
        legal_pages_i18n: {},
        site_chrome: null,
        newsletter_settings: null,
    };

    const workspaceId = dashboardState.workspace.id;
    const canManageTheme = dashboardState.role === "admin" && dashboardState.capabilities.includes("theme.manage");
    const canManageManagers = dashboardState.role === "admin";

    const params = await searchParams;
    const gdprStatuses = parseList(params.gdprStatus).filter((s): s is GdprRequestStatus =>
        (ALLOWED_STATUSES as readonly string[]).includes(s),
    );
    const gdprTypes = parseList(params.gdprType).filter((t): t is GdprRequestType =>
        (ALLOWED_TYPES as readonly string[]).includes(t),
    );
    const gdprSearch = Array.isArray(params.gdprSearch) ? params.gdprSearch[0] : params.gdprSearch;
    const gdprPage = Math.max(1, parseInt10(params.gdprPage, 1));
    const gdprPageSize = Math.min(100, Math.max(5, parseInt10(params.gdprPageSize, 20)));

    const [
        { data: themeVersions },
        { data: assignments },
        { data: managerProfiles },
        balanceSummary,
        ledgerResult,
        monitorData,
        gdprSettingsResult,
        gdprRequestsResult,
    ] = await Promise.all([
        canManageTheme ? getWorkspaceThemeVersions(workspaceId) : Promise.resolve({ data: null, error: null }),
        canManageManagers
            ? getWorkspaceManagerAssignments(workspaceId)
            : Promise.resolve({ data: null, error: null }),
        canManageManagers
            ? getManagerProfilesForWorkspace(workspaceId)
            : Promise.resolve({ data: null, error: null }),
        getWorkspaceAiBalanceSummary(),
        listWorkspaceAiCreditLedger(20),
        canAccessMarketMonitor
            ? loadMarketMonitorDashboard()
            : Promise.resolve({ workspaceId, config: null, results: [], error: null }),
        getGdprSettings(),
        listGdprRequests({
            statuses: gdprStatuses,
            types: gdprTypes,
            search: gdprSearch,
            page: gdprPage,
            pageSize: gdprPageSize,
        }),
    ]);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const onboardingStatus = user
        ? await loadOnboardingMembershipStatus(workspaceId, user.id)
        : null;

    return (
        <SettingsForm
            initialSettings={initialSettings}
            workspace={dashboardState.workspace}
            role={dashboardState.role}
            capabilities={dashboardState.capabilities}
            activeTheme={dashboardState.theme}
            themeVersions={themeVersions ?? []}
            managerAssignments={assignments ?? []}
            managerProfiles={managerProfiles ?? []}
            accessibleWorkspaces={dashboardState.accessibleWorkspaces}
            aiCredits={{
                balanceMillicents: balanceSummary.data?.balanceMillicents ?? 0,
                floorMillicents: balanceSummary.data?.floorMillicents ?? MIN_BALANCE_FLOOR_MILLICENTS,
                ledger: ledgerResult.data ?? [],
            }}
            canAccessMarketMonitor={canAccessMarketMonitor}
            marketMonitorConfig={monitorData.config}
            gdpr={{
                settings: gdprSettingsResult.data ?? {
                    workspace_id: workspaceId,
                    dpo_name: null,
                    dpo_email: null,
                    privacy_policy_url: null,
                    terms_url: null,
                    processing_legal_basis: "legitimate_interest",
                    analytics_retention_days: 365,
                    logs_retention_days: 90,
                    marketing_retention_days: 730,
                    sub_processors: [],
                    data_regions: ["EU"],
                    consent_required: true,
                    cookie_consent_mode: "banner",
                    notes: null,
                    updated_at: new Date(0).toISOString(),
                    created_at: new Date(0).toISOString(),
                },
                requests: gdprRequestsResult.data,
                totalRequests: gdprRequestsResult.total,
                page: gdprRequestsResult.page,
                pageSize: gdprRequestsResult.pageSize,
                statuses: gdprStatuses,
                types: gdprTypes,
                search: gdprSearch ?? "",
                statusCounts: gdprRequestsResult.statusCounts,
            }}
            onboarding={{
                completedAt: onboardingStatus?.completedAt ?? null,
                skippedAt: onboardingStatus?.skippedAt ?? null,
            }}
        />
    );
}
