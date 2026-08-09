"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext, assertWorkspaceAdminOrManager } from "@/shared/lib/workspace/context";
import type { BlogAuthor, ProfileRow } from "@/features/blog/types";
import { toBlogAuthor } from "@/features/blog/types";

interface AuthorPatch {
    display_name?: string;
    role_title?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    social_links?: {
        linkedin?: string;
        x?: string;
        github?: string;
        website?: string;
    };
}

const SOCIAL_KEYS = ["linkedin", "x", "github", "website"] as const;

function sanitizeText(value: string | null | undefined, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
}

function sanitizeUrl(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return trimmed.slice(0, 500);
}

/**
 * List every profile that has authored a blog post in the active workspace,
 * plus all admin/manager profiles assigned to the workspace. Returns BlogAuthor
 * objects ready for rendering in the admin Authors tab.
 */
export async function listWorkspaceAuthors(): Promise<{
    data: BlogAuthor[];
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { data: [], error: "No active workspace." };
    const supabase = await createClient();

    // Authors of existing blog posts in this workspace.
    const { data: postAuthorRows, error: postsErr } = await supabase
        .from("content_items")
        .select("author_id")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .eq("type", "blog")
        .not("author_id", "is", null);
    if (postsErr) return { data: [], error: postsErr.message };

    const authorIds = new Set<string>();
    for (const row of postAuthorRows ?? []) {
        const id = (row as { author_id: string | null }).author_id;
        if (id) authorIds.add(id);
    }

    // Workspace owner + assigned managers.
    const { data: managerRows } = await supabase
        .from("workspace_managers")
        .select("manager_profile_id")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .eq("is_active", true);
    for (const row of managerRows ?? []) {
        const id = (row as { manager_profile_id: string | null }).manager_profile_id;
        if (id) authorIds.add(id);
    }
    if (ctx.activeWorkspace.owner_profile_id) {
        authorIds.add(ctx.activeWorkspace.owner_profile_id);
    }

    if (authorIds.size === 0) return { data: [], error: null };

    const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, email, display_name, role_title, bio, avatar_url, social_links")
        .in("id", Array.from(authorIds));
    if (profErr) return { data: [], error: profErr.message };

    const authors = (profiles ?? [])
        .map((p) => toBlogAuthor(p as Partial<ProfileRow>))
        .filter((a): a is BlogAuthor => Boolean(a))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));

    return { data: authors, error: null };
}

/**
 * Update one author profile. The caller MUST be a workspace admin or manager.
 * Profile rows are 1:1 with auth users — not workspace-scoped — so the
 * permission check is on the active workspace's role rather than ownership of
 * the profile row. Operators can update any author whose profile is in the
 * workspace (matching the listWorkspaceAuthors set).
 */
export async function updateAuthorProfile(input: {
    profileId: string;
    patch: AuthorPatch;
}): Promise<{ data: BlogAuthor | null; error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { data: null, error: err instanceof Error ? err.message : "Forbidden" };
    }

    if (!input.profileId) return { data: null, error: "profileId required" };
    const supabase = await createClient();

    // Verify the target profile is part of this workspace's author set.
    const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", input.profileId)
        .maybeSingle();
    if (!existing) return { data: null, error: "Profile not found." };

    const social: Record<string, string> = {};
    for (const key of SOCIAL_KEYS) {
        const url = sanitizeUrl(input.patch.social_links?.[key]);
        if (url) social[key] = url;
    }

    const updates: Record<string, unknown> = {
        display_name: sanitizeText(input.patch.display_name, 120) ?? null,
        role_title: sanitizeText(input.patch.role_title, 160),
        bio: sanitizeText(input.patch.bio, 600),
        avatar_url: sanitizeUrl(input.patch.avatar_url),
        social_links: social,
    };

    const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", input.profileId)
        .select("id, email, display_name, role_title, bio, avatar_url, social_links")
        .single();
    if (error) return { data: null, error: error.message };

    // Bust both blog list and any cached blog detail across every locale.
    // Workspace-scoped revalidate is unavailable here, so we revalidate the
    // broad blog paths.
    const { revalidatePublicContent } = await import("@/features/content-engine/revalidate-public");
    await revalidatePublicContent({ type: "blog" });
    revalidatePath("/dashboard/settings");

    void context;
    return { data: toBlogAuthor(data as Partial<ProfileRow>), error: null };
}
