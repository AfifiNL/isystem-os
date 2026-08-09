"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
    createCaseSnippet,
    deleteCaseSnippet,
    toggleCaseSnippetActive,
    updateCaseSnippet,
} from "@/features/content-engine/case-snippets";
import type { CaseSnippet, CaseSnippetInput } from "@/features/content-engine/case-snippets-types";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

interface CaseSnippetsControlCenterProps {
    initialSnippets: CaseSnippet[];
    initialError: string | null;
    canManage: boolean;
}

const EMPTY_INPUT: CaseSnippetInput = {
    title: "",
    body: "",
    tags: [],
    industry: "",
    outcome_summary: "",
    is_active: true,
};

function snippetToInput(snippet: CaseSnippet): CaseSnippetInput {
    return {
        title: snippet.title,
        body: snippet.body,
        tags: snippet.tags,
        industry: snippet.industry ?? "",
        outcome_summary: snippet.outcome_summary ?? "",
        is_active: snippet.is_active,
    };
}

function parseTags(value: string): string[] {
    return value
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
}

export function CaseSnippetsControlCenter(props: CaseSnippetsControlCenterProps) {
    const [snippets, setSnippets] = useState<CaseSnippet[]>(props.initialSnippets);
    const [error, setError] = useState<string | null>(props.initialError);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draft, setDraft] = useState<CaseSnippetInput>(EMPTY_INPUT);
    const [isPending, startTransition] = useTransition();

    const editingSnippet = useMemo(
        () => (editingId ? snippets.find((s) => s.id === editingId) ?? null : null),
        [editingId, snippets],
    );

    function openCreate() {
        setEditingId(null);
        setDraft(EMPTY_INPUT);
    }

    function openEdit(snippet: CaseSnippet) {
        setEditingId(snippet.id);
        setDraft(snippetToInput(snippet));
    }

    function handleSubmit() {
        setError(null);
        const payload = { ...draft, tags: Array.isArray(draft.tags) ? draft.tags : [] };
        startTransition(async () => {
            if (editingId) {
                const result = await updateCaseSnippet(editingId, payload);
                if (result.error) {
                    setError(result.error);
                    return;
                }
                if (result.data) {
                    const updated = result.data;
                    setSnippets((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
                    setDraft(snippetToInput(updated));
                }
            } else {
                const result = await createCaseSnippet(payload);
                if (result.error) {
                    setError(result.error);
                    return;
                }
                if (result.data) {
                    const created = result.data;
                    setSnippets((rows) => [created, ...rows]);
                    setEditingId(created.id);
                }
            }
        });
    }

    function handleToggle(snippet: CaseSnippet) {
        setError(null);
        const next = !snippet.is_active;
        setSnippets((rows) => rows.map((r) => (r.id === snippet.id ? { ...r, is_active: next } : r)));
        startTransition(async () => {
            const result = await toggleCaseSnippetActive(snippet.id, next);
            if (result.error) {
                setError(result.error);
                setSnippets((rows) =>
                    rows.map((r) => (r.id === snippet.id ? { ...r, is_active: snippet.is_active } : r)),
                );
            }
        });
    }

    function handleDelete(snippet: CaseSnippet) {
        if (!confirm(`Delete "${snippet.title}"? This cannot be undone.`)) return;
        setError(null);
        startTransition(async () => {
            const result = await deleteCaseSnippet(snippet.id);
            if (result.error) {
                setError(result.error);
                return;
            }
            setSnippets((rows) => rows.filter((r) => r.id !== snippet.id));
            if (editingId === snippet.id) {
                openCreate();
            }
        });
    }

    const tagsInput = useMemo(
        () => (Array.isArray(draft.tags) ? draft.tags.join(", ") : ""),
        [draft.tags],
    );

    return (
        <div className="flex h-full flex-col gap-6 p-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-[23px] font-semibold">Case snippets</h1>
                    <p className="mt-1 max-w-2xl text-[17px] text-muted-foreground">
                        Real client anecdotes, named outcomes, and operator stories the AI blog writer weaves into drafts.
                        One specific story per article is the single highest-signal way to make generated content read as
                        human-written. Keep entries short (1-3 sentences) and concrete — names, dates, metrics.
                    </p>
                </div>
                {props.canManage && (
                    <Button onClick={openCreate} disabled={isPending} size="sm">
                        <Plus className="h-4 w-4" />
                        New snippet
                    </Button>
                )}
            </header>

            {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[17px] text-destructive">
                    {error}
                </div>
            )}

            <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px),1fr]">
                <aside className="flex flex-col gap-2 overflow-y-auto rounded-md border bg-card p-3">
                    {snippets.length === 0 && (
                        <p className="px-2 py-4 text-[17px] text-muted-foreground">
                            No snippets yet. Add the first concrete client story so future generations have something to weave in.
                        </p>
                    )}
                    {snippets.map((snippet) => {
                        const isSelected = snippet.id === editingId;
                        return (
                            <button
                                key={snippet.id}
                                type="button"
                                onClick={() => openEdit(snippet)}
                                className={[
                                    "group flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors",
                                    isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-transparent hover:border-border hover:bg-muted/40",
                                ].join(" ")}
                            >
                                <div className="flex w-full items-center justify-between gap-2">
                                    <span className="truncate text-[17px] font-medium">{snippet.title}</span>
                                    <span
                                        className={[
                                            "shrink-0 rounded-full px-2 py-0.5 text-[13px] font-medium uppercase tracking-wide",
                                            snippet.is_active
                                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                                : "bg-muted text-muted-foreground",
                                        ].join(" ")}
                                    >
                                        {snippet.is_active ? "Active" : "Paused"}
                                    </span>
                                </div>
                                <p className="line-clamp-2 text-[15px] text-muted-foreground">{snippet.body}</p>
                                <div className="flex flex-wrap items-center gap-1 text-[14px] text-muted-foreground">
                                    {snippet.tags.slice(0, 4).map((tag) => (
                                        <span key={tag} className="rounded-sm bg-muted px-1.5 py-0.5">
                                            {tag}
                                        </span>
                                    ))}
                                    {snippet.use_count > 0 && (
                                        <span className="ml-auto">used {snippet.use_count}×</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </aside>

                <section className="flex flex-col gap-4 overflow-y-auto rounded-md border bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-[19px] font-semibold">
                            {editingSnippet ? "Edit snippet" : "New snippet"}
                        </h2>
                        {editingSnippet && props.canManage && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggle(editingSnippet)}
                                    disabled={isPending}
                                >
                                    {editingSnippet.is_active ? "Pause" : "Activate"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(editingSnippet)}
                                    disabled={isPending}
                                    className="text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </Button>
                            </div>
                        )}
                    </div>

                    <label className="flex flex-col gap-1.5 text-[17px]">
                        <span className="font-medium">Title</span>
                        <Input
                            value={draft.title}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                            placeholder="Example client onboarding cut from 9 weeks to 12 days"
                            disabled={!props.canManage || isPending}
                            maxLength={160}
                        />
                        <span className="text-[15px] text-muted-foreground">
                            Operator-facing label. Make it scannable in the list view.
                        </span>
                    </label>

                    <label className="flex flex-col gap-1.5 text-[17px]">
                        <span className="font-medium">Body</span>
                        <Textarea
                            value={draft.body}
                            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                            placeholder="When the example client replaced paper check-ins with the configured workflow, supervisor overhead dropped from 18 hours a week to under 3."
                            disabled={!props.canManage || isPending}
                            rows={6}
                            maxLength={2000}
                        />
                        <span className="text-[15px] text-muted-foreground">
                            1-3 sentences. Include names, dates, and concrete metrics. The writer is instructed to preserve them verbatim.
                        </span>
                    </label>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1.5 text-[17px]">
                            <span className="font-medium">Tags</span>
                            <Input
                                value={tagsInput}
                                onChange={(e) => setDraft({ ...draft, tags: parseTags(e.target.value) })}
                                placeholder="onboarding, automation, compliance"
                                disabled={!props.canManage || isPending}
                            />
                            <span className="text-[15px] text-muted-foreground">
                                Comma-separated. The picker prefers snippets whose tags overlap the article keywords.
                            </span>
                        </label>

                        <label className="flex flex-col gap-1.5 text-[17px]">
                            <span className="font-medium">Industry (optional)</span>
                            <Input
                                value={draft.industry ?? ""}
                                onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                                placeholder="facility services"
                                disabled={!props.canManage || isPending}
                            />
                        </label>
                    </div>

                    <label className="flex flex-col gap-1.5 text-[17px]">
                        <span className="font-medium">Outcome summary (optional)</span>
                        <Textarea
                            value={draft.outcome_summary ?? ""}
                            onChange={(e) => setDraft({ ...draft, outcome_summary: e.target.value })}
                            placeholder="Closed 4 net-new contracts in Q1 with the same headcount."
                            disabled={!props.canManage || isPending}
                            rows={2}
                            maxLength={400}
                        />
                    </label>

                    {props.canManage && (
                        <div className="flex items-center justify-between gap-3 border-t pt-4">
                            <label className="flex items-center gap-2 text-[17px]">
                                <input
                                    type="checkbox"
                                    checked={draft.is_active !== false}
                                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                                    disabled={isPending}
                                />
                                Eligible for auto-insertion
                            </label>
                            <div className="flex items-center gap-2">
                                {editingId && (
                                    <Button variant="ghost" size="sm" onClick={openCreate} disabled={isPending}>
                                        Cancel
                                    </Button>
                                )}
                                <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                                    {editingId ? "Save changes" : "Create snippet"}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
