"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, ArchiveRestore, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { AppCommandBar, DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import { SelectionCheckbox } from "@/shared/ui/list-controls";
import type { NoteRecord } from "./actions";
import {
    createNote,
    deleteNote,
    deleteNotes,
    listNotes,
    setNotesArchived,
    updateNote,
} from "./actions";

interface NotesAppProps {
    initialNotes: NoteRecord[];
    initialActiveCount: number;
    initialArchivedCount: number;
}

type ArchivedState = "active" | "archived" | "all";

const PAGE_SIZE = 50;

export function NotesApp({ initialNotes, initialActiveCount, initialArchivedCount }: NotesAppProps) {
    const [notes, setNotes] = useState<NoteRecord[]>(initialNotes);
    const [activeId, setActiveId] = useState<string | null>(initialNotes[0]?.id ?? null);
    const [title, setTitle] = useState(initialNotes[0]?.title ?? "");
    const [body, setBody] = useState(initialNotes[0]?.body ?? "");
    const [archivedFilter, setArchivedFilter] = useState<ArchivedState>("active");
    const [searchDraft, setSearchDraft] = useState("");
    const [search, setSearch] = useState("");
    const [activeCount, setActiveCount] = useState(initialActiveCount);
    const [archivedCount, setArchivedCount] = useState(initialArchivedCount);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isPending, startTransition] = useTransition();
    const [isListPending, startListTransition] = useTransition();
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const activeNote = notes.find((n) => n.id === activeId) ?? null;
    const allSelected = notes.length > 0 && notes.every((note) => selected.has(note.id));
    const someSelected = selected.size > 0 && !allSelected;

    const refreshList = (opts: { archivedState?: ArchivedState; search?: string } = {}) => {
        const nextArchived = opts.archivedState ?? archivedFilter;
        const nextSearch = opts.search ?? search;
        startListTransition(async () => {
            const result = await listNotes({
                archivedState: nextArchived,
                search: nextSearch,
                page: 1,
                pageSize: PAGE_SIZE,
            });
            setNotes(result.data);
            setActiveCount(result.activeCount);
            setArchivedCount(result.archivedCount);
            setSelected(new Set());
            if (result.data[0]) {
                setActiveId(result.data[0].id);
                setTitle(result.data[0].title);
                setBody(result.data[0].body);
            } else {
                setActiveId(null);
                setTitle("");
                setBody("");
            }
            setSaveStatus("idle");
        });
    };

    useEffect(() => {
        if (!activeId) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveStatus("idle");
        saveTimerRef.current = setTimeout(() => {
            setSaveStatus("saving");
            (async () => {
                const result = await updateNote({ id: activeId, title, body });
                if (!result.error) {
                    setSaveStatus("saved");
                    setNotes((prev) =>
                        prev
                            .map((n) =>
                                n.id === activeId
                                    ? { ...n, title: title || "Untitled note", body, updated_at: new Date().toISOString() }
                                    : n,
                            )
                            .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
                    );
                }
            })();
        }, 1000);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [title, body, activeId]);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            if (searchDraft !== search) {
                setSearch(searchDraft);
                refreshList({ search: searchDraft });
            }
        }, 300);
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchDraft]);

    const handleSelect = (id: string) => {
        const note = notes.find((n) => n.id === id);
        if (!note) return;
        setActiveId(id);
        setTitle(note.title);
        setBody(note.body);
        setSaveStatus("idle");
    };

    const handleCreate = () => {
        startTransition(async () => {
            const result = await createNote();
            if (result.data) {
                setNotes((prev) => [result.data as NoteRecord, ...prev]);
                setActiveCount((c) => c + 1);
                setActiveId(result.data.id);
                setTitle(result.data.title);
                setBody(result.data.body);
                setSaveStatus("idle");
            }
        });
    };

    const handleDelete = (id: string) => {
        if (!confirm("Delete this note? This cannot be undone.")) return;
        startTransition(async () => {
            await deleteNote(id);
            refreshList();
        });
    };

    const handleArchiveToggle = (id: string, archived: boolean) => {
        startTransition(async () => {
            await setNotesArchived([id], archived);
            refreshList();
        });
    };

    const toggleArchivedFilter = (next: ArchivedState) => {
        setArchivedFilter(next);
        refreshList({ archivedState: next });
    };

    const toggleSelected = (id: string, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        setSelected(allSelected ? new Set() : new Set(notes.map((note) => note.id)));
    };

    const bulkDelete = () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} note${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
        startTransition(async () => {
            await deleteNotes(ids);
            refreshList();
        });
    };

    const bulkArchive = (archived: boolean) => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        startTransition(async () => {
            await setNotesArchived(ids, archived);
            refreshList();
        });
    };

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-[15px] font-medium text-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                    New
                  </button>
                </div>
            </AppCommandBar>

        <div className="flex min-h-0 flex-1 min-w-0 flex-col md:flex-row">
            <aside className="flex max-h-[38dvh] w-full shrink-0 flex-col border-b border-border/60 bg-muted/20 md:max-h-none md:w-72 md:border-b-0 md:border-r">
                <div className="border-b border-border/60 px-3 py-2 space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            value={searchDraft}
                            onChange={(e) => setSearchDraft(e.target.value)}
                            placeholder="Search notes…"
                            className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-2 text-[15px] focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                    </div>
                    <div className="inline-flex w-full overflow-hidden rounded-md border border-border/60 bg-background text-[15px]">
                        {(["active", "archived", "all"] as ArchivedState[]).map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => toggleArchivedFilter(s)}
                                className={`flex-1 px-2 py-1 capitalize transition-colors ${
                                    archivedFilter === s
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {s}
                                {s === "active" ? ` (${activeCount})` : s === "archived" ? ` (${archivedCount})` : ""}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <SelectionCheckbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onCheckedChange={toggleSelectAll}
                            disabled={notes.length === 0}
                            label="Select all notes"
                            size="sm"
                        />
                        <span>{selected.size > 0 ? `${selected.size} selected` : "Select all notes"}</span>
                    </div>
                    {selected.size > 0 ? (
                        <div className="space-y-1">
                            <p className="text-[13px] uppercase text-primary">{selected.size} selected</p>
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={() => bulkArchive(archivedFilter !== "archived")}
                                    disabled={isPending}
                                    className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-0.5 text-[14px] hover:border-primary/40"
                                >
                                    {archivedFilter === "archived" ? (
                                        <ArchiveRestore className="h-3 w-3" />
                                    ) : (
                                        <Archive className="h-3 w-3" />
                                    )}
                                    {archivedFilter === "archived" ? "Unarchive" : "Archive"}
                                </button>
                                <button
                                    type="button"
                                    onClick={bulkDelete}
                                    disabled={isPending}
                                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[14px] text-destructive hover:bg-destructive/20"
                                >
                                    <Trash2 className="h-3 w-3" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
                <ul className="flex-1 overflow-y-auto">
                    {isListPending ? (
                        <li className="flex items-center justify-center px-3 py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </li>
                    ) : notes.length === 0 ? (
                        <li className="px-3 py-8 text-center text-[15px] text-muted-foreground">
                            {search
                                ? `No notes match “${search}”.`
                                : archivedFilter === "archived"
                                    ? "No archived notes."
                                    : "No notes yet. Press New to start."}
                        </li>
                    ) : (
                        notes.map((note) => {
                            const isActive = note.id === activeId;
                            const checked = selected.has(note.id);
                            return (
                                <li key={note.id} className="relative">
                                    <div className="flex items-start gap-2 border-b border-border/40 px-3 py-2.5">
                                        <SelectionCheckbox
                                            checked={checked}
                                            onCheckedChange={(nextChecked) => toggleSelected(note.id, nextChecked)}
                                            label={`Select note ${note.title || "Untitled note"}`}
                                            className="mt-0.5"
                                            size="sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(note.id)}
                                            className={`flex-1 min-w-0 rounded-md px-2 py-1 text-left transition-colors ${
                                                isActive ? "bg-primary/10" : "hover:bg-background"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-[15px] font-medium text-foreground">
                                                    {note.title || "Untitled note"}
                                                </p>
                                                {note.archived ? (
                                                    <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                ) : null}
                                            </div>
                                            <p className="mt-0.5 line-clamp-1 text-[15px] text-muted-foreground">
                                                {note.body.slice(0, 80) || "No content"}
                                            </p>
                                        </button>
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                {activeNote ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Title"
                                className="min-w-[12rem] flex-1 bg-transparent text-[20px] font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
                            />
                            <span className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground">
                                {saveStatus === "saving" ? (
                                    <>
                                        <Save className="h-3 w-3 animate-pulse" />
                                        Saving…
                                    </>
                                ) : saveStatus === "saved" ? (
                                    <>
                                        <Save className="h-3 w-3 text-emerald-500" />
                                        Saved
                                    </>
                                ) : null}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleArchiveToggle(activeNote.id, !activeNote.archived)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[15px] text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                            >
                                {activeNote.archived ? (
                                    <ArchiveRestore className="h-3 w-3" />
                                ) : (
                                    <Archive className="h-3 w-3" />
                                )}
                                {activeNote.archived ? "Unarchive" : "Archive"}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(activeNote.id)}
                                disabled={isPending}
                                aria-busy={isPending || undefined}
                                className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[15px] text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                {isPending ? "Deleting…" : "Delete"}
                            </button>
                        </div>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Start typing…"
                            className="min-h-[18rem] flex-1 resize-none bg-background px-4 py-3 text-[17px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
                        />
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center text-[15px] text-muted-foreground">
                        {search
                            ? `No notes match “${search}”.`
                            : archivedFilter === "archived"
                                ? "No archived notes yet."
                                : "No note selected. Create one to get started."}
                    </div>
                )}
            </div>
        </div>
        </DashboardAppWorkbench>
    );
}
