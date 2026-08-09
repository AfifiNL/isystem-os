"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Image as ImageIcon, Loader2, Monitor, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface DesktopTabProps {
    currentWallpaperUrl: string | null;
    canManage: boolean;
}

interface UploadResponse {
    asset?: {
        url: string;
        width?: number;
        height?: number;
        size: number;
        optimized: boolean;
    };
    error?: string;
}

// Vercel serverless functions cap incoming request bodies around 4.5 MB. Our
// server route allows 15 MB before processing, but the platform rejects with
// 413 long before the file reaches us. Client-side downscale + re-encode keeps
// the payload safely under that ceiling and matches what the server pipeline
// would produce anyway (max edge 2400px, WebP).
const CLIENT_MAX_EDGE = 2400;
const CLIENT_TARGET_BYTES = 3 * 1024 * 1024;
const ALLOW_NATIVE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

async function downscaleImage(file: File): Promise<File> {
    if (ALLOW_NATIVE_TYPES.has(file.type) && file.size <= CLIENT_TARGET_BYTES) {
        return file;
    }
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;
    const scale = Math.min(1, CLIENT_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/webp", 0.86);
    });
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "wallpaper";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

export function DesktopTab({ currentWallpaperUrl, canManage }: DesktopTabProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(currentWallpaperUrl);
    const [isUploading, startUpload] = useTransition();
    const [isResetting, startReset] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);

    const handlePickFile = () => {
        setError(null);
        setInfo(null);
        fileInputRef.current?.click();
    };

    const handleFile = (file: File) => {
        setError(null);
        setInfo(null);
        const MAX = 15 * 1024 * 1024;
        if (file.size > MAX) {
            setError("Wallpaper must be 15 MB or smaller.");
            return;
        }
        if (!file.type.startsWith("image/")) {
            setError("Only image files are supported.");
            return;
        }
        startUpload(async () => {
            try {
                const prepared = await downscaleImage(file).catch(() => file);
                const fd = new FormData();
                fd.set("file", prepared);
                const res = await fetch("/api/workspace/wallpaper/upload", {
                    method: "POST",
                    body: fd,
                });
                const body = (await res.json()) as UploadResponse;
                if (!res.ok || !body.asset?.url) {
                    setError(body.error ?? `Upload failed (${res.status}).`);
                    return;
                }
                setWallpaperUrl(body.asset.url);
                const sizeKb = Math.round(body.asset.size / 1024);
                const optimized = body.asset.optimized ? " (optimized)" : "";
                setInfo(`Wallpaper uploaded · ${sizeKb} KB${optimized}.`);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Upload failed.");
            }
        });
    };

    const handleReset = () => {
        // window.confirm() is suppressed by Chrome when the tab isn't frontmost.
        // Use a two-click inline confirm instead so the action is always tied
        // to a real user gesture in the page itself.
        if (!confirmReset) {
            setConfirmReset(true);
            setError(null);
            setInfo(null);
            return;
        }
        setConfirmReset(false);
        setError(null);
        setInfo(null);
        startReset(async () => {
            try {
                const res = await fetch("/api/workspace/wallpaper/upload", { method: "DELETE" });
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setError(body.error ?? `Reset failed (${res.status}).`);
                    return;
                }
                setWallpaperUrl(null);
                setInfo("Wallpaper reset to default.");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Reset failed.");
            }
        });
    };

    const isBusy = isUploading || isResetting;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <section className="rounded-md border border-border/60 bg-card p-6 shadow-sm space-y-5">
                <header className="flex items-start gap-3">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                        <Monitor className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Desktop wallpaper</h2>
                        <p className="mt-1 text-[15px] text-muted-foreground">
                            Replace the default workspace gradient with a branded image.
                            Uploads are automatically resized to 2400&nbsp;px on the long edge and re-encoded
                            to WebP.
                        </p>
                    </div>
                </header>

                {!canManage ? (
                    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[15px] text-amber-700 dark:text-amber-300">
                        Only workspace admins can change the desktop wallpaper.
                    </p>
                ) : null}

                <div className="overflow-hidden rounded-md border border-border/60 bg-slate-950">
                    <div className="relative aspect-[16/9] w-full">
                        {wallpaperUrl ? (
                            <Image
                                src={wallpaperUrl}
                                alt="Current workspace wallpaper"
                                fill
                                sizes="(max-width: 1024px) 100vw, 800px"
                                className="object-cover object-center"
                                priority={false}
                            />
                        ) : (
                            <div
                                aria-hidden
                                className="absolute inset-0"
                                style={{
                                    background:
                                        "linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
                                }}
                            />
                        )}
                        <div className="absolute inset-0 bg-slate-950/35" />
                        <div className="absolute inset-0 flex items-end p-4">
                            <div className="rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-[17px] text-slate-200 backdrop-blur">
                                {wallpaperUrl ? "Current wallpaper preview" : "Default gradient (no wallpaper set)"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/avif,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                            e.currentTarget.value = "";
                        }}
                    />
                    <Button
                        type="button"
                        onClick={handlePickFile}
                        disabled={!canManage || isBusy}
                        aria-busy={isUploading || undefined}
                    >
                        {isUploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        {isUploading ? "Uploading…" : wallpaperUrl ? "Replace wallpaper" : "Upload wallpaper"}
                    </Button>
                    {wallpaperUrl ? (
                        <>
                            <Button
                                type="button"
                                variant={confirmReset ? "destructive" : "outline"}
                                onClick={handleReset}
                                disabled={!canManage || isBusy}
                                aria-busy={isResetting || undefined}
                            >
                                {isResetting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                )}
                                {isResetting
                                    ? "Resetting…"
                                    : confirmReset
                                        ? "Click again to confirm reset"
                                        : "Reset to default"}
                            </Button>
                            {confirmReset && !isResetting ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setConfirmReset(false)}
                                    disabled={!canManage}
                                >
                                    Cancel
                                </Button>
                            ) : null}
                        </>
                    ) : null}
                    <span className="inline-flex items-center gap-1 text-[17px] text-muted-foreground">
                        <ImageIcon className="h-3 w-3" />
                        PNG, JPEG, WebP, AVIF, or HEIC · up to 15 MB
                    </span>
                </div>

                {error ? (
                    <p
                        role="alert"
                        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[15px] text-destructive"
                    >
                        <AlertTriangle className="h-3 w-3" />
                        {error}
                    </p>
                ) : null}
                {info ? (
                    <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[15px] text-emerald-700 dark:text-emerald-300">
                        {info}
                    </p>
                ) : null}
            </section>
        </div>
    );
}
