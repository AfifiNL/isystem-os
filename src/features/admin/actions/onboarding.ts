"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import {
    ONBOARDING_STATE_VERSION,
    loadOnboardingMembershipStatus,
    type OnboardingState,
} from "@/features/admin/lib/onboarding";

export interface OnboardingActionResult {
    success: boolean;
    error?: string;
}

interface AdvanceInput {
    workspaceId: string;
    stepIndex: number;
    stepKey: string;
}

async function getCurrentProfileId(): Promise<string | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
}

function buildNextState(prev: OnboardingState, stepIndex: number, stepKey: string): OnboardingState {
    const completedSteps = prev.completedSteps.includes(stepKey)
        ? prev.completedSteps
        : [...prev.completedSteps, stepKey];

    return {
        version: ONBOARDING_STATE_VERSION,
        currentStep: Math.max(prev.currentStep, stepIndex + 1),
        completedSteps,
        coachMarksSeen: prev.coachMarksSeen,
    };
}

export async function advanceOnboardingStep(input: AdvanceInput): Promise<OnboardingActionResult> {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
        return { success: false, error: "Not authenticated" };
    }

    if (!input.workspaceId || !input.stepKey || typeof input.stepIndex !== "number") {
        return { success: false, error: "Invalid step payload" };
    }

    const status = await loadOnboardingMembershipStatus(input.workspaceId, profileId);
    if (!status.hasMembership) {
        return { success: false, error: "No workspace membership" };
    }

    const nextState = buildNextState(status.state, input.stepIndex, input.stepKey);

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_memberships")
        .update({ onboarding_state: nextState })
        .eq("workspace_id", input.workspaceId)
        .eq("profile_id", profileId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function skipOnboarding(workspaceId: string): Promise<OnboardingActionResult> {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
        return { success: false, error: "Not authenticated" };
    }

    if (!workspaceId) {
        return { success: false, error: "Missing workspace" };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_memberships")
        .update({ onboarding_skipped_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("profile_id", profileId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function completeOnboarding(workspaceId: string): Promise<OnboardingActionResult> {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
        return { success: false, error: "Not authenticated" };
    }

    if (!workspaceId) {
        return { success: false, error: "Missing workspace" };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_memberships")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("profile_id", profileId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

/**
 * Re-launch the tour: clear both timestamps and reset progress. Triggered
 * from Workspace Settings → Onboarding.
 */
export async function restartOnboarding(workspaceId: string): Promise<OnboardingActionResult> {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
        return { success: false, error: "Not authenticated" };
    }

    if (!workspaceId) {
        return { success: false, error: "Missing workspace" };
    }

    const freshState: OnboardingState = {
        version: ONBOARDING_STATE_VERSION,
        currentStep: 0,
        completedSteps: [],
        coachMarksSeen: [],
    };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_memberships")
        .update({
            onboarding_state: freshState,
            onboarding_completed_at: null,
            onboarding_skipped_at: null,
        })
        .eq("workspace_id", workspaceId)
        .eq("profile_id", profileId);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function markCoachMarkSeen(
    workspaceId: string,
    coachMarkKey: string,
): Promise<OnboardingActionResult> {
    const profileId = await getCurrentProfileId();
    if (!profileId) {
        return { success: false, error: "Not authenticated" };
    }

    if (!workspaceId || !coachMarkKey) {
        return { success: false, error: "Missing payload" };
    }

    const status = await loadOnboardingMembershipStatus(workspaceId, profileId);
    if (!status.hasMembership) {
        return { success: false, error: "No workspace membership" };
    }

    if (status.state.coachMarksSeen.includes(coachMarkKey)) {
        return { success: true };
    }

    const nextState: OnboardingState = {
        ...status.state,
        coachMarksSeen: [...status.state.coachMarksSeen, coachMarkKey],
    };

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_memberships")
        .update({ onboarding_state: nextState })
        .eq("workspace_id", workspaceId)
        .eq("profile_id", profileId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
