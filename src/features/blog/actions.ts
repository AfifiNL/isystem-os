"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getActiveTemplate, getSiteSettings } from "@/features/templates/actions";
import { stripLocaleFromPathname, type SUPPORTED_LOCALES } from "@/shared/lib/i18n/routing";
import { toBlogAuthor, type BlogAuthor, type BlogPaginationMetadata, type ProfileRow } from "@/features/blog/types";
import { canonicalBlogHref } from "@/features/blog/urls";
import { RETIRED_BLOG_POSTGREST_FILTER } from "@/features/blog/retired-posts";
import { sanitizePublicContent } from "@/features/seo/public-content-sanitizer";

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_BLOG_PAGE_SIZE = 9;
const ISYSTEM_FOUNDER_AUTHOR: BlogAuthor = {
    id: "isystem-founder-hossam-afifi",
    display_name: "Hossam Afifi",
    role_title: "Founder and Systems Operator at iSystem.ai",
    bio: "Hossam Afifi builds and operates iSystem.ai from Breda, informed by his MSc research on Dutch SME adaptation to AI, regulation, and digital competition.",
    avatar_url: null,
    social_links: {
        linkedin: "https://www.linkedin.com/in/hossamafifi",
        website: "https://isystem.ai/en/about",
    },
};

// PostgREST projection for the joined author profile. Columns added in
// migration 20260427160000_isystem_author_profiles.sql.
const AUTHOR_PROJECTION = "author:profiles!content_items_author_id_fkey(id,email,display_name,role_title,bio,avatar_url,social_links)";

interface PublishedPostsPaginationOptions {
    page?: number;
    pageSize?: number;
    localeOverride?: SupportedLocale;
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
    if (!Number.isFinite(value) || !value || value < 1) {
        return fallback;
    }

    return Math.floor(value);
}

function normalizePublishedPostsPagination(options: PublishedPostsPaginationOptions | undefined) {
    const page = normalizePositiveInteger(options?.page, 1);
    const pageSize = Math.min(normalizePositiveInteger(options?.pageSize, DEFAULT_BLOG_PAGE_SIZE), 48);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    return { page, pageSize, from, to };
}

function pickAuthor(row: { author?: unknown } | null | undefined): BlogAuthor | null {
    if (!row || !row.author) return null;
    // PostgREST returns the joined row as an object (one-to-one) or an array
    // when the FK relationship is ambiguous. Handle both shapes.
    const raw = Array.isArray(row.author) ? row.author[0] : row.author;
    return toBlogAuthor(raw as Partial<ProfileRow>);
}

function normalizePublicPost<T extends { author?: unknown; content_markdown?: string | null }>(
    row: T,
    locale: SupportedLocale,
    templateId: string,
) {
    return {
        ...row,
        content_markdown: sanitizePublicContent(row.content_markdown, locale),
        author: pickAuthor(row) ?? (templateId === "isystem-agency" ? ISYSTEM_FOUNDER_AUTHOR : null),
    };
}

async function resolveBlogScope(localeOverride?: SupportedLocale) {
    const context = await resolveWorkspaceContext();
    const settings = await getSiteSettings();
    const templateResolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
    const { locale } = await getActiveTemplate();

    // Anonymous visitors have no auth cookie → context is null. Fall back to
    // the canonical workspace that owns the active template so public reads
    // match the rows admins edit (otherwise template_id-only queries return
    // arbitrary rows across workspaces sharing the template).
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(templateResolution.templateId));

    return {
        workspaceId,
        templateId: templateResolution.templateId,
        locale: localeOverride ?? locale,
    };
}

function getBlogSlugFromPathname(pathname: string) {
    const strippedPathname = stripLocaleFromPathname(pathname || "/");
    const match = strippedPathname.match(/^\/blog\/([^/?#]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function publishedPostExistsForLocale(slug: string, locale: SupportedLocale) {
    const supabase = await createClient();
    const scope = await resolveBlogScope(locale);

    let query = supabase
        .from("content_items")
        .select("id")
        .eq("type", "blog")
        .eq("slug", slug)
        .eq("status", "published")
        .eq("locale", scope.locale)
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER)
        .limit(1);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("[blog] Error checking localized post:", error);
        return false;
    }

    return Boolean(data?.length);
}

export async function resolveBlogLocaleSwitchHref(input: {
    pathname: string;
    nextLocale: SupportedLocale;
}) {
    const strippedPathname = stripLocaleFromPathname(input.pathname || "/");

    if (strippedPathname === "/blog" || strippedPathname === "/blog/") {
        return canonicalBlogHref(input.nextLocale, "/blog");
    }

    const slug = getBlogSlugFromPathname(strippedPathname);

    if (!slug) {
        return null;
    }

    const localizedPostExists = await publishedPostExistsForLocale(slug, input.nextLocale);
    return canonicalBlogHref(input.nextLocale, localizedPostExists ? `/blog/${slug}` : "/blog");
}

// Returns one row per (slug, locale) for every published blog post in the
// active workspace/template, without locale scoping. Powers the sitemap so
// hreflang alternates are only emitted for locales that actually have a
// published translation — otherwise Google crawls localized URLs that 404.
export async function getPublishedPostLocaleMap() {
    const supabase = await createClient();
    const scope = await resolveBlogScope();

    let query = supabase
        .from("content_items")
        .select("slug, locale, updated_at, created_at, featured_image_url:metadata->>featured_image_url")
        .eq("type", "blog")
        .eq("status", "published")
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("[blog] Error fetching post locale map:", error);
        return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
}

// For a given blog slug, return the set of locales in which a published
// version exists. Used by `[slug]/page.tsx` to recover stale inbound links
// to a localized URL whose translation doesn't exist by redirecting to one
// that does, preserving SEO equity.
export async function findPublishedLocalesForSlug(slug: string): Promise<SupportedLocale[]> {
    if (!slug) return [];

    const supabase = await createClient();
    const scope = await resolveBlogScope();

    let query = supabase
        .from("content_items")
        .select("locale")
        .eq("type", "blog")
        .eq("slug", slug)
        .eq("status", "published")
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER);

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row) => row.locale as SupportedLocale);
}

export async function getPublishedPosts(limit?: number, localeOverride?: SupportedLocale) {
    const supabase = await createClient();
    const scope = await resolveBlogScope(localeOverride);

    let query = supabase
        .from("content_items")
        .select(`id, workspace_id, template_id, title, slug, type, status, created_at, updated_at, content_markdown, metadata, excerpt:metadata->>excerpt, featured_image_url:metadata->>featured_image_url, ${AUTHOR_PROJECTION}`)
        .eq("type", "blog")
        .eq("status", "published")
        .eq("locale", scope.locale)
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER)
        .order("created_at", { ascending: false });

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    if (limit) {
        query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
        console.error("[blog] Error fetching published posts:", error);
        return { data: null, error: error.message };
    }

    // Normalize the joined author into the BlogAuthor shape so renderers
    // never see PostgREST's array-or-object ambiguity.
    const normalized = (data ?? []).map((row) => normalizePublicPost(row, scope.locale, scope.templateId));
    return { data: normalized, error: null };
}

export async function getPaginatedPublishedPosts(options: PublishedPostsPaginationOptions = {}): Promise<{
    data: Awaited<ReturnType<typeof getPublishedPosts>>["data"];
    error: string | null;
    pagination: BlogPaginationMetadata;
}> {
    const supabase = await createClient();
    const scope = await resolveBlogScope(options.localeOverride);
    const paginationInput = normalizePublishedPostsPagination(options);

    let query = supabase
        .from("content_items")
        .select(`id, workspace_id, template_id, title, slug, type, status, created_at, updated_at, content_markdown, metadata, excerpt:metadata->>excerpt, featured_image_url:metadata->>featured_image_url, ${AUTHOR_PROJECTION}`, { count: "exact" })
        .eq("type", "blog")
        .eq("status", "published")
        .eq("locale", scope.locale)
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER)
        .order("created_at", { ascending: false });

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error, count } = await query.range(paginationInput.from, paginationInput.to);
    const totalItems = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / paginationInput.pageSize));
    const pagination: BlogPaginationMetadata = {
        currentPage: paginationInput.page,
        pageSize: paginationInput.pageSize,
        totalItems,
        totalPages,
        hasPreviousPage: paginationInput.page > 1,
        hasNextPage: paginationInput.page < totalPages,
    };

    if (error) {
        console.error("[blog] Error fetching paginated published posts:", error);
        return { data: null, error: error.message, pagination };
    }

    const normalized = (data ?? []).map((row) => normalizePublicPost(row, scope.locale, scope.templateId));
    return { data: normalized, error: null, pagination };
}

export async function getPostBySlug(slug: string) {
    if (!slug) return { data: null, error: "Slug is required" };

    const supabase = await createClient();
    const scope = await resolveBlogScope();

    // Try matching by slug first, then fall back to ID
    let slugQuery = supabase
        .from("content_items")
        .select(`*, ${AUTHOR_PROJECTION}`)
        .eq("type", "blog")
        .eq("slug", slug)
        .eq("status", "published")
        .eq("locale", scope.locale)
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER);

    if (scope.workspaceId) {
        slugQuery = slugQuery.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        slugQuery = slugQuery.eq("template_id", scope.templateId);
    }

    let { data, error } = await slugQuery.single();

    if (error || !data) {
        // Try by ID as fallback
        let idQuery = supabase
            .from("content_items")
            .select(`*, ${AUTHOR_PROJECTION}`)
            .eq("type", "blog")
            .eq("id", slug)
            .eq("status", "published")
            .eq("locale", scope.locale)
            .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER);

        if (scope.workspaceId) {
            idQuery = idQuery.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
        } else {
            idQuery = idQuery.eq("template_id", scope.templateId);
        }

        const result = await idQuery.single();

        data = result.data;
        error = result.error;
    }

    if (error) {
        console.error("[blog] Error fetching post by slug:", error);
        return { data: null, error: error.message };
    }

    const normalized = data ? normalizePublicPost(data, scope.locale, scope.templateId) : null;
    return { data: normalized, error: null };
}

export async function getRelatedPosts(currentId: string, limit = 3) {
    const supabase = await createClient();
    const scope = await resolveBlogScope();

    let query = supabase
        .from("content_items")
        .select(`id, title, slug, created_at, content_markdown, metadata, excerpt:metadata->>excerpt, featured_image_url:metadata->>featured_image_url, ${AUTHOR_PROJECTION}`)
        .eq("type", "blog")
        .eq("status", "published")
        .eq("locale", scope.locale)
        .not("slug", "in", RETIRED_BLOG_POSTGREST_FILTER)
        .neq("id", currentId)
        .order("created_at", { ascending: false });

    if (scope.workspaceId) {
        query = query.or(`workspace_id.eq.${scope.workspaceId},and(workspace_id.is.null,template_id.eq.${scope.templateId})`);
    } else {
        query = query.eq("template_id", scope.templateId);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
        return { data: null, error: error.message };
    }

    const normalized = (data ?? []).map((row) => normalizePublicPost(row, scope.locale, scope.templateId));
    return { data: normalized, error: null };
}
