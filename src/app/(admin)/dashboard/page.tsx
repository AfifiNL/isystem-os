import { requireAdminDashboardState } from "@/features/admin/lib/route-guard";
import { loadDashboardInbox } from "@/features/admin/lib/dashboard-inbox";
import {
    buildOnboardingSteps,
    loadOnboardingMembershipStatus,
    shouldAutoLaunchOnboarding,
} from "@/features/admin/lib/onboarding";
import { DesktopView } from "@/features/admin/ui/shell/desktop-view";
import { createClient } from "@/shared/lib/supabase/server";

// The desktop view. The OS shell (dashboard/layout.tsx → DashboardShell)
// wraps this and renders it without window chrome when pathname is exactly
// /dashboard. Inbox data is loaded server-side and passed into the desktop
// widget. Onboarding state is fetched per-membership; the Welcome window
// auto-launches for first-time invited managers and stays dormant for
// returning users.
export default async function DashboardPage() {
    const state = await requireAdminDashboardState();
    const inbox = await loadDashboardInbox(state.workspace.id);

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const onboarding = user
        ? await loadOnboardingMembershipStatus(state.workspace.id, user.id)
        : null;

    const showOnboarding = onboarding ? shouldAutoLaunchOnboarding(onboarding) : false;
    const onboardingSteps = showOnboarding ? buildOnboardingSteps(state) : [];
    const initialStepIndex = onboarding?.state.currentStep ?? 0;

    return (
        <DesktopView
            state={state}
            inbox={inbox}
            onboarding={
                showOnboarding
                    ? {
                        steps: onboardingSteps,
                        initialStepIndex,
                    }
                    : null
            }
        />
    );
}
