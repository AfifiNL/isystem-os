"use client";

import { useMemo, useState, useTransition } from "react";
import {
    POPUP_LOCALES,
    POPUP_TEMPLATE_KINDS,
    POPUP_TRIGGER_TYPES,
    type PopupConfigInput,
    type PopupContent,
    type PopupTemplateKind,
    type PopupTrigger,
} from "@/features/popups/schema";
import {
    createPopupFromTemplate,
    deletePopup,
    togglePopupActive,
    updatePopup,
    type PopupRow,
} from "@/features/popups/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
    DashboardAppWorkbench,
    AppCommandBar,
    AppStatusBanner,
} from "@/features/admin/ui/app-workbench";

interface PopupsControlCenterProps {
    initialPopups: PopupRow[];
    initialError: string | null;
    canManage: boolean;
    dashboardLocale: "en" | "nl";
}

const TEMPLATE_LABELS: Record<PopupTemplateKind, string> = {
    "newsletter-classic": "Newsletter — classic (inline form)",
    "newsletter-minimal": "Newsletter — minimal (deep link)",
    "booking-promo": "Booking — promo (editorial)",
    "booking-urgency": "Booking — urgency (exit intent)",
};

const TRIGGER_LABELS: Record<"exit_intent" | "timed", string> = {
    exit_intent: "Exit intent (desktop only)",
    timed: "Timed delay",
};

function rowToInput(row: PopupRow): PopupConfigInput {
    const trigger: PopupTrigger = row.trigger_type === "timed"
        ? {
            type: "timed",
            config: {
                delay_ms: Number((row.trigger_config as { delay_ms?: unknown }).delay_ms) || 8_000,
            },
        }
        : { type: "exit_intent", config: {} };
    return {
        name: row.name,
        template_kind: row.template_kind,
        trigger,
        content: row.content,
        audience: row.audience ?? {},
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        priority: row.priority,
        dismissal_ttl_seconds: row.dismissal_ttl_seconds,
        is_active: row.is_active,
    };
}

export function PopupsControlCenter(props: PopupsControlCenterProps) {
    const [popups, setPopups] = useState<PopupRow[]>(props.initialPopups);
    const [error, setError] = useState<string | null>(props.initialError);
    const [editing, setEditing] = useState<PopupRow | null>(null);
    const [isPending, startTransition] = useTransition();

    function refresh(updater: (current: PopupRow[]) => PopupRow[]) {
        setPopups((prev) => updater(prev));
    }

    async function handleCreate(kind: PopupTemplateKind) {
        setError(null);
        startTransition(async () => {
            const result = await createPopupFromTemplate(kind);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (result.data) {
                refresh((rows) => [result.data as PopupRow, ...rows]);
                setEditing(result.data);
            }
        });
    }

    async function handleToggle(row: PopupRow) {
        setError(null);
        const next = !row.is_active;
        // Optimistic — flip immediately, revert on error.
        refresh((rows) => rows.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
        startTransition(async () => {
            const result = await togglePopupActive(row.id, next);
            if (result.error) {
                setError(result.error);
                refresh((rows) => rows.map((r) => (r.id === row.id ? { ...r, is_active: row.is_active } : r)));
            }
        });
    }

    async function handleDelete(row: PopupRow) {
        if (!window.confirm(`Delete popup "${row.name}"? This cannot be undone.`)) return;
        setError(null);
        startTransition(async () => {
            const result = await deletePopup(row.id);
            if (result.error) {
                setError(result.error);
                return;
            }
            refresh((rows) => rows.filter((r) => r.id !== row.id));
            if (editing?.id === row.id) setEditing(null);
        });
    }

    async function handleSave(input: PopupConfigInput) {
        if (!editing) return;
        setError(null);
        startTransition(async () => {
            const result = await updatePopup(editing.id, input);
            if (result.error) {
                setError(result.error);
                return;
            }
            if (result.data) {
                refresh((rows) => rows.map((r) => (r.id === editing.id ? (result.data as PopupRow) : r)));
                setEditing(result.data);
            }
        });
    }

    const sorted = useMemo(
        () => [...popups].sort((a, b) => b.priority - a.priority || (b.updated_at > a.updated_at ? 1 : -1)),
        [popups],
    );

    return (
        <DashboardAppWorkbench>
            <AppCommandBar>
                <div className="flex w-full items-center justify-end">
                    {props.canManage ? <CreateMenu onCreate={handleCreate} disabled={isPending} /> : null}
                </div>
            </AppCommandBar>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {error ? (
                    <AppStatusBanner variant="destructive">
                        {error}
                    </AppStatusBanner>
                ) : null}

                {sorted.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/50 bg-card p-10 text-center text-muted-foreground">
                        <p className="font-medium text-[19px]">No popups yet.</p>
                        <p className="mt-1 text-[17px]">Create one from a template to get started.</p>
                    </div>
                ) : (
                    <ul className="grid gap-3">
                        {sorted.map((row) => (
                            <li
                                key={row.id}
                                className="flex flex-col gap-3 rounded-md border border-border/50 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-foreground text-[17px]">{row.name}</span>
                                        <span className={
                                            row.is_active
                                                ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[15px] font-medium text-emerald-600 dark:text-emerald-400"
                                                : "rounded-full bg-muted px-2 py-0.5 text-[15px] font-medium text-muted-foreground"
                                        }>
                                            {row.is_active ? "Active" : "Draft"}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-[15px] text-muted-foreground">
                                        {TEMPLATE_LABELS[row.template_kind]} · {TRIGGER_LABELS[row.trigger_type]}
                                        {" · priority "}{row.priority}
                                    </div>
                                </div>
                                {props.canManage ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setEditing(row)} disabled={isPending}>
                                            Edit
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleToggle(row)} disabled={isPending}>
                                            {row.is_active ? "Disable" : "Enable"}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleDelete(row)} disabled={isPending}>
                                            Delete
                                        </Button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}

                {editing && props.canManage ? (
                    <PopupEditorPanel
                        key={editing.id}
                        row={editing}
                        onClose={() => setEditing(null)}
                        onSave={handleSave}
                        isSaving={isPending}
                    />
                ) : null}
            </div>
        </DashboardAppWorkbench>
    );
}

function CreateMenu({
    onCreate,
    disabled,
}: {
    onCreate: (kind: PopupTemplateKind) => void;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <Button onClick={() => setOpen((v) => !v)} disabled={disabled}>
                + Create from template
            </Button>
            {open ? (
                <div
                    className="absolute end-0 z-10 mt-2 w-72 rounded-md border border-border/50 bg-card p-1 shadow-lg"
                    onMouseLeave={() => setOpen(false)}
                >
                    {POPUP_TEMPLATE_KINDS.map((kind) => (
                        <button
                            key={kind}
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onCreate(kind);
                            }}
                            className="block w-full rounded-md px-3 py-2 text-start text-[17px] text-foreground/90 hover:bg-muted"
                        >
                            {TEMPLATE_LABELS[kind]}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

interface PopupEditorPanelProps {
    row: PopupRow;
    onClose: () => void;
    onSave: (input: PopupConfigInput) => void;
    isSaving: boolean;
}

function PopupEditorPanel({ row, onClose, onSave, isSaving }: PopupEditorPanelProps) {
    const [draft, setDraft] = useState<PopupConfigInput>(rowToInput(row));
    const [activeLocale, setActiveLocale] = useState<typeof POPUP_LOCALES[number]>("en");

    function patchContent(patch: Partial<PopupContent>) {
        setDraft((prev) => ({ ...prev, content: { ...prev.content, ...patch } }));
    }

    function patchLocalized<K extends "title" | "body" | "ctaLabel">(field: K, value: string) {
        setDraft((prev) => ({
            ...prev,
            content: {
                ...prev.content,
                [field]: { ...prev.content[field], [activeLocale]: value },
            },
        }));
    }

    function patchOptionalLocalized(field: "eyebrow" | "dismissLabel", value: string) {
        setDraft((prev) => ({
            ...prev,
            content: {
                ...prev.content,
                [field]: { ...(prev.content[field] ?? { en: "" }), [activeLocale]: value },
            },
        }));
    }

    function patchTrigger(next: PopupTrigger) {
        setDraft((prev) => ({ ...prev, trigger: next }));
    }

    return (
        <section className="rounded-md border border-border/50 bg-card p-5 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
                <h2 className="text-[21px] font-semibold text-foreground">Editing: {draft.name}</h2>
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </header>

            <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                    <Field label="Name (internal)">
                        <Input
                            value={draft.name}
                            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                    </Field>

                    <div className="rounded-md border border-border/50 bg-muted/35 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-[17px] font-medium text-foreground/90">Content (per locale)</span>
                            <div className="flex gap-1">
                                {POPUP_LOCALES.map((loc) => (
                                    <button
                                        key={loc}
                                        type="button"
                                        onClick={() => setActiveLocale(loc)}
                                        className={
                                            activeLocale === loc
                                                ? "rounded-md bg-primary px-3 py-1 text-[15px] font-semibold text-primary-foreground"
                                                : "rounded-md px-3 py-1 text-[15px] font-medium text-muted-foreground hover:bg-muted"
                                        }
                                    >
                                        {loc.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Field label="Eyebrow (optional)">
                                <Input
                                    value={draft.content.eyebrow?.[activeLocale] ?? ""}
                                    onChange={(e) => patchOptionalLocalized("eyebrow", e.target.value)}
                                    placeholder="Small label above title"
                                />
                            </Field>
                            <Field label="Title">
                                <Input
                                    value={draft.content.title[activeLocale] ?? ""}
                                    onChange={(e) => patchLocalized("title", e.target.value)}
                                />
                            </Field>
                            <Field label="Body">
                                <Textarea
                                    value={draft.content.body[activeLocale] ?? ""}
                                    onChange={(e) => patchLocalized("body", e.target.value)}
                                    rows={3}
                                />
                            </Field>
                            <Field label="CTA label">
                                <Input
                                    value={draft.content.ctaLabel[activeLocale] ?? ""}
                                    onChange={(e) => patchLocalized("ctaLabel", e.target.value)}
                                />
                            </Field>
                            <Field label="Dismiss label (optional)">
                                <Input
                                    value={draft.content.dismissLabel?.[activeLocale] ?? ""}
                                    onChange={(e) => patchOptionalLocalized("dismissLabel", e.target.value)}
                                    placeholder="Maybe later"
                                />
                            </Field>
                        </div>
                    </div>

                    <Field label="CTA URL">
                        <Input
                            value={draft.content.ctaHref}
                            onChange={(e) => patchContent({ ctaHref: e.target.value })}
                            placeholder="/newsletter or /booking"
                        />
                    </Field>
                </div>

                <div className="space-y-4">
                    <Field label="Trigger">
                        <select
                            value={draft.trigger.type}
                            onChange={(e) => {
                                const type = e.target.value as typeof POPUP_TRIGGER_TYPES[number];
                                patchTrigger(
                                    type === "timed"
                                        ? { type: "timed", config: { delay_ms: 8_000 } }
                                        : { type: "exit_intent", config: {} },
                                );
                            }}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-[17px]"
                        >
                            {POPUP_TRIGGER_TYPES.map((t) => (
                                <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                            ))}
                        </select>
                    </Field>

                    {draft.trigger.type === "timed" ? (
                        <Field label="Delay (seconds)">
                            <Input
                                type="number"
                                min={1}
                                max={300}
                                value={Math.round((draft.trigger.config.delay_ms ?? 8_000) / 1000)}
                                onChange={(e) => {
                                    const seconds = Math.max(1, Math.min(300, Number(e.target.value) || 8));
                                    patchTrigger({ type: "timed", config: { delay_ms: seconds * 1000 } });
                                }}
                            />
                        </Field>
                    ) : null}

                    <Field label="Show on locales">
                        <div className="flex gap-3">
                            {POPUP_LOCALES.map((loc) => {
                                const checked = draft.audience.locales?.includes(loc) ?? false;
                                return (
                                    <label key={loc} className="inline-flex items-center gap-2 text-[17px] text-foreground/90">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                                const current = draft.audience.locales ?? [];
                                                const next = checked
                                                    ? current.filter((l) => l !== loc)
                                                    : [...current, loc];
                                                setDraft({
                                                    ...draft,
                                                    audience: { ...draft.audience, locales: next.length ? next : undefined },
                                                });
                                            }}
                                        />
                                        {loc.toUpperCase()}
                                    </label>
                                );
                            })}
                        </div>
                        <p className="mt-1 text-[15px] text-muted-foreground">Leave all unchecked to show on every locale.</p>
                    </Field>

                    <Field label="Include paths (one per line)">
                        <Textarea
                            rows={3}
                            placeholder={"/blog/*\n/services"}
                            value={(draft.audience.include_paths ?? []).join("\n")}
                            onChange={(e) => {
                                const lines = e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                setDraft({
                                    ...draft,
                                    audience: { ...draft.audience, include_paths: lines.length ? lines : undefined },
                                });
                            }}
                        />
                    </Field>

                    <Field label="Exclude paths (one per line)">
                        <Textarea
                            rows={2}
                            placeholder="/legal/*"
                            value={(draft.audience.exclude_paths ?? []).join("\n")}
                            onChange={(e) => {
                                const lines = e.target.value
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                setDraft({
                                    ...draft,
                                    audience: { ...draft.audience, exclude_paths: lines.length ? lines : undefined },
                                });
                            }}
                        />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Starts (UTC, optional)">
                            <Input
                                type="datetime-local"
                                value={localFromIso(draft.starts_at ?? null)}
                                onChange={(e) => setDraft({ ...draft, starts_at: isoFromLocal(e.target.value) })}
                            />
                        </Field>
                        <Field label="Ends (UTC, optional)">
                            <Input
                                type="datetime-local"
                                value={localFromIso(draft.ends_at ?? null)}
                                onChange={(e) => setDraft({ ...draft, ends_at: isoFromLocal(e.target.value) })}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Priority">
                            <Input
                                type="number"
                                min={0}
                                max={1000}
                                value={draft.priority}
                                onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
                            />
                        </Field>
                        <Field label="Dismissal TTL (days)">
                            <Input
                                type="number"
                                min={0}
                                max={365}
                                value={Math.round(draft.dismissal_ttl_seconds / 86_400)}
                                onChange={(e) => {
                                    const days = Math.max(0, Math.min(365, Number(e.target.value) || 0));
                                    setDraft({ ...draft, dismissal_ttl_seconds: days * 86_400 });
                                }}
                            />
                        </Field>
                    </div>

                    <label className="inline-flex items-center gap-2 text-[17px] text-foreground/90">
                        <input
                            type="checkbox"
                            checked={draft.is_active}
                            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                        />
                        Active (visible to public visitors)
                    </label>
                </div>
            </div>

            <footer className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                <Button onClick={() => onSave(draft)} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save changes"}
                </Button>
            </footer>
        </section>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[15px] font-medium text-muted-foreground">{label}</span>
            {children}
        </label>
    );
}

// datetime-local <input> wants "YYYY-MM-DDTHH:mm" in LOCAL time. We store
// ISO-UTC. Convert both directions, treating empty inputs as null.
function localFromIso(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoFromLocal(local: string): string | null {
    if (!local) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}
