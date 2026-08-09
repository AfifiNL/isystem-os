"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getSiteSettings } from "@/features/templates/actions";
import { enqueueContentPublishedAutomations } from "@/features/newsletter/service";
import { enqueueInternalLinkJobForPublishedContent } from "@/features/seo/internal-link-jobs";
import { enqueueBlogIndexingJob } from "@/features/seo/indexing/service";
import { markSeoSourcePublished } from "@/features/seo/lib/source-lifecycle";
import { z } from "zod";
import type { Json } from "@/shared/lib/supabase/database.types";
import { createSeededPageVisualLayout, createSeededStructuredPageData, createStarterPresetPuckData, normalizePublicBuilderData, type PublicBuilderData } from "@/features/builder/puck.config";
import { revalidatePublicContent, revalidateAllPublicSurfaces } from "./revalidate-public";
import { validateGeneratedBlogDraft } from "./lib/blog-editorial-validation";
import {
    assessBlogEditorialPublicationReadiness,
    getBlogEditorialPublicPolicy,
} from "./lib/blog-editorial-policy";
import { buildEditorialRepairValidationInput, buildRepairedBlogMetadata, extractRepairSeoData } from "./lib/editorial-repair";
import { verifyContentFreshness } from "./verify-freshness";
import { normalizeContentMarkdownForSave } from "./lib/content-normalization";
import {
    preserveProtectedPublicPageSemantics,
    resolvePublicPageDefinition,
    validateProtectedPublicPageEdit,
    validatePublicPageData,
    type PublicPagePuckDataV2,
} from "@/features/public-site/public-page-contract";
import { isPublicPagePuckDataV2 } from "@/features/public-site/public-page-data";
import { getSiteHost } from "@/shared/lib/site-url";

// ── Constants ──────────────────────────────────────────────────────────
const MAX_VISUAL_LAYOUT_BYTES = 2 * 1024 * 1024; // 2 MB safety ceiling for JSONB payload

const VALID_STARTER_PRESETS = new Set([
    "trust-strip",
    "service-comparison",
    "why-choose-us",
    "operational-standards",
    "call-booking-cta",
    "client-transparency",
    "facility-sector-showcase",
]);
const CONTENT_FRESHNESS_MANUAL_SCAN_LIMIT = 5;

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function validateBlogPublishReadiness(input: {
    title: string | null;
    contentMarkdown: string | null;
    metadata: unknown;
    locale?: string | null;
    templateId?: string | null;
}): { ok: true } | { ok: false; error: string } {
    const markdown = input.contentMarkdown ?? "";
    const metadata = asRecord(input.metadata) ?? {};
    const locale = input.locale === "nl" || input.locale === "ar" ? input.locale : "en";
    const publicPolicy = getBlogEditorialPublicPolicy(input.templateId);
    const validationInput = buildEditorialRepairValidationInput({
        markdown,
        title: input.title ?? "",
        metadata,
        seoData: extractRepairSeoData(metadata, input.title ?? ""),
        siteHost: getSiteHost(),
        forbiddenPublicTerms: publicPolicy.forbiddenPublicTerms,
    });
    const result = validateGeneratedBlogDraft(validationInput);
    const readiness = assessBlogEditorialPublicationReadiness(result, {
        locale,
        scoreFloor: publicPolicy.publicationScoreFloor,
    });
    if (readiness.ready) {
        return { ok: true };
    }

    const summary = readiness.blockingIssues.length > 0
        ? readiness.blockingIssues.slice(0, 3).map((issue) => `${issue.code}: ${issue.message}`).join(" | ")
        : `editorial score ${result.scorecard.overall}/100 is below the publication floor of ${readiness.scoreFloor}`;
    return {
        ok: false,
        error: `Publication blocked by editorial validation. ${summary}`,
    };
}

// Zod schema for Content Item
const ContentItemSchema = z.object({
    title: z.string().min(1, "Title is required"),
    content_markdown: z.string().min(1, "Content is required"),
    slug: z.string().optional(),
    status: z.string().optional(),
    type: z.string().optional(),
    author_id: z.string().uuid().optional(),
    metadata: z.any().optional(), // Using any since it's flexible JSONB
    video_url: z.string().url().optional(),
    video_duration: z.number().optional(),
    video_resolution: z.string().optional(),
});

// Partial schema for updates — every field is optional but must pass type checks when present
const PartialContentItemSchema = ContentItemSchema.partial();

export type CreateContentInput = z.infer<typeof ContentItemSchema>;

export interface VisualLayoutInput {
    root: {
        props?: {
            title?: string;
            locale?: string;
        };
    };
    content: unknown[];
}

type SeededPageEntry = {
    title: string;
    slug: "home" | "services" | "about" | "contact";
    content_markdown: string;
    visual_layout: Json | null;
    metadata: Json;
};

function buildSeededCorePageEntries(): SeededPageEntry[] {
    return [
        {
            title: "Home",
            slug: "home",
            content_markdown: "",
            visual_layout: createSeededPageVisualLayout("home") as Json | null,
            metadata: {
                source: "core-page-builder",
                page_kind: "home",
                structured_content: createSeededStructuredPageData("home"),
            } as Json,
        },
        {
            title: "Services",
            slug: "services",
            content_markdown: "",
            visual_layout: createSeededPageVisualLayout("services") as Json | null,
            metadata: {
                source: "core-page-builder",
                page_kind: "services",
                structured_content: createSeededStructuredPageData("services"),
            } as Json,
        },
        {
            title: "About",
            slug: "about",
            content_markdown: "",
            visual_layout: createSeededPageVisualLayout("about") as Json | null,
            metadata: {
                source: "core-page-builder",
                page_kind: "about",
                structured_content: createSeededStructuredPageData("about"),
            } as Json,
        },
        {
            title: "Contact",
            slug: "contact",
            content_markdown: "",
            visual_layout: createSeededPageVisualLayout("contact") as Json | null,
            metadata: {
                source: "core-page-builder",
                page_kind: "contact",
                structured_content: createSeededStructuredPageData("contact"),
            } as Json,
        },
    ];
}

async function resolveContentScope() {
    const context = await resolveWorkspaceContext();
    const settings = await getSiteSettings();
    const templateResolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);

    // For anonymous visitors (no auth cookie → context is null), fall back
    // to the canonical workspace that owns the active template. Without this,
    // anonymous reads query by template_id alone and may match a different
    // row than logged-in admins do (admin queries are workspace-scoped),
    // producing the "incognito shows different content than admin" symptom.
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(templateResolution.templateId));

    return {
        context,
        workspaceId,
        templateId: templateResolution.templateId,
        defaultLocale: context?.activeWorkspace?.default_locale ?? "en",
    };
}

function isNoRowsError(error: unknown) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as { code?: string; details?: string | null; message?: string };
    return candidate.code === "PGRST116"
        || candidate.details?.includes("0 rows")
        || candidate.message?.includes("JSON object requested, multiple (or no) rows returned")
        || false;
}

export async function createContentItem(input: CreateContentInput) {
    const supabase = await createClient();

    // Validate input
    const validatedFields = ContentItemSchema.safeParse(input);
    if (!validatedFields.success) {
        return {
            error: "Invalid fields",
            details: validatedFields.error.flatten().fieldErrors,
        };
    }

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Unauthorized" };
    }

    const scope = await resolveContentScope();
    const resolvedSlug = input.slug?.trim() || input.title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

    // Insert content
    const { data, error } = await supabase
        .from("content_items")
        .insert([
            {
                title: validatedFields.data.title,
                slug: resolvedSlug,
                content_markdown: validatedFields.data.content_markdown,
                video_url: validatedFields.data.video_url,
                video_duration: validatedFields.data.video_duration,
                video_resolution: validatedFields.data.video_resolution,
                type: validatedFields.data.type ?? "blog",
                author_id: user.id,
                workspace_id: scope.workspaceId,
                template_id: scope.templateId,
                locale: scope.defaultLocale,
            },
        ])
        .select()
        .single();

    if (error) {
        console.error("Error creating content:", error);
        return { error: "Failed to create content item" };
    }

    revalidatePath("/dashboard/content");

    // Newly created public content needs its index/list page busted so the
    // item actually appears for visitors.
    if (data?.type === "blog") {
        await revalidatePublicContent({ type: "blog", slug: typeof data.slug === "string" ? data.slug : null });
    } else if (data?.type === "page") {
        const pageKind = typeof data?.metadata?.page_kind === "string" ? data.metadata.page_kind : null;
        await revalidatePublicContent({ type: "page", slug: typeof data.slug === "string" ? data.slug : null, pageKind });
    }

    return { data };
}

export async function getContentItems() {
    const supabase = await createClient();
    const scope = await resolveContentScope();

    let query = supabase
        .from("content_items")
        .select(`
      *,
      author:author_id(
        id,
        email,
        role
      )
    `)
        .order("created_at", { ascending: false });

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching content items:", error);
        return { error: "Failed to fetch content items", data: null };
    }

    return { data, error: null };
}

export interface WorkspaceContentFreshnessScanResult {
    success: boolean;
    scanned: number;
    stale: number;
    failed: number;
    message: string;
    error: string | null;
}

interface FreshnessReviewRow {
    content_item_id: string;
    checked_at: string | null;
}

export async function runWorkspaceContentFreshnessScanAction(): Promise<WorkspaceContentFreshnessScanResult> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            success: false,
            scanned: 0,
            stale: 0,
            failed: 0,
            message: "Sign in to run a content freshness scan.",
            error: "Unauthorized",
        };
    }

    const scope = await resolveContentScope();
    const workspaceId = scope.context?.activeWorkspace?.id ?? scope.workspaceId;
    if (!workspaceId) {
        return {
            success: false,
            scanned: 0,
            stale: 0,
            failed: 0,
            message: "No active workspace was found for this scan.",
            error: "No active workspace",
        };
    }

    let contentQuery = supabase
        .from("content_items")
        .select("id,workspace_id,title,created_at")
        .eq("status", "published")
        .eq("type", "blog");

    if (scope.context?.activeWorkspace?.id) {
        contentQuery = contentQuery.or(
            `workspace_id.eq.${workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`,
        );
    } else {
        contentQuery = contentQuery.eq("template_id", scope.templateId);
    }

    const { data: contentItems, error: fetchError } = await contentQuery;
    if (fetchError) {
        return {
            success: false,
            scanned: 0,
            stale: 0,
            failed: 0,
            message: "Freshness scan could not load published posts.",
            error: fetchError.message,
        };
    }

    if (!contentItems || contentItems.length === 0) {
        return {
            success: true,
            scanned: 0,
            stale: 0,
            failed: 0,
            message: "No published blog posts are ready for freshness checks.",
            error: null,
        };
    }

    const { data: existingReviews, error: reviewsError } = await supabase
        .from("content_freshness_reviews" as never)
        .select("content_item_id,checked_at" as never)
        .eq("workspace_id" as never, workspaceId as never);

    if (reviewsError) {
        console.warn("[content-engine] Could not load freshness review history:", reviewsError.message);
    }

    const reviewsMap = new Map<string, string>();
    for (const review of (existingReviews as unknown as FreshnessReviewRow[] | null) ?? []) {
        if (review.checked_at) {
            reviewsMap.set(review.content_item_id, review.checked_at);
        }
    }

    const sortedItems = [...contentItems].sort((a, b) => {
        const dateA = reviewsMap.get(a.id);
        const dateB = reviewsMap.get(b.id);
        if (!dateA && !dateB) {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
        }
        if (!dateA) return -1;
        if (!dateB) return 1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    let scanned = 0;
    let stale = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of sortedItems.slice(0, CONTENT_FRESHNESS_MANUAL_SCAN_LIMIT)) {
        try {
            const result = await verifyContentFreshness(item.id, supabase);
            scanned += 1;

            if (result.verification_status === "stale") {
                stale += 1;
            }
            if (result.verification_status === "error" || result.error) {
                failed += 1;
                if (result.error) errors.push(`${item.title}: ${result.error}`);
            }

            const { error: upsertError } = await supabase
                .from("content_freshness_reviews" as never)
                .upsert({
                    workspace_id: item.workspace_id ?? workspaceId,
                    content_item_id: item.id,
                    status: result.verification_status,
                    risk: result.freshness_risk,
                    stale_indicators: result.stale_indicators,
                    checked_at: result.checked_at,
                } as never, {
                    onConflict: "workspace_id,content_item_id",
                } as never);

            if (upsertError) {
                failed += 1;
                errors.push(`${item.title}: ${upsertError.message}`);
                console.error("[content-engine] Failed to upsert freshness review:", upsertError.message);
            }
        } catch (error) {
            failed += 1;
            const message = error instanceof Error ? error.message : "Unexpected freshness scan failure";
            errors.push(`${item.title}: ${message}`);
            console.error(`[content-engine] Freshness scan failed for ${item.id}:`, error);
        }
    }

    revalidatePath("/dashboard/content");

    const message = `Scanned ${scanned} published post${scanned === 1 ? "" : "s"}; found ${stale} stale and ${failed} failed check${failed === 1 ? "" : "s"}.`;
    return {
        success: failed === 0,
        scanned,
        stale,
        failed,
        message,
        error: errors[0] ?? null,
    };
}

export async function getContentItemById(id: string) {
    if (!id) return { error: "ID is required", data: null };

    const supabase = await createClient();
    const scope = await resolveContentScope();

    let query = supabase
        .from("content_items")
        .select(`
      *,
      author:author_id(
        id,
        email,
        role
      )
    `)
        .eq("id", id);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query.single();

    if (error) {
        console.error("Error fetching content item:", error);
        return { error: "Failed to fetch content item", data: null };
    }

    return { data, error: null };
}

export async function updateContentItem(id: string, input: Partial<CreateContentInput>) {
    if (!id) return { error: "ID is required" };

    // Validate partial input with Zod — catches type mismatches early
    const validatedFields = PartialContentItemSchema.safeParse(input);
    if (!validatedFields.success) {
        return {
            error: "Invalid fields",
            details: validatedFields.error.flatten().fieldErrors,
        };
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Unauthorized" };
    }

    const scope = await resolveContentScope();
    const { data: previousItem } = await getContentItemById(id);
    const previousItemRecord = asRecord(previousItem);

    // Prepare update payload — only include keys that were explicitly provided
    const payload: Record<string, unknown> = {};
    const validated = validatedFields.data;
    if (validated.title !== undefined) payload.title = validated.title;
    if (validated.content_markdown !== undefined) payload.content_markdown = normalizeContentMarkdownForSave(validated.content_markdown);
    if (validated.slug !== undefined) payload.slug = validated.slug;
    if (validated.status !== undefined) payload.status = validated.status;
    if (validated.type !== undefined) payload.type = validated.type;
    if (validated.author_id !== undefined) payload.author_id = validated.author_id;
    if (validated.metadata !== undefined) payload.metadata = validated.metadata;
    if (validated.video_url !== undefined) payload.video_url = validated.video_url;
    if (validated.video_duration !== undefined) payload.video_duration = validated.video_duration;
    if (validated.video_resolution !== undefined) payload.video_resolution = validated.video_resolution;

    const nextStatus = typeof payload.status === "string" ? payload.status : previousItemRecord?.status;
    const nextType = typeof payload.type === "string" ? payload.type : previousItemRecord?.type;

    // Recalculate editorial diagnostics when blog markdown is saved. This ensures the UI
    // scorecard updates immediately if a user manually introduces or fixes an error.
    if (nextType === "blog" && payload.content_markdown !== undefined) {
        const markdown = payload.content_markdown as string;
        const currentMeta = asRecord(payload.metadata !== undefined ? payload.metadata : previousItemRecord?.metadata) ?? {};
        const nextTitle = typeof payload.title === "string" ? payload.title : typeof previousItemRecord?.title === "string" ? previousItemRecord.title : undefined;
        const seoData = extractRepairSeoData(currentMeta, nextTitle ?? "");
        const publicPolicy = getBlogEditorialPublicPolicy(
            typeof previousItemRecord?.template_id === "string"
                ? previousItemRecord.template_id
                : null,
        );

        const validationInput = buildEditorialRepairValidationInput({
            markdown,
            title: nextTitle ?? "",
            metadata: currentMeta,
            seoData,
            siteHost: getSiteHost(),
            forbiddenPublicTerms: publicPolicy.forbiddenPublicTerms,
        });
        const newValidation = validateGeneratedBlogDraft(validationInput);

        const enrichment = asRecord(currentMeta.enrichment) ?? {};
        const existingValidation = asRecord(enrichment.editorial_validation) ?? {};
        payload.metadata = buildRepairedBlogMetadata({
            metadata: currentMeta,
            seoData,
            validation: newValidation,
            repairAttempts: typeof existingValidation.repair_attempts === "number" ? existingValidation.repair_attempts : 0,
            repaired: existingValidation.repaired === true,
            fallbackReason: typeof existingValidation.fallback_reason === "string" ? existingValidation.fallback_reason : null,
        });
    }

    if (Object.keys(payload).length === 0) {
        return { error: "No fields to update" };
    }
    if (nextStatus === "published" && nextType === "blog") {
        const readiness = validateBlogPublishReadiness({
            title: typeof payload.title === "string" ? payload.title : typeof previousItemRecord?.title === "string" ? previousItemRecord.title : null,
            contentMarkdown: typeof payload.content_markdown === "string" ? payload.content_markdown : typeof previousItemRecord?.content_markdown === "string" ? previousItemRecord.content_markdown : null,
            metadata: payload.metadata !== undefined ? payload.metadata : previousItemRecord?.metadata,
            locale: typeof previousItemRecord?.locale === "string" ? previousItemRecord.locale : null,
            templateId: typeof previousItemRecord?.template_id === "string" ? previousItemRecord.template_id : null,
        });
        if (!readiness.ok) {
            return { error: readiness.error };
        }
    }

    let query = supabase
        .from("content_items")
        .update(payload)
        .eq("id", id);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query.select().single();

    if (error) {
        console.error("Error updating content:", error);
        return { error: "Failed to update content item" };
    }

    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/${id}`);

    // Bust the matching public surface so CMS edits actually reach visitors.
    // updateContentItem covers title / markdown / slug / metadata edits — all of
    // which affect rendered output but were never revalidated before this fix.
    const updatedType = typeof data?.type === "string" ? data.type : previousItemRecord?.type;
    const updatedSlug = typeof data?.slug === "string" ? data.slug : (typeof previousItemRecord?.slug === "string" ? previousItemRecord.slug : null);
    const previousMetadataRecord = asRecord(previousItemRecord?.metadata);
    const updatedPageKind = typeof data?.metadata?.page_kind === "string"
        ? data.metadata.page_kind
        : (typeof previousMetadataRecord?.page_kind === "string" ? previousMetadataRecord.page_kind : null);

    if (updatedType === "page") {
        await revalidatePublicContent({ type: "page", slug: updatedSlug, pageKind: updatedPageKind });
    } else if (updatedType === "blog") {
        await revalidatePublicContent({ type: "blog", slug: updatedSlug });
        // If the slug or title changed, the old URL must also be busted.
        const previousSlug = typeof previousItemRecord?.slug === "string" ? previousItemRecord.slug : null;
        if (previousSlug && previousSlug !== updatedSlug) {
            await revalidatePublicContent({ type: "blog", slug: previousSlug });
        }
    }

    if (previousItemRecord?.status !== "published" && data.status === "published" && data.type === "blog") {
        const publishedWorkspaceId = typeof data.workspace_id === "string" ? data.workspace_id : scope.workspaceId;
        if (publishedWorkspaceId) {
            const seoLifecycle = await markSeoSourcePublished({
                supabase,
                workspaceId: publishedWorkspaceId,
                contentId: data.id,
                metadata: data.metadata,
            });
            if (seoLifecycle.error) {
                console.warn("[content-engine] SEO source lifecycle update failed:", seoLifecycle.error);
            } else if (seoLifecycle.source) {
                revalidatePath("/dashboard/seo");
            }
        }

        const internalLinkJobResult = await enqueueInternalLinkJobForPublishedContent({
            workspaceId: publishedWorkspaceId,
            templateId: typeof data.template_id === "string" ? data.template_id : scope.templateId,
            contentId: data.id,
            locale: typeof data.locale === "string" ? data.locale : "en",
            title: typeof data.title === "string" ? data.title : null,
            slug: typeof data.slug === "string" ? data.slug : null,
            contentMarkdown: typeof data.content_markdown === "string" ? data.content_markdown : null,
            visualLayout: (data.visual_layout ?? null) as Json | null,
            metadata: (data.metadata ?? null) as Json | null,
            forceRequeue: true,
        });

        if (internalLinkJobResult.error) {
            console.warn("[content-engine] Internal-link job enqueue skipped:", internalLinkJobResult.error);
        } else if (internalLinkJobResult.status === "queued" || internalLinkJobResult.status === "reactivated") {
            after(async () => {
                const workerId = `next-bg-${Date.now()}`;
                console.log(`[seo-bg-worker] Starting background job drainer: ${workerId}`);
                let consecutiveFailures = 0;
                while (true) {
                    try {
                        const { processNextInternalLinkJob } = await import("@/features/seo/worker");
                        const result = await processNextInternalLinkJob(workerId);
                        if (!result.success) {
                            if (result.message === "No queued jobs found.") break;
                            consecutiveFailures++;
                            console.warn(`[seo-bg-worker] Job skipped/failed: ${result.message}`);
                            if (consecutiveFailures > 5) break;
                        } else {
                            consecutiveFailures = 0;
                        }
                    } catch (err) {
                        console.error("[seo-bg-worker] Drainer loop crashed:", err);
                        break;
                    }
                }
            });
        }

        await enqueueContentPublishedAutomations(id);

        const indexingJobResult = await enqueueBlogIndexingJob({
            workspaceId: publishedWorkspaceId,
            contentId: data.id,
            slug: typeof data.slug === "string" ? data.slug : "",
            locale: typeof data.locale === "string" ? data.locale : "en",
            sourceEvent: "blog_published",
            supabase,
        });
        if (indexingJobResult.error) {
            console.warn("[content-engine] Blog indexing enqueue skipped:", indexingJobResult.error);
        }
    }

    return { data };
}

export async function deleteContentItem(id: string) {
    if (!id) return { error: "ID is required" };

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Unauthorized" };
    }

    const scope = await resolveContentScope();
    // Capture identity BEFORE deletion so we know which public surface to bust.
    const { data: doomedItem } = await getContentItemById(id);

    let query = supabase
        .from("content_items")
        .delete()
        .eq("id", id);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { error } = await query;

    if (error) {
        console.error("Error deleting content:", error);
        return { error: "Failed to delete content item" };
    }

    revalidatePath("/dashboard/content");

    const deletedType = typeof doomedItem?.type === "string" ? doomedItem.type : null;
    const deletedSlug = typeof doomedItem?.slug === "string" ? doomedItem.slug : null;
    const deletedPageKind = typeof doomedItem?.metadata?.page_kind === "string" ? doomedItem.metadata.page_kind : null;
    if (deletedType === "page") {
        await revalidatePublicContent({ type: "page", slug: deletedSlug, pageKind: deletedPageKind });
    } else if (deletedType === "blog") {
        await revalidatePublicContent({ type: "blog", slug: deletedSlug });
    }

    return { success: true };
}

export async function updateContentVisualLayout(id: string, visualLayout: VisualLayoutInput | PublicBuilderData | PublicPagePuckDataV2, status?: string) {
    if (!id) return { error: "ID is required" };

    // ── Payload size guard ──────────────────────────────────────────
    const serializedSize = JSON.stringify(visualLayout).length;
    if (serializedSize > MAX_VISUAL_LAYOUT_BYTES) {
        console.error(`[updateContentVisualLayout] payload too large: ${serializedSize} bytes for id=${id}`);
        return { error: `Visual layout payload exceeds ${(MAX_VISUAL_LAYOUT_BYTES / 1024 / 1024).toFixed(0)} MB limit. Reduce block count or content.` };
    }

    // ── Structural guard ────────────────────────────────────────────
    if (!visualLayout || typeof visualLayout !== "object" || Array.isArray(visualLayout)) {
        console.error("[updateContentVisualLayout] invalid payload structure — expected object with root + content");
        return { error: "Invalid visual layout structure." };
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Unauthorized" };
    }

    const scope = await resolveContentScope();
    const { data: currentItem, error: currentItemError } = await getContentItemById(id);

    if (currentItemError || !currentItem) {
        return { error: "Failed to load content item" };
    }

    const pageKind = typeof currentItem.metadata?.page_kind === "string" ? currentItem.metadata.page_kind : undefined;
    const isV2Layout = isPublicPagePuckDataV2(visualLayout);
    const normalizedVisualLayout = isV2Layout ? null : normalizePublicBuilderData(visualLayout, pageKind);
    const currentV2Layout = isPublicPagePuckDataV2(currentItem.public_layout_v2) ? currentItem.public_layout_v2 : null;
    const publicLayoutForSave = isV2Layout && currentV2Layout && status !== "published"
        ? preserveProtectedPublicPageSemantics(currentV2Layout, visualLayout)
        : isV2Layout
            ? visualLayout
            : null;

    if (!isV2Layout && !normalizedVisualLayout) {
        console.error("[updateContentVisualLayout] normalization returned null — refusing to persist empty layout");
        return { error: "Layout normalization failed. The payload could not be converted to a valid builder layout." };
    }

    if (isV2Layout && status === "published") {
        const slug = typeof currentItem.slug === "string" ? currentItem.slug : "";
        const route = slug === "home" ? "/" : `/${slug}`;
        const definition = resolvePublicPageDefinition(route);
        if (definition) {
            const validation = validatePublicPageData(visualLayout, definition);
            if (!validation.ok) {
                return {
                    error: `Publication blocked by public page validation: ${validation.issues.slice(0, 4).map((issue) => issue.message).join(" ")}`,
                };
            }
        }
        if (currentV2Layout) {
            const protectedIssues = validateProtectedPublicPageEdit(currentV2Layout, visualLayout as PublicPagePuckDataV2);
            if (protectedIssues.length > 0) {
                return {
                    error: `Publication blocked by protected public-page semantics: ${protectedIssues.slice(0, 3).map((issue) => issue.message).join(" ")}`,
                };
            }
        }
    }

    const updatePayload: Record<string, unknown> = {
        ...(isV2Layout
            ? { public_layout_v2: publicLayoutForSave }
            : { visual_layout: normalizedVisualLayout as unknown as Json }),
        ...(status ? { status } : {}),
    };

    let query = supabase
        .from("content_items")
        .update(updatePayload as never)
        .eq("id", id);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query.select().single();

    if (error) {
        console.error("Error updating visual layout:", error);
        return { error: "Failed to update visual layout" };
    }

    // ── Revalidation: admin routes ──────────────────────────────────
    revalidatePath("/dashboard/content");
    revalidatePath(`/dashboard/content/${id}`);
    revalidatePath(`/dashboard/builder/${id}`);

    // ── Revalidation: public routes ─────────────────────────────────
    // Middleware rewrites `/en/<path>` → `/<path>` but Next.js keys the
    // Full Route Cache by visible URL, so each locale prefix is cached
    // separately. The PublicLayout also reads chrome overrides from the
    // page's metadata, so we revalidate the `"layout"` segment to bust
    // both page- and layout-level data. See revalidate-public.ts.
    const slug = typeof currentItem.slug === "string" ? currentItem.slug : null;
    await revalidatePublicContent({ type: "page", slug, pageKind });

    return { data, error: null };
}

export async function getPageContentItems() {
    const supabase = await createClient();
    const scope = await resolveContentScope();

    let query = supabase
        .from("content_items")
        .select("id, title, slug, type, status, updated_at, visual_layout, public_layout_v2")
        .eq("type", "page")
        .order("title", { ascending: true });

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching page content items:", error);
        return { error: "Failed to fetch page content items", data: null };
    }

    return { data, error: null };
}

export interface ListPagesQuery {
    search?: string;
    statuses?: string[];
    page?: number;
    pageSize?: number;
}

export interface ListPagesResult {
    data: Array<{
        id: string;
        title: string;
        slug: string | null;
        type: string | null;
        status: string | null;
        updated_at: string | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
    statusCounts: Record<string, number>;
    error: string | null;
}

export async function listBuilderPages(query: ListPagesQuery = {}): Promise<ListPagesResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

    const supabase = await createClient();
    const scope = await resolveContentScope();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let base = (supabase.from("content_items") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("id, title, slug, type, status, updated_at", { count: "exact" })
        .eq("type", "page");

    if (scope.workspaceId) {
        base = base.or(
            `workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`,
        );
    } else {
        base = base.eq("template_id", scope.templateId);
    }

    if (query.statuses && query.statuses.length > 0) {
        base = base.in("status", query.statuses);
    }
    if (query.search && query.search.trim()) {
        const term = query.search.trim().replace(/[%_]/g, "\\$&");
        base = base.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
    }

    const STATUSES = ["draft", "ready", "published"] as const;

    const countByStatus = async (status: string) => {
        let q = (supabase.from("content_items") as unknown as {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            select: (c: string, opts: { count: "exact"; head: true }) => any;
        })
            .select("id", { count: "exact", head: true })
            .eq("type", "page")
            .eq("status", status);
        if (scope.workspaceId) {
            q = q.or(
                `workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`,
            );
        } else {
            q = q.eq("template_id", scope.templateId);
        }
        const res = await q;
        return { status, count: (res?.count as number | null) ?? 0 };
    };

    const [listRes, ...countsRes] = await Promise.all([
        base.order("title", { ascending: true }).range(from, to),
        ...STATUSES.map(countByStatus),
    ]);

    if (listRes.error) {
        return {
            data: [],
            total: 0,
            page,
            pageSize,
            statusCounts: {},
            error: listRes.error.message,
        };
    }

    const statusCounts: Record<string, number> = {};
    for (const r of countsRes) {
        statusCounts[r.status] = r.count;
    }

    return {
        data: (listRes.data ?? []) as ListPagesResult["data"],
        total: listRes.count ?? 0,
        page,
        pageSize,
        statusCounts,
        error: null,
    };
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function deleteContentItems(
    ids: readonly string[],
): Promise<{ error: string | null; deleted: number }> {
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, deleted: 0 };
    const supabase = await createClient();
    const scope = await resolveContentScope();

    let q = (supabase as unknown as {
        from: (t: string) => {
            delete: (opts: { count: "exact" }) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                in: (c: string, v: string[]) => any;
            };
        };
    })
        .from("content_items")
        .delete({ count: "exact" })
        .in("id", cleaned);
    if (scope.workspaceId) {
        q = q.or(
            `workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`,
        );
    } else {
        q = q.eq("template_id", scope.templateId);
    }
    const { error, count } = await q;
    if (error) return { error: error.message, deleted: 0 };
    revalidatePath("/dashboard/builder");
    revalidatePath("/dashboard/content");
    return { error: null, deleted: (count as number | null) ?? 0 };
}

export async function createBuilderPage(input: { title: string; slug: string; pageIntent?: string; starterPreset?: string }) {
    const title = input.title.trim();
    const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

    if (!title) {
        return { data: null, error: "Page title is required." };
    }

    if (!slug) {
        return { data: null, error: "Page slug is required." };
    }

    // Guard against reserved core-page slugs
    if (slug === "home" || slug === "services" || slug === "about" || slug === "contact") {
        return { data: null, error: `The slug "${slug}" is reserved for a core page. Choose a different slug.` };
    }

    // Validate starter preset against known set
    const safePreset = input.starterPreset?.trim() || null;
    if (safePreset && !VALID_STARTER_PRESETS.has(safePreset)) {
        console.warn(`[createBuilderPage] unknown starter preset "${safePreset}" — falling back to empty layout`);
        // Don't fail, just fall back to empty layout
    }

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { data: null, error: "Unauthorized" };
    }

    const scope = await resolveContentScope();

    let existingQuery = supabase
        .from("content_items")
        .select("id")
        .eq("type", "page")
        .eq("slug", slug)
        .limit(1);

    if (scope.workspaceId) {
        existingQuery = existingQuery.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        existingQuery = existingQuery.eq("template_id", scope.templateId);
    }

    const { data: existingPage, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) {
        return { data: null, error: "Failed to validate page slug." };
    }

    if (existingPage) {
        return { data: null, error: "A page with this slug already exists in the active workspace." };
    }

    const metadata = {
        source: "core-page-builder",
        page_kind: "custom",
        structured_content: null,
        page_intent: input.pageIntent?.trim() || null,
        starter_preset: safePreset,
    } as Json;

    // Only use the preset if it's valid; otherwise fall back to empty layout
    const resolvedPreset = safePreset && VALID_STARTER_PRESETS.has(safePreset) ? safePreset : null;

    const { data, error } = await supabase
        .from("content_items")
        .insert({
            title,
            slug,
            type: "page",
            status: "draft",
            content_markdown: `${title} page managed in the workspace page builder.`,
            visual_layout: createStarterPresetPuckData(resolvedPreset, title) as unknown as Json,
            metadata,
            author_id: user.id,
            workspace_id: scope.workspaceId,
            template_id: scope.templateId,
            locale: scope.defaultLocale,
        })
        .select("id, title, slug, type, status, updated_at, visual_layout")
        .single();

    if (error) {
        return { data: null, error: "Failed to create builder page." };
    }

    revalidatePath("/(admin)/dashboard/builder");
    revalidatePath("/dashboard/builder");
    return { data, error: null };
}

export async function seedCorePageContentItems() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: "Unauthorized", data: null };
    }

    const scope = await resolveContentScope();

    let existingQuery = supabase
        .from("content_items")
        .select("slug")
        .eq("type", "page");

    if (scope.workspaceId) {
        existingQuery = existingQuery.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        existingQuery = existingQuery.eq("template_id", scope.templateId);
    }

    const { data: existingPages, error: existingError } = await existingQuery;

    if (existingError) {
        console.error("Error reading existing core pages:", existingError);
        return { error: "Failed to inspect existing pages", data: null };
    }

    const existingSlugs = new Set((existingPages ?? []).map((page) => page.slug));
    const defaults = buildSeededCorePageEntries().filter((entry) => !existingSlugs.has(entry.slug));

    if (defaults.length === 0) {
        return { data: [], error: null };
    }

    const { data, error } = await supabase
        .from("content_items")
        .insert(defaults.map((entry) => ({
            ...entry,
            type: "page",
            status: "published",
            author_id: user.id,
            workspace_id: scope.workspaceId,
            template_id: scope.templateId,
            locale: scope.defaultLocale,
        })))
        .select("id, title, slug, type, status, updated_at, visual_layout");

    if (error) {
        console.error("Error seeding core page content items:", error);
        return { error: "Failed to seed core pages", data: null };
    }

    return { data, error: null };
}

export async function revalidateCorePagePaths() {
    revalidatePath("/dashboard/builder");
    // Bust the entire public layout across every locale — covers /, /about,
    // /services, /contact and all child paths including locale variants.
    await revalidateAllPublicSurfaces();
}

export async function getPageContentItemBySlug(slug: string) {
    if (!slug) {
        return { error: "Slug is required", data: null };
    }

    const supabase = await createClient();
    const scope = await resolveContentScope();

    let query = supabase
        .from("content_items")
        .select("*")
        .eq("type", "page")
        .eq("slug", slug)
        .eq("status", "published");

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        if (isNoRowsError(error)) {
            return { data: null, error: null };
        }
        console.error("Error fetching page content item by slug:", error);
        return { error: "Failed to fetch page content item", data: null };
    }

    return { data, error: null };
}
