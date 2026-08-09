"use server";

import { assertWorkspaceAiEnabled } from "@/shared/lib/workspace/context";
import {
    createExternalPublishingAssetManifest,
    createExternalPublishingCampaign,
    createExternalPublishingPackageDraft,
    exportExternalPublicationBundle,
    generateAndStoreExternalPublishingPackage,
    loadExternalPublishingDashboardData,
    mineExternalPublishingOpportunitiesForWorkspace,
    recordExternalPublishingManualPublication,
    syncExternalPublishingConversionFeedback,
    transitionExternalPublishingPackageStatus,
    upsertExternalPublishingPlatformProfile,
} from "./service";
import { externalPublicationStatusSchema } from "./schema";

type ActionResult<T> = { success: true; data: T; error?: null } | { success: false; data?: null; error: string };

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "External publishing action failed.";
}

async function resolveScope() {
    const context = await assertWorkspaceAiEnabled();
    return {
        workspaceId: context.activeWorkspace.id,
        templateId: context.activeWorkspace.legacy_template_id,
        userId: context.userId,
        locale: (context.activeWorkspace.default_locale ?? "en") as "en" | "nl" | "ar",
    };
}

export async function loadExternalPublishingDashboardAction(): Promise<ActionResult<Awaited<ReturnType<typeof loadExternalPublishingDashboardData>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await loadExternalPublishingDashboardData(scope) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function mineExternalPublishingOpportunitiesAction(): Promise<ActionResult<Awaited<ReturnType<typeof mineExternalPublishingOpportunitiesForWorkspace>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await mineExternalPublishingOpportunitiesForWorkspace(scope) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function createExternalPublishingCampaignAction(input: unknown): Promise<ActionResult<Awaited<ReturnType<typeof createExternalPublishingCampaign>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await createExternalPublishingCampaign(scope, input) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function createExternalPublishingPackageDraftAction(input: unknown): Promise<ActionResult<Awaited<ReturnType<typeof createExternalPublishingPackageDraft>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await createExternalPublishingPackageDraft(scope, input) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function generateExternalPublishingPackageAction(packageId: string): Promise<ActionResult<Awaited<ReturnType<typeof generateAndStoreExternalPublishingPackage>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await generateAndStoreExternalPublishingPackage(scope, packageId) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function transitionExternalPublishingPackageStatusAction(packageId: string, statusInput: unknown): Promise<ActionResult<Awaited<ReturnType<typeof transitionExternalPublishingPackageStatus>>>> {
    try {
        const scope = await resolveScope();
        const status = externalPublicationStatusSchema.parse(statusInput);
        return { success: true, data: await transitionExternalPublishingPackageStatus(scope, packageId, status) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function recordExternalPublishingManualPublicationAction(packageId: string, url: string): Promise<ActionResult<Awaited<ReturnType<typeof recordExternalPublishingManualPublication>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await recordExternalPublishingManualPublication(scope, packageId, url) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function downloadExternalPublicationBundleAction(packageId: string): Promise<ActionResult<Awaited<ReturnType<typeof exportExternalPublicationBundle>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await exportExternalPublicationBundle(scope, packageId) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function upsertExternalPublishingPlatformProfileAction(input: unknown): Promise<ActionResult<Awaited<ReturnType<typeof upsertExternalPublishingPlatformProfile>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await upsertExternalPublishingPlatformProfile(scope, input) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function createExternalPublishingAssetManifestAction(packageId: string, input: unknown = {}): Promise<ActionResult<Awaited<ReturnType<typeof createExternalPublishingAssetManifest>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await createExternalPublishingAssetManifest(scope, packageId, input) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function syncExternalPublishingConversionFeedbackAction(): Promise<ActionResult<Awaited<ReturnType<typeof syncExternalPublishingConversionFeedback>>>> {
    try {
        const scope = await resolveScope();
        return { success: true, data: await syncExternalPublishingConversionFeedback(scope) };
    } catch (error) {
        return { success: false, error: errorMessage(error) };
    }
}
