"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type { SiteChromeConfig } from "@/features/site-chrome/schema";
import type { MarketMonitorConfig } from "@/features/market-monitor/types";
import type { AiCreditLedgerEntry } from "@/features/admin/actions/ai-balance";
import {
    Loader2,
    Save,
    Palette,
    Check,
    Layers,
    TrendingUp,
    Users,
    Zap,
    ShieldCheck,
    Monitor,
    Sparkles,
} from "lucide-react";
import { updateSettings } from "@/features/admin/actions/settings";
import {
    assignManagerToWorkspace,
    reassignManagerToWorkspace,
    revokeManagerAssignment,
} from "@/features/admin/actions/workspace-managers";
import { setActiveWorkspace } from "@/features/admin/actions/workspaces";
import { setActiveWorkspaceThemeVersion } from "@/features/admin/actions/workspace-theme";
import type { TemplateId, Locale } from "@/features/templates/types";
import type { DashboardRole } from "@/features/admin/lib/dashboard-state";
import { SiteChromePreview } from "@/features/site-chrome/ui/site-chrome-editor";
import { inviteManager } from "@/features/admin/actions/workspace-managers";
import { buildDefaultNewsletterSettings, type NewsletterSettingsInput } from "@/features/newsletter/schema";

import { GeneralTab } from "@/app/(admin)/dashboard/settings/components/general-tab";
import { ThemeTab } from "@/app/(admin)/dashboard/settings/components/theme-tab";
import { ManagersTab } from "@/app/(admin)/dashboard/settings/components/managers-tab";
import { AuthorsTab } from "@/app/(admin)/dashboard/settings/components/authors-tab";
import { AiCreditsTab } from "@/app/(admin)/dashboard/settings/components/ai-credits-tab";
import { MarketMonitorTab } from "@/app/(admin)/dashboard/settings/components/market-monitor-tab";
import { NewsletterTab } from "@/app/(admin)/dashboard/settings/components/newsletter-tab";
import { GdprTab } from "@/app/(admin)/dashboard/settings/components/gdpr-tab";
import { DesktopTab } from "@/app/(admin)/dashboard/settings/components/desktop-tab";
import { OnboardingTab } from "@/features/admin/ui/onboarding/onboarding-tab";
import { AppCommandBar, DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import type {
    GdprRequestStatus,
    GdprRequestType,
    WorkspaceGdprRequest,
    WorkspaceGdprSettings,
} from "@/features/gdpr/types";

interface SettingsFormProps {
    initialSettings: {
        active_template: string;
        locale: string;
        workspace_default_locale: string;
        site_name: string;
        site_description: string;
        site_description_i18n?: { en?: string; nl?: string; ar?: string };
        legal_pages_i18n?: {
            privacy?: { en?: string; nl?: string; ar?: string };
            terms?: { en?: string; nl?: string; ar?: string };
        };
        site_chrome: SiteChromeConfig | null;
        newsletter_settings: NewsletterSettingsInput | null;
    };
    workspace: {
        id: string;
        name: string;
        slug: string;
        wallpaper_url?: string | null;
    };
    role: DashboardRole;
    capabilities: string[];
    activeTheme: {
        id: string;
        themeKey: string;
        themeName: string;
        version: string;
        status: string;
    } | null;
    themeVersions: Array<{
        id: string;
        themeId: string;
        version: string;
        status: string;
        isDefault: boolean;
        releasedAt: string | null;
        themeKey: string;
        themeName: string;
        config: unknown;
    }>;
    managerAssignments: Array<{
        id: string;
        manager_profile_id: string;
        workspace_id: string;
        is_active: boolean;
        starts_at: string;
        ends_at: string | null;
        manager?: { email?: string | null } | { email?: string | null }[];
    }>;
    managerProfiles: Array<{
        id: string;
        email: string | null;
        role: string | null;
    }>;
    accessibleWorkspaces: Array<{
        id: string;
        name: string;
        slug: string;
    }>;
    aiCredits: {
        balanceMillicents: number;
        floorMillicents: number;
        ledger: AiCreditLedgerEntry[];
    };
    canAccessMarketMonitor: boolean;
    marketMonitorConfig: MarketMonitorConfig | null;
    gdpr: {
        settings: WorkspaceGdprSettings;
        requests: WorkspaceGdprRequest[];
        totalRequests: number;
        page: number;
        pageSize: number;
        statuses: GdprRequestStatus[];
        types: GdprRequestType[];
        search: string;
        statusCounts: Record<GdprRequestStatus, number>;
    };
    onboarding: {
        completedAt: string | null;
        skippedAt: string | null;
    };
}

type TabKey = "general" | "desktop" | "theme" | "managers" | "authors" | "ai-credits" | "market-monitor" | "newsletter" | "gdpr" | "onboarding";

const SECTION_TO_TAB: Record<string, TabKey> = {
    general: "general",
    desktop: "desktop",
    theme: "theme",
    managers: "managers",
    authors: "authors",
    "ai-credits": "ai-credits",
    "market-monitor": "market-monitor",
    newsletter: "newsletter",
    gdpr: "gdpr",
    onboarding: "onboarding",
};

export function SettingsForm({
    initialSettings,
    workspace,
    role,
    capabilities,
    activeTheme,
    themeVersions,
    managerAssignments,
    managerProfiles,
    accessibleWorkspaces,
    aiCredits,
    canAccessMarketMonitor,
    marketMonitorConfig,
    gdpr,
    onboarding,
}: SettingsFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        const section = searchParams?.get("section");
        if (section && SECTION_TO_TAB[section]) return SECTION_TO_TAB[section];
        return "general";
    });

    // Respond to section changes triggered by navigation elsewhere in the app
    // (e.g. the inbox "Top up credits" CTA linking to ?section=ai-credits).
    useEffect(() => {
        const section = searchParams?.get("section");
        if (section && SECTION_TO_TAB[section] && SECTION_TO_TAB[section] !== activeTab) {
            setActiveTab(SECTION_TO_TAB[section]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Transitions
    const [isPending, startTransition] = useTransition();
    const [isThemePending, startThemeTransition] = useTransition();
    const [isManagerPending, startManagerTransition] = useTransition();

    // General State
    const [activeTemplate, setActiveTemplate] = useState(initialSettings.active_template);
    const [locale, setLocale] = useState(initialSettings.locale);
    const [workspaceDefaultLocale, setWorkspaceDefaultLocale] = useState(initialSettings.workspace_default_locale);
    const [siteName, setSiteName] = useState(initialSettings.site_name);
    const [siteDescription, setSiteDescription] = useState(initialSettings.site_description);
    const [siteDescriptionNl, setSiteDescriptionNl] = useState(initialSettings.site_description_i18n?.nl ?? "");
    const [siteDescriptionAr, setSiteDescriptionAr] = useState(initialSettings.site_description_i18n?.ar ?? "");
    const [legalPrivacyEn, setLegalPrivacyEn] = useState(initialSettings.legal_pages_i18n?.privacy?.en ?? "");
    const [legalPrivacyNl, setLegalPrivacyNl] = useState(initialSettings.legal_pages_i18n?.privacy?.nl ?? "");
    const [legalPrivacyAr, setLegalPrivacyAr] = useState(initialSettings.legal_pages_i18n?.privacy?.ar ?? "");
    const [legalTermsEn, setLegalTermsEn] = useState(initialSettings.legal_pages_i18n?.terms?.en ?? "");
    const [legalTermsNl, setLegalTermsNl] = useState(initialSettings.legal_pages_i18n?.terms?.nl ?? "");
    const [legalTermsAr, setLegalTermsAr] = useState(initialSettings.legal_pages_i18n?.terms?.ar ?? "");
    const [siteChrome, setSiteChrome] = useState<SiteChromeConfig>(initialSettings.site_chrome as SiteChromeConfig);
    const [newsletterSettings, setNewsletterSettings] = useState<NewsletterSettingsInput>(
        initialSettings.newsletter_settings ?? buildDefaultNewsletterSettings(workspace.name)
    );
    const [nextWorkspaceId, setNextWorkspaceId] = useState(workspace.id);

    // Theme State
    const [nextThemeVersionId, setNextThemeVersionId] = useState(activeTheme?.id ?? "");

    // Manager State
    const [selectedManagerId, setSelectedManagerId] = useState(managerProfiles[0]?.id ?? "");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [invitePassword, setInvitePassword] = useState("");
    const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});

    // Status State
    const [error, setError] = useState<string | null>(null);
    const [workspaceError, setWorkspaceError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const canManageTheme = role === "admin" && capabilities.includes("theme.manage");
    const canManageManagers = role === "admin";
    const settingsTabs = [
        { key: "general" as const, label: "General", icon: Palette },
        { key: "desktop" as const, label: "Desktop", icon: Monitor },
        { key: "theme" as const, label: "Theme Runtime", icon: Layers },
        { key: "managers" as const, label: "Managers", icon: Users },
        { key: "authors" as const, label: "Authors", icon: Users },
        { key: "ai-credits" as const, label: "AI Credits", icon: Zap },
        { key: "newsletter" as const, label: "Newsletter", icon: Zap },
        ...(canAccessMarketMonitor ? [{ key: "market-monitor" as const, label: "Market Monitor", icon: TrendingUp }] : []),
        { key: "gdpr" as const, label: "GDPR", icon: ShieldCheck },
        { key: "onboarding" as const, label: "Onboarding", icon: Sparkles },
    ];

    // Callbacks
    const handleWorkspaceSwitch = () => {
        if (!nextWorkspaceId || nextWorkspaceId === workspace.id) return;
        setWorkspaceError(null);
        startTransition(async () => {
            const result = await setActiveWorkspace(nextWorkspaceId);
            if (result.error) return setWorkspaceError(result.error);
            router.refresh();
        });
    };

    const handleSave = () => {
        setError(null);
        setSuccess(false);

        startTransition(async () => {
            const result = await updateSettings({
                active_template: activeTemplate as TemplateId,
                locale: locale as Locale,
                workspace_default_locale: workspaceDefaultLocale as Locale,
                site_name: siteName,
                site_description: siteDescription,
                site_description_i18n: {
                    nl: siteDescriptionNl,
                    ar: siteDescriptionAr,
                },
                legal_pages_i18n: {
                    privacy: { en: legalPrivacyEn, nl: legalPrivacyNl, ar: legalPrivacyAr },
                    terms: { en: legalTermsEn, nl: legalTermsNl, ar: legalTermsAr },
                },
                site_chrome: siteChrome,
                newsletter_settings: newsletterSettings,
            });
            if (result.error) return setError(result.error);
            setSuccess(true);
            router.refresh();
            setTimeout(() => setSuccess(false), 3000);
        });
    };

    const handleThemeUpdate = () => {
        if (!nextThemeVersionId) return setWorkspaceError("Select a theme version before applying.");
        setWorkspaceError(null);
        startThemeTransition(async () => {
            const result = await setActiveWorkspaceThemeVersion({
                workspaceId: workspace.id,
                themeVersionId: nextThemeVersionId,
            });
            if (result.error) return setWorkspaceError(result.error);
            router.refresh();
        });
    };

    const handleAssignManager = () => {
        if (!selectedManagerId) return setWorkspaceError("Select a manager profile first.");
        setWorkspaceError(null);
        startManagerTransition(async () => {
            const result = await assignManagerToWorkspace({
                workspaceId: workspace.id,
                managerProfileId: selectedManagerId,
            });
            if (result.error) return setWorkspaceError(result.error);
            router.refresh();
        });
    };

    const handleInviteManager = () => {
        if (!inviteEmail || !inviteName) {
            setWorkspaceError("Email and full name are required to invite a manager.");
            return;
        }

        setWorkspaceError(null);
        startManagerTransition(async () => {
            const result = await inviteManager({
                email: inviteEmail,
                fullName: inviteName,
                password: invitePassword || undefined,
                workspaceId: workspace.id,
            });

            if (result.error) {
                setWorkspaceError(result.error);
                return;
            }

            setInviteEmail("");
            setInviteName("");
            setInvitePassword("");
            router.refresh();
        });
    };

    const handleReassign = (assignmentId: string, managerProfileId: string) => {
        const targetWorkspaceId = reassignTargets[assignmentId];
        if (!targetWorkspaceId) return setWorkspaceError("Select a target workspace before reassigning.");
        setWorkspaceError(null);
        startManagerTransition(async () => {
            const result = await reassignManagerToWorkspace({
                managerProfileId,
                toWorkspaceId: targetWorkspaceId,
            });
            if (result.error) return setWorkspaceError(result.error);
            router.refresh();
        });
    };

    const handleRevoke = (assignmentId: string) => {
        setWorkspaceError(null);
        startManagerTransition(async () => {
            const result = await revokeManagerAssignment({
                assignmentId,
                workspaceId: workspace.id,
            });
            if (result.error) return setWorkspaceError(result.error);
            router.refresh();
        });
    };

    return (
        <DashboardAppWorkbench className="animate-in fade-in duration-500">
            <AppCommandBar
                leading={
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                            <Palette className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[17px] font-semibold text-foreground">Site Settings</p>
                            <p className="truncate text-[15px] text-muted-foreground">
                                {workspace.name} · styling, access, credits, and governance
                            </p>
                        </div>
                    </div>
                }
                actions={
                    <Button onClick={handleSave} disabled={isPending} className="w-full transition-all active:scale-95 sm:w-auto sm:min-w-[140px]">
                    {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Settings
                    </Button>
                }
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                <aside className="shrink-0 border-b border-border/60 bg-card/45 p-2 lg:w-64 lg:border-b-0 lg:border-r lg:p-3">
                    <div className="flex snap-x gap-1 overflow-x-auto overscroll-x-contain pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                        {settingsTabs.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveTab(key)}
                                className={cn(
                                    "flex min-w-fit snap-start items-center gap-2 rounded-md px-3 py-2 text-left text-[14px] font-medium transition-colors lg:w-full lg:text-[15px]",
                                    activeTab === key
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                )}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{label}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(env(safe-area-inset-bottom),1rem)] sm:p-4">
                    <div className="mb-4 space-y-2">
                        {error && (
                            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-[15px] font-medium text-destructive animate-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-[15px] font-medium text-emerald-600 animate-in slide-in-from-top-2 dark:text-emerald-300">
                                <Check className="h-4 w-4" />
                                Settings saved successfully!
                            </div>
                        )}
                        {workspaceError && (
                            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-[15px] font-medium text-destructive animate-in slide-in-from-top-2">
                                {workspaceError}
                            </div>
                        )}
                    </div>
                    <div className="relative min-h-[400px]">
                {activeTab === "general" && (
                    <GeneralTab
                        workspace={workspace}
                        role={role}
                        accessibleWorkspaces={accessibleWorkspaces}
                        nextWorkspaceId={nextWorkspaceId}
                        setNextWorkspaceId={setNextWorkspaceId}
                        handleWorkspaceSwitch={handleWorkspaceSwitch}
                        canManageManagers={canManageManagers}
                        isPending={isPending}
                        activeTemplate={activeTemplate}
                        setActiveTemplate={setActiveTemplate}
                        workspaceDefaultLocale={workspaceDefaultLocale}
                        setWorkspaceDefaultLocale={setWorkspaceDefaultLocale}
                        locale={locale}
                        setLocale={setLocale}
                        siteName={siteName}
                        setSiteName={setSiteName}
                        siteDescription={siteDescription}
                        setSiteDescription={setSiteDescription}
                        siteDescriptionNl={siteDescriptionNl}
                        setSiteDescriptionNl={setSiteDescriptionNl}
                        siteDescriptionAr={siteDescriptionAr}
                        setSiteDescriptionAr={setSiteDescriptionAr}
                        legalPrivacyEn={legalPrivacyEn}
                        setLegalPrivacyEn={setLegalPrivacyEn}
                        legalPrivacyNl={legalPrivacyNl}
                        setLegalPrivacyNl={setLegalPrivacyNl}
                        legalPrivacyAr={legalPrivacyAr}
                        setLegalPrivacyAr={setLegalPrivacyAr}
                        legalTermsEn={legalTermsEn}
                        setLegalTermsEn={setLegalTermsEn}
                        legalTermsNl={legalTermsNl}
                        setLegalTermsNl={setLegalTermsNl}
                        legalTermsAr={legalTermsAr}
                        setLegalTermsAr={setLegalTermsAr}
                        siteChrome={siteChrome}
                        setSiteChrome={setSiteChrome}
                        siteChromePreview={<SiteChromePreview value={siteChrome} locale={locale as Locale} />}
                    />
                )}

                {activeTab === "desktop" && (
                    <DesktopTab
                        currentWallpaperUrl={workspace.wallpaper_url ?? null}
                        canManage={role === "admin"}
                    />
                )}

                {activeTab === "theme" && (
                    <ThemeTab
                        activeTheme={activeTheme}
                        capabilities={capabilities}
                        themeVersions={themeVersions}
                        canManageTheme={canManageTheme}
                        nextThemeVersionId={nextThemeVersionId}
                        setNextThemeVersionId={setNextThemeVersionId}
                        isThemePending={isThemePending}
                        handleThemeUpdate={handleThemeUpdate}
                    />
                )}

                {activeTab === "authors" && <AuthorsTab />}

                {activeTab === "managers" && (
                    <ManagersTab
                        canManageManagers={canManageManagers}
                        managerProfiles={managerProfiles}
                        managerAssignments={managerAssignments}
                        accessibleWorkspaces={accessibleWorkspaces}
                        selectedManagerId={selectedManagerId}
                        setSelectedManagerId={setSelectedManagerId}
                        inviteEmail={inviteEmail}
                        setInviteEmail={setInviteEmail}
                        inviteName={inviteName}
                        setInviteName={setInviteName}
                        invitePassword={invitePassword}
                        setInvitePassword={setInvitePassword}
                        isManagerPending={isManagerPending}
                        handleInviteManager={handleInviteManager}
                        handleAssignManager={handleAssignManager}
                        handleRevoke={handleRevoke}
                        reassignTargets={reassignTargets}
                        setReassignTargets={setReassignTargets}
                        handleReassign={handleReassign}
                        locale={locale}
                    />
                )}

                {activeTab === "ai-credits" && (
                    <AiCreditsTab
                        workspace={workspace}
                        role={role}
                        balanceMillicents={aiCredits.balanceMillicents}
                        floorMillicents={aiCredits.floorMillicents}
                        ledger={aiCredits.ledger}
                    />
                )}

                {activeTab === "newsletter" && (
                    <NewsletterTab
                        newsletterSettings={newsletterSettings}
                        setNewsletterSettings={setNewsletterSettings}
                    />
                )}

                {canAccessMarketMonitor && activeTab === "market-monitor" && (
                    <MarketMonitorTab config={marketMonitorConfig} />
                )}

                {activeTab === "gdpr" && (
                    <GdprTab
                        initialSettings={gdpr.settings}
                        requests={gdpr.requests}
                        totalRequests={gdpr.totalRequests}
                        page={gdpr.page}
                        pageSize={gdpr.pageSize}
                        statuses={gdpr.statuses}
                        types={gdpr.types}
                        search={gdpr.search}
                        statusCounts={gdpr.statusCounts}
                    />
                )}

                {activeTab === "onboarding" && (
                    <OnboardingTab
                        workspaceId={workspace.id}
                        workspaceName={workspace.name}
                        completedAt={onboarding.completedAt}
                        skippedAt={onboarding.skippedAt}
                    />
                )}
                    </div>
                </main>
            </div>
        </DashboardAppWorkbench>
    );
}
