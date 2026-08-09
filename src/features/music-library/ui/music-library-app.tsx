"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Music, Pause, Play, Trash2, Upload } from "lucide-react";
import {
    archiveMusicTrack,
    deleteMusicTrack,
    restoreMusicTrack,
    uploadMusicTrack,
} from "../actions";
import { MUSIC_MOODS, type MusicMood, type MusicTrackWithUrl } from "../types";

interface MusicLibraryAppProps {
    initialTracks: MusicTrackWithUrl[];
    initialError: string | null;
    canManage: boolean;
}

type RoleFilter = "all" | "intro" | "bed" | "outro";

function formatDuration(seconds: number): string {
    if (!seconds || seconds < 0) return "—";
    const m = Math.floor(seconds / 60).toString();
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function formatBytes(bytes: number | null): string {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MusicLibraryApp({ initialTracks, initialError, canManage }: MusicLibraryAppProps) {
    const router = useRouter();
    const [tracks, setTracks] = useState(initialTracks);
    const [error, setError] = useState<string | null>(initialError);
    const [moodFilter, setMoodFilter] = useState<"all" | MusicMood>("all");
    const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
    const [showArchived, setShowArchived] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [busy, startTransition] = useTransition();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const filtered = useMemo(() => {
        return tracks.filter((track) => {
            if (!showArchived && track.archived_at) return false;
            if (showArchived && !track.archived_at) return false;
            if (moodFilter !== "all" && track.mood !== moodFilter) return false;
            if (roleFilter === "intro" && !track.is_intro) return false;
            if (roleFilter === "bed" && !track.is_bed) return false;
            if (roleFilter === "outro" && !track.is_outro) return false;
            return true;
        });
    }, [tracks, moodFilter, roleFilter, showArchived]);

    const handlePlay = (track: MusicTrackWithUrl) => {
        if (!track.signed_url) return;
        if (playingId === track.id) {
            audioRef.current?.pause();
            setPlayingId(null);
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const next = new Audio(track.signed_url);
        audioRef.current = next;
        next.onended = () => setPlayingId(null);
        next.play().catch(() => setError("Playback failed."));
        setPlayingId(track.id);
    };

    const handleArchive = (track: MusicTrackWithUrl) => {
        startTransition(async () => {
            const result = track.archived_at
                ? await restoreMusicTrack(track.id)
                : await archiveMusicTrack(track.id);
            if (result.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    const handleDelete = (track: MusicTrackWithUrl) => {
        if (!confirm(`Delete "${track.title}"? This cannot be undone.`)) return;
        startTransition(async () => {
            const result = await deleteMusicTrack(track.id);
            if (result.error) {
                setError(result.error);
                return;
            }
            setTracks((prev) => prev.filter((t) => t.id !== track.id));
        });
    };

    return (
        <div className="flex h-full flex-col gap-4 p-4">
            <header className="flex flex-wrap items-center gap-3 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                    <Music className="h-5 w-5 text-muted-foreground" />
                    <h1 className="text-[21px] font-semibold tracking-tight">Music Library</h1>
                </div>
                <span className="text-[17px] text-muted-foreground">
                    {filtered.length} of {tracks.length} tracks
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setShowUpload(true)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[17px] font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            <Upload className="h-4 w-4" />
                            Upload track
                        </button>
                    )}
                </div>
            </header>

            <section className="flex flex-wrap items-center gap-2 text-[17px]">
                <select
                    value={moodFilter}
                    onChange={(e) => setMoodFilter(e.target.value as "all" | MusicMood)}
                    className="rounded-md border border-border/40 bg-background px-2 py-1"
                >
                    <option value="all">All moods</option>
                    {MUSIC_MOODS.map((m) => (
                        <option key={m} value={m}>
                            {m[0].toUpperCase()}{m.slice(1)}
                        </option>
                    ))}
                </select>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                    className="rounded-md border border-border/40 bg-background px-2 py-1"
                >
                    <option value="all">All roles</option>
                    <option value="intro">Intros</option>
                    <option value="bed">Beds</option>
                    <option value="outro">Outros</option>
                </select>
                <label className="ml-auto inline-flex items-center gap-1.5">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    Show archived
                </label>
            </section>

            {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[17px] text-red-400">
                    {error}
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[17px] text-muted-foreground">
                    <Music className="h-8 w-8 opacity-40" />
                    <p>{showArchived ? "No archived tracks." : "No tracks yet."}</p>
                    {canManage && !showArchived && (
                        <button
                            type="button"
                            onClick={() => setShowUpload(true)}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/40 px-3 py-1.5"
                        >
                            <Upload className="h-4 w-4" />
                            Upload your first track
                        </button>
                    )}
                </div>
            ) : (
                <ul className="grid gap-2 overflow-y-auto pr-1">
                    {filtered.map((track) => (
                        <li
                            key={track.id}
                            className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-card/40 p-3"
                        >
                            <button
                                type="button"
                                onClick={() => handlePlay(track)}
                                disabled={!track.signed_url}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
                                aria-label={playingId === track.id ? "Pause" : "Play"}
                            >
                                {playingId === track.id ? (
                                    <Pause className="h-4 w-4" />
                                ) : (
                                    <Play className="h-4 w-4" />
                                )}
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-medium">{track.title}</span>
                                    <span className="rounded bg-muted px-1.5 py-0.5 text-[14px] uppercase tracking-wide text-muted-foreground">
                                        {track.mood}
                                    </span>
                                    {track.is_intro && <Tag>Intro</Tag>}
                                    {track.is_bed && <Tag>Bed</Tag>}
                                    {track.is_outro && <Tag>Outro</Tag>}
                                    {track.loop_safe && <Tag>Loop</Tag>}
                                    {track.source === "generated" && <Tag>AI</Tag>}
                                </div>
                                <div className="text-[15px] text-muted-foreground">
                                    {formatDuration(track.duration_seconds)} • {formatBytes(track.audio_byte_size)}
                                </div>
                            </div>
                            {canManage && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleArchive(track)}
                                        disabled={busy}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title={track.archived_at ? "Restore" : "Archive"}
                                    >
                                        <Archive className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(track)}
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

            {showUpload && canManage && (
                <UploadDialog
                    onClose={() => setShowUpload(false)}
                    onUploaded={() => {
                        setShowUpload(false);
                        router.refresh();
                    }}
                    onError={(message) => setError(message)}
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

interface UploadDialogProps {
    onClose: () => void;
    onUploaded: () => void;
    onError: (message: string) => void;
}

function UploadDialog({ onClose, onUploaded, onError }: UploadDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [mood, setMood] = useState<MusicMood>("calm");
    const [role, setRole] = useState<"intro" | "bed" | "outro">("bed");
    const [loopSafe, setLoopSafe] = useState(false);
    const [duration, setDuration] = useState(0);
    const [submitting, startSubmit] = useTransition();

    const handleFile = async (selected: File) => {
        setFile(selected);
        // Best-effort duration probe: load metadata in a hidden audio element.
        const url = URL.createObjectURL(selected);
        const audio = document.createElement("audio");
        audio.preload = "metadata";
        audio.src = url;
        audio.onloadedmetadata = () => {
            setDuration(Math.round(audio.duration || 0));
            URL.revokeObjectURL(url);
        };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title.trim()) {
            onError("File and title are required.");
            return;
        }
        const formData = new FormData();
        formData.append("audio", file);
        formData.append("title", title.trim());
        formData.append("mood", mood);
        formData.append("duration_seconds", String(duration));
        formData.append("is_intro", role === "intro" ? "true" : "false");
        formData.append("is_bed", role === "bed" ? "true" : "false");
        formData.append("is_outro", role === "outro" ? "true" : "false");
        formData.append("loop_safe", loopSafe ? "true" : "false");

        startSubmit(async () => {
            const result = await uploadMusicTrack(formData);
            if (result.error) {
                onError(result.error);
                return;
            }
            onUploaded();
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-border/40 bg-background p-5"
            >
                <h2 className="text-[19px] font-semibold">Upload music track</h2>

                <label className="flex flex-col gap-1 text-[17px]">
                    <span className="text-muted-foreground">Audio file</span>
                    <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleFile(f);
                        }}
                        required
                        className="rounded-md border border-border/40 bg-background px-2 py-1.5"
                    />
                </label>

                <label className="flex flex-col gap-1 text-[17px]">
                    <span className="text-muted-foreground">Title</span>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Studio Calm 60s Bed"
                        required
                        className="rounded-md border border-border/40 bg-background px-2 py-1.5"
                    />
                </label>

                <div className="grid grid-cols-2 gap-3 text-[17px]">
                    <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Mood</span>
                        <select
                            value={mood}
                            onChange={(e) => setMood(e.target.value as MusicMood)}
                            className="rounded-md border border-border/40 bg-background px-2 py-1.5"
                        >
                            {MUSIC_MOODS.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">Role</span>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as "intro" | "bed" | "outro")}
                            className="rounded-md border border-border/40 bg-background px-2 py-1.5"
                        >
                            <option value="intro">Intro</option>
                            <option value="bed">Bed</option>
                            <option value="outro">Outro</option>
                        </select>
                    </label>
                </div>

                <label className="inline-flex items-center gap-2 text-[17px]">
                    <input
                        type="checkbox"
                        checked={loopSafe}
                        onChange={(e) => setLoopSafe(e.target.checked)}
                    />
                    Loop-safe (clean endpoints, can be looped under speech)
                </label>

                {duration > 0 && (
                    <p className="text-[15px] text-muted-foreground">
                        Detected duration: {formatDuration(duration)}
                    </p>
                )}

                <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-md border border-border/40 px-3 py-1.5 text-[17px]"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[17px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Uploading…
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                Upload
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
