import { createClient } from "@/shared/lib/supabase/server";
import type { AdminDashboardState, DashboardModule } from "@/features/admin/lib/dashboard-state";

export const ONBOARDING_STATE_VERSION = 1;
export const WELCOME_STEP_KEY = "welcome";
export const FINISH_STEP_KEY = "finish";

export interface OnboardingState {
    version: number;
    currentStep: number;
    completedSteps: string[];
    coachMarksSeen: string[];
}

export interface OnboardingMembershipStatus {
    /** Active membership exists for this (workspace, profile). False means no row to track against. */
    hasMembership: boolean;
    completedAt: string | null;
    skippedAt: string | null;
    state: OnboardingState;
}

export interface OnboardingStepCopy {
    headline: string;
    body: string;
    primaryCta?: string;
    deepLink?: string;
}

const FEATURE_COPY: Record<string, OnboardingStepCopy> = {
    opportunities: {
        headline: "AI Opportunity Engine",
        body: "Scans SEO, content, and conversion signals to surface the next 10–20% improvement worth shipping. Use it weekly to keep the backlog honest.",
        primaryCta: "Open the engine",
    },
    "market-monitor": {
        headline: "Market Monitor",
        body: "Tracks competitors, authority sources, and industry keyword movement. Configure your watchlist once and review the weekly digest.",
        primaryCta: "Open Market Monitor",
    },
    generate: {
        headline: "AI Draft Generator",
        body: "Long-form drafts with guided prompts. Pick a topic, language, and tone — the orchestrator handles research, structure, and assets.",
        primaryCta: "Generate a draft",
    },
    "creative-studio": {
        headline: "Creative Studio",
        body: "Govern creative briefs, strategy placeholders, prompt manifests, queue visibility, assets, and audit trails before any rendering backend is allowed to run.",
        primaryCta: "Open Creative Studio",
    },
    content: {
        headline: "Content Library",
        body: "Every draft and published post for this workspace lives here. Filter by status, locale, author, or campaign.",
        primaryCta: "Open Content Library",
    },
    builder: {
        headline: "Page Builder",
        body: "Compose premium pages with constrained design-system blocks. Edits are workspace-scoped and respect your live theme.",
        primaryCta: "Open Page Builder",
    },
    "manual-posts": {
        headline: "Manual Blog Library",
        body: "A focused view of manually-authored posts inside the unified content library — useful when an editor wants to bypass AI generation.",
        primaryCta: "Open Manual Library",
    },
    podcast: {
        headline: "Podcast Studio",
        body: "Generate, manage, and publish podcast episodes with reusable music beds and TTS voices.",
        primaryCta: "Open Podcast Studio",
    },
    "music-library": {
        headline: "Music Library",
        body: "Reusable intros, beds, and outros for podcast episodes. Upload once, attach anywhere.",
        primaryCta: "Open Music Library",
    },
    voices: {
        headline: "Voice Library",
        body: "Manage cloned and library voices used by the podcast and TTS pipelines.",
        primaryCta: "Open Voice Library",
    },
    popups: {
        headline: "Popups",
        body: "Run timed and exit-intent popups for newsletter and booking conversions. Each popup is workspace- and locale-scoped.",
        primaryCta: "Open Popups",
    },
    seo: {
        headline: "SEO Control Center",
        body: "Audit internal linking, detect content gaps, and run analytics-aware growth plans with safe apply/rollback.",
        primaryCta: "Open SEO",
    },
    newsletter: {
        headline: "Newsletter Control Center",
        body: "Audiences, campaigns, templates, analytics, and automation — all under one roof.",
        primaryCta: "Open Newsletter",
    },
    analytics: {
        headline: "Analytics",
        body: "Traffic, conversions, and content performance for this workspace. Export CSV from any view.",
        primaryCta: "Open Analytics",
    },
    booking: {
        headline: "Booking Control Center",
        body: "Configure premium booking journeys, intake, availability, and reservation operations.",
        primaryCta: "Open Booking",
    },
    clients: {
        headline: "Client Management",
        body: "Manage portal client accounts, workspace relationships, and SLA continuity from a single console.",
        primaryCta: "Open Clients",
    },
    slas: {
        headline: "SLA Operations",
        body: "Manage facility locations and cleaning SLAs scoped to this workspace.",
        primaryCta: "Open SLAs",
    },
    "render-queue": {
        headline: "Render Queue",
        body: "Fulfill manual video rendering tasks across workspaces.",
        primaryCta: "Open Render Queue",
    },
    settings: {
        headline: "Workspace Settings",
        body: "Inspect runtime configuration, governance, locale defaults, and integrations for this workspace.",
        primaryCta: "Open Settings",
    },
    "admin-workspaces": {
        headline: "Workspaces",
        body: "Global administration — manage workspaces, themes, and manager assignments.",
        primaryCta: "Open Workspaces",
    },
};

const DEFAULT_FEATURE_COPY: OnboardingStepCopy = {
    headline: "Workspace module",
    body: "A workspace module configured by your theme. Click through to explore — you can revisit this tour from Settings.",
    primaryCta: "Open module",
};

export interface OnboardingStep {
    /** Stable identifier (matches module key, or a built-in step like "welcome"/"finish"). */
    key: string;
    /** Title shown in the window header (icon next to it where applicable). */
    title: string;
    /** Step body copy. */
    body: string;
    /** Optional deep-link the primary CTA opens in a new desktop window. */
    href?: string;
    /** Lucide icon name from DashboardModule.icon — null for built-in steps. */
    icon: string | null;
    /** PRO badge if the module is locked behind tier upgrade. */
    badge?: "PRO";
    /** Whether this step is locked (visible but disabled). */
    locked: boolean;
    /** Built-in steps don't correspond to a feature module. */
    kind: "intro" | "feature" | "outro";
    /** Optional CTA label. */
    primaryCta?: string;
}

function emptyOnboardingState(): OnboardingState {
    return {
        version: ONBOARDING_STATE_VERSION,
        currentStep: 0,
        completedSteps: [],
        coachMarksSeen: [],
    };
}

function coerceState(raw: unknown): OnboardingState {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return emptyOnboardingState();
    }

    const source = raw as Record<string, unknown>;
    const completedSteps = Array.isArray(source.completedSteps)
        ? source.completedSteps.filter((value): value is string => typeof value === "string")
        : [];
    const coachMarksSeen = Array.isArray(source.coachMarksSeen)
        ? source.coachMarksSeen.filter((value): value is string => typeof value === "string")
        : [];

    return {
        version: typeof source.version === "number" ? source.version : ONBOARDING_STATE_VERSION,
        currentStep: typeof source.currentStep === "number" && source.currentStep >= 0 ? source.currentStep : 0,
        completedSteps,
        coachMarksSeen,
    };
}

export async function loadOnboardingMembershipStatus(
    workspaceId: string,
    profileId: string,
): Promise<OnboardingMembershipStatus> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("workspace_memberships")
        .select("onboarding_state, onboarding_completed_at, onboarding_skipped_at")
        .eq("workspace_id", workspaceId)
        .eq("profile_id", profileId)
        .maybeSingle();

    if (error || !data) {
        return {
            hasMembership: false,
            completedAt: null,
            skippedAt: null,
            state: emptyOnboardingState(),
        };
    }

    return {
        hasMembership: true,
        completedAt: data.onboarding_completed_at ?? null,
        skippedAt: data.onboarding_skipped_at ?? null,
        state: coerceState(data.onboarding_state),
    };
}

function buildFeatureStep(module: DashboardModule): OnboardingStep {
    const copy = FEATURE_COPY[module.key] ?? DEFAULT_FEATURE_COPY;

    return {
        key: module.key,
        title: copy.headline,
        body: copy.body,
        href: module.enabled ? module.href : undefined,
        icon: module.icon,
        badge: module.badge,
        locked: !module.enabled,
        kind: "feature",
        primaryCta: copy.primaryCta,
    };
}

export function buildOnboardingSteps(state: AdminDashboardState): OnboardingStep[] {
    const intro: OnboardingStep = {
        key: WELCOME_STEP_KEY,
        title: `Welcome, ${state.workspace.name}`,
        body: "We'll spend the next minute touring every app on your desktop. You can skip this at any point — the tour is always available from Workspace Settings.",
        icon: null,
        locked: false,
        kind: "intro",
        primaryCta: "Start tour",
    };

    // On Basic workspaces, modules that are Pro-only come back from the
    // dashboard state with enabled=false. Including them in the tour shows
    // first-time managers a parade of disabled CTAs for features they can't
    // use — confusing, not aspirational. Filter them out; the upsell lives
    // in Settings → Plan, not in a feature walkthrough.
    const isBasic = state.workspace.workspace_tier === "basic";
    const featureSteps = state.modules
        .filter((module) => module.key !== "settings")
        .filter((module) => !isBasic || module.enabled)
        .sort((a, b) => a.order - b.order)
        .map(buildFeatureStep);

    // Settings is always last among features so the user knows where to
    // come back for re-running the tour and configuring the workspace.
    const settingsModule = state.modules.find((module) => module.key === "settings");
    if (settingsModule) {
        featureSteps.push(buildFeatureStep(settingsModule));
    }

    const outro: OnboardingStep = {
        key: FINISH_STEP_KEY,
        title: "You're set up",
        body: "That's the full workspace. Re-run this tour from Workspace Settings → Onboarding whenever you need a refresher.",
        icon: null,
        locked: false,
        kind: "outro",
        primaryCta: "Finish",
    };

    return [intro, ...featureSteps, outro];
}

/**
 * Decide whether the Welcome window should auto-launch on /dashboard.
 * Only first-time invited managers see it: completed or skipped users do
 * not, and admins can re-trigger from Settings (handled separately).
 */
export function shouldAutoLaunchOnboarding(status: OnboardingMembershipStatus): boolean {
    if (!status.hasMembership) return false;
    if (status.completedAt) return false;
    if (status.skippedAt) return false;
    return true;
}
