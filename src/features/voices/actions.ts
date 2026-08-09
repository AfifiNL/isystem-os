"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { assertWorkspaceAdminOrManager, resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import type { WorkspaceVoice } from "./types";

export async function listVoices(includeArchived = false): Promise<{
    data: WorkspaceVoice[];
    error: string | null;
}> {
    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { data: [], error: "No active workspace." };

    const supabase = await createClient();
    let query = supabase
        .from("workspace_voices")
        .select("*")
        .eq("workspace_id", ctx.activeWorkspace.id)
        .order("created_at", { ascending: false });

    if (!includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data ?? []) as WorkspaceVoice[], error: null };
}

/**
 * Deprecated manual voice import.
 */
export async function importLibraryVoice(_input: {
    elevenlabsVoiceId: string;
    displayName: string;
    languageCode?: string;
    modelPreference?: string;
}): Promise<{ voiceId: string | null; error: string | null }> {
    void _input;
    return { voiceId: null, error: "Manual ElevenLabs voice ID import is deprecated. Please use the seeded Google prebuilt presets or clone a new voice." };
}

export async function archiveVoice(voiceId: string): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }
    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_voices")
        .update({ archived_at: new Date().toISOString(), provider_status: "archived" })
        .eq("id", voiceId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/voices");
    return { error: null };
}

export async function restoreVoice(voiceId: string): Promise<{ error: string | null }> {
    try {
        await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }
    const supabase = await createClient();
    const { error } = await supabase
        .from("workspace_voices")
        .update({ archived_at: null, provider_status: "ready" })
        .eq("id", voiceId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/voices");
    return { error: null };
}

/**
 * Hard delete a voice. Also deletes from ElevenLabs to free a clone slot
 * (Starter plan cap is small). Aborts if any podcast episode still references
 * this voice as host or guest — admins must reassign first.
 */
export async function deleteVoice(voiceId: string): Promise<{ error: string | null }> {
    let context;
    try {
        context = await assertWorkspaceAdminOrManager();
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : "Forbidden" };
    }

    const supabase = await createClient();
    const { data: row, error: fetchError } = await supabase
        .from("workspace_voices")
        .select("id, workspace_id, provider, provider_voice_id, voice_type")
        .eq("id", voiceId)
        .maybeSingle();
    if (fetchError) return { error: fetchError.message };
    if (!row || row.workspace_id !== context.activeWorkspace.id) {
        return { error: "Voice not found." };
    }

    const { count, error: refsError } = await supabase
        .from("podcast_episodes")
        .select("id", { count: "exact", head: true })
        .or(`host_voice_id.eq.${voiceId},guest_voice_id.eq.${voiceId}`);
    if (refsError) return { error: refsError.message };
    if ((count ?? 0) > 0) {
        return { error: "Voice is still attached to podcast episodes. Reassign first." };
    }

    const { error: deleteError } = await supabase
        .from("workspace_voices")
        .delete()
        .eq("id", voiceId);
    if (deleteError) return { error: deleteError.message };

    // Best-effort delete on the provider side.
    if (
        row.provider === "elevenlabs"
        && (row.voice_type === "instant_clone" || row.voice_type === "professional_clone" || row.voice_type === "designed")
    ) {
        try {
            const { deleteElevenLabsVoice } = await import("@/shared/lib/ai/tts-providers/elevenlabs");
            await deleteElevenLabsVoice(row.provider_voice_id);
        } catch (err) {
            console.error("[voices] ElevenLabs delete failed:", err);
        }
    }

    revalidatePath("/dashboard/voices");
    return { error: null };
}
