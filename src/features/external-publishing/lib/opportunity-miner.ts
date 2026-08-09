import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/shared/lib/supabase/database.types";
import type { ExternalPublicationSourceType } from "../types";
import { fetchFreshSearchConsoleQuerySignals } from "@/features/seo/lib/inventory";
import { buildInternalContentHref } from "@/features/seo/lib/internal-link-href";
import { localizeHref } from "@/shared/lib/i18n/routing";

type ExternalPublishingSupabaseClient = SupabaseClient<Database>;

export interface ExternalPublishingOpportunity {
    id: string;
    workspaceId: string;
    templateId: string | null;
    locale: "en" | "nl" | "ar";
    sourceType: ExternalPublicationSourceType;
    sourceContentId?: string | null;
    sourceSeoPlanId?: string | null;
    sourceSeoOpportunityId?: string | null;
    sourceOpportunityId?: string | null;
    topic: string;
    primaryQuery?: string | null;
    title: string;
    targetUrl: string;
    targetSlug?: string | null;
    score: number;
    scoreReasons: string[];
    provenance: Record<string, unknown>;
}

export interface MineExternalPublishingOpportunitiesInput {
    workspaceId: string;
    templateId?: string | null;
    locale?: "en" | "nl" | "ar";
    siteUrl?: string | null;
    limit?: number;
}

function asRecord(value: Json | null | undefined): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeSlug(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.replace(/^\/+/, "").replace(/\/$/, "") || "";
}

function requireSiteUrl(value?: string | null): string {
    const configured = value?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!configured) {
        throw new Error("External publishing requires NEXT_PUBLIC_SITE_URL.");
    }
    const siteUrl = new URL(configured);
    if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
        throw new Error("External publishing site URL must use HTTP or HTTPS.");
    }
    return siteUrl.toString();
}

function targetUrlForSlug(siteUrl: string, slug: string | null, locale: "en" | "nl" | "ar"): string {
    const base = new URL(requireSiteUrl(siteUrl));
    const cleanSlug = normalizeSlug(slug);
    base.pathname = localizeHref(locale, cleanSlug ? `/${cleanSlug}` : "/");
    base.search = "";
    base.hash = "";
    return base.toString();
}

function dedupeOpportunities(items: ExternalPublishingOpportunity[], limit: number): ExternalPublishingOpportunity[] {
    const seen = new Set<string>();
    const output: ExternalPublishingOpportunity[] = [];
    for (const item of items.sort((a, b) => b.score - a.score)) {
        const key = `${item.sourceType}:${item.sourceContentId ?? item.sourceSeoPlanId ?? item.sourceSeoOpportunityId ?? item.sourceOpportunityId ?? item.targetSlug ?? item.topic}:${item.primaryQuery ?? ""}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(item);
        if (output.length >= limit) break;
    }
    return output;
}

export function scoreGscOpportunity(input: { impressions: number; clicks: number; ctr: number; position: number }): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 25;
    if (input.impressions >= 500) {
        score += 25;
        reasons.push("high search impressions");
    } else if (input.impressions >= 100) {
        score += 15;
        reasons.push("moderate search impressions");
    }
    if (input.position >= 4 && input.position <= 15) {
        score += 22;
        reasons.push("striking-distance ranking");
    }
    if (input.ctr <= 0.025 && input.impressions >= 50) {
        score += 18;
        reasons.push("low CTR improvement opportunity");
    }
    if (input.clicks > 0) {
        score += Math.min(10, input.clicks);
        reasons.push("already receives some organic clicks");
    }
    return { score: Math.min(100, Math.round(score)), reasons };
}

export function scoreSeoOpportunity(input: { priorityScore: number; analyticsScore?: number | null; strategicImportanceScore?: number | null }): { score: number; reasons: string[] } {
    const priority = input.priorityScore || 0;
    const analytics = input.analyticsScore ?? 0;
    const strategic = input.strategicImportanceScore ?? 0;
    return {
        score: Math.min(100, Math.round(priority * 0.55 + analytics * 0.2 + strategic * 0.25)),
        reasons: ["SEO strategist opportunity", priority >= 70 ? "high priority score" : "available SEO plan signal"].filter(Boolean),
    };
}

export async function mineExternalPublishingOpportunities(
    supabase: ExternalPublishingSupabaseClient,
    input: MineExternalPublishingOpportunitiesInput,
): Promise<ExternalPublishingOpportunity[]> {
    const locale = input.locale ?? "en";
    const limit = Math.max(1, Math.min(input.limit ?? 30, 100));
    const siteUrl = requireSiteUrl(input.siteUrl);

    const [
        gscResult,
        seoPlansResult,
        seoOpportunitiesResult,
        contentResult,
        analyticsResult,
        researchResult,
        approvedMarketResult,
    ] = await Promise.all([
        fetchFreshSearchConsoleQuerySignals(input.workspaceId, locale, 30, supabase),
        supabase
            .from("seo_content_plans")
            .select("id,title,primary_keyword,slug_suggestion,priority_score,locale,status,brief_markdown,metadata,draft_content_item_id")
            .eq("workspace_id", input.workspaceId)
            .eq("locale", locale)
            .order("priority_score", { ascending: false })
            .limit(40),
        supabase
            .from("seo_content_opportunities")
            .select("id,title,topic,priority_score,analytics_score,strategic_importance_score,locale,status,summary,metadata,draft_content_item_id")
            .eq("workspace_id", input.workspaceId)
            .eq("locale", locale)
            .order("priority_score", { ascending: false })
            .limit(40),
        supabase
            .from("content_items")
            .select("id,title,slug,type,locale,template_id,status,metadata,updated_at")
            .eq("workspace_id", input.workspaceId)
            .eq("locale", locale)
            .eq("status", "published")
            .order("updated_at", { ascending: false })
            .limit(60),
        supabase
            .from("analytics_events")
            .select("page_slug,event_type,event_name,utm_source,utm_medium,utm_campaign,created_at")
            .eq("workspace_id", input.workspaceId)
            .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(500),
        supabase
            .from("external_publication_research_documents")
            .select("id,canonical_url,title,excerpt,source_kind,trust_tier,metadata,created_at")
            .eq("workspace_id", input.workspaceId)
            .order("created_at", { ascending: false })
            .limit(60),
        supabase
            .from("workspace_opportunities")
            .select("id,title,summary,recommendation_markdown,signal_data,priority_score,created_at")
            .eq("workspace_id", input.workspaceId)
            .eq("category", "market")
            .eq("status", "approved")
            .order("priority_score", { ascending: false })
            .limit(30),
    ]);

    const opportunities: ExternalPublishingOpportunity[] = [];
    const publishedContentById = new Map((contentResult.data ?? []).map((row) => [row.id, row]));

    for (const row of gscResult) {
        const scored = scoreGscOpportunity({
            impressions: row.total_impressions,
            clicks: row.total_clicks,
            ctr: row.avg_ctr,
            position: row.avg_position,
        });
        const slug = normalizeSlug(row.page_slug);
        opportunities.push({
            id: `gsc:${row.page_slug}:${row.query}`,
            workspaceId: input.workspaceId,
            templateId: input.templateId ?? null,
            locale,
            sourceType: "gsc_query",
            topic: row.query,
            primaryQuery: row.query,
            title: `Turn search demand for "${row.query}" into an external publishing package`,
            targetUrl: targetUrlForSlug(siteUrl, slug, locale),
            targetSlug: slug,
            score: scored.score,
            scoreReasons: scored.reasons,
            provenance: { source: "gsc_raw_30d_locale_aggregate", row, snapshotAt: new Date().toISOString() },
        });
    }

    for (const row of seoPlansResult.data ?? []) {
        const publishedContent = row.draft_content_item_id ? publishedContentById.get(row.draft_content_item_id) : null;
        if (!publishedContent) continue;
        const slug = normalizeSlug(publishedContent.slug);
        const href = buildInternalContentHref({ slug, type: publishedContent.type, locale: publishedContent.locale });
        if (!href) continue;
        opportunities.push({
            id: `seo_plan:${row.id}`,
            workspaceId: input.workspaceId,
            templateId: input.templateId ?? null,
            locale: row.locale as "en" | "nl" | "ar",
            sourceType: "seo_plan",
            sourceContentId: publishedContent.id,
            sourceSeoPlanId: row.id,
            topic: row.primary_keyword ?? row.title,
            primaryQuery: row.primary_keyword,
            title: row.title,
            targetUrl: new URL(href, siteUrl).toString(),
            targetSlug: slug,
            score: Math.min(100, Math.round(row.priority_score ?? 0)),
            scoreReasons: ["SEO content plan", row.status === "approved" ? "approved plan" : "planned content"],
            provenance: { source: "seo_content_plans", row, publishedContent, snapshotAt: new Date().toISOString() },
        });
    }

    for (const row of seoOpportunitiesResult.data ?? []) {
        const publishedContent = row.draft_content_item_id ? publishedContentById.get(row.draft_content_item_id) : null;
        if (!publishedContent) continue;
        const slug = normalizeSlug(publishedContent.slug);
        const href = buildInternalContentHref({ slug, type: publishedContent.type, locale: publishedContent.locale });
        if (!href) continue;
        const scored = scoreSeoOpportunity({
            priorityScore: row.priority_score,
            analyticsScore: row.analytics_score,
            strategicImportanceScore: row.strategic_importance_score,
        });
        opportunities.push({
            id: `seo_opportunity:${row.id}`,
            workspaceId: input.workspaceId,
            templateId: input.templateId ?? null,
            locale: row.locale as "en" | "nl" | "ar",
            sourceType: "seo_opportunity",
            sourceContentId: publishedContent.id,
            sourceSeoOpportunityId: row.id,
            topic: row.topic,
            primaryQuery: row.topic,
            title: row.title,
            targetUrl: new URL(href, siteUrl).toString(),
            targetSlug: slug,
            score: scored.score,
            scoreReasons: scored.reasons,
            provenance: { source: "seo_content_opportunities", row, publishedContent, snapshotAt: new Date().toISOString() },
        });
    }

    const analyticsBySlug = new Map<string, number>();
    for (const event of analyticsResult.data ?? []) {
        const slug = normalizeSlug(event.page_slug);
        if (!slug) continue;
        analyticsBySlug.set(slug, (analyticsBySlug.get(slug) ?? 0) + 1);
    }
    for (const row of contentResult.data ?? []) {
        const slug = normalizeSlug(row.slug);
        if (input.templateId && row.template_id && row.template_id !== input.templateId) continue;
        const events = slug ? analyticsBySlug.get(slug) ?? 0 : 0;
        opportunities.push({
            id: `content:${row.id}`,
            workspaceId: input.workspaceId,
            templateId: row.template_id ?? input.templateId ?? null,
            locale: row.locale as "en" | "nl" | "ar",
            sourceType: "content_item",
            sourceContentId: row.id,
            topic: row.title,
            primaryQuery: null,
            title: `Repurpose "${row.title}" for an external audience`,
            targetUrl: targetUrlForSlug(siteUrl, slug, locale),
            targetSlug: slug,
            score: Math.min(100, 45 + Math.min(25, events) + (row.updated_at ? 10 : 0)),
            scoreReasons: ["published content", events > 0 ? "recent analytics activity" : "fresh repurposing candidate"],
            provenance: { source: "content_items", row, analyticsEvents30d: events, snapshotAt: new Date().toISOString() },
        });
    }

    for (const row of researchResult.data ?? []) {
        const trust = row.trust_tier ?? 3;
        const isReddit = row.source_kind === "reddit_question";
        const score = isReddit ? Math.min(100, 40 + trust * 12) : Math.min(100, 35 + trust * 10);

        opportunities.push({
            id: `research:${row.id}`,
            workspaceId: input.workspaceId,
            templateId: input.templateId ?? null,
            locale,
            sourceType: "market_signal",
            topic: row.title ?? row.source_kind,
            primaryQuery: row.title,
            title: isReddit ? `Answer Reddit question: ${row.title}` : `Use market signal: ${row.title ?? row.source_kind}`,
            targetUrl: row.canonical_url,
            targetSlug: null,
            score,
            scoreReasons: ["research document", isReddit ? "Reddit audience opportunity" : `trust tier ${trust}`],
            provenance: { source: "external_publication_research_documents", row, snapshotAt: new Date().toISOString() },
        });
    }

    for (const row of approvedMarketResult.data ?? []) {
        const signalData = asRecord(row.signal_data);
        const sourceUrl =
            typeof signalData.sourceUrl === "string"
                ? signalData.sourceUrl
                : typeof signalData.canonicalUrl === "string"
                    ? signalData.canonicalUrl
                    : null;
        const changeType =
            typeof signalData.changeType === "string"
                ? signalData.changeType.replaceAll("_", " ")
                : "market change";

        opportunities.push({
            id: `workspace_opportunity:${row.id}`,
            workspaceId: input.workspaceId,
            templateId: input.templateId ?? null,
            locale,
            sourceType: "market_signal",
            sourceOpportunityId: row.id,
            topic: row.title,
            primaryQuery: row.title,
            title: `Publish from approved market signal: ${row.title}`,
            targetUrl: targetUrlForSlug(siteUrl, null, locale),
            targetSlug: null,
            score: Math.min(100, Math.round(row.priority_score ?? 0)),
            scoreReasons: ["approved Opportunity Engine signal", changeType],
            provenance: {
                source: "workspace_opportunities",
                row,
                sourceUrl,
                snapshotAt: new Date().toISOString(),
            },
        });
    }

    return dedupeOpportunities(opportunities, limit);
}
