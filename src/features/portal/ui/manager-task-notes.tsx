"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    addManagerNote,
    listScheduleNotes,
    type ScheduleNote,
} from "@/features/portal/actions/sla-flags-actions";

interface ManagerTaskNotesProps {
    scheduleId: string;
}

function formatTimestamp(iso: string): string {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso));
}

// Inline notes panel surfaced under a TaskRow when the manager clicks the
// "Notes" toggle. Lazily fetches the latest 25 notes (most recent first) so
// the parent table render isn't penalized for every task. Includes an
// "Add note" composer with optional "marks as resolved" checkbox — the
// resolution flag is what pushes a flagged task back off the inbox surface.
export function ManagerTaskNotes({ scheduleId }: ManagerTaskNotesProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState<ScheduleNote[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();

    const [body, setBody] = useState("");
    const [resolves, setResolves] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, startSubmitting] = useTransition();

    function toggleOpen() {
        const next = !isOpen;
        setIsOpen(next);
        if (next && notes === null) {
            startLoading(async () => {
                const result = await listScheduleNotes(scheduleId);
                if (result.error) {
                    setLoadError(result.error);
                    return;
                }
                setNotes(result.data);
            });
        }
    }

    function submit() {
        if (!body.trim() || isSubmitting) return;
        setSubmitError(null);
        startSubmitting(async () => {
            const result = await addManagerNote(scheduleId, body, { resolves });
            if (result.error || !result.data) {
                setSubmitError(result.error ?? "Failed to add note.");
                return;
            }
            setNotes((prev) => (prev ? [result.data!, ...prev] : [result.data!]));
            setBody("");
            setResolves(false);
            router.refresh();
        });
    }

    const unresolvedFlags = (notes ?? []).filter((n) => n.is_flag && !(notes ?? []).some((m) => m.is_resolution && new Date(m.created_at) > new Date(n.created_at)));

    return (
        <div className="mt-1">
            <button
                type="button"
                onClick={toggleOpen}
                className={`text-[11px] font-medium ${unresolvedFlags.length > 0 ? "text-red-600 hover:text-red-800" : "text-muted-foreground hover:text-foreground"}`}
            >
                {isOpen ? "Hide notes" : `Notes${unresolvedFlags.length > 0 ? ` · ${unresolvedFlags.length} flag${unresolvedFlags.length === 1 ? "" : "s"}` : ""}`}
            </button>

            {isOpen ? (
                <div className="mt-2 rounded-md border bg-muted/40 p-3 text-xs space-y-3">
                    <div>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Reply to the client, leave context, or note an action taken…"
                            rows={2}
                            maxLength={4000}
                            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={resolves}
                                    onChange={(e) => setResolves(e.target.checked)}
                                    className="h-3.5 w-3.5"
                                />
                                Marks open flag as resolved
                            </label>
                            <div className="ml-auto flex items-center gap-2">
                                {submitError ? <span className="text-[11px] text-destructive">{submitError}</span> : null}
                                <button
                                    type="button"
                                    onClick={submit}
                                    disabled={!body.trim() || isSubmitting}
                                    className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {isSubmitting ? "Posting…" : "Post note"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {isLoading && notes === null ? (
                            <p className="text-[11px] text-muted-foreground">Loading notes…</p>
                        ) : loadError ? (
                            <p className="text-[11px] text-destructive">{loadError}</p>
                        ) : (notes ?? []).length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No notes yet.</p>
                        ) : (
                            (notes ?? []).map((note) => (
                                <div
                                    key={note.id}
                                    className={`rounded border bg-background px-2.5 py-1.5 ${
                                        note.is_flag && !note.is_resolution
                                            ? "border-amber-300"
                                            : note.is_resolution
                                                ? "border-emerald-300"
                                                : "border-border"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                        <span>
                                            {note.author_kind === "portal_client" ? "Client" : "Workspace"}
                                            {note.author_email ? ` · ${note.author_email}` : ""}
                                            {note.is_flag ? " · flagged" : ""}
                                            {note.is_resolution ? " · resolution" : ""}
                                        </span>
                                        <span>{formatTimestamp(note.created_at)}</span>
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{note.body}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
