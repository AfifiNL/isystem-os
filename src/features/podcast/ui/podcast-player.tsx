"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListOrdered, Pause, Play, Rewind, FastForward, Gauge } from "lucide-react";

export interface PodcastChapter {
    start_ms: number;
    title: string;
}

interface PodcastPlayerProps {
    episodeId: string;
    showSlug: string;
    episodeSlug?: string | null;
    audioUrl: string;
    coverUrl: string | null;
    title: string;
    chapters?: PodcastChapter[];
    /** Optional WebVTT captions URL — surfaces a <track> element on the audio. */
    transcriptVttUrl?: string | null;
    /** Workspace this episode belongs to — required for analytics attribution. */
    workspaceId?: string | null;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function useMilestoneTracker(input: { episodeId: string; showSlug: string; episodeSlug?: string | null; workspaceId?: string | null }) {
    const reachedRef = useRef<Set<number>>(new Set());
    const reset = () => reachedRef.current.clear();
    const fire = async (event: "audio_play" | "audio_progress" | "audio_complete", milestone?: number) => {
        try {
            await fetch("/api/analytics/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventType: event,
                    contentType: "podcast",
                    path: typeof window !== "undefined" ? window.location.pathname : undefined,
                    workspaceId: input.workspaceId || undefined,
                    metadata: {
                        episodeId: input.episodeId,
                        episodeSlug: input.episodeSlug || undefined,
                        showSlug: input.showSlug,
                        milestone,
                    },
                }),
                keepalive: true,
            });
        } catch {
            /* analytics is best-effort */
        }
    };
    return {
        reset,
        firePlay: () => fire("audio_play"),
        fireProgress: (percent: number) => {
            const milestone = Math.floor(percent * 4) / 4;
            if (milestone > 0 && milestone < 1 && !reachedRef.current.has(milestone)) {
                reachedRef.current.add(milestone);
                void fire("audio_progress", milestone);
            }
        },
        fireComplete: () => {
            if (reachedRef.current.has(1)) return;
            reachedRef.current.add(1);
            void fire("audio_complete", 1);
        },
    };
}

export function PodcastPlayer({ episodeId, showSlug, episodeSlug, audioUrl, coverUrl, title, chapters, transcriptVttUrl, workspaceId }: PodcastPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState<number>(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showChapters, setShowChapters] = useState(false);

    const tracker = useMilestoneTracker({ episodeId, showSlug, episodeSlug, workspaceId });
    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Chapters are stored with start_ms only — derive end_ms by stepping to the
    // next chapter's start (or the audio duration for the final chapter), and
    // sort to handle out-of-order data.
    const sortedChapters = useMemo(() => {
        if (!chapters || chapters.length === 0) return [];
        const cleaned = chapters
            .filter((c) => Number.isFinite(c.start_ms) && c.start_ms >= 0)
            .map((c) => ({ start_ms: Math.floor(c.start_ms), title: c.title?.trim() || "Chapter" }))
            .sort((a, b) => a.start_ms - b.start_ms);
        return cleaned.map((c, i, arr) => ({
            ...c,
            end_ms: i + 1 < arr.length ? arr[i + 1].start_ms : Number.POSITIVE_INFINITY,
        }));
    }, [chapters]);

    const currentMs = currentTime * 1000;
    const activeChapterIndex = sortedChapters.findIndex(
        (c) => currentMs >= c.start_ms && currentMs < c.end_ms,
    );

    useEffect(() => {
        tracker.reset();
    }, [episodeId, tracker]);

    const handlePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            audio.play().catch(() => undefined);
        } else {
            audio.pause();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const next = Number(e.target.value);
        audio.currentTime = next;
        setCurrentTime(next);
    };

    const skip = (deltaSeconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + deltaSeconds));
    };

    const setPlaybackRate = (rate: number) => {
        const audio = audioRef.current;
        if (audio) audio.playbackRate = rate;
        setSpeed(rate);
        setShowSpeedMenu(false);
    };

    const seekToMs = (ms: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        const seconds = ms / 1000;
        audio.currentTime = Math.max(0, Math.min(duration || seconds, seconds));
        setCurrentTime(audio.currentTime);
        if (audio.paused) {
            audio.play().catch(() => undefined);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-xl shadow-primary/10 backdrop-blur">
            {/* Decorative gradient veil — picks up the active template's primary
                color subtly so the player feels integrated rather than chrome. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-32 h-64 bg-gradient-to-b from-primary/15 to-transparent" />

            <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                crossOrigin={transcriptVttUrl ? "anonymous" : undefined}
                onPlay={() => {
                    setIsPlaying(true);
                    void tracker.firePlay();
                }}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setCurrentTime(t);
                    if (duration > 0) tracker.fireProgress(t / duration);
                }}
                onEnded={() => {
                    setIsPlaying(false);
                    tracker.fireComplete();
                }}
            >
                {transcriptVttUrl ? (
                    <track
                        kind="captions"
                        srcLang="en"
                        label="English captions"
                        src={transcriptVttUrl}
                        default
                    />
                ) : null}
            </audio>

            <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                {coverUrl && (
                    <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={coverUrl}
                            alt=""
                            className="h-28 w-28 rounded-xl object-cover shadow-lg ring-1 ring-border/40 sm:h-32 sm:w-32"
                        />
                    </div>
                )}

                <div className="flex flex-1 flex-col gap-3">
                    <p className="line-clamp-2 text-sm font-medium text-foreground sm:text-base">
                        {title}
                    </p>

                    {/* Progress bar — pillbox slider with live fill, plus tick
                        marks for each chapter when present so listeners get an
                        at-a-glance map of the episode. */}
                    <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <div className="relative h-1.5 flex-1 rounded-full bg-muted">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150"
                                style={{ width: `${progressPercent}%` }}
                            />
                            {duration > 0 && sortedChapters.map((chapter, i) => {
                                if (chapter.start_ms === 0) return null; // first chapter implicit at 0
                                const left = Math.min(100, Math.max(0, (chapter.start_ms / 1000 / duration) * 100));
                                return (
                                    <span
                                        key={`tick-${i}`}
                                        aria-hidden
                                        className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/40"
                                        style={{ left: `${left}%` }}
                                    />
                                );
                            })}
                            <input
                                type="range"
                                min={0}
                                max={duration || 0}
                                step={0.5}
                                value={currentTime}
                                onChange={handleSeek}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label="Playback position"
                            />
                        </div>
                        <span>{formatTime(duration)}</span>
                    </div>

                    {/* Controls row */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => skip(-15)}
                            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label="Back 15 seconds"
                        >
                            <Rewind className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handlePlay}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 hover:bg-primary/90 active:scale-95"
                            aria-label={isPlaying ? "Pause" : "Play"}
                        >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => skip(30)}
                            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            aria-label="Forward 30 seconds"
                        >
                            <FastForward className="h-4 w-4" />
                        </button>

                        <div className="ml-auto flex items-center gap-2">
                            {sortedChapters.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowChapters((s) => !s)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                        showChapters
                                            ? "border-primary/60 bg-primary/10 text-primary"
                                            : "border-border/60 bg-background/60 hover:bg-muted"
                                    }`}
                                    aria-expanded={showChapters}
                                    aria-label="Toggle chapter list"
                                >
                                    <ListOrdered className="h-3 w-3" />
                                    {sortedChapters.length} chapter{sortedChapters.length === 1 ? "" : "s"}
                                </button>
                            )}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowSpeedMenu((s) => !s)}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-medium hover:bg-muted"
                                    aria-label="Playback speed"
                                >
                                    <Gauge className="h-3 w-3" />
                                    {speed}×
                                </button>
                                {showSpeedMenu && (
                                    <ul className="absolute right-0 top-full z-10 mt-1.5 flex flex-col overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
                                        {SPEED_OPTIONS.map((rate) => (
                                            <li key={rate}>
                                                <button
                                                    type="button"
                                                    onClick={() => setPlaybackRate(rate)}
                                                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-muted ${
                                                        speed === rate ? "font-semibold text-primary" : ""
                                                    }`}
                                                >
                                                    {rate}×
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chapter list — collapses by default; renders below the control
                strip so it doesn't shift the player chrome layout when toggled. */}
            {sortedChapters.length > 0 && showChapters && (
                <div className="relative border-t border-border/40 bg-background/30 p-3 sm:p-4">
                    <ol className="flex flex-col">
                        {sortedChapters.map((chapter, i) => {
                            const isActive = i === activeChapterIndex;
                            return (
                                <li key={`${chapter.start_ms}-${i}`}>
                                    <button
                                        type="button"
                                        onClick={() => seekToMs(chapter.start_ms)}
                                        aria-current={isActive ? "true" : undefined}
                                        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                                            isActive
                                                ? "bg-primary/10 text-foreground"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }`}
                                    >
                                        <span
                                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                                                isActive
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-muted text-muted-foreground group-hover:bg-foreground/10"
                                            }`}
                                        >
                                            {i + 1}
                                        </span>
                                        <span className="line-clamp-1 flex-1 font-medium">{chapter.title}</span>
                                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                            {formatTime(chapter.start_ms / 1000)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
        </div>
    );
}
