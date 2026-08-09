"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/shared/lib/supabase/server";
import {
    resolveWorkspaceContext,
    resolveWorkspaceIdFromTemplate,
    getCurrentUserRole,
} from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getSiteSettings } from "@/features/templates/actions";
import { revalidatePublicContent } from "@/features/content-engine/revalidate-public";

const SUPPORTED_LOCALES = ["en", "nl", "ar"] as const;
type ManagerLocale = (typeof SUPPORTED_LOCALES)[number];

const SLUG_FALLBACK = () => `video-${Date.now()}`;

function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || SLUG_FALLBACK();
}

function extractStoragePath(url: string): string | null {
    const marker = "/public-videos/";
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.substring(index + marker.length));
}

const CreateVideoSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().default(""),
    slug: z.string().optional(),
    locale: z.enum(SUPPORTED_LOCALES).default("en"),
    status: z.enum(["draft", "published"]).default("draft"),
    video_url: z.string().url("Video URL is required"),
    video_duration: z.number().int().nonnegative().optional(),
    video_resolution: z.string().optional(),
    poster_url: z.string().url().optional(),
});

const UpdateVideoSchema = CreateVideoSchema.partial();

export type CreateVideoInput = z.infer<typeof CreateVideoSchema>;
export type UpdateVideoInput = z.infer<typeof UpdateVideoSchema>;

interface ManagerScope {
    workspaceId: string;
    templateId: string;
    defaultLocale: ManagerLocale;
    userId: string;
}

async function requireManagerScope(): Promise<{ scope: ManagerScope } | { error: string }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const role = await getCurrentUserRole();
    if (!role || (role.role !== "admin" && role.role !== "manager")) {
        return { error: "Manager or admin role required" };
    }

    const context = await resolveWorkspaceContext();
    const settings = await getSiteSettings();
    const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);

    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));
    if (!workspaceId) return { error: "No active workspace" };

    const rawLocale = context?.activeWorkspace?.default_locale ?? "en";
    const defaultLocale: ManagerLocale =
        rawLocale === "nl" || rawLocale === "ar" ? rawLocale : "en";

    return {
        scope: { workspaceId, templateId: resolution.templateId, defaultLocale, userId: user.id },
    };
}

function buildMetadata(poster_url?: string, description?: string) {
    return {
        source: "manager-upload",
        poster_url: poster_url ?? null,
        description: description ?? null,
    };
}

export async function createVideo(input: CreateVideoInput) {
    const parsed = CreateVideoSchema.safeParse(input);
    if (!parsed.success) {
        return { error: "Invalid fields", details: parsed.error.flatten().fieldErrors };
    }

    const guard = await requireManagerScope();
    if ("error" in guard) return { error: guard.error };
    const { scope } = guard;

    const supabase = await createClient();
    const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
    const locale = parsed.data.locale ?? scope.defaultLocale;

    const { data, error } = await supabase
        .from("content_items")
        .insert([{
            title: parsed.data.title,
            slug,
            type: "video",
            status: parsed.data.status,
            content_markdown: parsed.data.description ?? "",
            video_url: parsed.data.video_url,
            video_duration: parsed.data.video_duration ?? null,
            video_resolution: parsed.data.video_resolution ?? null,
            metadata: buildMetadata(parsed.data.poster_url, parsed.data.description),
            author_id: scope.userId,
            workspace_id: scope.workspaceId,
            template_id: scope.templateId,
            locale,
        }])
        .select()
        .single();

    if (error) {
        console.error("[videos] createVideo failed:", error);
        return { error: `Failed to create video: ${error.message}` };
    }

    revalidatePath("/dashboard/videos");
    if (parsed.data.status === "published") {
        await revalidatePublicContent({ type: "video", slug: data?.slug ? String(data.slug) : null });
    }

    return { data };
}

export async function updateVideo(id: string, input: UpdateVideoInput) {
    if (!id) return { error: "Video id required" };

    const parsed = UpdateVideoSchema.safeParse(input);
    if (!parsed.success) {
        return { error: "Invalid fields", details: parsed.error.flatten().fieldErrors };
    }

    const guard = await requireManagerScope();
    if ("error" in guard) return { error: guard.error };
    const { scope } = guard;

    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await supabase
        .from("content_items")
        .select("id, slug, video_url, metadata, workspace_id, type")
        .eq("id", id)
        .eq("workspace_id", scope.workspaceId)
        .eq("type", "video")
        .maybeSingle();

    if (fetchErr) return { error: fetchErr.message };
    if (!existing) return { error: "Video not found" };

    const nextSlug = parsed.data.slug?.trim() || (parsed.data.title ? slugify(parsed.data.title) : undefined);

    const existingMeta = (existing.metadata as Record<string, unknown> | null) ?? {};
    const nextMetadata =
        parsed.data.poster_url !== undefined || parsed.data.description !== undefined
            ? {
                ...existingMeta,
                poster_url:
                    parsed.data.poster_url !== undefined
                        ? parsed.data.poster_url
                        : (existingMeta.poster_url ?? null),
                description:
                    parsed.data.description !== undefined
                        ? parsed.data.description
                        : (existingMeta.description ?? null),
            }
            : undefined;

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined) patch.content_markdown = parsed.data.description;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.locale !== undefined) patch.locale = parsed.data.locale;
    if (parsed.data.video_url !== undefined) patch.video_url = parsed.data.video_url;
    if (parsed.data.video_duration !== undefined) patch.video_duration = parsed.data.video_duration;
    if (parsed.data.video_resolution !== undefined) patch.video_resolution = parsed.data.video_resolution;
    if (nextSlug !== undefined) patch.slug = nextSlug;
    if (nextMetadata !== undefined) patch.metadata = nextMetadata;

    if (Object.keys(patch).length === 0) {
        return { data: existing };
    }

    const { data, error } = await supabase
        .from("content_items")
        .update(patch)
        .eq("id", id)
        .eq("workspace_id", scope.workspaceId)
        .eq("type", "video")
        .select()
        .single();

    if (error) {
        console.error("[videos] updateVideo failed:", error);
        return { error: `Failed to update video: ${error.message}` };
    }

    // If the URL was replaced, drop the previous file to avoid orphans.
    if (
        parsed.data.video_url !== undefined
        && existing.video_url
        && existing.video_url !== parsed.data.video_url
        && existing.video_url.includes("/public-videos/")
    ) {
        try {
            const path = extractStoragePath(existing.video_url);
            if (path) {
                const { error: delErr } = await supabase.storage.from("public-videos").remove([path]);
                if (delErr) {
                    console.warn("[videos] failed to delete previous file from storage", delErr);
                }
            }
        } catch (e) {
            console.warn("[videos] failed to delete previous storage file", e);
        }
    }

    revalidatePath("/dashboard/videos");
    revalidatePath(`/dashboard/videos/${id}`);

    // Revalidate on any status touch (including published→draft) so a demoted
    // video drops off the public listing instead of waiting for cache TTL.
    // Also revalidate on slug change so the old URL doesn't keep rendering
    // the cached payload after the row moves.
    const newSlug = data?.slug ? String(data.slug) : (existing.slug ? String(existing.slug) : null);
    const slugChanged = existing.slug && newSlug && existing.slug !== newSlug;
    const statusTouched = parsed.data.status !== undefined;
    if (statusTouched || slugChanged) {
        await revalidatePublicContent({ type: "video", slug: newSlug });
        if (slugChanged && existing.slug) {
            await revalidatePublicContent({ type: "video", slug: String(existing.slug) });
        }
    } else if (data?.status === "published") {
        await revalidatePublicContent({ type: "video", slug: newSlug });
    }

    return { data };
}

export async function deleteVideo(id: string) {
    if (!id) return { error: "Video id required" };

    const guard = await requireManagerScope();
    if ("error" in guard) return { error: guard.error };
    const { scope } = guard;

    const supabase = await createClient();
    const { data: existing } = await supabase
        .from("content_items")
        .select("id, slug, video_url")
        .eq("id", id)
        .eq("workspace_id", scope.workspaceId)
        .eq("type", "video")
        .maybeSingle();

    if (!existing) return { error: "Video not found" };

    const { error } = await supabase
        .from("content_items")
        .delete()
        .eq("id", id)
        .eq("workspace_id", scope.workspaceId)
        .eq("type", "video");

    if (error) return { error: error.message };

    if (existing.video_url && existing.video_url.includes("/public-videos/")) {
        try {
            const path = extractStoragePath(existing.video_url);
            if (path) {
                const { error: delErr } = await supabase.storage.from("public-videos").remove([path]);
                if (delErr) {
                    console.warn("[videos] failed to delete file from storage on remove", delErr);
                }
            }
        } catch (e) {
            console.warn("[videos] failed to delete storage file on remove", e);
        }
    }

    revalidatePath("/dashboard/videos");
    await revalidatePublicContent({ type: "video", slug: existing.slug ? String(existing.slug) : null });

    return { success: true };
}

export interface WorkspaceVideoListItem {
    id: string;
    title: string;
    slug: string | null;
    status: string;
    locale: string;
    video_url: string;
    video_duration: number | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export async function listWorkspaceVideos(): Promise<{
    data: WorkspaceVideoListItem[];
    error: string | null;
}> {
    const guard = await requireManagerScope();
    if ("error" in guard) return { data: [], error: guard.error };
    const { scope } = guard;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("content_items")
        .select("id, title, slug, status, locale, video_url, video_duration, metadata, created_at, updated_at")
        .eq("workspace_id", scope.workspaceId)
        .eq("type", "video")
        .order("updated_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as unknown as WorkspaceVideoListItem[], error: null };
}

export async function getWorkspaceVideoById(id: string): Promise<{
    data: WorkspaceVideoListItem | null;
    error: string | null;
}> {
    if (!id) return { data: null, error: "Video id required" };

    const guard = await requireManagerScope();
    if ("error" in guard) return { data: null, error: guard.error };
    const { scope } = guard;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("content_items")
        .select("id, title, slug, status, locale, video_url, video_duration, metadata, created_at, updated_at")
        .eq("id", id)
        .eq("workspace_id", scope.workspaceId)
        .eq("type", "video")
        .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: (data ?? null) as unknown as WorkspaceVideoListItem | null, error: null };
}
