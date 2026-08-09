import { DraftGeneratorForm, type DraftGeneratorInitialValues } from "@/features/content-engine/ui/draft-generator-form";
import { requireDashboardModuleAccess } from "@/features/admin/lib/route-guard";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import { createClient } from "@/shared/lib/supabase/server";
import {
    DashboardAppWorkbench,
} from "@/features/admin/ui/app-workbench";

type FormatToken = NonNullable<DraftGeneratorInitialValues["content_types"]>[number];

function formatToContentTypes(format: string | null | undefined): FormatToken[] {
    const value = (format ?? "").toLowerCase();
    if (!value || /\bblog|article|post\b/.test(value)) return ["blog_post"];
    if (/video|youtube|reel/.test(value)) return ["video_script"];
    if (/linkedin/.test(value)) return ["social_linkedin"];
    if (/twitter|tweet|x\b/.test(value)) return ["social_twitter"];
    if (/instagram|ig\b/.test(value)) return ["social_instagram"];
    return ["blog_post"];
}

async function loadOpportunityPrefill(workspaceId: string, opportunityId: string): Promise<DraftGeneratorInitialValues | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("seo_content_opportunities")
        .select("id,title,topic,recommended_format,target_intent,target_conversion_goal,summary,rationale,cluster_name")
        .eq("id", opportunityId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (!data) return null;
    const keywords = [data.topic, data.target_intent, data.target_conversion_goal, data.cluster_name]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return {
        title: data.title ?? "",
        keywords: Array.from(new Set(keywords)).slice(0, 8),
        content_types: formatToContentTypes(data.recommended_format),
        opportunityId: data.id,
        sourceLabel: "SEO Strategist opportunity",
        summary: data.summary ?? data.rationale ?? null,
    };
}

async function loadPlanPrefill(workspaceId: string, planId: string): Promise<DraftGeneratorInitialValues | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("seo_content_plans")
        .select("id,title,primary_keyword,secondary_keywords,intent_stage,target_conversion_goal,brief_markdown")
        .eq("id", planId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
    if (!data) return null;
    const secondary = Array.isArray(data.secondary_keywords)
        ? data.secondary_keywords.filter((v): v is string => typeof v === "string")
        : [];
    const keywords = [data.primary_keyword, ...secondary, data.intent_stage, data.target_conversion_goal]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return {
        title: data.title ?? "",
        keywords: Array.from(new Set(keywords)).slice(0, 8),
        content_types: ["blog_post"],
        planId: data.id,
        sourceLabel: "SEO Content Plan",
        summary: data.brief_markdown ?? null,
    };
}

interface GeneratePageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GenerateDraftPage({ searchParams }: GeneratePageProps) {
    await requireDashboardModuleAccess("generate");
    const context = await resolveWorkspaceContext();
    const isAiEnabled = context?.productFeatures.aiGeneration ?? false;

    const params = (await searchParams) ?? {};
    const opportunityId = typeof params.opportunityId === "string" ? params.opportunityId : null;
    const planId = typeof params.planId === "string" ? params.planId : null;

    let initialValues: DraftGeneratorInitialValues | null = null;
    if (context?.activeWorkspace?.id) {
        if (opportunityId) {
            initialValues = await loadOpportunityPrefill(context.activeWorkspace.id, opportunityId);
        } else if (planId) {
            initialValues = await loadPlanPrefill(context.activeWorkspace.id, planId);
        }
    }

    return (
        <DashboardAppWorkbench className="dashboard-route-generate">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {!isAiEnabled ? (
                    <div className="mx-auto max-w-4xl">
                        <ProFeatureNotice
                            title="AI Draft Generator is part of Pro"
                            description="Generate drafts, content variations, and media from one brief."
                            ctaLabel="Activate Pro for AI Draft Generator"
                            benefits={[
                                "Research and draft from one brief.",
                                "Create blog, video, and social outputs.",
                                "Generate images and narration in the same flow.",
                            ]}
                        />
                    </div>
                ) : (
                    <DraftGeneratorForm
                        aiGenerationEnabled={isAiEnabled}
                        initialValues={initialValues}
                        defaultLocale={context?.activeWorkspace?.default_locale ?? "en"}
                    />
                )}
            </div>
        </DashboardAppWorkbench>
    );
}
