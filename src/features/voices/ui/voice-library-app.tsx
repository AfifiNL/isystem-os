"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Mic, Trash2, UploadCloud, Wand2 } from "lucide-react";
import { archiveVoice, deleteVoice, restoreVoice } from "../actions";
import type { WorkspaceVoice } from "../types";

interface VoiceLibraryAppProps {
    initialVoices: WorkspaceVoice[];
    initialError: string | null;
    canManage: boolean;
    elevenlabsConfigured: boolean;
}

export function VoiceLibraryApp({ initialVoices, initialError, canManage, elevenlabsConfigured }: VoiceLibraryAppProps) {
    const router = useRouter();
    const [voices, setVoices] = useState(initialVoices);
    const [error, setError] = useState<string | null>(initialError);
    const [showClone, setShowClone] = useState(false);
    const [busy, startTransition] = useTransition();

    const handleArchive = (voice: WorkspaceVoice) => {
        startTransition(async () => {
            const result = voice.archived_at ? await restoreVoice(voice.id) : await archiveVoice(voice.id);
            if (result.error) setError(result.error);
            else router.refresh();
        });
    };

    const handleDelete = (voice: WorkspaceVoice) => {
        if (!confirm(`Permanently delete "${voice.display_name}"?`)) return;
        startTransition(async () => {
            const result = await deleteVoice(voice.id);
            if (result.error) {
                setError(result.error);
                return;
            }
            setVoices((prev) => prev.filter((v) => v.id !== voice.id));
        });
    };

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            <header className="flex flex-wrap items-center gap-3 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-muted-foreground" />
                    <h1 className="text-[21px] font-semibold tracking-tight">Voice Library</h1>
                </div>
                <span className="text-[17px] text-muted-foreground">{voices.length} voices</span>
                {canManage && (
                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowClone(true)}
                            disabled={!elevenlabsConfigured}
                            title={!elevenlabsConfigured ? "ElevenLabs is not configured" : ""}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                            <Wand2 className="h-4 w-4" /> Clone voice
                        </button>
                    </div>
                )}
            </header>

            {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[17px] text-red-400">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
                </div>
            )}

            {voices.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[17px] text-muted-foreground">
                    <Mic className="h-8 w-8 opacity-40" />
                    <p>No voices yet.</p>
                    {canManage && elevenlabsConfigured && (
                        <button
                            type="button"
                            onClick={() => setShowClone(true)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5"
                        >
                            <Wand2 className="h-4 w-4" /> Clone your first voice
                        </button>
                    )}
                </div>
            ) : (
                <ul className="grid gap-2 overflow-y-auto pr-1">
                    {voices.map((voice) => (
                        <li
                            key={voice.id}
                            className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-card/40 p-3"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Mic className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-medium">{voice.display_name}</span>
                                    <Tag>{voice.provider}</Tag>
                                    <Tag>{voice.voice_type.replace(/_/g, " ")}</Tag>
                                    {voice.consent_status === "granted" && <Tag>consented</Tag>}
                                    {voice.provider_status === "pending" && <Tag>pending</Tag>}
                                    {voice.archived_at && <Tag>archived</Tag>}
                                </div>
                                <div className="text-[15px] text-muted-foreground">
                                    {voice.language_code} • {voice.model_preference ?? "default model"}
                                </div>
                            </div>
                            {canManage && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleArchive(voice)}
                                        disabled={busy}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title={voice.archived_at ? "Restore" : "Archive"}
                                    >
                                        <Archive className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(voice)}
                                        disabled={busy}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {showClone && canManage && (
                <CloneDialog
                    onClose={() => setShowClone(false)}
                    onSuccess={() => {
                        setShowClone(false);
                        router.refresh();
                    }}
                    onError={setError}
                />
            )}
        </div>
    );
}

function Tag({ children }: { children: React.ReactNode }) {
    return (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[14px] uppercase tracking-wide text-primary">
            {children}
        </span>
    );
}

function CloneDialog({
    onClose,
    onSuccess,
    onError,
}: {
    onClose: () => void;
    onSuccess: () => void;
    onError: (msg: string) => void;
}) {
    const [files, setFiles] = useState<File[]>([]);
    const [displayName, setDisplayName] = useState("");
    const [actorName, setActorName] = useState("");
    const [languageCode, setLanguageCode] = useState("en");
    const [modelPreference, setModelPreference] = useState("eleven_multilingual_v2");
    const [consent, setConsent] = useState(false);
    const [submitting, startSubmit] = useTransition();

    const submit = () => {
        if (files.length === 0) {
            onError("Add at least one reference audio sample file.");
            return;
        }
        if (!displayName.trim()) {
            onError("Display name is required.");
            return;
        }
        if (!actorName.trim()) {
            onError("Consent actor name is required.");
            return;
        }
        if (!consent) {
            onError("Explicit consent checkbox is required.");
            return;
        }

        const fd = new FormData();
        fd.append("display_name", displayName.trim());
        fd.append("language_code", languageCode);
        fd.append("model_preference", modelPreference);
        fd.append("consent_granted", "true");
        fd.append("consent_actor_name", actorName.trim());
        fd.append("consent_source", "self_upload");
        for (const file of files) {
            fd.append("samples", file);
        }

        startSubmit(async () => {
            try {
                const res = await fetch("/api/voices/elevenlabs/clone", { method: "POST", body: fd });
                const data = await res.json();
                if (!res.ok) {
                    onError(data.error ?? "Clone failed.");
                    return;
                }
                onSuccess();
            } catch (err) {
                onError(err instanceof Error ? err.message : "Clone failed.");
            }
        });
    };

    return (
        <Dialog title="Clone voice (ElevenLabs IVC)" onClose={onClose}>
            <div className="max-h-[80vh] overflow-y-auto pr-1 flex flex-col gap-3">
                <Field label="Display name">
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="e.g. Primary Host Voice" />
                </Field>

                <Field label="Audio samples (≥30s clean speech, up to 5 files, ≤12MB each)">
                    <input
                        type="file"
                        accept="audio/*"
                        multiple
                        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                        className={inputClass}
                    />
                    {files.length > 0 && (
                        <p className="mt-1 text-[15px] text-muted-foreground">
                            {files.length} file(s), {(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                        </p>
                    )}
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Language">
                        <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className={inputClass}>
                            <option value="en">English</option>
                            <option value="nl">Nederlands</option>
                            <option value="de">Deutsch</option>
                            <option value="fr">Français</option>
                            <option value="es">Español</option>
                            <option value="ar">العربية</option>
                        </select>
                    </Field>
                    <Field label="Model">
                        <select value={modelPreference} onChange={(e) => setModelPreference(e.target.value)} className={inputClass}>
                            <option value="eleven_multilingual_v2">Multilingual v2 (stable)</option>
                            <option value="eleven_v3">v3 (expressive)</option>
                            <option value="eleven_flash_v2_5">Flash v2.5 (fast)</option>
                        </select>
                    </Field>
                </div>

                <Field label="Consent — name of the speaker (or authorized signatory)">
                    <input value={actorName} onChange={(e) => setActorName(e.target.value)} className={inputClass} placeholder="Full name" />
                </Field>

                <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-[15px]">
                    <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5"
                    />
                    <span>
                        I confirm that the voice in this audio sample is mine, OR I am authorized by the speaker to clone
                        their voice for use in this workspace, AND that I will not use the cloned voice to impersonate,
                        deceive, or generate content that violates the speaker&apos;s consent.
                    </span>
                </label>

                <DialogActions onClose={onClose} busy={submitting}>
                    <button type="button" onClick={submit} disabled={submitting} className={btnPrimary}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        Clone voice
                    </button>
                </DialogActions>
            </div>
        </Dialog>
    );
}

const inputClass = "rounded-md border border-border/40 bg-background px-2 py-1.5 text-[17px] w-full disabled:opacity-60";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 text-[17px] hover:bg-muted disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1 text-[17px]">
            <span className="text-[15px] uppercase tracking-wide text-muted-foreground">{label}</span>
            {children}
        </label>
    );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="flex w-full max-w-lg flex-col gap-3 rounded-lg border border-border/40 bg-background p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-[19px] font-semibold">{title}</h2>
                {children}
            </div>
        </div>
    );
}

function DialogActions({ onClose, children, busy }: { onClose: () => void; children: React.ReactNode; busy: boolean }) {
    return (
        <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>Cancel</button>
            {children}
        </div>
    );
}
