import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import {
    buildVoiceMemoGeneratedNotePayload,
    type VoiceMemoGeneratedNoteInput,
    type VoiceMemoGeneratedNotePayload,
} from "@/features/productivity/notes/voice-memo-note-content";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { syncNoteSemanticNode, syncNoteSemanticNodeWithClient, type NoteSemanticRecord } from "@/features/productivity/notes/semantic-sync";

type NotesSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type VoiceMemoGeneratedNoteSupabaseClient = NotesSupabaseClient;

const GENERATED_NOTE_SEMANTIC_SELECT = "id,workspace_id,profile_id,title,body,archived,archived_at,source_type,source_voice_memo_id,source_metadata";

async function syncGeneratedVoiceMemoNoteSemanticNode(note: NoteSemanticRecord): Promise<{ error: string | null }> {
    const result = await syncNoteSemanticNode(note);
    return { error: result.success ? null : result.error ?? "Failed to sync generated voice memo note semantic node." };
}

function isUniqueGeneratedNoteConflict(error: { code?: string | null; message?: string | null } | null): boolean {
    return error?.code === "23505" || error?.message?.includes("workspace_notes_one_generated_note_per_voice_memo_idx") === true;
}

async function updateExistingGeneratedVoiceMemoNote(params: {
    supabase: VoiceMemoGeneratedNoteSupabaseClient;
    noteId: string;
    payload: VoiceMemoGeneratedNotePayload;
}): Promise<{ note: NoteSemanticRecord | null; error: string | null }> {
    const { data, error } = await params.supabase
        .from("workspace_notes")
        .update({
            title: params.payload.title,
            body: params.payload.body,
            source_type: params.payload.source_type,
            source_metadata: params.payload.source_metadata,
            archived: params.payload.archived,
            archived_at: params.payload.archived_at,
            updated_at: params.payload.updated_at,
        })
        .eq("id", params.noteId)
        .eq("workspace_id", params.payload.workspace_id)
        .eq("profile_id", params.payload.profile_id)
        .eq("source_voice_memo_id", params.payload.source_voice_memo_id)
        .select(GENERATED_NOTE_SEMANTIC_SELECT)
        .maybeSingle();

    if (error) return { note: null, error: error.message };
    if (!data) return { note: null, error: "Generated voice memo note was not found for this workspace." };
    return { note: data as NoteSemanticRecord, error: null };
}

export async function createOrUpdateVoiceMemoGeneratedNote(params: {
    supabase: NotesSupabaseClient;
    input: VoiceMemoGeneratedNoteInput;
}): Promise<{ noteId: string | null; error: string | null }> {
    const payload = buildVoiceMemoGeneratedNotePayload(params.input);

    const { data: existing, error: lookupError } = await params.supabase
        .from("workspace_notes")
        .select("id")
        .eq("workspace_id", payload.workspace_id)
        .eq("profile_id", payload.profile_id)
        .eq("source_voice_memo_id", payload.source_voice_memo_id)
        .maybeSingle();

    if (lookupError) return { noteId: null, error: lookupError.message };

    if (existing) {
        const result = await updateExistingGeneratedVoiceMemoNote({
            supabase: params.supabase,
            noteId: existing.id,
            payload,
        });
        if (result.error || !result.note) return { noteId: null, error: result.error ?? "Failed to update generated voice memo note." };

        const semanticResult = await syncGeneratedVoiceMemoNoteSemanticNode(result.note);
        if (semanticResult.error) return { noteId: null, error: semanticResult.error };

        revalidatePath("/dashboard/notes");
        return { noteId: result.note.id, error: null };
    }

    const { data: inserted, error: insertError } = await params.supabase
        .from("workspace_notes")
        .insert(payload)
        .select(GENERATED_NOTE_SEMANTIC_SELECT)
        .single();

    if (!insertError && inserted) {
        const semanticResult = await syncGeneratedVoiceMemoNoteSemanticNode(inserted as NoteSemanticRecord);
        if (semanticResult.error) return { noteId: null, error: semanticResult.error };

        revalidatePath("/dashboard/notes");
        return { noteId: inserted.id, error: null };
    }

    if (!isUniqueGeneratedNoteConflict(insertError)) {
        return { noteId: null, error: insertError?.message ?? "Failed to create generated voice memo note." };
    }

    const { data: racedExisting, error: racedLookupError } = await params.supabase
        .from("workspace_notes")
        .select("id")
        .eq("workspace_id", payload.workspace_id)
        .eq("profile_id", payload.profile_id)
        .eq("source_voice_memo_id", payload.source_voice_memo_id)
        .maybeSingle();

    if (racedLookupError) return { noteId: null, error: racedLookupError.message };
    if (!racedExisting) return { noteId: null, error: "Generated voice memo note conflict could not be resolved." };

    const result = await updateExistingGeneratedVoiceMemoNote({
        supabase: params.supabase,
        noteId: racedExisting.id,
        payload,
    });
    if (result.error || !result.note) return { noteId: null, error: result.error ?? "Failed to update generated voice memo note." };

    const semanticResult = await syncGeneratedVoiceMemoNoteSemanticNode(result.note);
    if (semanticResult.error) return { noteId: null, error: semanticResult.error };

    revalidatePath("/dashboard/notes");
    return { noteId: result.note.id, error: null };
}

export async function createOrUpdateVoiceMemoGeneratedNoteWithAdminClient(params: {
    supabase: ReturnType<typeof createAdminClient>;
    input: VoiceMemoGeneratedNoteInput;
}): Promise<{ noteId: string | null; error: string | null }> {
    const payload = buildVoiceMemoGeneratedNotePayload(params.input);
    const supabase = params.supabase as unknown as NotesSupabaseClient;

    const { data: existing, error: lookupError } = await supabase
        .from("workspace_notes")
        .select("id")
        .eq("workspace_id", payload.workspace_id)
        .eq("profile_id", payload.profile_id)
        .eq("source_voice_memo_id", payload.source_voice_memo_id)
        .maybeSingle();

    if (lookupError) return { noteId: null, error: lookupError.message };

    if (existing) {
        const result = await updateExistingGeneratedVoiceMemoNote({
            supabase,
            noteId: existing.id,
            payload,
        });
        if (result.error || !result.note) return { noteId: null, error: result.error ?? "Failed to update generated voice memo note." };

        const semanticResult = await syncNoteSemanticNodeWithClient(params.supabase, result.note);
        if (semanticResult.error) return { noteId: null, error: semanticResult.error };

        return { noteId: result.note.id, error: null };
    }

    const { data: inserted, error: insertError } = await supabase
        .from("workspace_notes")
        .insert(payload)
        .select(GENERATED_NOTE_SEMANTIC_SELECT)
        .single();

    if (!insertError && inserted) {
        const semanticResult = await syncNoteSemanticNodeWithClient(params.supabase, inserted as NoteSemanticRecord);
        if (semanticResult.error) return { noteId: null, error: semanticResult.error };

        return { noteId: inserted.id, error: null };
    }

    if (!isUniqueGeneratedNoteConflict(insertError)) {
        return { noteId: null, error: insertError?.message ?? "Failed to create generated voice memo note." };
    }

    const { data: racedExisting, error: racedLookupError } = await supabase
        .from("workspace_notes")
        .select("id")
        .eq("workspace_id", payload.workspace_id)
        .eq("profile_id", payload.profile_id)
        .eq("source_voice_memo_id", payload.source_voice_memo_id)
        .maybeSingle();

    if (racedLookupError) return { noteId: null, error: racedLookupError.message };
    if (!racedExisting) return { noteId: null, error: "Generated voice memo note conflict could not be resolved." };

    const result = await updateExistingGeneratedVoiceMemoNote({
        supabase,
        noteId: racedExisting.id,
        payload,
    });
    if (result.error || !result.note) return { noteId: null, error: result.error ?? "Failed to update generated voice memo note." };

    const semanticResult = await syncNoteSemanticNodeWithClient(params.supabase, result.note);
    if (semanticResult.error) return { noteId: null, error: semanticResult.error };

    return { noteId: result.note.id, error: null };
}
