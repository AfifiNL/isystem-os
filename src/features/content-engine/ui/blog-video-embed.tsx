import { Film, Play } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { getYouTubeNoCookieEmbedUrl, type BlogVideoShortcode } from "@/features/content-engine/lib/video-shortcodes";

interface BlogVideoEmbedProps {
    video: BlogVideoShortcode;
    surface?: "editor" | "public";
}

export function BlogVideoEmbed({ video, surface = "public" }: BlogVideoEmbedProps) {
    const isEditor = surface === "editor";
    const frameClassName = cn(
        "group my-6 overflow-hidden rounded-2xl border shadow-2xl",
        isEditor
            ? "border-border/60 bg-slate-950 text-slate-100 shadow-black/10"
            : "border-[var(--template-border-inverse)] bg-black/80 text-white shadow-black/30",
    );

    return (
        <figure className={frameClassName}>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <figcaption className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-200">
                        {video.kind === "youtube" ? <Play className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                    </span>
                    <span className="truncate">{video.title}</span>
                </figcaption>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/80">
                    {video.kind === "youtube" ? "YouTube" : "Uploaded"}
                </span>
            </div>
            <div className="aspect-video bg-black">
                {video.kind === "youtube" ? (
                    <iframe
                        src={getYouTubeNoCookieEmbedUrl(video.id)}
                        title={video.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="h-full w-full"
                    />
                ) : (
                    <video
                        src={video.src}
                        poster={video.poster}
                        title={video.title}
                        controls
                        preload="metadata"
                        className="h-full w-full bg-black"
                    />
                )}
            </div>
        </figure>
    );
}
