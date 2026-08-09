import { createAdminClient } from "@/shared/lib/supabase/admin";
import { deleteSemanticNode, syncSemanticNode, syncSemanticNodeWithClient } from "@/shared/lib/semantic-hub/sync";
import { buildNoteSemanticContent, buildNoteSemanticMetadata, type NoteSemanticRecord } from "@/features/productivity/notes/semantic-payload";

export type { NoteSemanticRecord } from "@/features/productivity/notes/semantic-payload";

export async function syncNoteSemanticNode(note: NoteSemanticRecord): Promise<{ success: boolean; error: string | null }> {
    return syncSemanticNode({
        workspaceId: note.workspace_id,
        entityType: "note",
        entityId: note.id,
        title: note.title,
        content: buildNoteSemanticContent(note),
        metadata: buildNoteSemanticMetadata(note),
    });
}

export async function syncNoteSemanticNodeWithClient(
    supabase: ReturnType<typeof createAdminClient>,
    note: NoteSemanticRecord,
): Promise<{ success: boolean; error: string | null }> {
    return syncSemanticNodeWithClient({
        supabase: supabase as unknown as Awaited<ReturnType<typeof import("@/shared/lib/supabase/server").createClient>>,
        workspaceId: note.workspace_id,
        entityType: "note",
        entityId: note.id,
        title: note.title,
        content: buildNoteSemanticContent(note),
        metadata: buildNoteSemanticMetadata(note),
    });
}

export async function deleteNoteSemanticNode(noteId: string): Promise<{ success: boolean; error: string | null }> {
    return deleteSemanticNode("note", noteId);
}
