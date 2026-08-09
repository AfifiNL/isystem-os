"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAdminOrManager, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import {
    MUSIC_MOODS,
    type MusicMood,
    type MusicTrack,
    type MusicTrackWithUrl,
} from "./types";

const BUCKET = "workspace-music";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — fits a 5-min stereo MP3 at 320kbps
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const MIME_EXTENSIONS: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/flac": "flac",
};

function extensionForMime(mime: string): string {
    return MIME_EXTENSIONS[mime.toLowerCase()] ?? "bin";
}

function isMusicMood(value: unknown): value is MusicMood {
    return typeof value === "string" && (MUSIC_MOODS as readonly string[]).includes(value);
}

interface ListOptions {
    includeArchived?: boolean;
    mood?: MusicMood;
}

export async function listMusicTracks(options: ListOptions = {}): Promise<{
    data: MusicTrackWithUrl[];
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) {
        return { data: [], error: "No active workspace." };
    }

    const supabase = await createClient();
    let query = supabase
        .from("workspace_music_tracks")
        .select("*")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .order("created_at", { ascending: false });

    if (!options.includeArchived) {
        query = query.is("archived_at", null);
    }
    if (options.mood) {
        query = query.eq("mood", options.mood);
    }

    const { data, error } = await query;
    if (error) {
        return { data: [], error: error.message };
    }

    const rows = (data ?? []) as MusicTrack[];
    const signed = await Promise.all(
        rows.map(async (row) => {
            const { data: signedData } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
            return {
                ...row,
                signed_url: signedData?.signedUrl ?? null,
            } satisfies MusicTrackWithUrl;
        }),
    );

    return { data: signed, error: null };
}

export async function uploadMusicTrack(formData: FormData): Promise<{
    trackId: string | null;
    error: string | null;
}> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { trackId: null, error: err instanceof Error ? err.message : "Forbidden" };
    }

    const file = formData.get("audio");
    const titleRaw = (formData.get("title") as string | null)?.trim();
    const moodRaw = formData.get("mood");
    const durationRaw = Number(formData.get("duration_seconds") ?? 0);
    const isIntro = formData.get("is_intro") === "true";
    const isOutro = formData.get("is_outro") === "true";
    const isBed = formData.get("is_bed") === "true" || (!isIntro && !isOutro);
    const loopSafe = formData.get("loop_safe") === "true";

    if (!(file instanceof File) || file.size === 0) {
        return { trackId: null, error: "No audio file received." };
    }
    if (file.size > MAX_BYTES) {
        return { trackId: null, error: `Audio exceeds ${MAX_BYTES / 1024 / 1024}MB cap.` };
    }
    const mime = (file.type || "audio/mpeg").toLowerCase();
    if (!mime.startsWith("audio/")) {
        return { trackId: null, error: "Uploaded file is not audio." };
    }
    if (!titleRaw) {
        return { trackId: null, error: "Title is required." };
    }
    if (!isMusicMood(moodRaw)) {
        return { trackId: null, error: "Invalid mood." };
    }

    const duration = Number.isFinite(durationRaw)
        ? Math.max(0, Math.min(60 * 60, Math.round(durationRaw)))
        : 0;

    const trackId = randomUUID();
    const ext = extensionForMime(mime);
    // Path layout MUST match the workspace_music storage RLS policies:
    // first folder segment is the workspace id.
    const storagePath = `${context.activeWorkspace.id}/${trackId}.${ext}`;

    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: mime, upsert: false });

    if (uploadError) {
        return { trackId: null, error: uploadError.message };
    }

    const { error: insertError } = await supabase.from("workspace_music_tracks").insert({
        id: trackId,
        workspace_id: context.activeWorkspace.id,
        template_id: context.activeWorkspace.legacy_template_id,
        created_by_profile_id: context.userId,
        title: titleRaw,
        mood: moodRaw,
        duration_seconds: duration,
        storage_path: storagePath,
        audio_mime_type: mime,
        audio_byte_size: file.size,
        source: "uploaded",
        is_intro: isIntro,
        is_outro: isOutro,
        is_bed: isBed,
        loop_safe: loopSafe,
    });

    if (insertError) {
        // Best-effort cleanup so a failed insert doesn't leave an orphan file.
        await supabase.storage.from(BUCKET).remove([storagePath]);
        return { trackId: null, error: insertError.message };
    }

    revalidatePath("/dashboard/music-library");
    return { trackId, error: null };
}

export async function archiveMusicTrack(trackId: string): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_music_tracks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", trackId)
        .is("archived_at", null);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/music-library");
    return { error: null };
}

export async function restoreMusicTrack(trackId: string): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_music_tracks")
        .update({ archived_at: null })
        .eq("id", trackId);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/music-library");
    return { error: null };
}

export async function deleteMusicTrack(trackId: string): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();

    // Check the track is still referenced by any episode — restrict means the
    // FK already prevents the delete, but we surface a clearer message.
    const { data: refs, error: refsError } = await supabase
        .from("podcast_episode_music")
        .select("id")
        .eq("track_id", trackId)
        .limit(1);
    if (refsError) return { error: refsError.message };
    if (refs && refs.length > 0) {
        return { error: "Track is still attached to one or more episodes." };
    }

    const { data: row, error: fetchError } = await supabase
        .from("workspace_music_tracks")
        .select("storage_path, workspace_id")
        .eq("id", trackId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!row) return { error: "Track not found." };
    if (row.workspace_id !== context.activeWorkspace.id) {
        return { error: "Track does not belong to the active workspace." };
    }

    const { error: deleteError } = await supabase
        .from("workspace_music_tracks")
        .delete()
        .eq("id", trackId);
    if (deleteError) return { error: deleteError.message };

    await supabase.storage.from(BUCKET).remove([row.storage_path]);

    revalidatePath("/dashboard/music-library");
    return { error: null };
}
