import type { Json } from "@/shared/lib/supabase/database.types";

export interface NoteSemanticRecord {
    id: string;
    workspace_id: string;
    profile_id: string;
    title: string;
    body: string;
    archived: boolean;
    archived_at: string | null;
    source_type?: string | null;
    source_voice_memo_id?: string | null;
    source_metadata?: Json | null;
}

export function buildNoteSemanticContent(note: Pick<NoteSemanticRecord, "body">): string {
    return note.body.trim() ? note.body.trim() : "";
}

export function buildNoteSemanticMetadata(note: NoteSemanticRecord): Record<string, unknown> {
    return {
        workspace_id: note.workspace_id,
        profile_id: note.profile_id,
        archived: note.archived,
        archived_at: note.archived_at,
        source_type: note.source_type ?? null,
        source_voice_memo_id: note.source_voice_memo_id ?? null,
        source_metadata: note.source_metadata ?? null,
    };
}
