"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Headphones, Loader2, Plus, Wand2 } from "lucide-react";
import {
    createEpisodeFromContent,
    listEpisodesByContent,
    listShows,
} from "@/features/podcast/actions";
import { listMusicTracks } from "@/features/music-library/actions";
import { listVoices } from "@/features/voices/actions";
import type { PodcastEpisode, PodcastShow } from "@/features/podcast/types";
import type { MusicTrackWithUrl } from "@/features/music-library/types";
import type { WorkspaceVoice } from "@/features/voices/types";

interface PodcastProductionNodeProps {
    contentId: string;
    contentTitle: string;
}

const STATUS_BADGE: Record<string, string> = {
    draft: "bg-zinc-200 text-zinc-700",
    scheduled: "bg-amber-100 text-amber-700",
    published: "bg-emerald-100 text-emerald-700",
    archived: "bg-rose-100 text-rose-700",
};

export function PodcastProductionNode({ contentId, contentTitle }: PodcastProductionNodeProps) {
    const router = useRouter();
    const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
    const [shows, setShows] = useState<PodcastShow[]>([]);
    const [voices, setVoices] = useState<WorkspaceVoice[]>([]);
    const [tracks, setTracks] = useState<MusicTrackWithUrl[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        void (async () => {
            const [eps, sh, vc, tr] = await Promise.all([
                listEpisodesByContent(contentId),
                listShows(),
                listVoices(false),
                listMusicTracks({ includeArchived: false }),
            ]);
            if (eps.error) setError(eps.error);
            setEpisodes(eps.data);
            setShows(sh.data);
            setVoices(vc.data);
            setTracks(tr.data);
            setLoading(false);
        })();
    }, [contentId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading podcast tools…
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-950">
                        <Headphones className="h-5 w-5 text-[#002f58]" />
                        Podcast Production
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Convert this blog post into a podcast episode. The TTS narrator will read directly from the published markdown.
                    </p>
                </div>
                <button
                    type="button"
                    disabled={shows.length === 0}
                    onClick={() => setShowWizard(true)}
                    title={shows.length === 0 ? "Create a podcast show first in /dashboard/podcast" : ""}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#002f58] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3d69] disabled:opacity-60"
                >
                    <Plus className="h-4 w-4" />
                    New episode from this post
                </button>
            </header>

            {error && (
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            {shows.length === 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                    You don&apos;t have any podcast shows yet.{" "}
                    <Link href="/dashboard/podcast" className="underline">Create one in the Podcast Studio</Link>{" "}
                    before generating episodes.
                </div>
            )}

            <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Episodes from this post ({episodes.length})
                </h3>
                {episodes.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                        No episodes generated from this post yet.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {episodes.map((ep) => (
                            <li
                                key={ep.id}
                                className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="truncate font-medium text-slate-900">{ep.title}</span>
                                        <span className={`rounded px-1.5 py-0.5 text-[11px] uppercase ${STATUS_BADGE[ep.status] ?? STATUS_BADGE.draft}`}>
                                            {ep.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {ep.audio_url ? "Audio rendered" : ep.narration_only_url ? "Narration generated, awaiting publish" : "Awaiting generation"}
                                    </div>
                                </div>
                                <Link
                                    href={`/dashboard/podcast`}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50"
                                >
                                    Open in studio
                                    <ExternalLink className="h-3 w-3" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {showWizard && shows.length > 0 && (
                <Wizard
                    contentId={contentId}
                    contentTitle={contentTitle}
                    shows={shows}
                    voices={voices}
                    tracks={tracks}
                    onClose={() => setShowWizard(false)}
                    onCreated={(ep) => {
                        setEpisodes((prev) => [ep, ...prev]);
                        setShowWizard(false);
                        router.refresh();
                    }}
                    onError={setError}
                />
            )}
        </div>
    );
}

function Wizard({
    contentId,
    contentTitle,
    shows,
    voices,
    tracks,
    onClose,
    onCreated,
    onError,
}: {
    contentId: string;
    contentTitle: string;
    shows: PodcastShow[];
    voices: WorkspaceVoice[];
    tracks: MusicTrackWithUrl[];
    onClose: () => void;
    onCreated: (episode: PodcastEpisode) => void;
    onError: (msg: string) => void;
}) {
    const readyVoices = voices.filter((v) => !v.archived_at && v.provider_status === "ready");

    const [showId, setShowId] = useState(shows[0]?.id ?? "");
    const [title, setTitle] = useState(contentTitle);
    const [hostVoiceId, setHostVoiceId] = useState<string | null>(null);
    const [guestVoiceId, setGuestVoiceId] = useState<string | null>(null);
    const [introTrackId, setIntroTrackId] = useState<string | null>(null);
    const [bedTrackId, setBedTrackId] = useState<string | null>(null);
    const [outroTrackId, setOutroTrackId] = useState<string | null>(null);
    const [generateNow, setGenerateNow] = useState(true);
    const [generateCoverArt, setGenerateCoverArt] = useState(true);
    const [submitting, startSubmit] = useTransition();

    const hostProvider = readyVoices.find((v) => v.id === hostVoiceId)?.provider;
    const compatibleGuestVoices = hostProvider
        ? readyVoices.filter((v) => v.provider === hostProvider && v.id !== hostVoiceId)
        : readyVoices;

    const introTracks = tracks.filter((t) => t.is_intro);
    const bedTracks = tracks.filter((t) => t.is_bed);
    const outroTracks = tracks.filter((t) => t.is_outro);

    const submit = () => {
        if (!showId) {
            onError("Pick a show.");
            return;
        }
        startSubmit(async () => {
            const created = await createEpisodeFromContent({
                contentId,
                showId,
                title: title.trim() || undefined,
                hostVoiceId,
                guestVoiceId,
                introTrackId,
                bedTrackId,
                outroTrackId,
            });
            if (created.error || !created.episode) {
                onError(created.error ?? "Failed to create episode");
                return;
            }
            if (generateNow) {
                try {
                    const res = await fetch("/api/generate-podcast-episode", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            episodeId: created.episode.id,
                            hostVoiceId: hostVoiceId ?? undefined,
                            guestVoiceId: guestVoiceId ?? undefined,
                            multiSpeaker: Boolean(guestVoiceId),
                            generateCoverArt,
                        }),
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        onError(`Episode created but generation failed: ${data.error ?? res.statusText}`);
                    }
                } catch (err) {
                    onError(`Episode created but generation failed: ${err instanceof Error ? err.message : "unknown"}`);
                }
            }
            onCreated(created.episode);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-xl flex-col gap-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-base font-semibold text-slate-900">Generate podcast episode from this post</h2>
                <p className="text-xs text-slate-500">
                    Source: <span className="font-medium">{contentTitle}</span>
                </p>

                <Field label="Show">
                    <select value={showId} onChange={(e) => setShowId(e.target.value)} className={inputClass}>
                        {shows.map((s) => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Episode title">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Host voice">
                        <select
                            value={hostVoiceId ?? ""}
                            onChange={(e) => setHostVoiceId(e.target.value || null)}
                            className={inputClass}
                        >
                            <option value="">Default (Gemini Aoede)</option>
                            {readyVoices.map((v) => (
                                <option key={v.id} value={v.id}>{v.display_name} • {v.provider}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Guest voice (optional)">
                        <select
                            value={guestVoiceId ?? ""}
                            onChange={(e) => setGuestVoiceId(e.target.value || null)}
                            className={inputClass}
                        >
                            <option value="">None (single host)</option>
                            {compatibleGuestVoices.map((v) => (
                                <option key={v.id} value={v.id}>{v.display_name} • {v.provider}</option>
                            ))}
                        </select>
                    </Field>
                </div>
                {hostProvider && guestVoiceId && (
                    <p className="text-xs text-slate-500">
                        Multi-speaker mode active — script will use [HOST]: / [GUEST]: tags.
                    </p>
                )}

                <div className="grid grid-cols-3 gap-3">
                    <Field label="Intro music">
                        <select value={introTrackId ?? ""} onChange={(e) => setIntroTrackId(e.target.value || null)} className={inputClass}>
                            <option value="">None</option>
                            {introTracks.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Bed">
                        <select value={bedTrackId ?? ""} onChange={(e) => setBedTrackId(e.target.value || null)} className={inputClass}>
                            <option value="">None</option>
                            {bedTracks.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Outro music">
                        <select value={outroTrackId ?? ""} onChange={(e) => setOutroTrackId(e.target.value || null)} className={inputClass}>
                            <option value="">None</option>
                            {outroTracks.map((t) => (
                                <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={generateNow} onChange={(e) => setGenerateNow(e.target.checked)} />
                    Generate audio immediately after creating the episode
                </label>
                {generateNow && (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={generateCoverArt} onChange={(e) => setGenerateCoverArt(e.target.checked)} />
                        Also generate square cover art
                    </label>
                )}

                <div className="mt-2 flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>Cancel</button>
                    <button type="button" onClick={submit} disabled={submitting || !showId} className={btnPrimary}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        {generateNow ? "Create & generate" : "Create draft"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const inputClass = "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:opacity-60";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-[#002f58] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3d69] disabled:opacity-60";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
            {children}
        </label>
    );
}
