"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/ui/button";
import { ProBadge } from "@/shared/ui/pro-badge";
import { ProFeatureNotice } from "@/shared/ui/pro-feature-notice";
import {
    Download, ImageIcon, Mic, RefreshCw, Loader2,
    ExternalLink, CheckCircle2
} from "lucide-react";

interface StorageAsset {
    id: string;
    name: string;
    url: string;
    metadata: {
        size?: number;
        mimetype?: string;
    } | null;
    created_at: string;
}

interface ContentAssetViewerProps {
    contentId: string;
    aiGenerationEnabled?: boolean;
    onOpenPodcastProduction?: () => void;
}

interface VideoJob {
    id: string;
    status: "pending_admin" | "completed" | string;
    created_at: string;
    result_video_url: string | null;
    signedUrl?: string | null;
}

const ASSET_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
    blog_featured: { label: "Blog Featured Image", icon: ImageIcon },
    youtube_thumbnail: { label: "YouTube Thumbnail", icon: ImageIcon },
    social_linkedin: { label: "LinkedIn Post Image", icon: ImageIcon },
    social_twitter: { label: "X / Twitter Card", icon: ImageIcon },
    social_instagram: { label: "Instagram Cover", icon: ImageIcon },
    narration: { label: "Audio Narration", icon: Mic },
};

function formatBytes(bytes?: number): string {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function ContentAssetViewer({
    contentId,
    aiGenerationEnabled = true,
    onOpenPodcastProduction,
}: ContentAssetViewerProps) {
    const [fetchedAssets, setFetchedAssets] = useState<StorageAsset[]>([]);
    const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
    const [isLoadingAssets, setIsLoadingAssets] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    const loadAssets = useCallback(async () => {
        setIsLoadingAssets(true);
        try {
            const [assetRes, jobsRes] = await Promise.all([
                fetch(`/api/content/${contentId}/assets`),
                fetch(`/api/content/${contentId}/video-jobs`)
            ]);

            if (assetRes.ok) {
                const assetData = await assetRes.json();
                if (assetData.assets) setFetchedAssets(assetData.assets);
            }
            if (jobsRes.ok) {
                const jobsData = await jobsRes.json();
                if (jobsData.jobs) setVideoJobs(jobsData.jobs);
            }
        } catch (error) {
            console.error("Failed to load assets or video jobs:", error);
        } finally {
            setIsLoadingAssets(false);
        }
    }, [contentId]);

    useEffect(() => {
        loadAssets();
    }, [loadAssets]);

    const handleGenerateImages = async () => {
        if (!aiGenerationEnabled) {
            setGenError("AI generation is only available on Pro workspaces.");
            return;
        }
        setIsGenerating(true);
        setGenError(null);
        try {
            const res = await fetch("/api/generate-assets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content_id: contentId,
                    generate_images: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setGenError(data.error || "Asset generation failed");
            } else {
                // Instantly sync the new assets from the storage bucket
                await loadAssets();
            }
        } catch {
            setGenError("Network error during asset generation");
        } finally {
            setIsGenerating(false);
        }
    };

    const imageAssets = fetchedAssets.filter((a) => {
        const mimeType = a.metadata?.mimetype || "";
        const name = a.name.toLowerCase();
        return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(name);
    });
    const audioAssets = fetchedAssets.filter((a) => a.metadata?.mimetype?.startsWith("audio/") || a.name.endsWith(".wav") || a.name.endsWith(".mp3"));

    if (isLoadingAssets) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (fetchedAssets.length === 0) {
        return (
            <div className="text-center py-12 space-y-4">
                {!aiGenerationEnabled ? (
                    <ProFeatureNotice
                        title="Asset Library generation tools are part of Pro"
                        description="Pro transforms the Asset Library into a visual production layer and connects source content to the governed Podcast Production workflow."
                        ctaLabel="Activate Pro for Asset Library"
                        benefits={[
                            "Generate branded imagery for blog, social, and campaign use cases.",
                            "Open Podcast Production for show-aware narration and voice selection.",
                            "Bridge generated assets into render and fulfillment workflows from one workspace view.",
                        ]}
                    />
                ) : null}
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">No assets found in Library</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Generate branded images here. Narration is created through Podcast Production so its show, voice, and music settings remain attached.
                    </p>
                </div>
                <div className="flex gap-2 justify-center">
                    <Button
                        onClick={handleGenerateImages}
                        disabled={isGenerating || !aiGenerationEnabled}
                        variant="outline"
                        className="gap-2"
                    >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                        Generate Images
                        {!aiGenerationEnabled ? <ProBadge className="ml-1" /> : null}
                    </Button>
                    <Button
                        onClick={onOpenPodcastProduction}
                        disabled={!onOpenPodcastProduction}
                        variant="outline"
                        className="gap-2"
                    >
                        <Mic className="h-4 w-4" />
                        Open Podcast Production
                    </Button>
                </div>
                {genError && (
                    <p className="text-sm text-destructive">{genError}</p>
                )}
                {isGenerating && (
                    <p className="text-sm text-muted-foreground animate-pulse">
                        Generating assets with AI models... This may take up to 60 seconds.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {!aiGenerationEnabled ? (
                <ProFeatureNotice
                    title="Asset Library generation tools are part of Pro"
                    description="Pro transforms the Asset Library into a visual production layer and connects source content to the governed Podcast Production workflow."
                    ctaLabel="Activate Pro for Asset Library"
                    benefits={[
                        "Generate branded imagery for blog, social, and campaign use cases.",
                        "Open Podcast Production for show-aware narration and voice selection.",
                        "Bridge generated assets into render and fulfillment workflows from one workspace view.",
                    ]}
                />
            ) : null}

            {/* Image Assets Library */}
            {imageAssets.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Live Image Assets
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {imageAssets.map((asset) => {
                            const key = asset.name.split('.')[0];
                            const meta = ASSET_LABELS[key] || { label: asset.name, icon: ImageIcon };
                            return (
                                <div key={asset.id} className="rounded-lg border overflow-hidden bg-card">
                                    <div className="aspect-video bg-muted relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={asset.url}
                                            alt={meta.label}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium">{meta.label}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatBytes(asset.metadata?.size)} · {asset.name.split('.').pop()?.toUpperCase() || 'IMAGE'}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <a
                                                href={asset.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-md hover:bg-muted transition-colors"
                                                title="Open in new tab"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                            <a
                                                href={asset.url}
                                                download={asset.name}
                                                className="p-2 rounded-md hover:bg-muted transition-colors"
                                                title="Download"
                                            >
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Audio Assets Library */}
            {audioAssets.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        Live Audio Assets
                    </h3>
                    {audioAssets.map((asset) => {
                        const key = asset.name.split('.')[0];
                        return (
                            <div key={asset.id} className="rounded-lg border p-4 bg-card space-y-3">
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium">
                                            {ASSET_LABELS[key]?.label || asset.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatBytes(asset.metadata?.size)} · {asset.name.split('.').pop()?.toUpperCase() || 'AUDIO'}
                                        </div>
                                    </div>
                                    <a
                                        href={asset.url}
                                        download={asset.name}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </a>
                                </div>
                                <audio controls className="w-full" preload="metadata">
                                    <source src={asset.url} type={asset.metadata?.mimetype || "audio/wav"} />
                                    Your browser does not support audio playback.
                                </audio>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Video Render Tasks Dashboard */}
            {videoJobs.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4" />
                        Video Generation Tasks
                    </h3>
                    <div className="grid gap-3">
                        {videoJobs.map((job) => (
                            <div key={job.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-card gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-sm">Orchestrated Video Batch</h4>
                                        {job.status === "pending_admin" && (
                                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                Awaiting Fulfillment
                                            </span>
                                        )}
                                        {job.status === "completed" && (
                                            <span className="inline-flex items-center rounded-full border border-green-200 px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                Completed
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {job.status === "pending_admin"
                                            ? "Queue Generated. Waiting for Admin to render the video manually."
                                            : "Video successfully rendered and uploaded by Admin."}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Created: {new Date(job.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    {job.status === "completed" && job.signedUrl ? (
                                        <Button size="sm" asChild>
                                            <a href={job.signedUrl} target="_blank" rel="noopener noreferrer">
                                                <Download className="h-4 w-4 mr-2" />
                                                Download Rendered Video
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button size="sm" variant="secondary" disabled>
                                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                            Processing Offline...
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Regenerate Library */}
            <div className="flex min-w-0 flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    {fetchedAssets.length} asset{fetchedAssets.length !== 1 ? "s" : ""} synced from Library
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={onOpenPodcastProduction}
                        disabled={!onOpenPodcastProduction}
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                    >
                        <Mic className="h-3.5 w-3.5" />
                        Open Podcast Production
                    </Button>
                    <Button
                        onClick={loadAssets}
                        disabled={isLoadingAssets}
                        variant="ghost"
                        size="sm"
                        className="gap-2"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAssets ? 'animate-spin' : ''}`} />
                        Sync
                    </Button>
                    <Button
                        onClick={handleGenerateImages}
                        disabled={isGenerating || !aiGenerationEnabled}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                    >
                        {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Regenerate Images
                        {!aiGenerationEnabled ? <ProBadge className="ml-1" /> : null}
                    </Button>
                </div>
            </div>

            {genError && (
                <p className="text-sm text-destructive">{genError}</p>
            )}
        </div>
    );
}
