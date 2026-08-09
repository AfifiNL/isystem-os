"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Loader2, Mic, Plus, Send, Trash2, Upload, Wand2, X } from "lucide-react";
import {
    attachMusic,
    createEpisode,
    createShow,
    deleteEpisode,
    detachMusic,
    publishEpisode,
    setEpisodeVoices,
    unpublishEpisode,
    updateEpisode,
    updateShow,
} from "../actions";
import type { EpisodeStatus, EpisodeType, MusicRole, PodcastEpisode, PodcastShow } from "../types";
import type { MusicTrackWithUrl } from "@/features/music-library/types";
import type { WorkspaceVoice } from "@/features/voices/types";

interface PodcastStudioProps {
    initialShows: PodcastShow[];
    initialEpisodes: PodcastEpisode[];
    initialTracks: MusicTrackWithUrl[];
    initialVoices: WorkspaceVoice[];
    canManage: boolean;
}

const STATUS_BADGE: Record<EpisodeStatus, string> = {
    draft: "bg-zinc-500/20 text-zinc-300",
    scheduled: "bg-amber-500/20 text-amber-300",
    published: "bg-emerald-500/20 text-emerald-300",
    archived: "bg-rose-500/20 text-rose-300",
};

export function PodcastStudio({ initialShows, initialEpisodes, initialTracks, initialVoices, canManage }: PodcastStudioProps) {
    const router = useRouter();
    const [shows, setShows] = useState(initialShows);
    // Sync episodes from props on every parent re-render. router.refresh()
    // re-runs the server component and passes a new initialEpisodes; without
    // this effect the local state would be frozen to the first-mount value
    // and create/delete/publish/unpublish would not show until a full reload.
    const [episodes, setEpisodes] = useState(initialEpisodes);
    useEffect(() => {
        setEpisodes(initialEpisodes);
    }, [initialEpisodes]);
    useEffect(() => {
        setShows(initialShows);
    }, [initialShows]);
    const tracks = initialTracks;
    const voices = initialVoices;
    const [activeShowId, setActiveShowId] = useState<string | null>(initialShows[0]?.id ?? null);
    const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, startTransition] = useTransition();
    const [showCreateShow, setShowCreateShow] = useState(false);
    const [showCreateEpisode, setShowCreateEpisode] = useState(false);

    const activeShow = shows.find((s) => s.id === activeShowId) ?? null;
    const filteredEpisodes = useMemo(
        () => episodes.filter((e) => !activeShowId || e.show_id === activeShowId),
        [episodes, activeShowId],
    );
    const activeEpisode = filteredEpisodes.find((e) => e.id === activeEpisodeId) ?? null;

    const handleCreateShow = (input: { title: string; description?: string }) => {
        startTransition(async () => {
            const result = await createShow(input);
            if (result.error || !result.show) {
                setError(result.error ?? "Failed to create show");
                return;
            }
            setShows((prev) => [result.show!, ...prev]);
            setActiveShowId(result.show.id);
            setShowCreateShow(false);
            router.refresh();
        });
    };

    const handleCreateEpisode = (input: { title: string; summary?: string; description?: string; episodeType?: EpisodeType }) => {
        if (!activeShowId) return;
        startTransition(async () => {
            const result = await createEpisode({ showId: activeShowId, ...input });
            if (result.error || !result.episode) {
                setError(result.error ?? "Failed to create episode");
                return;
            }
            setActiveEpisodeId(result.episode.id);
            setShowCreateEpisode(false);
            router.refresh();
        });
    };

    return (
        <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden lg:flex-row lg:overflow-hidden">
            {/* Left: shows list */}
            <aside className="w-full shrink-0 border-b border-border/40 bg-card/40 p-3 lg:w-56 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between pb-2">
                    <h2 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">Shows</h2>
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setShowCreateShow(true)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="New show"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible lg:pr-0">
                    {shows.map((show) => (
                        <li key={show.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveShowId(show.id);
                                    setActiveEpisodeId(null);
                                }}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[17px] ${
                                    show.id === activeShowId
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                <Headphones className="h-3.5 w-3.5" />
                                <span className="truncate">{show.title}</span>
                                {show.is_published && (
                                    <span className="ml-auto text-[13px] text-emerald-400">LIVE</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
                {shows.length === 0 && (
                    <p className="px-2 py-3 text-[15px] text-muted-foreground">No shows yet.</p>
                )}
            </aside>

            {/* Middle: episodes list */}
            <section className="w-full shrink-0 border-b border-border/40 p-3 lg:w-72 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between pb-2">
                    <h2 className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">Episodes</h2>
                    {canManage && activeShowId && (
                        <button
                            type="button"
                            onClick={() => setShowCreateEpisode(true)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="New episode"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1 lg:max-h-none">
                    {filteredEpisodes.map((ep) => (
                        <li key={ep.id}>
                            <button
                                type="button"
                                onClick={() => setActiveEpisodeId(ep.id)}
                                className={`flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left text-[17px] ${
                                    ep.id === activeEpisodeId
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                <span className="truncate font-medium">{ep.title}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[13px] uppercase ${STATUS_BADGE[ep.status]}`}>
                                    {ep.status}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                {filteredEpisodes.length === 0 && activeShowId && (
                    <p className="px-2 py-3 text-[15px] text-muted-foreground">No episodes yet.</p>
                )}
            </section>

            {/* Right: episode editor */}
            <main className="flex min-h-[70svh] min-w-0 flex-1 flex-col overflow-visible p-3 sm:p-4 lg:min-h-0 lg:overflow-hidden">
                {activeEpisode ? (
                    <EpisodeEditor
                        episode={activeEpisode}
                        show={activeShow}
                        tracks={tracks}
                        voices={voices}
                        canManage={canManage}
                        busy={busy}
                        onError={setError}
                        startTransition={startTransition}
                    />
                ) : activeShow ? (
                    <ShowEditor show={activeShow} canManage={canManage} onError={setError} />
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[17px] text-muted-foreground">
                        <Headphones className="h-8 w-8 opacity-40" />
                        <p>Select or create a show to get started.</p>
                    </div>
                )}
                {error && (
                    <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[17px] text-red-400">
                        {error}
                        <button
                            type="button"
                            onClick={() => setError(null)}
                            className="ml-2 underline"
                        >
                            dismiss
                        </button>
                    </div>
                )}
            </main>

            {showCreateShow && (
                <CreateShowDialog
                    onClose={() => setShowCreateShow(false)}
                    onSubmit={handleCreateShow}
                    busy={busy}
                />
            )}
            {showCreateEpisode && activeShowId && (
                <CreateEpisodeDialog
                    onClose={() => setShowCreateEpisode(false)}
                    onSubmit={handleCreateEpisode}
                    busy={busy}
                />
            )}
        </div>
    );
}

function ShowEditor({
    show,
    canManage,
    onError,
}: {
    show: PodcastShow;
    canManage: boolean;
    onError: (msg: string) => void;
}) {
    const router = useRouter();
    const [title, setTitle] = useState(show.title);
    const [subtitle, setSubtitle] = useState(show.subtitle ?? "");
    const [description, setDescription] = useState(show.description ?? "");
    const [author, setAuthor] = useState(show.author ?? "");
    const [busy, startTransition] = useTransition();

    return (
        <div className="flex flex-col gap-3 overflow-y-auto">
            <h1 className="text-[19px] font-semibold">{show.title}</h1>
            <p className="text-[15px] text-muted-foreground">/{show.slug}</p>

            <Field label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} className={inputClass} />
            </Field>
            <Field label="Subtitle">
                <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={!canManage} className={inputClass} />
            </Field>
            <Field label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} rows={3} className={inputClass} />
            </Field>
            <Field label="Author">
                <input value={author} onChange={(e) => setAuthor(e.target.value)} disabled={!canManage} className={inputClass} />
            </Field>

            {canManage && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            startTransition(async () => {
                                const result = await updateShow(show.id, { title, subtitle, description, author });
                                if (result.error) onError(result.error);
                                else router.refresh();
                            });
                        }}
                        className={btnPrimary}
                    >
                        Save
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            startTransition(async () => {
                                const result = await updateShow(show.id, { isPublished: !show.is_published });
                                if (result.error) onError(result.error);
                                else router.refresh();
                            });
                        }}
                        className={btnSecondary}
                    >
                        {show.is_published ? "Unpublish show" : "Publish show"}
                    </button>
                </div>
            )}
        </div>
    );
}

function EpisodeEditor({
    episode,
    show,
    tracks,
    voices,
    canManage,
    busy,
    onError,
    startTransition,
}: {
    episode: PodcastEpisode;
    show: PodcastShow | null;
    tracks: MusicTrackWithUrl[];
    voices: WorkspaceVoice[];
    canManage: boolean;
    busy: boolean;
    onError: (msg: string) => void;
    startTransition: (fn: () => void | Promise<void>) => void;
}) {
    const router = useRouter();
    const [title, setTitle] = useState(episode.title);
    const [summary, setSummary] = useState(episode.summary ?? "");
    const [description, setDescription] = useState(episode.description ?? "");
    const [transcript] = useState(episode.transcript_text ?? "");
    const [hostVoiceId, setHostVoiceId] = useState<string | null>(episode.host_voice_id);
    const [guestVoiceId, setGuestVoiceId] = useState<string | null>(episode.guest_voice_id);
    const [generating, setGenerating] = useState(false);
    const [coverBusy, setCoverBusy] = useState(false);

    async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        // Reset the input immediately so re-selecting the same file re-fires
        // the change event after the user cancels and retries.
        event.target.value = "";
        if (!file) return;
        setCoverBusy(true);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch(`/api/podcast/episode/${episode.id}/cover`, {
                method: "POST",
                body: form,
            });
            const data = await res.json();
            if (!res.ok) {
                onError(data.error ?? "Cover upload failed.");
                return;
            }
            router.refresh();
        } catch (err) {
            onError(err instanceof Error ? err.message : "Cover upload failed.");
        } finally {
            setCoverBusy(false);
        }
    }

    async function handleCoverRemove() {
        if (!episode.cover_art_url) return;
        if (!confirm("Remove this episode cover? You can re-upload or regenerate one afterwards.")) return;
        setCoverBusy(true);
        try {
            const res = await fetch(`/api/podcast/episode/${episode.id}/cover`, {
                method: "DELETE",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                onError(data.error ?? "Cover removal failed.");
                return;
            }
            router.refresh();
        } catch (err) {
            onError(err instanceof Error ? err.message : "Cover removal failed.");
        } finally {
            setCoverBusy(false);
        }
    }

    const readyVoices = voices.filter((v) =>
        !v.archived_at
        && v.provider_status === "ready"
        && !(v.provider === "elevenlabs" && (v.voice_type === "prebuilt" || v.voice_type === "library"))
    );
    const hostVoiceProvider = readyVoices.find((v) => v.id === hostVoiceId)?.provider;
    const compatibleGuestVoices = hostVoiceProvider
        ? readyVoices.filter((v) => v.provider === hostVoiceProvider && v.id !== hostVoiceId)
        : readyVoices;

    // Group voices for the dropdown: Google presets by locale, then cloned/custom voices.
    const groupVoices = (list: WorkspaceVoice[]) => {
        const presetsByLocale: Record<string, WorkspaceVoice[]> = { en: [], nl: [], ar: [] };
        const cloned: WorkspaceVoice[] = [];
        for (const v of list) {
            if (v.provider === "gemini" && v.voice_type === "prebuilt") {
                const code = (v.language_code || "en").toLowerCase();
                if (code in presetsByLocale) presetsByLocale[code].push(v);
                else cloned.push(v);
            } else {
                cloned.push(v);
            }
        }
        return { presetsByLocale, cloned };
    };
    const localeLabels: Record<string, string> = {
        en: "Google prebuilt voices — English",
        nl: "Google prebuilt voices — Dutch",
        ar: "Google prebuilt voices — Arabic",
    };
    const renderVoiceGroups = (list: WorkspaceVoice[]) => {
        const { presetsByLocale, cloned } = groupVoices(list);
        return (
            <>
                {(["en", "nl", "ar"] as const).map((code) =>
                    presetsByLocale[code].length > 0 ? (
                        <optgroup key={`preset-${code}`} label={localeLabels[code]}>
                            {presetsByLocale[code].map((v) => (
                                <option key={v.id} value={v.id}>{v.display_name}</option>
                            ))}
                        </optgroup>
                    ) : null,
                )}
                {cloned.length > 0 && (
                    <optgroup label="Cloned & custom voices">
                        {cloned.map((v) => (
                            <option key={v.id} value={v.id}>{v.display_name} • {v.provider}</option>
                        ))}
                    </optgroup>
                )}
            </>
        );
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await fetch("/api/generate-podcast-episode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    episodeId: episode.id,
                    sourceText: description.trim() || transcript.trim() || undefined,
                    hostVoiceId: hostVoiceId ?? undefined,
                    guestVoiceId: guestVoiceId ?? undefined,
                    multiSpeaker: Boolean(guestVoiceId),
                    generateCoverArt: !episode.cover_art_url,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                onError(data.error ?? "Generation failed.");
            } else {
                router.refresh();
            }
        } catch (err) {
            onError(err instanceof Error ? err.message : "Generation failed.");
        } finally {
            setGenerating(false);
        }
    };

    const tracksByRole: Record<MusicRole, MusicTrackWithUrl[]> = {
        intro: tracks.filter((t) => t.is_intro),
        bed: tracks.filter((t) => t.is_bed),
        outro: tracks.filter((t) => t.is_outro),
    };

    return (
        <div className="flex flex-col gap-3 overflow-y-auto pr-2">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-[19px] font-semibold">{episode.title}</h1>
                    <p className="text-[15px] text-muted-foreground">
                        {show?.title} • <span className={`rounded px-1.5 py-0.5 ${STATUS_BADGE[episode.status]}`}>{episode.status}</span>
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {episode.cover_art_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={episode.cover_art_url} alt="Episode cover" className="h-20 w-20 rounded object-cover" />
                    ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-border/60 bg-muted/40 text-[13px] text-muted-foreground">
                            No cover
                        </div>
                    )}
                    {canManage && (
                        <div className="flex items-center gap-1">
                            <label
                                className={`inline-flex cursor-pointer items-center gap-1 rounded border border-border/60 bg-background px-2 py-1 text-[13px] font-medium text-foreground hover:bg-muted/60 ${coverBusy ? "pointer-events-none opacity-60" : ""}`}
                                title="Upload a custom cover (PNG, JPEG, WEBP, or AVIF · max 4 MB)"
                            >
                                {coverBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                Upload
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/avif"
                                    className="hidden"
                                    onChange={handleCoverUpload}
                                    disabled={coverBusy}
                                />
                            </label>
                            {episode.cover_art_url && (
                                <button
                                    type="button"
                                    onClick={handleCoverRemove}
                                    disabled={coverBusy}
                                    className="inline-flex items-center gap-1 rounded border border-border/60 bg-background px-2 py-1 text-[13px] font-medium text-foreground hover:bg-muted/60 disabled:opacity-60"
                                    title="Remove the current cover"
                                >
                                    <X className="h-3 w-3" />
                                    Remove
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Field label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} className={inputClass} />
            </Field>
            <Field label="Summary (1–2 sentences)">
                <input value={summary} onChange={(e) => setSummary(e.target.value)} disabled={!canManage} className={inputClass} />
            </Field>
            <Field label="Description / source for narration">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} rows={5} className={inputClass} />
            </Field>

            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            startTransition(async () => {
                                const metaResult = await updateEpisode(episode.id, { title, summary, description, transcriptText: transcript });
                                if (metaResult.error) {
                                    onError(metaResult.error);
                                    return;
                                }
                                const voiceResult = await setEpisodeVoices(episode.id, { hostVoiceId, guestVoiceId });
                                if (voiceResult.error) {
                                    onError(voiceResult.error);
                                    return;
                                }
                                router.refresh();
                            });
                        }}
                        className={btnSecondary}
                    >
                        Save metadata
                    </button>
                    <button
                        type="button"
                        disabled={busy || generating || episode.status === "published"}
                        onClick={handleGenerate}
                        className={btnPrimary}
                        title={episode.status === "published" ? "Unpublish to regenerate" : ""}
                    >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        {episode.narration_only_url ? "Regenerate audio" : "Generate audio"}
                    </button>
                    {episode.status !== "published" && episode.narration_only_url && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                startTransition(async () => {
                                    const result = await publishEpisode(episode.id);
                                    if (result.error) onError(result.error);
                                    else router.refresh();
                                });
                            }}
                            className={btnPublish}
                        >
                            <Send className="h-4 w-4" />
                            Publish
                        </button>
                    )}
                    {episode.status === "published" && (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                startTransition(async () => {
                                    const result = await unpublishEpisode(episode.id);
                                    if (result.error) onError(result.error);
                                    else router.refresh();
                                });
                            }}
                            className={btnSecondary}
                        >
                            Unpublish
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                            if (!confirm(`Delete "${episode.title}"?`)) return;
                            startTransition(async () => {
                                const result = await deleteEpisode(episode.id);
                                if (result.error) onError(result.error);
                                else router.refresh();
                            });
                        }}
                        className={`${btnSecondary} ml-auto text-rose-400`}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </button>
                </div>
            )}

            {/* Voice selection */}
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Host voice">
                    <select
                        disabled={!canManage}
                        value={hostVoiceId ?? ""}
                        onChange={(e) => setHostVoiceId(e.target.value || null)}
                        className={inputClass}
                    >
                        <option value="">— default (Gemini Aoede) —</option>
                        {renderVoiceGroups(readyVoices)}
                    </select>
                </Field>
                <Field label="Guest voice (optional, enables multi-speaker)">
                    <select
                        disabled={!canManage}
                        value={guestVoiceId ?? ""}
                        onChange={(e) => setGuestVoiceId(e.target.value || null)}
                        className={inputClass}
                    >
                        <option value="">— none (single host) —</option>
                        {renderVoiceGroups(compatibleGuestVoices)}
                    </select>
                </Field>
            </div>
            {hostVoiceProvider && guestVoiceId && (
                <p className="text-[15px] text-muted-foreground">
                    Multi-speaker mode: the script will be generated with [HOST]: / [GUEST]: tags and routed to each voice.
                </p>
            )}

            {/* Music attachments */}
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {(["intro", "bed", "outro"] as MusicRole[]).map((role) => (
                    <MusicSlot
                        key={role}
                        episodeId={episode.id}
                        role={role}
                        tracks={tracksByRole[role]}
                        canManage={canManage}
                        onError={onError}
                    />
                ))}
            </div>

            {episode.audio_url && (
                <div className="mt-2 rounded-md border border-border/40 bg-card/40 p-3">
                    <p className="mb-1 text-[15px] uppercase tracking-wide text-muted-foreground">Mixed episode</p>
                    <audio controls src={episode.audio_url} className="w-full" />
                </div>
            )}

            {episode.audio_url && episode.status === "published" && canManage && (
                <SocialExportPanel episodeId={episode.id} onError={onError} />
            )}

            {canManage && (
                <ChapterEditor episodeId={episode.id} initial={episode.chapters ?? []} onError={onError} />
            )}

            {episode.transcript_text && (
                <details className="mt-2 rounded-md border border-border/40 p-3">
                    <summary className="cursor-pointer text-[17px] font-medium">Transcript</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-[15px] text-muted-foreground">{episode.transcript_text}</pre>
                </details>
            )}
        </div>
    );
}

// Chapter editor — episodes can carry a list of {start_ms, title} markers.
// We render mm:ss text inputs to keep authoring fast; the row is parsed on
// blur/save into integer milliseconds (which is what the schema expects and
// what RSS / podcast players consume).
function ChapterEditor({
    episodeId,
    initial,
    onError,
}: {
    episodeId: string;
    initial: Array<{ start_ms: number; title: string }>;
    onError: (msg: string) => void;
}) {
    const router = useRouter();
    const [chapters, setChapters] = useState<Array<{ start_ms: number; title: string }>>(initial);
    const [busy, startTransition] = useTransition();

    // Resync when the parent passes new initial chapters (e.g. after refresh).
    useEffect(() => {
        setChapters(initial);
    }, [initial]);

    const addRow = () => {
        const lastMs = chapters.length > 0 ? chapters[chapters.length - 1].start_ms : 0;
        setChapters((prev) => [...prev, { start_ms: lastMs + 60_000, title: "" }]);
    };

    const updateRow = (idx: number, patch: Partial<{ start_ms: number; title: string }>) => {
        setChapters((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    };

    const removeRow = (idx: number) => {
        setChapters((prev) => prev.filter((_, i) => i !== idx));
    };

    const save = () => {
        // Sort and validate before persisting so RSS emission gets a clean list.
        const cleaned = chapters
            .filter((c) => c.title.trim())
            .map((c) => ({ start_ms: Math.max(0, Math.floor(c.start_ms)), title: c.title.trim() }))
            .sort((a, b) => a.start_ms - b.start_ms);
        startTransition(async () => {
            const result = await updateEpisode(episodeId, { chapters: cleaned });
            if (result.error) {
                onError(result.error);
                return;
            }
            setChapters(cleaned);
            router.refresh();
        });
    };

    return (
        <div className="mt-2 rounded-md border border-border/40 bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[15px] uppercase tracking-wide text-muted-foreground">Chapters</p>
                <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1 rounded border border-border/40 px-2 py-0.5 text-[15px] hover:bg-muted"
                >
                    <Plus className="h-3 w-3" /> Add chapter
                </button>
            </div>
            {chapters.length === 0 ? (
                <p className="text-[15px] text-muted-foreground">No chapters yet. Chapters appear in the RSS feed and on the public episode page.</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {chapters.map((ch, i) => (
                        <li key={i} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={msToTimecode(ch.start_ms)}
                                onChange={(e) => {
                                    const ms = timecodeToMs(e.target.value);
                                    if (ms !== null) updateRow(i, { start_ms: ms });
                                }}
                                placeholder="0:00"
                                className={`w-20 ${inputClass}`}
                                aria-label={`Chapter ${i + 1} start time (mm:ss or h:mm:ss)`}
                            />
                            <input
                                type="text"
                                value={ch.title}
                                onChange={(e) => updateRow(i, { title: e.target.value })}
                                placeholder="Chapter title"
                                className={`flex-1 ${inputClass}`}
                                aria-label={`Chapter ${i + 1} title`}
                            />
                            <button
                                type="button"
                                onClick={() => removeRow(i)}
                                className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                                aria-label="Remove chapter"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                onClick={save}
                disabled={busy}
                className={`${btnSecondary} mt-2`}
            >
                Save chapters
            </button>
        </div>
    );
}

function msToTimecode(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function timecodeToMs(value: string): number | null {
    const parts = value.trim().split(":").map((p) => parseInt(p, 10));
    if (parts.some((n) => Number.isNaN(n))) return null;
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    else if (parts.length === 1) seconds = parts[0];
    else return null;
    return Math.max(0, Math.floor(seconds * 1000));
}

function SocialExportPanel({
    episodeId,
    onError,
}: {
    episodeId: string;
    onError: (msg: string) => void;
}) {
    const [format, setFormat] = useState<"square" | "vertical" | "landscape">("vertical");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ videoUrl: string; downloadFilename: string; byteSize: number } | null>(null);

    const submit = async () => {
        setBusy(true);
        setResult(null);
        try {
            const res = await fetch("/api/export-podcast-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ episodeId, format }),
            });
            // Vercel returns an HTML error page (not JSON) when a serverless
            // function crashes at boot, exhausts memory, or times out. Read
            // as text first and only parse as JSON when the content-type
            // confirms it — surfaces the underlying cause to the user.
            const contentType = res.headers.get("content-type") ?? "";
            const rawText = await res.text();
            if (!contentType.includes("application/json")) {
                onError(
                    !res.ok
                        ? `Export failed (${res.status}). The server returned a non-JSON response — check function logs (timeout, memory, or unhandled crash).`
                        : "Export returned an unexpected non-JSON response.",
                );
                return;
            }
            const data = JSON.parse(rawText) as { error?: string; videoUrl?: string; downloadFilename?: string; byteSize?: number };
            if (!res.ok) {
                onError(data.error ?? `Export failed (${res.status}).`);
                return;
            }
            if (typeof data.videoUrl === "string" && typeof data.downloadFilename === "string" && typeof data.byteSize === "number") {
                setResult({ videoUrl: data.videoUrl, downloadFilename: data.downloadFilename, byteSize: data.byteSize });
            } else {
                onError("Export returned a malformed response.");
            }
        } catch (err) {
            onError(err instanceof Error ? err.message : "Export failed.");
        } finally {
            setBusy(false);
        }
    };

    const formatLabels: Record<typeof format, { label: string; ratio: string; platforms: string }> = {
        square: { label: "Square", ratio: "1:1 · 1080×1080", platforms: "Instagram Feed · LinkedIn" },
        vertical: { label: "Vertical", ratio: "9:16 · 1080×1920", platforms: "Reels · Shorts · TikTok" },
        landscape: { label: "Landscape", ratio: "16:9 · 1920×1080", platforms: "YouTube · X · Facebook" },
    };

    return (
        <div className="mt-2 rounded-md border border-border/40 bg-card/40 p-3">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[15px] uppercase tracking-wide text-muted-foreground">Download for social</p>
                {result && <span className="text-[14px] text-emerald-400">Ready · {(result.byteSize / 1024 / 1024).toFixed(1)} MB</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
                {(["vertical", "square", "landscape"] as const).map((f) => (
                    <label
                        key={f}
                        className={`flex cursor-pointer flex-col gap-0.5 rounded-md border px-2 py-2 text-left text-[15px] transition ${
                            format === f
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border/40 hover:bg-muted"
                        }`}
                    >
                        <input
                            type="radio"
                            name={`fmt-${episodeId}`}
                            value={f}
                            checked={format === f}
                            onChange={() => setFormat(f)}
                            className="sr-only"
                        />
                        <span className="font-semibold">{formatLabels[f].label}</span>
                        <span className="text-[13px] text-muted-foreground">{formatLabels[f].ratio}</span>
                        <span className="text-[13px] text-muted-foreground">{formatLabels[f].platforms}</span>
                    </label>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={submit}
                    disabled={busy}
                    className={btnPrimary}
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {busy ? "Rendering MP4…" : "Render MP4"}
                </button>
                {result && (
                    <a
                        href={result.videoUrl}
                        download={result.downloadFilename}
                        className={btnSecondary}
                    >
                        Download {result.downloadFilename}
                    </a>
                )}
            </div>
            <p className="mt-2 text-[14px] text-muted-foreground">
                Composes a static poster (blurred cover backdrop + centered cover) with the episode audio. H.264 + AAC, +faststart.
            </p>
        </div>
    );
}

function MusicSlot({
    episodeId,
    role,
    tracks,
    canManage,
    onError,
}: {
    episodeId: string;
    role: MusicRole;
    tracks: MusicTrackWithUrl[];
    canManage: boolean;
    onError: (msg: string) => void;
}) {
    const router = useRouter();
    const [busy, startTransition] = useTransition();
    const [showGenerate, setShowGenerate] = useState(false);

    return (
        <div className="rounded-md border border-border/40 bg-card/40 p-3">
            <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">{role}</p>
                <Mic className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {canManage ? (
                <>
                    <select
                        disabled={busy}
                        onChange={(e) => {
                            const trackId = e.target.value;
                            startTransition(async () => {
                                if (!trackId) {
                                    const result = await detachMusic(episodeId, role);
                                    if (result.error) onError(result.error);
                                    else router.refresh();
                                    return;
                                }
                                const result = await attachMusic({ episodeId, trackId, role });
                                if (result.error) onError(result.error);
                                else router.refresh();
                            });
                        }}
                        className={`mt-1 w-full ${inputClass}`}
                        defaultValue=""
                    >
                        <option value="">— none —</option>
                        {tracks.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.title}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowGenerate(true)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[15px] font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
                    >
                        <Wand2 className="h-3 w-3" /> Generate {role} music
                    </button>
                    {showGenerate && (
                        <GenerateMusicDialog
                            episodeId={episodeId}
                            role={role}
                            onClose={() => setShowGenerate(false)}
                            onGenerated={() => {
                                setShowGenerate(false);
                                router.refresh();
                            }}
                            onError={onError}
                        />
                    )}
                </>
            ) : (
                <p className="mt-1 text-[15px] text-muted-foreground">{tracks.length} candidate track(s)</p>
            )}
        </div>
    );
}

function GenerateMusicDialog({
    episodeId,
    role,
    onClose,
    onGenerated,
    onError,
}: {
    episodeId: string;
    role: MusicRole;
    onClose: () => void;
    onGenerated: () => void;
    onError: (msg: string) => void;
}) {
    const [mood, setMood] = useState<string>(role === "bed" ? "calm" : "cinematic");
    const [durationSeconds, setDurationSeconds] = useState<number>(role === "bed" ? 30 : 15);
    const [attach, setAttach] = useState(true);
    const [model, setModel] = useState<"lyria-3-clip-preview" | "lyria-3-pro-preview">("lyria-3-clip-preview");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/generate-music", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    episodeId,
                    role,
                    mood,
                    durationSeconds,
                    model,
                    attachToEpisode: attach,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                onError(data.error ?? "Generation failed.");
                return;
            }
            onGenerated();
        } catch (err) {
            onError(err instanceof Error ? err.message : "Generation failed.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border/40 bg-background p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-[19px] font-semibold">Generate {role} music for this episode</h2>
                <p className="text-[15px] text-muted-foreground">
                    Lyria 3 will produce a {role}-friendly track contextualized by this episode&apos;s title and topic.
                    The result is saved to the workspace music library so you can reuse it later.
                </p>

                <Field label="Mood">
                    <select value={mood} onChange={(e) => setMood(e.target.value)} className={inputClass}>
                        <option value="upbeat">Upbeat</option>
                        <option value="calm">Calm</option>
                        <option value="cinematic">Cinematic</option>
                        <option value="corporate">Corporate</option>
                        <option value="lofi">Lofi</option>
                        <option value="dramatic">Dramatic</option>
                        <option value="warm">Warm</option>
                        <option value="tense">Tense</option>
                        <option value="playful">Playful</option>
                        <option value="ambient">Ambient</option>
                    </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Duration (seconds)">
                        <input
                            type="number"
                            min={5}
                            max={model === "lyria-3-pro-preview" ? 180 : 30}
                            value={durationSeconds}
                            onChange={(e) => setDurationSeconds(Number(e.target.value))}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="Model">
                        <select value={model} onChange={(e) => setModel(e.target.value as "lyria-3-clip-preview" | "lyria-3-pro-preview")} className={inputClass}>
                            <option value="lyria-3-clip-preview">Clip (≤30s, fast)</option>
                            <option value="lyria-3-pro-preview">Pro (longer, structured)</option>
                        </select>
                    </Field>
                </div>

                <label className="inline-flex items-center gap-2 text-[17px]">
                    <input
                        type="checkbox"
                        checked={attach}
                        onChange={(e) => setAttach(e.target.checked)}
                    />
                    Auto-attach to this episode&apos;s {role} slot
                </label>

                <div className="mt-2 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
                        Cancel
                    </button>
                    <button type="button" onClick={submit} disabled={submitting} className={btnPrimary}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
}

function CreateShowDialog({
    onClose,
    onSubmit,
    busy,
}: {
    onClose: () => void;
    onSubmit: (input: { title: string; description?: string }) => void;
    busy: boolean;
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    return (
        <Dialog title="New podcast show" onClose={onClose}>
            <Field label="Title">
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
            </Field>
            <DialogActions onClose={onClose} busy={busy}>
                <button
                    type="button"
                    disabled={busy || !title.trim()}
                    onClick={() => onSubmit({ title, description })}
                    className={btnPrimary}
                >
                    Create show
                </button>
            </DialogActions>
        </Dialog>
    );
}

function CreateEpisodeDialog({
    onClose,
    onSubmit,
    busy,
}: {
    onClose: () => void;
    onSubmit: (input: { title: string; summary?: string; description?: string; episodeType?: EpisodeType }) => void;
    busy: boolean;
}) {
    const [title, setTitle] = useState("");
    const [summary, setSummary] = useState("");
    const [description, setDescription] = useState("");
    const [episodeType, setEpisodeType] = useState<EpisodeType>("full");
    return (
        <Dialog title="New episode" onClose={onClose}>
            <Field label="Title">
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Episode type">
                <select
                    value={episodeType}
                    onChange={(e) => setEpisodeType(e.target.value as EpisodeType)}
                    className={inputClass}
                >
                    <option value="full">Full episode</option>
                    <option value="trailer">Trailer (short promo)</option>
                    <option value="bonus">Bonus content</option>
                </select>
            </Field>
            <Field label="Summary">
                <input value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Description (used as TTS source if no content link)">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} />
            </Field>
            <DialogActions onClose={onClose} busy={busy}>
                <button
                    type="button"
                    disabled={busy || !title.trim()}
                    onClick={() => onSubmit({ title, summary, description, episodeType })}
                    className={btnPrimary}
                >
                    Create episode
                </button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Tiny styling primitives ──────────────────────────────────────────────

const inputClass = "rounded-md border border-border/40 bg-background px-2 py-1.5 text-[17px] w-full disabled:opacity-60";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5 text-[17px] hover:bg-muted disabled:opacity-60";
const btnPublish = "inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[17px] font-medium text-white hover:bg-emerald-500 disabled:opacity-60";

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
                className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border/40 bg-background p-5"
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
            <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>
                Cancel
            </button>
            {children}
        </div>
    );
}
