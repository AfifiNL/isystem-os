"use server";

import { revalidatePath } from "next/cache";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import {
    createCampaignFromContentItem,
    createCampaignFromContentWithDefaultAudience,
    createNewsletterAudience,
    createNewsletterAutomation,
    createNewsletterAutomationStep,
    createNewsletterCampaign,
    createNewsletterTemplate,
    deleteNewsletterAudience,
    deleteNewsletterAutomation,
    deleteNewsletterAutomationStep,
    deleteNewsletterCampaign,
    deleteNewsletterTemplate,
    getNewsletterControlCenterData,
    runNewsletterDispatchCycle,
    scheduleNewsletterCampaign,
    updateNewsletterContact,
    unsubscribeNewsletterContact,
    updateNewsletterSettingsForWorkspace,
    CONTACT_STATUS_VALUES,
    type ContactStatus,
} from "@/features/newsletter/service";

export type NewsletterActionResult = { error: string | null };

async function requireNewsletterWorkspace() {
    const context = await resolveWorkspaceContext();
    if (!context?.activeWorkspace) {
        throw new Error("No active workspace available.");
    }

    return context.activeWorkspace;
}

function refreshNewsletterSurfaces() {
    revalidatePath("/dashboard/newsletter");
    revalidatePath("/dashboard/analytics");
    revalidatePath("/dashboard/content");
    revalidatePath("/dashboard/settings");
    revalidatePath("/newsletter", "page");
    revalidatePath("/(public)/newsletter", "page");
}

function toResult(error: string | null | undefined): NewsletterActionResult {
    return { error: error ?? null };
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export async function getNewsletterDashboardDataAction(
    query?: import("@/features/newsletter/service").NewsletterListQuery,
) {
    const workspace = await requireNewsletterWorkspace();
    return getNewsletterControlCenterData(workspace.id, workspace.name, query);
}

export async function saveNewsletterSettingsAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await updateNewsletterSettingsForWorkspace(workspace.id, {
            fromName: String(formData.get("fromName") ?? ""),
            fromEmail: String(formData.get("fromEmail") ?? ""),
            replyToEmail: String(formData.get("replyToEmail") ?? ""),
            companyName: String(formData.get("companyName") ?? ""),
            companyAddress: String(formData.get("companyAddress") ?? ""),
            defaultAudienceName: String(formData.get("defaultAudienceName") ?? ""),
            welcomeSubject: String(formData.get("welcomeSubject") ?? ""),
            welcomeHeading: String(formData.get("welcomeHeading") ?? ""),
            welcomeBody: String(formData.get("welcomeBody") ?? ""),
            footerText: String(formData.get("footerText") ?? ""),
            brandAccent: String(formData.get("brandAccent") ?? ""),
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to save newsletter settings.") };
    }
}

export async function createNewsletterAudienceAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await createNewsletterAudience(workspace.id, {
            name: String(formData.get("name") ?? ""),
            description: String(formData.get("description") ?? ""),
            isDefault: String(formData.get("isDefault") ?? "") === "on",
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to create audience.") };
    }
}

export async function createNewsletterTemplateAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await createNewsletterTemplate(workspace.id, {
            name: String(formData.get("name") ?? ""),
            workflowType: (String(formData.get("workflowType") ?? "broadcast") as "broadcast" | "welcome_series" | "nurture" | "reengagement"),
            subjectTemplate: String(formData.get("subjectTemplate") ?? ""),
            preheaderTemplate: String(formData.get("preheaderTemplate") ?? ""),
            bodyMarkdownTemplate: String(formData.get("bodyMarkdownTemplate") ?? ""),
            ctaLabel: String(formData.get("ctaLabel") ?? ""),
            ctaUrl: String(formData.get("ctaUrl") ?? ""),
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to create template.") };
    }
}

export async function createNewsletterCampaignAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const scheduledForInput = String(formData.get("scheduledFor") ?? "");
        const result = await createNewsletterCampaign(workspace.id, {
            title: String(formData.get("title") ?? ""),
            workflowType: (String(formData.get("workflowType") ?? "broadcast") as "broadcast" | "welcome_series" | "nurture" | "reengagement"),
            subjectLine: String(formData.get("subjectLine") ?? ""),
            preheader: String(formData.get("preheader") ?? ""),
            bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
            audienceId: String(formData.get("audienceId") ?? ""),
            templateId: String(formData.get("templateId") ?? ""),
            sourceContentId: String(formData.get("sourceContentId") ?? ""),
            scheduledFor: scheduledForInput ? new Date(scheduledForInput).toISOString() : "",
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to create campaign.") };
    }
}

export async function createCampaignFromContentAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await createCampaignFromContentItem(
            workspace.id,
            String(formData.get("contentItemId") ?? ""),
            String(formData.get("audienceId") ?? ""),
        );
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to generate campaign from content.") };
    }
}

/**
 * Content Studio shortcut. Takes a single `contentItemId`, resolves the active
 * workspace's default audience, and creates a campaign from the (already
 * generated) `newsletter_issue` artifact on that content row. Operator picks
 * the audience and schedule later inside the Newsletter Control Center.
 */
export async function createCampaignFromContentInlineAction(contentItemId: string): Promise<NewsletterActionResult> {
    try {
        if (!contentItemId) return { error: "Content id required." };
        const workspace = await requireNewsletterWorkspace();
        const result = await createCampaignFromContentWithDefaultAudience(
            workspace.id,
            workspace.name,
            contentItemId,
        );
        // Structured trail so we can grep production logs for the inline
        // path specifically — there's no audit_log table yet, so a tagged
        // console line is the lightweight record other newsletter actions
        // use too. Keep field names stable for log aggregators.
        console.info(JSON.stringify({
            event: "newsletter.campaign.created_from_content_inline",
            workspaceId: workspace.id,
            contentItemId,
            ok: !result.error,
            error: result.error ?? null,
            at: new Date().toISOString(),
        }));
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to create campaign from content.") };
    }
}

export async function scheduleNewsletterCampaignAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const scheduledForInput = String(formData.get("scheduledFor") ?? "");
        const result = await scheduleNewsletterCampaign(
            workspace.id,
            String(formData.get("campaignId") ?? ""),
            scheduledForInput ? new Date(scheduledForInput).toISOString() : null,
        );
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to schedule campaign.") };
    }
}

export async function sendNewsletterCampaignNowAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await scheduleNewsletterCampaign(
            workspace.id,
            String(formData.get("campaignId") ?? ""),
            null,
        );

        if (result.error) {
            refreshNewsletterSurfaces();
            return toResult(result.error);
        }

        try {
            await runNewsletterDispatchCycle();
        } catch (dispatchError) {
            refreshNewsletterSurfaces();
            return { error: errorMessage(dispatchError, "Dispatch cycle failed.") };
        }

        refreshNewsletterSurfaces();
        return toResult(null);
    } catch (error) {
        return { error: errorMessage(error, "Failed to send campaign.") };
    }
}

export async function createNewsletterAutomationAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await createNewsletterAutomation(workspace.id, {
            name: String(formData.get("name") ?? ""),
            triggerType: (String(formData.get("triggerType") ?? "manual") as "manual" | "contact_subscribed" | "content_published"),
            audienceId: String(formData.get("audienceId") ?? ""),
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to create automation.") };
    }
}

export async function createNewsletterAutomationStepAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await createNewsletterAutomationStep(workspace.id, {
            automationId: String(formData.get("automationId") ?? ""),
            templateId: String(formData.get("templateId") ?? ""),
            position: Number(formData.get("position") ?? "1"),
            delayMinutes: Number(formData.get("delayMinutes") ?? "0"),
            subjectLineOverride: String(formData.get("subjectLineOverride") ?? ""),
            preheaderOverride: String(formData.get("preheaderOverride") ?? ""),
            bodyMarkdownOverride: String(formData.get("bodyMarkdownOverride") ?? ""),
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to create automation step.") };
    }
}

export async function deleteNewsletterAudienceAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await deleteNewsletterAudience(workspace.id, String(formData.get("audienceId") ?? ""));
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to delete audience.") };
    }
}

export async function deleteNewsletterTemplateAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await deleteNewsletterTemplate(workspace.id, String(formData.get("templateId") ?? ""));
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to delete template.") };
    }
}

export async function deleteNewsletterCampaignAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await deleteNewsletterCampaign(workspace.id, String(formData.get("campaignId") ?? ""));
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to delete campaign.") };
    }
}

export async function deleteNewsletterAutomationAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await deleteNewsletterAutomation(workspace.id, String(formData.get("automationId") ?? ""));
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to delete automation.") };
    }
}

export async function deleteNewsletterAutomationStepAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const result = await deleteNewsletterAutomationStep(workspace.id, String(formData.get("stepId") ?? ""));
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to delete automation step.") };
    }
}

function coerceContactStatus(value: string | null): ContactStatus | undefined {
    if (!value) return undefined;
    return (CONTACT_STATUS_VALUES as readonly string[]).includes(value)
        ? (value as ContactStatus)
        : undefined;
}

function emptyToNull(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}

export async function updateNewsletterContactAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const contactId = String(formData.get("contactId") ?? "");
        if (!contactId) return { error: "Contact id required." };

        const statusRaw = formData.get("status");
        const status = coerceContactStatus(typeof statusRaw === "string" ? statusRaw : null);

        const result = await updateNewsletterContact(workspace.id, contactId, {
            firstName: emptyToNull(formData.get("firstName") as string | null),
            lastName: emptyToNull(formData.get("lastName") as string | null),
            locale: emptyToNull(formData.get("locale") as string | null),
            status,
        });
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to update contact.") };
    }
}

export async function unsubscribeNewsletterContactAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    try {
        const workspace = await requireNewsletterWorkspace();
        const contactId = String(formData.get("contactId") ?? "");
        if (!contactId) return { error: "Contact id required." };
        const result = await unsubscribeNewsletterContact(workspace.id, contactId);
        refreshNewsletterSurfaces();
        return toResult(result.error);
    } catch (error) {
        return { error: errorMessage(error, "Failed to unsubscribe contact.") };
    }
}

export async function runNewsletterDispatchCycleAction(
    _prev: NewsletterActionResult | null,
    formData: FormData,
): Promise<NewsletterActionResult> {
    void formData;
    try {
        await runNewsletterDispatchCycle();
        refreshNewsletterSurfaces();
        return toResult(null);
    } catch (error) {
        refreshNewsletterSurfaces();
        return { error: errorMessage(error, "Dispatch cycle failed.") };
    }
}
