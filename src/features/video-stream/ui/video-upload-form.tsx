"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud, AlertCircle, ImagePlus } from "lucide-react";
import { createVideo, updateVideo, type CreateVideoInput } from "@/features/video-stream/manager-actions";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_BYTES = 500 * 1024 * 1024;

interface VideoUploadFormProps {
    mode: "create" | "edit";
    workspaceId: string;
    videoId?: string;
    initialTitle?: string;
    initialDescription?: string;
    initialSlug?: string;
    initialLocale?: "en" | "nl" | "ar";
    initialStatus?: "draft" | "published";
    initialVideoUrl?: string;
    initialPosterUrl?: string;
    initialDuration?: number | null;
    initialResolution?: string | null;
}

async function probeVideoMeta(file: File): Promise<{ duration: number; resolution: string } | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => {
            const duration = Math.round(v.duration || 0);
            const resolution = v.videoWidth && v.videoHeight ? `${v.videoWidth}x${v.videoHeight}` : "";
            URL.revokeObjectURL(url);
            resolve({ duration, resolution });
        };
        v.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };
        v.src = url;
    });
}

export function VideoUploadForm({
    mode,
    workspaceId,
    videoId,
    initialTitle = "",
    initialDescription = "",
    initialSlug = "",
    initialLocale = "en",
    initialStatus = "draft",
    initialVideoUrl = "",
    initialPosterUrl = "",
    initialDuration = null,
    initialResolution = null,
}: VideoUploadFormProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [slug, setSlug] = useState(initialSlug);
    const [locale, setLocale] = useState<"en" | "nl" | "ar">(initialLocale);
    const [status, setStatus] = useState<"draft" | "published">(initialStatus);
    const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
    const [posterUrl, setPosterUrl] = useState(initialPosterUrl);
    const [duration, setDuration] = useState<number | null>(initialDuration);
    const [resolution, setResolution] = useState<string | null>(initialResolution);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const posterInputRef = useRef<HTMLInputElement | null>(null);
    const [posterUploading, setPosterUploading] = useState(false);

    async function handleVideoFile(file: File) {
        setError(null);

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError(`Unsupported file type: ${file.type}. Use MP4, WebM, or MOV.`);
            return;
        }
        if (file.size > MAX_BYTES) {
            setError(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Max 500MB.`);
            return;
        }

        // Probe metadata before upload so we can save it alongside the URL.
        const meta = await probeVideoMeta(file);
        if (meta) {
            setDuration(meta.duration);
            setResolution(meta.resolution || null);
        }

        try {
            setUploadProgress(0);
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
            const pathname = `videos/${workspaceId}/${Date.now()}-${safeName}`;

            // 1. Get signed upload URL from Next.js server
            const res = await fetch("/api/videos/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pathname, contentType: file.type, size: file.size }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error || "Failed to generate upload URL");
            }

            const { uploadUrl, publicUrl } = json as { uploadUrl: string; publicUrl: string };

            // 2. Perform direct browser-to-Supabase upload via the signed URL.
            // Supabase signed uploads expect multipart form data for Blob/File bodies:
            // `cacheControl` plus the file under an empty field name, matching storage-js.
            const uploadBody = new FormData();
            uploadBody.append("cacheControl", "3600");
            uploadBody.append("", file);

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl, true);
                xhr.setRequestHeader("x-upsert", "false");

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        setUploadProgress(Math.round((event.loaded / event.total) * 100));
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
                    }
                };

                xhr.onerror = () => reject(new Error("Network error during upload"));
                xhr.send(uploadBody);
            });

            setVideoUrl(publicUrl);
            setUploadProgress(null);
        } catch (err) {
            setUploadProgress(null);
            setError(err instanceof Error ? err.message : "Upload failed");
        }
    }

    async function handlePosterFile(file: File) {
        setError(null);
        if (!file.type.startsWith("image/")) {
            setError("Poster must be an image");
            return;
        }

        setPosterUploading(true);
        try {
            const form = new FormData();
            form.set("file", file);
            form.set("target", "video-poster");
            const res = await fetch("/api/site-chrome/assets/upload", { method: "POST", body: form });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error ?? "Poster upload failed");
            setPosterUrl(json.asset.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Poster upload failed");
        } finally {
            setPosterUploading(false);
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!title.trim()) return setError("Title is required");
        if (!videoUrl) return setError("Upload a video file before saving");

        const payload: CreateVideoInput = {
            title: title.trim(),
            description,
            slug: slug.trim() || undefined,
            locale,
            status,
            video_url: videoUrl,
            video_duration: duration ?? undefined,
            video_resolution: resolution ?? undefined,
            poster_url: posterUrl || undefined,
        };

        startTransition(async () => {
            const result = mode === "edit" && videoId
                ? await updateVideo(videoId, payload)
                : await createVideo(payload);

            if ("error" in result && result.error) {
                setError(result.error);
                return;
            }

            const id = "data" in result && result.data ? (result.data as { id?: string }).id : null;
            router.push(id && mode === "create" ? `/dashboard/videos/${id}` : "/dashboard/videos");
            router.refresh();
        });
    }

    const isUploading = uploadProgress !== null;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Video file</h2>

                {videoUrl ? (
                    <div className="space-y-3">
                        <video src={videoUrl} controls className="w-full rounded-lg border border-border/50 bg-black" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">{videoUrl}</span>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="ml-3 shrink-0 rounded-md border border-border/60 px-3 py-1 hover:text-foreground"
                            >
                                Replace
                            </button>
                        </div>
                        {(duration || resolution) && (
                            <p className="text-[11px] text-muted-foreground">
                                {duration ? `${duration}s` : ""}
                                {duration && resolution ? " · " : ""}
                                {resolution ?? ""}
                            </p>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-12 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-60"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <span>Uploading… {uploadProgress}%</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="h-6 w-6" />
                                <span>Click to upload an MP4, WebM, or MOV (max 500MB)</span>
                            </>
                        )}
                    </button>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleVideoFile(file);
                        e.target.value = "";
                    }}
                />
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Details</h2>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Walkthrough — Workspace SEO module"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                            Slug <span className="text-muted-foreground/60">(auto-generated if blank)</span>
                        </label>
                        <input
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="workspace-seo-walkthrough"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="What does this video show?"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Locale</label>
                            <select
                                value={locale}
                                onChange={(e) => setLocale(e.target.value as "en" | "nl" | "ar")}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="en">English</option>
                                <option value="nl">Nederlands</option>
                                <option value="ar">العربية</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-foreground">Poster image</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                    Optional. Used as the thumbnail on /videos and the poster frame on the player.
                </p>

                {posterUrl ? (
                    <div className="space-y-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={posterUrl} alt="Poster preview" className="aspect-video w-full rounded-lg object-cover" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">{posterUrl}</span>
                            <button
                                type="button"
                                onClick={() => setPosterUrl("")}
                                className="ml-3 shrink-0 rounded-md border border-border/60 px-3 py-1 hover:text-foreground"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => posterInputRef.current?.click()}
                        disabled={posterUploading}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-8 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-60"
                    >
                        {posterUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <ImagePlus className="h-5 w-5" />
                                <span>Upload poster image</span>
                            </>
                        )}
                    </button>
                )}

                <input
                    ref={posterInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePosterFile(file);
                        e.target.value = "";
                    }}
                />
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={() => router.push("/dashboard/videos")}
                    className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-muted"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={pending || isUploading || !videoUrl}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {mode === "edit" ? "Save changes" : "Save video"}
                </button>
            </div>
        </form>
    );
}
