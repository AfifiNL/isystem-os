"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Mic, RotateCcw, Square, Trash2 } from "lucide-react";
import { DashboardAppWorkbench } from "@/features/admin/ui/app-workbench";
import type { ClientProjectOption, VoiceMemoRecord } from "./actions";
import { deleteVoiceMemo, retryVoiceMemoProcessing, uploadVoiceMemo } from "./actions";
import { getRecorderSupportMessage, normalizeRecorderPermissionError, type RecorderPermissionState } from "./browser-support";

interface RecorderAppProps {
    initialMemos: VoiceMemoRecord[];
    projects: ClientProjectOption[];
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60).toString();
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

// Voice memo app — record via MediaRecorder, upload to Supabase Storage,
// list past memos with signed URLs for playback.
//
// Constraints held:
//   - No waveform visualizer (Phase 2)
//   - No client-side trimming (Phase 2)
//   - 20MB / per-memo cap enforced server-side
//   - Per-user, per-workspace scoping; RLS in the DB is the source of truth
export function RecorderApp({ initialMemos, projects }: RecorderAppProps) {
    const router = useRouter();
    const [memos, setMemos] = useState(initialMemos);
    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [permissionState, setPermissionState] = useState<RecorderPermissionState>("checking");
    const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
    const [isUploading, startUpload] = useTransition();
    const [isDeleting, startDelete] = useTransition();
    const [isRetrying, startRetry] = useTransition();
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkRecorderSupport = () => {
        const mediaDevices = globalThis.navigator?.mediaDevices;
        const supportMessage = getRecorderSupportMessage({
            hasMediaDevices: Boolean(mediaDevices),
            hasGetUserMedia: typeof mediaDevices?.getUserMedia === "function",
            hasMediaRecorder: typeof globalThis.MediaRecorder === "function",
        });

        if (supportMessage) {
            setPermissionState("unsupported");
            setError(supportMessage);
            return false;
        }

        setPermissionState("ready");
        return true;
    };

    useEffect(() => {
        checkRecorderSupport();

        return () => {
            // Cleanup on unmount — stop any active stream so the browser's
            // microphone indicator doesn't stay lit after the user closes the
            // window.
            streamRef.current?.getTracks().forEach((track) => track.stop());
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const retryMicrophone = () => {
        setError(null);
        setPermissionState("checking");
        if (!checkRecorderSupport()) return;
        void startRecording();
    };

    const startRecording = async () => {
        setError(null);
        if (!checkRecorderSupport()) return;
        try {
            const stream = await globalThis.navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];

            const preferredMime = globalThis.MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : "audio/webm";
            const recorder = new globalThis.MediaRecorder(stream, { mimeType: preferredMime });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };

            recorder.onstop = () => {
                const mime = recorder.mimeType || "audio/webm";
                const blob = new Blob(chunksRef.current, { type: mime });
                streamRef.current?.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
                handleUpload(blob, elapsed);
            };

            recorder.start();
            setPermissionState("ready");
            setIsRecording(true);
            setElapsed(0);
            timerRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
        } catch (err) {
            setPermissionState("blocked");
            setError(normalizeRecorderPermissionError(err));
        }
    };

    const stopRecording = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleUpload = (blob: Blob, durationSeconds: number) => {
        const fd = new FormData();
        fd.append("audio", blob, "memo.webm");
        fd.append("title", `Voice memo · ${new Date().toLocaleString()}`);
        fd.append("duration_seconds", String(durationSeconds));
        if (selectedProjectId) fd.append("project_id", selectedProjectId);

        startUpload(async () => {
            const result = await uploadVoiceMemo(fd);
            if (result.error) {
                setError(result.error);
                return;
            }
            // Router refresh will re-run the server component which calls
            // listVoiceMemos — freshly signed URLs, transcripts, summaries,
            // and generated SLA tasks become visible after processing.
            router.refresh();
        });
    };

    const handleDelete = (id: string) => {
        startDelete(async () => {
            const result = await deleteVoiceMemo(id);
            if (result.error) {
                setError(result.error);
                return;
            }
            setMemos((prev) => prev.filter((m) => m.id !== id));
            router.refresh();
        });
    };

    const handleRetry = (id: string) => {
        startRetry(async () => {
            const result = await retryVoiceMemoProcessing(id);
            if (result.error) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    };

    return (
        <DashboardAppWorkbench>
            {isUploading ? (
                <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border/55 px-3 py-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving memo…
                </div>
            ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
            {/* Control side */}
            <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-border/60 bg-muted/10 p-4 md:w-[420px] md:border-b-0 md:border-r md:p-6 lg:w-[480px]">
                <div className="rounded-md border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isUploading || permissionState === "checking" || permissionState === "unsupported"}
                        className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border transition-all ${
                            isRecording
                                ? "animate-pulse border-rose-500/50 bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-300"
                                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 hover:border-cyan-400 hover:bg-cyan-500/20 dark:text-cyan-300"
                        }`}
                        aria-label={isRecording ? "Stop recording" : "Start recording"}
                    >
                        {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </button>
                    <div>
                        <p className="text-[20px] font-semibold tracking-tight text-foreground">
                            {isRecording ? "Recording…" : isUploading ? "Uploading…" : permissionState === "checking" ? "Checking microphone…" : "Tap to record"}
                        </p>
                        <p className="mt-0.5 text-[15px] text-muted-foreground">
                            {isRecording
                                ? formatDuration(elapsed)
                                : "Record sales calls or meetings; uploads are queued for cron transcription, generated notes, semantic sync, and SLA follow-ups."}
                        </p>
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[15px] text-destructive">
                        <p className="inline-flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            {error}
                        </p>
                        {(permissionState === "blocked" || permissionState === "unsupported") ? (
                            <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-destructive/90">
                                <p>To record a memo: open this page over HTTPS, allow microphone access in browser/site settings, then retry.</p>
                                <button
                                    type="button"
                                    onClick={retryMicrophone}
                                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-background/70 px-2 py-1 font-medium text-destructive hover:bg-background"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Retry microphone
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="mt-4 rounded-md border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[14px] leading-relaxed text-cyan-800 dark:text-cyan-200">
                    Voice memos upload as <span className="font-semibold">pending</span> jobs. The cron processor transcribes audio, creates or updates the generated note, syncs the memo and note into the semantic hub, then extracts SLA commitments for the selected project.
                </div>

                <div className="mt-5 rounded-md border border-border/60 bg-background/50 p-4">
                    <label className="block text-[15px] font-semibold uppercase text-muted-foreground">
                        Client project for generated SLA tasks
                    </label>
                    <select
                        value={selectedProjectId}
                        onChange={(event) => setSelectedProjectId(event.target.value)}
                        className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">Auto-create / use General Operations</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}{project.client_name ? ` · ${project.client_name}` : ""}
                            </option>
                        ))}
                    </select>
                    <p className="mt-2 text-[15px] text-muted-foreground">
                        Extracted commitments are written to the selected project as pending SLA items and indexed in the Legibility Hub.
                    </p>
                </div>
                </div>
            </aside>

            {/* Memo list */}
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4 md:p-6">
                <h2 className="mb-3 text-[14px] font-semibold uppercase text-muted-foreground">
                    {memos.length} memo{memos.length === 1 ? "" : "s"}
                </h2>
                {memos.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border/60 px-6 py-10 text-center text-[15px] text-muted-foreground">
                        No memos yet. Press the mic button to record your first one.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {memos.map((memo) => (
                            <li
                                key={memo.id}
                                className="rounded-md border border-border/50 bg-card px-4 py-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[15px] font-medium text-foreground">
                                            {memo.title}
                                        </p>
                                        <p className="mt-0.5 text-[15px] text-muted-foreground">
                                            {formatDuration(memo.duration_seconds)} · {memo.created_at}
                                        </p>
                                    </div>
                                    {memo.processed_at ? (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/50 bg-emerald-500/10 px-2 py-1 text-[14px] font-medium text-emerald-700 dark:text-emerald-300">
                                            <CheckCircle2 className="h-3 w-3" /> Processed
                                        </span>
                                    ) : memo.processing_status === "error" || memo.summary_json?.error ? (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/50 bg-amber-500/10 px-2 py-1 text-[14px] font-medium text-amber-700 dark:text-amber-300">
                                            <AlertTriangle className="h-3 w-3" /> Needs retry
                                        </span>
                                    ) : memo.processing_status === "processing" ? (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/50 bg-cyan-500/10 px-2 py-1 text-[14px] font-medium text-cyan-700 dark:text-cyan-300">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Processing
                                        </span>
                                    ) : memo.processing_status === "pending" ? (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[14px] font-medium text-muted-foreground">
                                            Pending
                                        </span>
                                    ) : null}
                                    {memo.processed_at ? (
                                        <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/40 bg-cyan-500/10 px-2 py-1 text-[14px] font-medium text-cyan-700 dark:text-cyan-300">
                                            Note + Hub + SLA synced
                                        </span>
                                    ) : memo.processing_status === "pending" ? (
                                        <span className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[14px] font-medium text-muted-foreground">
                                            Queued for cron
                                        </span>
                                    ) : null}
                                    {memo.signed_url ? (
                                        <audio controls src={memo.signed_url} className="h-8 max-w-[280px]">
                                            Your browser does not support audio playback.
                                        </audio>
                                    ) : (
                                        <span className="text-[14px] text-muted-foreground">URL expired</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(memo.id)}
                                        disabled={isDeleting}
                                        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[15px] text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                        aria-label={`Delete ${memo.title}`}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                    {memo.processing_status === "error" ? (
                                        <button
                                            type="button"
                                            onClick={() => handleRetry(memo.id)}
                                            disabled={isRetrying}
                                            className="inline-flex items-center gap-1 rounded-md border border-amber-300/50 px-2 py-1 text-[15px] text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
                                            aria-label={`Retry ${memo.title}`}
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            Retry
                                        </button>
                                    ) : null}
                                </div>
                                {(memo.summary_json?.summary || memo.transcript || memo.summary_json?.commitments?.length || memo.summary_json?.error || memo.processing_error) ? (
                                    <div className="mt-3 grid gap-3 rounded-md border border-border/50 bg-background/60 p-3 text-[15px] text-muted-foreground md:grid-cols-2">
                                        <div>
                                            <p className="mb-1 inline-flex items-center gap-1 font-semibold text-foreground">
                                                <FileText className="h-3.5 w-3.5" /> Summary
                                            </p>
                                            <p className="line-clamp-4 leading-relaxed">
                                                {memo.processing_error ?? memo.summary_json?.error ?? memo.summary_json?.summary ?? "Summary pending."}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="mb-1 font-semibold text-foreground">
                                                Generated commitments
                                            </p>
                                            {memo.summary_json?.commitments?.length ? (
                                                <ul className="space-y-1">
                                                    {memo.summary_json.commitments.slice(0, 4).map((commitment, index) => (
                                                        <li key={`${memo.id}-${index}`} className="rounded-md border border-border/40 bg-card/70 px-2 py-1">
                                                            <span className="font-medium text-foreground">{commitment.title}</span>
                                                            <span className="ml-1 text-muted-foreground">· {commitment.priority}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p>No commitments extracted yet.</p>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
        </DashboardAppWorkbench>
    );
}
