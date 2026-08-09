"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAdminOrManager, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import type {
    EpisodeMusicAttachment,
    EpisodeStatus,
    EpisodeType,
    MusicRole,
    PodcastEpisode,
    PodcastShow,
} from "./types";

const DRAFTS_BUCKET = "podcast-drafts";
const PUBLIC_BUCKET = "audio-episodes";
const SIGNED_URL_TTL = 60 * 60;

function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || `episode-${Date.now()}`;
}

type EpisodeLocale = "en" | "nl" | "ar";

/**
 * Resolve the locale to stamp on a new podcast episode. Priority:
 *   1. explicit override (caller passed `locale`)
 *   2. linked content_item's locale (the script source language)
 *   3. show.language's leading two-letter segment (e.g. "nl-NL" → "nl")
 *   4. workspace default_locale
 *   5. "en"
 *
 * Returns one of "en" | "nl" | "ar" — anything outside that set falls back
 * to "en" so the DB CHECK never fires.
 */
function resolveEpisodeLocale(input: {
    override?: string | null;
    contentItemLocale?: string | null;
    showLanguage?: string | null;
    workspaceDefault?: string | null;
}): EpisodeLocale {
    const candidates = [
        input.override,
        input.contentItemLocale,
        input.showLanguage ? input.showLanguage.split("-")[0] : null,
        input.workspaceDefault,
    ];
    for (const raw of candidates) {
        if (!raw) continue;
        const lower = raw.toLowerCase();
        if (lower === "en" || lower === "nl" || lower === "ar") return lower;
    }
    return "en";
}

// ─── Shows ────────────────────────────────────────────────────────────────

export async function listShows(): Promise<{ data: PodcastShow[]; error: string | null }> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { data: [], error: "No active workspace." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("podcast_shows")
        .select("*")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .order("updated_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as PodcastShow[], error: null };
}

export interface CreateShowInput {
    title: string;
    subtitle?: string;
    description?: string;
    language?: string;
    author?: string;
    ownerEmail?: string;
    category?: string;
    explicit?: boolean;
}

export async function createShow(input: CreateShowInput): Promise<{
    show: PodcastShow | null;
    error: string | null;
}> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { show: null, error: err instanceof Error ? err.message : "Forbidden" };
    }

    const trimmed = input.title?.trim();
    if (!trimmed) return { show: null, error: "Show title is required." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("podcast_shows")
        .insert({
            workspace_id: context.activeWorkspace.id,
            template_id: context.activeWorkspace.legacy_template_id,
            slug: slugify(trimmed),
            title: trimmed,
            subtitle: input.subtitle?.trim() || null,
            description: input.description?.trim() || null,
            language: input.language?.trim() || "en",
            author: input.author?.trim() || null,
            owner_email: input.ownerEmail?.trim() || null,
            category: input.category?.trim() || null,
            explicit: input.explicit ?? false,
        })
        .select("*")
        .single();

    if (error) return { show: null, error: error.message };
    revalidatePath("/dashboard/podcast");
    return { show: data as PodcastShow, error: null };
}

export async function updateShow(
    showId: string,
    patch: Partial<CreateShowInput> & { isPublished?: boolean; coverArtUrl?: string | null },
): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const updates: Record<string, unknown> = {};
    if (patch.title !== undefined) updates.title = patch.title.trim();
    if (patch.subtitle !== undefined) updates.subtitle = patch.subtitle?.trim() || null;
    if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
    if (patch.language !== undefined) updates.language = patch.language.trim();
    if (patch.author !== undefined) updates.author = patch.author?.trim() || null;
    if (patch.ownerEmail !== undefined) updates.owner_email = patch.ownerEmail?.trim() || null;
    if (patch.category !== undefined) updates.category = patch.category?.trim() || null;
    if (patch.explicit !== undefined) updates.explicit = patch.explicit;
    if (patch.isPublished !== undefined) updates.is_published = patch.isPublished;
    if (patch.coverArtUrl !== undefined) updates.cover_art_url = patch.coverArtUrl;

    if (Object.keys(updates).length === 0) return { error: null };

    const supabase = await createClient();
    const { error } = await supabase.from("podcast_shows").update(updates).eq("id", showId);
    if (error) return { error: error.message };

    revalidatePath("/dashboard/podcast");
    return { error: null };
}

// ─── Episodes ─────────────────────────────────────────────────────────────

export async function listEpisodes(showId?: string): Promise<{
    data: PodcastEpisode[];
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { data: [], error: "No active workspace." };

    const supabase = await createClient();
    let query = supabase
        .from("podcast_episodes")
        .select("*")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .order("updated_at", { ascending: false });

    if (showId) query = query.eq("show_id", showId);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as PodcastEpisode[], error: null };
}

export async function getEpisodeById(episodeId: string): Promise<{
    episode: PodcastEpisode | null;
    music: EpisodeMusicAttachment[];
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { episode: null, music: [], error: "No active workspace." };

    const supabase = await createClient();
    const [{ data: episode, error: episodeError }, { data: music, error: musicError }] = await Promise.all([
        supabase
            .from("podcast_episodes")
            .select("*")
            .eq("id", episodeId)
            .eq("workspace_id", ctx.activeWorkspace.id)
            .maybeSingle(),
        supabase
            .from("podcast_episode_music")
            .select("*")
            .eq("episode_id", episodeId),
    ]);

    if (episodeError) return { episode: null, music: [], error: episodeError.message };
    if (musicError) return { episode: null, music: [], error: musicError.message };
    return {
        episode: episode as PodcastEpisode | null,
        music: (music ?? []) as EpisodeMusicAttachment[],
        error: null,
    };
}

export interface CreateEpisodeInput {
    showId: string;
    title: string;
    summary?: string;
    description?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    episodeType?: EpisodeType;
    /** Override episode language. Defaults to show language → workspace default → "en". */
    locale?: EpisodeLocale;
    /** Optional voice + music attachments wired up in a single round-trip. */
    hostVoiceId?: string | null;
    guestVoiceId?: string | null;
    introTrackId?: string | null;
    bedTrackId?: string | null;
    outroTrackId?: string | null;
}

export async function createEpisode(input: CreateEpisodeInput): Promise<{
    episode: PodcastEpisode | null;
    error: string | null;
}> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { episode: null, error: err instanceof Error ? err.message : "Forbidden" };
    }

    const title = input.title?.trim();
    if (!title) return { episode: null, error: "Episode title is required." };
    if (!input.showId) return { episode: null, error: "Show is required." };

    const supabase = await createClient();
    // Verify show belongs to active workspace.
    const { data: show, error: showError } = await supabase
        .from("podcast_shows")
        .select("id, workspace_id, language")
        .eq("id", input.showId)
        .maybeSingle();
    if (showError) return { episode: null, error: showError.message };
    if (!show || show.workspace_id !== context.activeWorkspace.id) {
        return { episode: null, error: "Show not found." };
    }

    const locale = resolveEpisodeLocale({
        override: input.locale,
        showLanguage: show.language,
        workspaceDefault: context.activeWorkspace.default_locale,
    });

    const { data, error } = await supabase
        .from("podcast_episodes")
        .insert({
            workspace_id: context.activeWorkspace.id,
            show_id: input.showId,
            template_id: context.activeWorkspace.legacy_template_id,
            locale,
            slug: slugify(title),
            title,
            summary: input.summary?.trim() || null,
            description: input.description?.trim() || null,
            season_number: input.seasonNumber ?? null,
            episode_number: input.episodeNumber ?? null,
            episode_type: input.episodeType ?? "full",
            status: "draft",
            host_voice_id: input.hostVoiceId ?? null,
            guest_voice_id: input.guestVoiceId ?? null,
        })
        .select("*")
        .single();

    if (error) return { episode: null, error: error.message };

    // Best-effort music attachments. Failures here surface in logs but do not
    // roll back the episode — the user can attach tracks afterwards from the UI.
    const musicInserts: Array<{ track_id: string; role: MusicRole }> = [];
    if (input.introTrackId) musicInserts.push({ track_id: input.introTrackId, role: "intro" });
    if (input.bedTrackId) musicInserts.push({ track_id: input.bedTrackId, role: "bed" });
    if (input.outroTrackId) musicInserts.push({ track_id: input.outroTrackId, role: "outro" });
    if (musicInserts.length > 0) {
        await supabase.from("podcast_episode_music").insert(
            musicInserts.map((m) => ({ episode_id: (data as PodcastEpisode).id, ...m })),
        );
    }

    revalidatePath("/dashboard/podcast");
    return { episode: data as PodcastEpisode, error: null };
}

export async function updateEpisode(
    episodeId: string,
    patch: {
        title?: string;
        summary?: string;
        description?: string;
        seasonNumber?: number | null;
        episodeNumber?: number | null;
        episodeType?: EpisodeType;
        status?: EpisodeStatus;
        scheduledFor?: string | null;
        coverArtUrl?: string | null;
        transcriptText?: string | null;
        chapters?: Array<{ start_ms: number; title: string }>;
    },
): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const updates: Record<string, unknown> = {};
    if (patch.title !== undefined) updates.title = patch.title.trim();
    if (patch.summary !== undefined) updates.summary = patch.summary?.trim() || null;
    if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
    if (patch.seasonNumber !== undefined) updates.season_number = patch.seasonNumber;
    if (patch.episodeNumber !== undefined) updates.episode_number = patch.episodeNumber;
    if (patch.episodeType !== undefined) updates.episode_type = patch.episodeType;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.scheduledFor !== undefined) updates.scheduled_for = patch.scheduledFor;
    if (patch.coverArtUrl !== undefined) updates.cover_art_url = patch.coverArtUrl;
    if (patch.transcriptText !== undefined) updates.transcript_text = patch.transcriptText;
    if (patch.chapters !== undefined) updates.chapters = patch.chapters;

    if (Object.keys(updates).length === 0) return { error: null };

    const supabase = await createClient();
    const { error } = await supabase.from("podcast_episodes").update(updates).eq("id", episodeId);
    if (error) return { error: error.message };

    revalidatePath("/dashboard/podcast");
    return { error: null };
}

export async function deleteEpisode(episodeId: string): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { data: row, error: fetchError } = await supabase
        .from("podcast_episodes")
        .select("id, workspace_id, narration_only_url, audio_url")
        .eq("id", episodeId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!row || row.workspace_id !== context.activeWorkspace.id) {
        return { error: "Episode not found." };
    }

    const { error: deleteError } = await supabase
        .from("podcast_episodes")
        .delete()
        .eq("id", episodeId);
    if (deleteError) return { error: deleteError.message };

    // Best-effort cleanup of any audio in either bucket.
    const draftPath = `${context.activeWorkspace.id}/${episodeId}/`;
    await supabase.storage.from(DRAFTS_BUCKET).remove([
        `${draftPath}narration.wav`,
        `${draftPath}mixed.mp3`,
    ]);
    await supabase.storage.from(PUBLIC_BUCKET).remove([
        `${draftPath}audio.mp3`,
    ]);

    revalidatePath("/dashboard/podcast");
    return { error: null };
}

// ─── Music attachments ────────────────────────────────────────────────────

export interface AttachMusicInput {
    episodeId: string;
    trackId: string;
    role: MusicRole;
    fadeInMs?: number;
    fadeOutMs?: number;
    gainDb?: number;
}

export async function attachMusic(input: AttachMusicInput): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    // Verify both the episode and the track live in the active workspace.
    const [{ data: episode }, { data: track }] = await Promise.all([
        supabase
            .from("podcast_episodes")
            .select("id, workspace_id")
            .eq("id", input.episodeId)
            .maybeSingle(),
        supabase
            .from("workspace_music_tracks")
            .select("id, workspace_id, archived_at")
            .eq("id", input.trackId)
            .maybeSingle(),
    ]);

    if (!episode || episode.workspace_id !== context.activeWorkspace.id) {
        return { error: "Episode not found." };
    }
    if (!track || track.workspace_id !== context.activeWorkspace.id) {
        return { error: "Track not found in this workspace." };
    }
    if (track.archived_at) {
        return { error: "Cannot attach an archived track." };
    }

    // Replace any existing attachment for the same role.
    await supabase
        .from("podcast_episode_music")
        .delete()
        .eq("episode_id", input.episodeId)
        .eq("role", input.role);

    const { error } = await supabase.from("podcast_episode_music").insert({
        episode_id: input.episodeId,
        track_id: input.trackId,
        role: input.role,
        fade_in_ms: input.fadeInMs ?? 1500,
        fade_out_ms: input.fadeOutMs ?? 2000,
        gain_db: input.gainDb ?? -18.0,
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/podcast");
    return { error: null };
}

export async function detachMusic(episodeId: string, role: MusicRole): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("podcast_episode_music")
        .delete()
        .eq("episode_id", episodeId)
        .eq("role", role);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/podcast");
    return { error: null };
}

// ─── Publish flow ─────────────────────────────────────────────────────────

/**
 * Publish an episode: trigger the mixer route (which combines narration +
 * intro/bed/outro into a final MP3 and copies it to the public audio-episodes
 * bucket), then mark the episode as published.
 *
 * Why fetch instead of in-process: the mixer shells out to the operator's
 * FFmpeg executable. Keep the heavy work in the API route instead of coupling
 * the server action bundle to that system dependency, and
 * call it over HTTP. The route accepts an internal service-role bearer for
 * server-to-server use, which avoids cookie forwarding fragility.
 */
export async function publishEpisode(episodeId: string): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { data: row, error: fetchError } = await supabase
        .from("podcast_episodes")
        .select("id, workspace_id, narration_only_url, status")
        .eq("id", episodeId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!row || row.workspace_id !== context.activeWorkspace.id) {
        return { error: "Episode not found." };
    }
    if (!row.narration_only_url) {
        return { error: "Episode has no narration audio yet — generate it first." };
    }

    const internalSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!internalSecret) {
        return { error: "Server misconfiguration: missing service role key." };
    }

    // Resolve a base URL we can self-call. Prefer NEXT_PUBLIC_SITE_URL — its
    // domain matches the user's session cookies (www.isystem.ai), so the
    // route's cookie-based auth path stays valid. Fall back to VERCEL_URL
    // (which is a *.vercel.app host where the user has no cookies — usable
    // only with the body-secret path below). Refuse to silently dial
    // localhost in production.
    const publicSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const vercelHost = process.env.VERCEL_URL?.trim();
    const baseUrl = publicSite
        ? publicSite.replace(/\/$/, "")
        : vercelHost
            ? `https://${vercelHost}`
            : process.env.NODE_ENV !== "production"
                ? "http://localhost:3000"
                : null;
    if (!baseUrl) {
        return { error: "Server misconfiguration: set NEXT_PUBLIC_SITE_URL or VERCEL_URL so the mixer can be reached." };
    }
    const mixEndpoint = `${baseUrl}/api/mix-podcast-episode`;

    // Forward cookies as a best-effort additional auth channel. Vercel can
    // strip `authorization` headers on internal self-fetches and apex/www
    // mismatches break cookie domains, so the SECRET goes in the request
    // BODY too — bodies are never altered in transit. The route accepts
    // any of: body.internalToken, x-internal-token header, Bearer header,
    // valid cookie session.
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join("; ");

    let mixResult: { audioUrl?: string; byteSize?: number; durationSeconds?: number } | null = null;
    try {
        const response = await fetch(mixEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-token": internalSecret,
                ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({
                episodeId,
                workspaceId: context.activeWorkspace.id,
                internalToken: internalSecret,
            }),
            cache: "no-store",
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({} as { error?: string }));
            return { error: `Mixing failed (${response.status}): ${data.error ?? response.statusText}` };
        }
        mixResult = await response.json();
    } catch (err) {
        return { error: `Mixing failed: ${err instanceof Error ? err.message : "unknown"}` };
    }

    if (!mixResult?.audioUrl) {
        return { error: "Mixing returned no audio URL." };
    }

    const { error: updateError } = await supabase
        .from("podcast_episodes")
        .update({
            audio_url: mixResult.audioUrl,
            audio_byte_size: mixResult.byteSize ?? null,
            audio_duration_seconds: mixResult.durationSeconds ?? null,
            status: "published",
            published_at: new Date().toISOString(),
        })
        .eq("id", episodeId);

    if (updateError) return { error: updateError.message };

    // Auto-publish the parent show on its first episode publish. Without this
    // the public /podcast index hides the show (it filters by `is_published`)
    // and operators have no obvious cue that "Publish show" is a separate
    // toggle. Treat publishing an episode as an implicit publish of its show.
    const { data: episodeRow } = await supabase
        .from("podcast_episodes")
        .select("show_id")
        .eq("id", episodeId)
        .maybeSingle();
    if (episodeRow?.show_id) {
        await supabase
            .from("podcast_shows")
            .update({ is_published: true })
            .eq("id", episodeRow.show_id)
            .eq("is_published", false);
    }

    revalidatePath("/dashboard/podcast");
    revalidatePath("/podcast", "layout");
    return { error: null };
}

// ─── Generate-from-content ────────────────────────────────────────────────

export async function listEpisodesByContent(contentId: string): Promise<{
    data: PodcastEpisode[];
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { data: [], error: "No active workspace." };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("podcast_episodes")
        .select("*")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .eq("content_item_id", contentId)
        .order("updated_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as PodcastEpisode[], error: null };
}

export interface CreateEpisodeFromContentInput {
    contentId: string;
    showId: string;
    title?: string;
    summary?: string;
    hostVoiceId?: string | null;
    guestVoiceId?: string | null;
    /** Optional music attachments to wire up at creation time. */
    introTrackId?: string | null;
    bedTrackId?: string | null;
    outroTrackId?: string | null;
}

/**
 * Create a draft podcast episode pre-linked to a blog/content item, with
 * voices and music slots pre-attached. The caller is expected to follow up
 * with /api/generate-podcast-episode to actually render audio.
 */
export async function createEpisodeFromContent(input: CreateEpisodeFromContentInput): Promise<{
    episode: PodcastEpisode | null;
    error: string | null;
}> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { episode: null, error: err instanceof Error ? err.message : "Forbidden" };
    }

    if (!input.contentId) return { episode: null, error: "contentId is required." };
    if (!input.showId) return { episode: null, error: "showId is required." };

    const supabase = await createClient();

    // Verify content + show belong to this workspace.
    const [{ data: content }, { data: show }] = await Promise.all([
        supabase
            .from("content_items")
            .select("id, workspace_id, template_id, title, metadata, content_markdown, locale")
            .eq("id", input.contentId)
            .maybeSingle(),
        supabase
            .from("podcast_shows")
            .select("id, workspace_id, language")
            .eq("id", input.showId)
            .maybeSingle(),
    ]);

    if (!content) return { episode: null, error: "Content item not found." };
    const contentMatchesWorkspace = content.workspace_id === context.activeWorkspace.id
        || (!content.workspace_id && content.template_id === context.activeWorkspace.legacy_template_id);
    if (!contentMatchesWorkspace) {
        return { episode: null, error: "Content item is outside the active workspace scope." };
    }
    if (!show || show.workspace_id !== context.activeWorkspace.id) {
        return { episode: null, error: "Show not found." };
    }

    const title = (input.title?.trim()) || content.title || "Untitled episode";
    const summary = input.summary?.trim()
        || (typeof content.metadata?.excerpt === "string" ? content.metadata.excerpt : null)
        || null;

    // Episode locale follows the linked content_item. Falls back to show
    // language → workspace default → "en". This is the critical hop that
    // prevents Dutch/Arabic episodes from appearing under /en/podcast/.
    const locale = resolveEpisodeLocale({
        contentItemLocale: content.locale,
        showLanguage: show.language,
        workspaceDefault: context.activeWorkspace.default_locale,
    });

    // Generate a unique slug per (show, locale). The DB index enforces
    // uniqueness on (show_id, locale, slug), so we check the same triple
    // here for a useful conflict suffix instead of a constraint error.
    const baseSlug = title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || `episode-${Date.now()}`;
    const { data: existingSlug } = await supabase
        .from("podcast_episodes")
        .select("id")
        .eq("show_id", input.showId)
        .eq("locale", locale)
        .eq("slug", baseSlug)
        .maybeSingle();
    const slug = existingSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const { data: episode, error } = await supabase
        .from("podcast_episodes")
        .insert({
            workspace_id: context.activeWorkspace.id,
            show_id: input.showId,
            template_id: context.activeWorkspace.legacy_template_id,
            content_item_id: input.contentId,
            locale,
            slug,
            title,
            summary,
            description: typeof content.metadata?.excerpt === "string" ? content.metadata.excerpt : null,
            episode_type: "full",
            status: "draft",
            host_voice_id: input.hostVoiceId ?? null,
            guest_voice_id: input.guestVoiceId ?? null,
        })
        .select("*")
        .single();

    if (error) return { episode: null, error: error.message };

    // Attach music slots (best-effort — failures here surface to the caller
    // but the episode row is already created).
    const musicInserts: Array<{ track_id: string; role: "intro" | "bed" | "outro" }> = [];
    if (input.introTrackId) musicInserts.push({ track_id: input.introTrackId, role: "intro" });
    if (input.bedTrackId) musicInserts.push({ track_id: input.bedTrackId, role: "bed" });
    if (input.outroTrackId) musicInserts.push({ track_id: input.outroTrackId, role: "outro" });
    if (musicInserts.length > 0) {
        await supabase.from("podcast_episode_music").insert(
            musicInserts.map((m) => ({ episode_id: episode.id, ...m })),
        );
    }

    revalidatePath("/dashboard/podcast");
    revalidatePath(`/dashboard/content/${input.contentId}`);
    return { episode: episode as PodcastEpisode, error: null };
}

export async function setEpisodeVoices(
    episodeId: string,
    input: { hostVoiceId: string | null; guestVoiceId: string | null },
): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();

    // Verify both voices (when set) belong to the active workspace and are
    // not archived. This is also enforced by RLS, but a clear error message
    // is better than a generic constraint violation.
    const candidateIds = [input.hostVoiceId, input.guestVoiceId].filter((id): id is string => Boolean(id));
    if (candidateIds.length > 0) {
        const { data: voices, error: voiceError } = await supabase
            .from("workspace_voices")
            .select("id, workspace_id, archived_at")
            .in("id", candidateIds);
        if (voiceError) return { error: voiceError.message };
        for (const v of voices ?? []) {
            if (v.workspace_id !== context.activeWorkspace.id) {
                return { error: "Voice does not belong to this workspace." };
            }
            if (v.archived_at) {
                return { error: "Cannot assign an archived voice." };
            }
        }
    }

    const { error } = await supabase
        .from("podcast_episodes")
        .update({ host_voice_id: input.hostVoiceId, guest_voice_id: input.guestVoiceId })
        .eq("id", episodeId)
        .eq("workspace_id", context.activeWorkspace.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/podcast");
    return { error: null };
}

export async function unpublishEpisode(episodeId: string): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { data: row, error: fetchError } = await supabase
        .from("podcast_episodes")
        .select("id, workspace_id")
        .eq("id", episodeId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!row || row.workspace_id !== context.activeWorkspace.id) {
        return { error: "Episode not found." };
    }

    // Delete the public copy so the URL stops resolving — the canonical
    // narration_only_url stays in podcast-drafts so re-publishing is cheap.
    const publicPath = `${context.activeWorkspace.id}/${episodeId}/audio.mp3`;
    await supabase.storage.from(PUBLIC_BUCKET).remove([publicPath]);

    const { error: updateError } = await supabase
        .from("podcast_episodes")
        .update({
            status: "draft",
            published_at: null,
            audio_url: null,
        })
        .eq("id", episodeId);

    if (updateError) return { error: updateError.message };
    revalidatePath("/dashboard/podcast");
    revalidatePath("/podcast", "layout");
    return { error: null };
}

// ─── Signed URLs for draft playback in the studio ─────────────────────────

export async function getDraftAudioSignedUrl(episodeId: string): Promise<{
    url: string | null;
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { url: null, error: "No active workspace." };

    const supabase = await createClient();
    const { data: row, error: fetchError } = await supabase
        .from("podcast_episodes")
        .select("workspace_id, narration_only_url")
        .eq("id", episodeId)
        .maybeSingle();
    if (fetchError) return { url: null, error: fetchError.message };
    if (!row || row.workspace_id !== ctx.activeWorkspace.id || !row.narration_only_url) {
        return { url: null, error: "Draft audio not found." };
    }

    // narration_only_url stores the storage path inside the drafts bucket.
    const { data, error: signError } = await supabase.storage
        .from(DRAFTS_BUCKET)
        .createSignedUrl(row.narration_only_url, SIGNED_URL_TTL);
    if (signError) return { url: null, error: signError.message };

    return { url: data?.signedUrl ?? null, error: null };
}
