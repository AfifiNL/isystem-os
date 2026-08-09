"use server";

import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext, resolveWorkspaceIdFromTemplate } from "@/shared/lib/workspace/context";
import { resolveLegacyTemplateForWorkspaceContext } from "@/features/templates/workspace-adapter";
import { getActiveTemplate, getSiteSettings } from "@/features/templates/actions";
import type { PodcastEpisode, PodcastShow } from "./types";
import { stripLocaleFromPathname, localizeHref, SUPPORTED_LOCALES } from "@/shared/lib/i18n/routing";

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type PodcastLocale = "en" | "nl" | "ar";

interface PodcastScope {
    workspaceId: string | null;
    templateId: string;
    locale: PodcastLocale;
}

function coercePodcastLocale(value: unknown): PodcastLocale {
    return value === "nl" || value === "ar" ? value : "en";
}

async function resolvePodcastScope(): Promise<PodcastScope> {
    const [context, settings, active] = await Promise.all([
        resolveWorkspaceContext(),
        getSiteSettings(),
        getActiveTemplate(),
    ]);
    const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
    // Anonymous visitors fall back to the canonical workspace for the active
    // template so public reads match the workspace admins edit.
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));
    return {
        workspaceId,
        templateId: resolution.templateId,
        // Locale comes from the path segment via middleware → x-site-locale,
        // which getActiveTemplate() reads. Public episode lists must filter
        // on this so /en/ never surfaces a /nl episode and vice versa.
        locale: coercePodcastLocale(active?.locale),
    };
}

// Public scoping: match shows whose `workspace_id` equals the active workspace
// OR whose `template_id` equals the active template. The OR-branch covers
// historical rows seeded under a different workspace id but the same template,
// and lets shows surface immediately when the workspace context isn't
// resolvable (anonymous probe before domain → workspace mapping resolves).
//
// Tenant safety: the application-level filter is a floor; RLS allows public
// reads of any `is_published = true` row. See migration 20260426221000 for the
// documented posture.
function applyShowScope<T extends {
    or: (clause: string) => T;
    eq: (col: string, val: string) => T;
}>(query: T, scope: PodcastScope): T {
    if (scope.workspaceId) {
        return query.or(`workspace_id.eq.${scope.workspaceId},template_id.eq.${scope.templateId}`);
    }
    return query.eq("template_id", scope.templateId);
}

export async function getPublishedShows(): Promise<{ data: PodcastShow[]; error: string | null }> {
    const scope = await resolvePodcastScope();
    const supabase = await createClient();

    // Pull shows AND their published-episode counts in two queries, then union.
    // The first query is `is_published = true` shows. The second is shows with
    // at least one published episode but `is_published = false` — covers the
    // case where the operator published an episode but never flipped the show
    // toggle. Both code paths land here so we don't lose either set.
    const baseQuery = applyShowScope(
        supabase
            .from("podcast_shows")
            .select("*")
            .order("updated_at", { ascending: false }),
        scope,
    );
    const { data: allShows, error } = await baseQuery;
    if (error) return { data: [], error: error.message };

    const candidates = (allShows ?? []) as PodcastShow[];
    if (candidates.length === 0) return { data: [], error: null };

    // Find which candidate shows actually have a published episode IN THE
    // ACTIVE LOCALE. Combined with the explicit `is_published` flag, this
    // gives us the visible set per /{locale}/podcast route. A show whose
    // only published episodes are in another language no longer surfaces.
    const showIds = candidates.map((s) => s.id);
    const { data: epRows } = await supabase
        .from("podcast_episodes")
        .select("show_id")
        .in("show_id", showIds)
        .eq("status", "published")
        .eq("locale", scope.locale);
    const showsWithEpisodes = new Set((epRows ?? []).map((r) => (r as { show_id: string }).show_id));

    const visible = candidates.filter((s) => s.is_published || showsWithEpisodes.has(s.id));
    return { data: visible, error: null };
}

export async function getPublishedShowBySlug(slug: string): Promise<{
    show: PodcastShow | null;
    episodes: PodcastEpisode[];
    error: string | null;
}> {
    if (!slug) return { show: null, episodes: [], error: "Slug required" };
    const scope = await resolvePodcastScope();
    const supabase = await createClient();

    // Match by slug + scope, but DO NOT require is_published — we'll accept
    // the row if it has any published episode (mirror of getPublishedShows
    // visibility). This avoids 404ing a show whose toggle is off but whose
    // episodes are live.
    const showQuery = applyShowScope(
        supabase
            .from("podcast_shows")
            .select("*")
            .eq("slug", slug)
            .limit(1),
        scope,
    );

    const { data: shows, error: showError } = await showQuery;
    if (showError) return { show: null, episodes: [], error: showError.message };
    const show = (shows?.[0] ?? null) as PodcastShow | null;
    if (!show) return { show: null, episodes: [], error: null };

    if (!show.is_published) {
        const { count } = await supabase
            .from("podcast_episodes")
            .select("id", { count: "exact", head: true })
            .eq("show_id", show.id)
            .eq("status", "published")
            .eq("locale", scope.locale);
        if (!count || count === 0) {
            return { show: null, episodes: [], error: null };
        }
    }

    const { data: episodes, error: episodeError } = await supabase
        .from("podcast_episodes")
        .select("*")
        .eq("show_id", show.id)
        .eq("status", "published")
        .eq("locale", scope.locale)
        .order("published_at", { ascending: false });

    if (episodeError) {
        return { show, episodes: [], error: episodeError.message };
    }

    return { show, episodes: (episodes ?? []) as PodcastEpisode[], error: null };
}

export async function getPublishedEpisode(showSlug: string, episodeSlug: string): Promise<{
    show: PodcastShow | null;
    episode: PodcastEpisode | null;
    error: string | null;
}> {
    const { show, error } = await getPublishedShowBySlug(showSlug);
    if (error) return { show: null, episode: null, error };
    if (!show) return { show: null, episode: null, error: null };

    const scope = await resolvePodcastScope();
    const supabase = await createClient();
    // Episode detail filters on locale too — a /nl URL must never resolve to
    // an /en episode row that happens to share the slug, and vice versa.
    const { data: episode, error: epError } = await supabase
        .from("podcast_episodes")
        .select("*")
        .eq("show_id", show.id)
        .eq("slug", episodeSlug)
        .eq("status", "published")
        .eq("locale", scope.locale)
        .maybeSingle();

    if (epError) return { show, episode: null, error: epError.message };
    return { show, episode: (episode ?? null) as PodcastEpisode | null, error: null };
}

// Matches /podcast/<showSlug>/<episodeSlug> or /podcast/<showSlug> or /podcast
export async function resolvePodcastLocaleSwitchHref(input: {
    pathname: string;
    nextLocale: SupportedLocale;
}): Promise<string | null> {
    const strippedPathname = stripLocaleFromPathname(input.pathname || "/");

    // Case 1: Podcast Index /podcast
    if (strippedPathname === "/podcast" || strippedPathname === "/podcast/") {
        return localizeHref(input.nextLocale, "/podcast");
    }

    // Parse segments: /podcast/[showSlug] or /podcast/[showSlug]/[episodeSlug]
    const segments = strippedPathname.split("/").filter(Boolean); // e.g., ["podcast", "isystem-show", "wat-is-een-..."]
    if (segments[0] !== "podcast" || segments.length < 2) {
        return null;
    }

    const showSlug = segments[1];

    // Case 2: Podcast Show Page /podcast/[showSlug]
    if (segments.length === 2) {
        const supabase = await createClient();

        // Resolve scope for nextLocale
        const [context, settings] = await Promise.all([
            resolveWorkspaceContext(),
            getSiteSettings(),
        ]);
        const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
        const workspaceId =
            context?.activeWorkspace?.id
            ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));

        const scope = {
            workspaceId,
            templateId: resolution.templateId,
            locale: input.nextLocale as PodcastLocale,
        };

        const showQuery = applyShowScope(
            supabase
                .from("podcast_shows")
                .select("id, is_published")
                .eq("slug", showSlug)
                .limit(1),
            scope,
        );
        const { data: shows } = await showQuery;
        const show = shows?.[0];

        if (show) {
            if (show.is_published) {
                return localizeHref(input.nextLocale, `/podcast/${showSlug}`);
            }
            // If show toggle is off, check if there is at least one published episode in nextLocale
            const { count } = await supabase
                .from("podcast_episodes")
                .select("id", { count: "exact", head: true })
                .eq("show_id", show.id)
                .eq("status", "published")
                .eq("locale", input.nextLocale);

            if (count && count > 0) {
                return localizeHref(input.nextLocale, `/podcast/${showSlug}`);
            }
        }

        // Fallback to podcast index
        return localizeHref(input.nextLocale, "/podcast");
    }

    // Case 3: Podcast Episode Page /podcast/[showSlug]/[episodeSlug]
    const episodeSlug = segments[2];
    const supabase = await createClient();

    // 1. Find the current episode (cross-locale) to get its content_item_id
    const { data: currentEpisodes } = await supabase
        .from("podcast_episodes")
        .select("content_item_id")
        .eq("slug", episodeSlug)
        .eq("status", "published")
        .limit(1);

    const contentItemId = currentEpisodes?.[0]?.content_item_id;

    if (contentItemId) {
        // 2. Find the content item slug
        const { data: baseContentItem } = await supabase
            .from("content_items")
            .select("slug, workspace_id, template_id")
            .eq("id", contentItemId)
            .maybeSingle();

        if (baseContentItem) {
            // 3. Find the translated content item in the nextLocale
            let query = supabase
                .from("content_items")
                .select("id")
                .eq("slug", baseContentItem.slug)
                .eq("locale", input.nextLocale)
                .eq("status", "published");

            if (baseContentItem.workspace_id) {
                query = query.or(`workspace_id.eq.${baseContentItem.workspace_id},and(workspace_id.is.null,template_id.eq.${baseContentItem.template_id})`);
            } else {
                query = query.eq("template_id", baseContentItem.template_id);
            }

            const { data: translatedContentItem } = await query.maybeSingle();

            if (translatedContentItem) {
                // 4. Find the published episode linked to this translated content item
                const { data: translatedEpisodes } = await supabase
                    .from("podcast_episodes")
                    .select("slug")
                    .eq("content_item_id", translatedContentItem.id)
                    .eq("locale", input.nextLocale)
                    .eq("status", "published")
                    .limit(1);

                const translatedEpisodeSlug = translatedEpisodes?.[0]?.slug;
                if (translatedEpisodeSlug) {
                    return localizeHref(input.nextLocale, `/podcast/${showSlug}/${translatedEpisodeSlug}`);
                }
            }
        }
    }

    // Fallback: Check if the show exists in nextLocale
    const showUrl = await resolvePodcastLocaleSwitchHref({
        pathname: `/podcast/${showSlug}`,
        nextLocale: input.nextLocale,
    });
    return showUrl || localizeHref(input.nextLocale, "/podcast");
}

export async function findAvailableLocalesForEpisode(
    showSlug: string,
    episodeSlug: string
): Promise<Array<{ locale: PodcastLocale; showSlug: string; episodeSlug: string }>> {
    const supabase = await createClient();

    // 1. Find the current episode (cross-locale) to get its content_item_id
    const { data: currentEpisodes } = await supabase
        .from("podcast_episodes")
        .select("content_item_id, locale, show:show_id(slug)")
        .eq("slug", episodeSlug)
        .eq("status", "published");

    if (!currentEpisodes?.length) {
        return [];
    }

    // Filter down matching show slug
    const matchingEpisodes = currentEpisodes.filter(
        (ep) => (ep.show as unknown as { slug: string })?.slug === showSlug
    );

    if (matchingEpisodes.length === 0) {
        return [];
    }

    const firstMatch = matchingEpisodes[0];
    const contentItemId = firstMatch.content_item_id;

    if (!contentItemId) {
        return [{
            locale: firstMatch.locale as PodcastLocale,
            showSlug,
            episodeSlug,
        }];
    }

    // 2. Find all content item translations (same slug across locales)
    const { data: baseContentItem } = await supabase
        .from("content_items")
        .select("slug, workspace_id, template_id")
        .eq("id", contentItemId)
        .maybeSingle();

    if (!baseContentItem) {
        return [{
            locale: firstMatch.locale as PodcastLocale,
            showSlug,
            episodeSlug,
        }];
    }

    let query = supabase
        .from("content_items")
        .select("id")
        .eq("slug", baseContentItem.slug)
        .eq("status", "published");

    if (baseContentItem.workspace_id) {
        query = query.or(`workspace_id.eq.${baseContentItem.workspace_id},and(workspace_id.is.null,template_id.eq.${baseContentItem.template_id})`);
    } else {
        query = query.eq("template_id", baseContentItem.template_id);
    }

    const { data: contentItems } = await query;
    if (!contentItems?.length) {
        return [{
            locale: firstMatch.locale as PodcastLocale,
            showSlug,
            episodeSlug,
        }];
    }

    const contentItemIds = contentItems.map((ci) => ci.id);

    // 3. Find all published podcast episodes linked to these content items
    const { data: episodes } = await supabase
        .from("podcast_episodes")
        .select("locale, slug, show:show_id(slug)")
        .in("content_item_id", contentItemIds)
        .eq("status", "published");

    if (!episodes?.length) {
        return [{
            locale: firstMatch.locale as PodcastLocale,
            showSlug,
            episodeSlug,
        }];
    }

    return episodes
        .filter((ep) => (ep.show as unknown as { slug: string })?.slug === showSlug)
        .map((ep) => ({
            locale: ep.locale as PodcastLocale,
            showSlug,
            episodeSlug: ep.slug,
        }));
}

export interface PublishedEpisodeLocaleRow {
    episode_slug: string;
    locale: string;
    updated_at: string | null;
    published_at: string | null;
    cover_art_url: string | null;
    show_slug: string;
    show_cover_art_url: string | null;
    content_item_id: string | null;
    content_item_slug: string | null;
}

export async function getPublishedEpisodeLocaleMap(): Promise<PublishedEpisodeLocaleRow[]> {
    const supabase = await createClient();

    // Resolve scope using DEFAULT_LOCALE/default workspace locale
    const [context, settings] = await Promise.all([
        resolveWorkspaceContext(),
        getSiteSettings(),
    ]);
    const resolution = await resolveLegacyTemplateForWorkspaceContext(context, settings.activeTemplate);
    const workspaceId =
        context?.activeWorkspace?.id
        ?? (await resolveWorkspaceIdFromTemplate(resolution.templateId));

    let query = supabase
        .from("podcast_episodes")
        .select(`
            slug,
            locale,
            updated_at,
            published_at,
            cover_art_url,
            show:show_id (
                slug,
                cover_art_url
            ),
            content_item:content_item_id (
                id,
                slug
            )
        `)
        .eq("status", "published");

    if (workspaceId) {
        query = query.or(`workspace_id.eq.${workspaceId},template_id.eq.${resolution.templateId}`);
    } else {
        query = query.eq("template_id", resolution.templateId);
    }

    const { data, error } = await query;
    if (error || !data) {
        console.error("[podcast] Error fetching episode locale map:", error);
        return [];
    }

    return (data as Array<{
        slug: string;
        locale: string;
        updated_at: string | null;
        published_at: string | null;
        cover_art_url: string | null;
        show: Array<{ slug: string; cover_art_url: string | null }> | null;
        content_item: Array<{ id: string; slug: string }> | null;
    }>).map((row) => ({
        episode_slug: row.slug,
        locale: row.locale,
        updated_at: row.updated_at,
        published_at: row.published_at,
        cover_art_url: row.cover_art_url,
        show_slug: row.show?.[0]?.slug || "",
        show_cover_art_url: row.show?.[0]?.cover_art_url || null,
        content_item_id: row.content_item?.[0]?.id || null,
        content_item_slug: row.content_item?.[0]?.slug || null,
    }));
}
