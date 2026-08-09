import Link from "next/link";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { ArrowRight, Film, Play, Clock } from "lucide-react";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";
import type { PublicVideoItem } from "@/features/video-stream/public-actions";

interface PersonalBrandVideosIndexProps {
    items: PublicVideoItem[];
    config: TemplateConfig;
    locale: Locale;
}

const COPY = {
    eyebrowFallback: { en: "Video field reports", nl: "Video-veldrapportages", ar: "تقارير ميدانية بالفيديو" },
    moreVideos: { en: "More videos", nl: "Meer video's", ar: "المزيد من الفيديوهات" },
    watch: { en: "Watch", nl: "Bekijk", ar: "شاهد" },
    openVideo: { en: "Open the video", nl: "Open de video", ar: "افتح الفيديو" },
    featured: { en: "Featured video", nl: "Uitgelicht", ar: "الفيديو المميز" },
    emptyTitle: { en: "No videos published yet", nl: "Nog geen video's gepubliceerd", ar: "لم تُنشر أي فيديوهات بعد" },
    emptyBody: {
        en: "The first published video will land here. Check back soon.",
        nl: "De eerste gepubliceerde video komt hier. Kom snel terug.",
        ar: "ستظهر أول فيديو منشور هنا. عُد قريبًا.",
    },
} as const;

function formatDuration(seconds: number | null): string | null {
    if (!seconds || seconds <= 0) return null;
    const total = Math.round(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function getPoster(item: PublicVideoItem): string | null {
    const meta = item.metadata as Record<string, unknown> | null;
    if (!meta) return null;
    const candidates = [
        (meta as { poster_url?: unknown }).poster_url,
        (meta as { thumbnail_url?: unknown }).thumbnail_url,
        ((meta as { generated_formats?: { video_script?: { thumbnail_url?: unknown } } })
            .generated_formats?.video_script?.thumbnail_url),
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c.length > 0) return c;
    }
    return null;
}

export function PersonalBrandVideosIndex({ items, config, locale }: PersonalBrandVideosIndexProps) {
    const videosCopy = config.pages.videos;
    const featured = items[0] ?? null;
    const rest = items.slice(1);

    const eyebrow = videosCopy?.subtitle
        ? pickLocaleText(videosCopy.subtitle, locale)
        : COPY.eyebrowFallback[locale];
    const title = videosCopy?.title ? pickLocaleText(videosCopy.title, locale) : "Videos";
    const description = videosCopy?.description ? pickLocaleText(videosCopy.description, locale) : "";

    return (
        <section className="py-16 text-[var(--template-text-primary)] md:py-24">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                <div className="mb-16 max-w-2xl">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                        {eyebrow}
                    </p>
                    <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-[var(--template-text-primary)] sm:text-5xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="text-lg leading-relaxed text-[var(--template-text-secondary)]">
                            {description}
                        </p>
                    )}
                </div>

                {items.length === 0 ? (
                    <EmptyState locale={locale} />
                ) : (
                    <div className="flex flex-col gap-12">
                        {featured && <FeaturedVideo item={featured} locale={locale} />}
                        {rest.length > 0 && (
                            <div>
                                <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                                    {COPY.moreVideos[locale]}
                                </h2>
                                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {rest.map((item) => (
                                        <li key={item.id}>
                                            <VideoCard item={item} locale={locale} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function FeaturedVideo({ item, locale }: { item: PublicVideoItem; locale: Locale }) {
    const href = localizeHref(locale, `/videos/${item.slug ?? item.id}`);
    const duration = formatDuration(item.video_duration);
    const poster = getPoster(item);

    return (
        <Link
            href={href}
            className="group relative grid grid-cols-1 gap-8 overflow-hidden rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-6 backdrop-blur-[12px] transition-all duration-300 hover:border-[var(--template-accent)]/40 hover:shadow-[var(--template-depth-md)] sm:p-10 lg:grid-cols-[auto_1fr]"
        >
            <PosterBlock src={poster} alt={item.title} size="lg" duration={duration} />
            <div className="flex flex-col justify-center gap-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--template-accent)]/30 [background:var(--template-accent)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--template-text-accent-strong)]" />
                    {COPY.featured[locale]}
                </span>
                <h2 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-[var(--template-text-primary)] sm:text-4xl">
                    {item.title}
                </h2>
                {item.content_markdown && (
                    <p className="line-clamp-3 text-sm leading-relaxed text-[var(--template-text-secondary)]">
                        {item.content_markdown.replace(/[#*_>`-]/g, "").slice(0, 240)}
                    </p>
                )}
                <span className="mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--template-text-accent-strong)] transition group-hover:gap-2.5">
                    {COPY.openVideo[locale]}
                    <ArrowRight className="h-4 w-4" />
                </span>
            </div>
        </Link>
    );
}

function VideoCard({ item, locale }: { item: PublicVideoItem; locale: Locale }) {
    const href = localizeHref(locale, `/videos/${item.slug ?? item.id}`);
    const duration = formatDuration(item.video_duration);
    const poster = getPoster(item);

    return (
        <Link
            href={href}
            className="group flex h-full flex-col gap-4 rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-5 backdrop-blur-[12px] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--template-accent)]/40 hover:shadow-[var(--template-depth-md)]"
        >
            <PosterBlock src={poster} alt={item.title} size="md" duration={duration} className="aspect-video !h-auto w-full" />
            <div className="flex flex-col gap-1">
                <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-[var(--template-text-primary)]">
                    {item.title}
                </h3>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--template-text-accent-strong)] transition group-hover:gap-2">
                {COPY.watch[locale]}
                <ArrowRight className="h-3 w-3" />
            </span>
        </Link>
    );
}

function EmptyState({ locale }: { locale: Locale }) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-[var(--template-border-soft)] bg-white/70 py-20 text-center">
            <Film className="mx-auto mb-4 h-10 w-10 text-[var(--template-text-subtle)]" />
            <h3 className="mb-2 text-lg font-semibold text-[var(--template-text-primary)]">
                {COPY.emptyTitle[locale]}
            </h3>
            <p className="text-sm text-[var(--template-text-secondary)]">{COPY.emptyBody[locale]}</p>
        </div>
    );
}

function PosterBlock({
    src,
    alt,
    size,
    duration,
    className,
}: {
    src: string | null;
    alt: string;
    size: "md" | "lg";
    duration: string | null;
    className?: string;
}) {
    const dimensions = size === "lg" ? "h-64 w-full sm:h-80 sm:w-[28rem]" : "h-40 w-full";
    const wrapperClass = `relative shrink-0 overflow-hidden rounded-xl ${dimensions} ${className ?? ""}`;

    return (
        <div className={wrapperClass}>
            {src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={src}
                    alt={alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--template-accent)]/15 via-[var(--template-accent)]/5 to-transparent ring-1 ring-[var(--template-border-soft)]">
                    <Film className="h-10 w-10 text-[var(--template-text-accent-strong)]/60" />
                </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-xl transition-transform duration-300 group-hover:scale-110">
                    <Play className="ms-0.5 h-6 w-6 text-[var(--template-accent)]" />
                </span>
            </div>
            {duration && (
                <span className="absolute bottom-3 end-3 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-medium text-white backdrop-blur">
                    <Clock className="h-3 w-3" />
                    {duration}
                </span>
            )}
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
        </div>
    );
}
