import Link from "next/link";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { ArrowLeft, Calendar, Clock, Film, MonitorPlay } from "lucide-react";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import { VideoPlayer } from "@/features/video-stream/ui/video-player";
import type { PublicVideoItem } from "@/features/video-stream/public-actions";

interface PersonalBrandVideosDetailProps {
    item: PublicVideoItem;
    config: TemplateConfig;
    locale: Locale;
}

const COPY = {
    backToVideos: { en: "All videos", nl: "Alle video's", ar: "كل الفيديوهات" },
    eyebrow: { en: "Video", nl: "Video", ar: "فيديو" },
    aboutThisVideo: { en: "About this video", nl: "Over deze video", ar: "حول هذا الفيديو" },
} as const;

function formatDuration(seconds: number | null): string | null {
    if (!seconds || seconds <= 0) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(value: string | null, locale: Locale): string {
    if (!value) return "";
    try {
        return new Date(value).toLocaleDateString(
            locale === "en" ? "en-US" : locale === "nl" ? "nl-NL" : "ar-EG",
            { year: "numeric", month: "long", day: "numeric" },
        );
    } catch {
        return "";
    }
}

function getPoster(item: PublicVideoItem): string | undefined {
    const meta = item.metadata as Record<string, unknown> | null;
    if (!meta) return undefined;
    const candidates = [
        (meta as { poster_url?: unknown }).poster_url,
        (meta as { thumbnail_url?: unknown }).thumbnail_url,
        ((meta as { generated_formats?: { video_script?: { thumbnail_url?: unknown } } })
            .generated_formats?.video_script?.thumbnail_url),
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c.length > 0) return c;
    }
    return undefined;
}

export function PersonalBrandVideosDetail({ item, locale }: PersonalBrandVideosDetailProps) {
    const poster = getPoster(item);
    const duration = formatDuration(item.video_duration);
    const published = formatDate(item.created_at, locale);
    const body = item.content_markdown?.trim() ?? "";

    return (
        <section className="py-12 text-[var(--template-text-primary)] md:py-16">
            <div className="container mx-auto max-w-5xl px-4 md:px-6">
                <Link
                    href={localizeHref(locale, "/videos")}
                    className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--template-text-secondary)] transition hover:gap-2 hover:text-[var(--template-text-primary)]"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {COPY.backToVideos[locale]}
                </Link>

                <header className="mb-8 flex flex-col gap-4">
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--template-accent)]/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                        <Film className="h-3 w-3" />
                        {COPY.eyebrow[locale]}
                    </span>
                    <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[var(--template-text-primary)] sm:text-5xl">
                        {item.title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--template-text-secondary)]">
                        {published && (
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {published}
                            </span>
                        )}
                        {duration && (
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {duration}
                            </span>
                        )}
                        {item.video_resolution && (
                            <span className="inline-flex items-center gap-1.5">
                                <MonitorPlay className="h-3.5 w-3.5" />
                                {item.video_resolution}
                            </span>
                        )}
                    </div>
                </header>

                <div className="mb-12 overflow-hidden rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-2 backdrop-blur-[12px] sm:p-3">
                    <VideoPlayer url={item.video_url} poster={poster} />
                </div>

                {body && (
                    <div className="rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-6 backdrop-blur-[12px] sm:p-10">
                        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                            {COPY.aboutThisVideo[locale]}
                        </h2>
                        <div className="prose max-w-none text-[var(--template-text-secondary)]">
                            {body.split(/\n{2,}/).map((para, i) => (
                                <p key={i} className="mb-4 leading-relaxed last:mb-0">
                                    {para}
                                </p>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
