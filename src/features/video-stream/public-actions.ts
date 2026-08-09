"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getActiveTemplate, getSiteSettings } from "@/features/templates/actions";
import { stripLocaleFromPathname, localizeHref, SUPPORTED_LOCALES } from "@/shared/lib/i18n/routing";

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type VideoLocale = "en" | "nl" | "ar";

export interface PublicVideoItem {
    id: string;
    title: string;
    slug: string | null;
    video_url: string;
    video_duration: number | null;
    video_resolution: string | null;
    content_markdown: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

interface VideoScope {
    workspaceId: string | null;
    templateId: string;
    locale: VideoLocale;
}

function coerceLocale(value: unknown): VideoLocale {
    return value === "nl" || value === "ar" ? value : "en";
}

async function resolveVideoScope(): Promise<VideoScope> {
    const [context, settings, active] = await Promise.all([
        resolveWorkspaceContext(),
        getSiteSettings(),
        getActiveTemplate(),
    ]);
    const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));
    return {
        workspaceId,
        templateId: resolution.templateId,
        locale: coerceLocale(active?.locale),
    };
}

const SELECT_FIELDS =
    "id, title, slug, video_url, video_duration, video_resolution, content_markdown, metadata, created_at, updated_at";

function scopeClause(scope: VideoScope): string {
    return `workspace_id.eq.${scope.workspaceId},template_id.eq.${scope.templateId}`;
}

export async function getPublishedVideos(): Promise<{ data: PublicVideoItem[]; error: string | null }> {
    const scope = await resolveVideoScope();
    const supabase = await createClient();

    let query = supabase
        .from("content_items")
        .select(SELECT_FIELDS)
        .eq("type", "video")
        .eq("status", "published")
        .eq("locale", scope.locale)
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

    query = scope.workspaceId
        ? query.or(scopeClause(scope))
        : query.eq("template_id", scope.templateId);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    return { data: (data ?? []) as unknown as PublicVideoItem[], error: null };
}

export async function getPublishedVideoBySlug(
    slug: string,
): Promise<{ video: PublicVideoItem | null; error: string | null }> {
    if (!slug) return { video: null, error: "Slug required" };
    const scope = await resolveVideoScope();
    const supabase = await createClient();

    let query = supabase
        .from("content_items")
        .select(SELECT_FIELDS)
        .eq("type", "video")
        .eq("status", "published")
        .eq("locale", scope.locale)
        .eq("slug", slug)
        .not("video_url", "is", null)
        .limit(1);

    query = scope.workspaceId
        ? query.or(scopeClause(scope))
        : query.eq("template_id", scope.templateId);

    const { data, error } = await query;
    if (error) return { video: null, error: error.message };

    const video = (data?.[0] ?? null) as unknown as PublicVideoItem | null;
    return { video, error: null };
}

export async function resolveVideoLocaleSwitchHref(input: {
    pathname: string;
    nextLocale: SupportedLocale;
}) {
    const strippedPathname = stripLocaleFromPathname(input.pathname || "/");

    // Case 1: Video Index /videos
    if (strippedPathname === "/videos" || strippedPathname === "/videos/") {
        return localizeHref(input.nextLocale, "/videos");
    }

    // Parse segments: /videos/[slug]
    const segments = strippedPathname.split("/").filter(Boolean); // ["videos", slug]
    if (segments[0] !== "videos" || segments.length < 2) {
        return null;
    }

    const videoSlug = segments[1];
    const supabase = await createClient();
    const scope = await resolveVideoScope();

    // Check if the video exists in the target locale
    let query = supabase
        .from("content_items")
        .select("slug")
        .eq("type", "video")
        .eq("slug", videoSlug)
        .eq("locale", input.nextLocale)
        .eq("status", "published")
        .not("video_url", "is", null)
        .limit(1);

    query = scope.workspaceId
        ? query.or(`workspace_id.eq.${scope.workspaceId},template_id.eq.${scope.templateId}`)
        : query.eq("template_id", scope.templateId);

    const { data } = await query;
    const exists = Boolean(data?.length);

    if (exists) {
        return localizeHref(input.nextLocale, `/videos/${videoSlug}`);
    }

    // Fallback: Redirect to /videos in target locale
    return localizeHref(input.nextLocale, "/videos");
}

export async function findPublishedLocalesForVideoSlug(slug: string): Promise<SupportedLocale[]> {
    if (!slug) return [];
    const scope = await resolveVideoScope();
    const supabase = await createClient();

    let query = supabase
        .from("content_items")
        .select("locale")
        .eq("type", "video")
        .eq("status", "published")
        .eq("slug", slug)
        .not("video_url", "is", null);

    query = scope.workspaceId
        ? query.or(`workspace_id.eq.${scope.workspaceId},template_id.eq.${scope.templateId}`)
        : query.eq("template_id", scope.templateId);

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row) => row.locale as SupportedLocale);
}

export async function getPublishedVideoLocaleMap() {
    const scope = await resolveVideoScope();
    const supabase = await createClient();

    let query = supabase
        .from("content_items")
        .select("id, title, slug, locale, video_url, video_duration, video_resolution, content_markdown, metadata, updated_at, created_at")
        .eq("type", "video")
        .eq("status", "published")
        .not("video_url", "is", null);

    query = scope.workspaceId
        ? query.or(`workspace_id.eq.${scope.workspaceId},template_id.eq.${scope.templateId}`)
        : query.eq("template_id", scope.templateId);

    const { data, error } = await query;
    if (error) {
        console.error("[video] Error fetching video locale map:", error);
        return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
}
