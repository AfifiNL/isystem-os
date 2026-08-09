"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/shared/lib/supabase/server";
import { resolveWorkspaceContext } from "@/shared/lib/workspace/context";
import { deleteNoteSemanticNode, syncNoteSemanticNode, type NoteSemanticRecord } from "@/features/productivity/notes/semantic-sync";

export interface NoteRecord {
    id: string;
    title: string;
    body: string;
    updated_at: string;
    archived: boolean;
    archived_at: string | null;
}

const NOTE_SEMANTIC_SELECT = "id,workspace_id,profile_id,title,body,archived,archived_at,source_type,source_voice_memo_id,source_metadata";

type NoteSemanticRow = NoteSemanticRecord;

async function syncNoteSemanticInline(note: NoteSemanticRow): Promise<string | null> {
    const result = await syncNoteSemanticNode(note);
    return result.success ? null : result.error ?? "Failed to sync note semantic node.";
}

async function deleteNoteSemanticInline(noteId: string): Promise<string | null> {
    const result = await deleteNoteSemanticNode(noteId);
    return result.success ? null : result.error ?? "Failed to delete note semantic node.";
}

export interface NotesQuery {
    search?: string;
    archivedState?: "active" | "archived" | "all";
    page?: number;
    pageSize?: number;
}

export interface NotesListResult {
    data: NoteRecord[];
    total: number;
    page: number;
    pageSize: number;
    activeCount: number;
    archivedCount: number;
    error: string | null;
}

async function currentUserAndWorkspace(): Promise<{ userId: string; workspaceId: string } | { error: string }> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in." };

    const ctx = await resolveWorkspaceContext();
    if (!ctx?.activeWorkspace?.id) return { error: "No active workspace." };

    return { userId: user.id, workspaceId: ctx.activeWorkspace.id };
}

export async function listNotes(query: NotesQuery = {}): Promise<NotesListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(10, query.pageSize ?? 50));

    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) {
        return { data: [], total: 0, page, pageSize, activeCount: 0, archivedCount: 0, error: ctx.error };
    }

    const supabase = await createClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let builder = (supabase.from("workspace_notes") as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        select: (c: string, opts: { count: "exact" }) => any;
    })
        .select("id,title,body,updated_at,archived,archived_at", { count: "exact" })
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId);

    const archivedState = query.archivedState ?? "active";
    if (archivedState === "active") builder = builder.eq("archived", false);
    else if (archivedState === "archived") builder = builder.eq("archived", true);

    if (query.search && query.search.trim()) {
        const term = query.search.trim().replace(/[%_]/g, "\\$&");
        builder = builder.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    }

    const countArchived = async (archived: boolean) => {
        const res = await (supabase.from("workspace_notes") as unknown as {
            select: (c: string, opts: { count: "exact"; head: true }) => {
                eq: (c: string, v: string) => {
                    eq: (c: string, v: string) => {
                        eq: (c: string, v: boolean) => Promise<{ count: number | null }>;
                    };
                };
            };
        })
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ctx.workspaceId)
            .eq("profile_id", ctx.userId)
            .eq("archived", archived);
        return res.count ?? 0;
    };

    const [result, activeCount, archivedCount] = await Promise.all([
        builder.order("updated_at", { ascending: false }).range(from, to),
        countArchived(false),
        countArchived(true),
    ]);

    if (result.error) {
        return { data: [], total: 0, page, pageSize, activeCount, archivedCount, error: result.error.message };
    }

    return {
        data: (result.data ?? []) as NoteRecord[],
        total: result.count ?? 0,
        page,
        pageSize,
        activeCount,
        archivedCount,
        error: null,
    };
}

export async function createNote(): Promise<{ data: NoteRecord | null; error: string | null }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { data: null, error: ctx.error };

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_notes")
        .insert({
            workspace_id: ctx.workspaceId,
            profile_id: ctx.userId,
            title: "Untitled note",
            body: "",
        })
        .select(`${NOTE_SEMANTIC_SELECT},updated_at`)
        .single();

    if (error || !data) return { data: null, error: error?.message ?? "Failed to create note." };

    const semanticError = await syncNoteSemanticInline(data as NoteSemanticRow);
    if (semanticError) return { data: null, error: semanticError };

    revalidatePath("/dashboard/notes");
    return { data: data as NoteRecord, error: null };
}

export async function updateNote(input: { id: string; title: string; body: string }): Promise<{ error: string | null }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { error: ctx.error };

    const trimmedTitle = input.title.trim().slice(0, 200) || "Untitled note";
    const clampedBody = input.body.slice(0, 100_000);

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("workspace_notes")
        .update({
            title: trimmedTitle,
            body: clampedBody,
            updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId)
        .select(NOTE_SEMANTIC_SELECT)
        .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: "Note not found." };

    const semanticError = await syncNoteSemanticInline(data as NoteSemanticRow);
    if (semanticError) return { error: semanticError };

    return { error: null };
}

function sanitizeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids.filter((id) => typeof id === "string" && id.length > 0)));
}

export async function deleteNote(id: string): Promise<{ error: string | null }> {
    const res = await deleteNotes([id]);
    return { error: res.error };
}

export async function deleteNotes(
    ids: readonly string[],
): Promise<{ error: string | null; deleted: number }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { error: ctx.error, deleted: 0 };
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, deleted: 0 };

    const supabase = await createClient();
    const { data: ownedRows, error: lookupError } = await supabase
        .from("workspace_notes")
        .select("id")
        .in("id", cleaned)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId);

    if (lookupError) return { error: lookupError.message, deleted: 0 };

    const ownedIds = (ownedRows ?? []).map((row) => row.id);
    if (ownedIds.length === 0) return { error: null, deleted: 0 };

    const { error, count } = await (supabase as unknown as {
        from: (t: string) => {
            delete: (opts: { count: "exact" }) => {
                in: (c: string, v: string[]) => {
                    eq: (c: string, v: string) => {
                        eq: (c: string, v: string) => Promise<{ error: { message: string } | null; count: number | null }>;
                    };
                };
            };
        };
    })
        .from("workspace_notes")
        .delete({ count: "exact" })
        .in("id", ownedIds)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId);

    if (error) return { error: error.message, deleted: 0 };

    for (const noteId of ownedIds) {
        const semanticError = await deleteNoteSemanticInline(noteId);
        if (semanticError) return { error: semanticError, deleted: count ?? 0 };
    }

    revalidatePath("/dashboard/notes");
    return { error: null, deleted: count ?? 0 };
}

export async function setNotesArchived(
    ids: readonly string[],
    archived: boolean,
): Promise<{ error: string | null; updated: number }> {
    const ctx = await currentUserAndWorkspace();
    if ("error" in ctx) return { error: ctx.error, updated: 0 };
    const cleaned = sanitizeIds(ids);
    if (cleaned.length === 0) return { error: null, updated: 0 };

    const supabase = await createClient();
    const { data: ownedRows, error: lookupError } = await supabase
        .from("workspace_notes")
        .select("id")
        .in("id", cleaned)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId);

    if (lookupError) return { error: lookupError.message, updated: 0 };

    const ownedIds = (ownedRows ?? []).map((row) => row.id);
    if (ownedIds.length === 0) return { error: null, updated: 0 };

    const { data, error, count } = await (supabase as unknown as {
        from: (t: string) => {
            update: (patch: Record<string, unknown>, opts: { count: "exact" }) => {
                in: (c: string, v: string[]) => {
                    eq: (c: string, v: string) => {
                        eq: (c: string, v: string) => {
                            select: (columns: string) => Promise<{ data: NoteSemanticRow[] | null; error: { message: string } | null; count: number | null }>;
                        };
                    };
                };
            };
        };
    })
        .from("workspace_notes")
        .update(
            { archived, archived_at: archived ? new Date().toISOString() : null },
            { count: "exact" },
        )
        .in("id", ownedIds)
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.userId)
        .select(NOTE_SEMANTIC_SELECT);

    if (error) return { error: error.message, updated: 0 };

    if (archived) {
        // Archived notes leave the active semantic recall surface; unarchiving below reindexes their latest body.
        for (const noteId of ownedIds) {
            const semanticError = await deleteNoteSemanticInline(noteId);
            if (semanticError) return { error: semanticError, updated: count ?? 0 };
        }
    } else {
        for (const note of data ?? []) {
            const semanticError = await syncNoteSemanticInline(note);
            if (semanticError) return { error: semanticError, updated: count ?? 0 };
        }
    }

    revalidatePath("/dashboard/notes");
    return { error: null, updated: count ?? 0 };
}
