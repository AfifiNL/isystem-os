import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import type { Locale } from "@/features/templates/types";

type DatabaseClient = SupabaseClient<Database>;

type OpportunityDraftInput = {
    opportunityId: string;
    workspaceId: string;
    templateId: string | null;
    authorId: string | null;
    locale: Locale;
    title: string;
    topic: string;
    summary: string | null;
    rationale: string | null;
    clusterName: string | null;
    recommendedFormat: string | null;
    targetIntent: string | null;
    funnelStage: string | null;
    targetConversionGoal: string | null;
    priorityScore: number | null;
    gsc?: {
        query: string;
        impressions: number;
        clicks: number;
        ctr: number;
        position: number;
    } | null;
};

type PlanDraftInput = {
    planId: string;
    workspaceId: string;
    templateId: string | null;
    authorId: string | null;
    locale: Locale;
    title: string;
    slugSuggestion: string | null;
    primaryKeyword: string | null;
    secondaryKeywords: readonly string[];
    intentStage: string | null;
    funnelStage: string | null;
    targetConversionGoal: string | null;
    briefMarkdown: string | null;
    outline: readonly unknown[];
    priorityScore: number | null;
    gsc?: {
        query: string;
        impressions: number;
        clicks: number;
        ctr: number;
        position: number;
    } | null;
};

type DraftResult = { id: string } | { id: null; error: string };

function slugify(source: string): string {
    return source
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "seo-draft";
}

async function ensureUniqueSlug(
    supabase: DatabaseClient,
    base: string,
    scope: { templateId: string | null; locale: Locale },
): Promise<string> {
    const attempts = 5;
    let candidate = base;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        // Slug uniqueness is now (template_id, locale, slug) — see migration
        // 20260427120000. Scope the lookup the same way so EN and NL drafts
        // can share a slug and we only collide within the same locale.
        let q = supabase
            .from("content_items")
            .select("id")
            .eq("slug", candidate)
            .eq("locale", scope.locale)
            .limit(1);
        if (scope.templateId) {
            q = q.eq("template_id", scope.templateId);
        }
        const { data } = await q;
        if (!data || data.length === 0) {
            return candidate;
        }
        candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
}

function formatList(label: string, items: readonly string[]): string {
    if (items.length === 0) return "";
    return `**${label}:** ${items.join(", ")}\n\n`;
}

function formatOutlineMarkdown(outline: readonly unknown[]): string {
    if (outline.length === 0) return "";
    const lines = outline
        .map((entry) => {
            if (typeof entry === "string") return `- ${entry}`;
            if (entry && typeof entry === "object") {
                const record = entry as { heading?: unknown; summary?: unknown; title?: unknown };
                const head = typeof record.heading === "string"
                    ? record.heading
                    : typeof record.title === "string"
                        ? record.title
                        : null;
                const body = typeof record.summary === "string" ? record.summary : null;
                if (head && body) return `- **${head}** — ${body}`;
                if (head) return `- ${head}`;
                if (body) return `- ${body}`;
            }
            return null;
        })
        .filter((line): line is string => Boolean(line));
    if (lines.length === 0) return "";
    return `## Outline\n\n${lines.join("\n")}\n\n`;
}

function buildOpportunityBrief(input: OpportunityDraftInput): string {
    const header = `> **Generated from SEO opportunity.** Refine the brief below, then flesh out the draft before publishing.\n\n`;
    const meta: string[] = [];
    if (input.clusterName) meta.push(`Cluster: ${input.clusterName}`);
    if (input.targetIntent) meta.push(`Intent: ${input.targetIntent}`);
    if (input.funnelStage) meta.push(`Funnel stage: ${input.funnelStage}`);
    if (input.targetConversionGoal) meta.push(`Conversion goal: ${input.targetConversionGoal}`);
    if (input.recommendedFormat) meta.push(`Recommended format: ${input.recommendedFormat}`);
    if (input.priorityScore !== null && input.priorityScore !== undefined) {
        meta.push(`Priority score: ${input.priorityScore}`);
    }

    const metaBlock = meta.length > 0 ? `${meta.map((line) => `- ${line}`).join("\n")}\n\n` : "";
    const summary = input.summary ? `## Summary\n\n${input.summary}\n\n` : "";
    const rationale = input.rationale ? `## Rationale\n\n${input.rationale}\n\n` : "";
    const topic = input.topic ? `## Topic focus\n\n${input.topic}\n\n` : "";

    return `${header}${metaBlock}${summary}${rationale}${topic}## Draft body\n\n_Start writing the article here._\n`;
}

function buildPlanBrief(input: PlanDraftInput): string {
    const header = `> **Generated from SEO plan.** This draft is prefilled from the strategist brief; expand it and publish when ready.\n\n`;
    const meta: string[] = [];
    if (input.primaryKeyword) meta.push(`Primary keyword: ${input.primaryKeyword}`);
    if (input.intentStage) meta.push(`Intent stage: ${input.intentStage}`);
    if (input.funnelStage) meta.push(`Funnel stage: ${input.funnelStage}`);
    if (input.targetConversionGoal) meta.push(`Conversion goal: ${input.targetConversionGoal}`);
    if (input.priorityScore !== null && input.priorityScore !== undefined) {
        meta.push(`Priority score: ${input.priorityScore}`);
    }

    const metaBlock = meta.length > 0 ? `${meta.map((line) => `- ${line}`).join("\n")}\n\n` : "";
    const keywords = formatList("Secondary keywords", input.secondaryKeywords);
    const outline = formatOutlineMarkdown(input.outline);
    const brief = input.briefMarkdown ? `## Brief\n\n${input.briefMarkdown}\n\n` : "";

    return `${header}${metaBlock}${keywords}${outline}${brief}## Draft body\n\n_Start writing the article here._\n`;
}

export async function createDraftFromOpportunity(
    supabase: DatabaseClient,
    input: OpportunityDraftInput,
): Promise<DraftResult> {
    const baseSlug = slugify(input.title || input.topic || "seo-opportunity");
    const slug = await ensureUniqueSlug(supabase, baseSlug, { templateId: input.templateId, locale: input.locale });

    const { data, error } = await supabase
        .from("content_items")
        .insert([
            {
                title: input.title,
                slug,
                type: "blog",
                status: "draft",
                content_markdown: buildOpportunityBrief(input),
                workspace_id: input.workspaceId,
                template_id: input.templateId,
                author_id: input.authorId,
                locale: input.locale,
                metadata: {
                    seo: {
                        source: "seo_content_opportunity",
                        opportunityId: input.opportunityId,
                        clusterName: input.clusterName,
                        targetIntent: input.targetIntent,
                        funnelStage: input.funnelStage,
                        targetConversionGoal: input.targetConversionGoal,
                        recommendedFormat: input.recommendedFormat,
                        ...(input.gsc ? { gsc: input.gsc } : {}),
                    },
                },
            },
        ])
        .select("id")
        .single();

    if (error || !data) {
        return { id: null, error: error?.message ?? "Failed to create draft from opportunity." };
    }

    return { id: data.id };
}

export async function createDraftFromPlan(
    supabase: DatabaseClient,
    input: PlanDraftInput,
): Promise<DraftResult> {
    const baseSlug = slugify(input.slugSuggestion || input.title || "seo-plan");
    const slug = await ensureUniqueSlug(supabase, baseSlug, { templateId: input.templateId, locale: input.locale });

    const { data, error } = await supabase
        .from("content_items")
        .insert([
            {
                title: input.title,
                slug,
                type: "blog",
                status: "draft",
                content_markdown: buildPlanBrief(input),
                workspace_id: input.workspaceId,
                template_id: input.templateId,
                author_id: input.authorId,
                locale: input.locale,
                metadata: {
                    seo: {
                        source: "seo_content_plan",
                        planId: input.planId,
                        primaryKeyword: input.primaryKeyword,
                        intentStage: input.intentStage,
                        funnelStage: input.funnelStage,
                        targetConversionGoal: input.targetConversionGoal,
                        ...(input.gsc ? { gsc: input.gsc } : {}),
                    },
                },
            },
        ])
        .select("id")
        .single();

    if (error || !data) {
        return { id: null, error: error?.message ?? "Failed to create draft from plan." };
    }

    return { id: data.id };
}
