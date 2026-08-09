import Link from "next/link";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { ArrowLeft, ArrowRight, Calendar, Clock, Headphones, Rss } from "lucide-react";
import type { TemplateConfig, Locale } from "@/features/templates/types";

interface PersonalBrandPodcastShowProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    show: any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    episodes: any[];
    config: TemplateConfig;
    locale: Locale;
}

function formatDuration(seconds: number | null): string {
    if (!seconds || seconds < 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
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

export function PersonalBrandPodcastShow({ show, episodes, locale }: PersonalBrandPodcastShowProps) {
    const feedHref = `/api/podcast/${show.slug}/feed.xml`;

    return (
        <section className="py-12 text-[var(--template-text-primary)] md:py-16">
            <div className="container mx-auto max-w-5xl px-4 md:px-6">
                <Link
                    href={localizeHref(locale, "/podcast")}
                    className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--template-text-secondary)] transition hover:gap-2 hover:text-[var(--template-text-primary)]"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {locale === "en" ? "All shows" : locale === "nl" ? "Alle shows" : "كل العروض"}
                </Link>

                {/* Show header */}
                <header className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr] sm:items-end">
                    <CoverArtBlock src={show.cover_art_url} alt={show.title} size="lg" />
                    <div className="flex flex-col gap-4">
                        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--template-accent)]/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                            <Headphones className="h-3 w-3" />
                            {locale === "en" ? "Podcast" : locale === "nl" ? "Podcast" : "بودكاست"}
                        </span>
                        <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-[var(--template-text-primary)] sm:text-5xl">
                            {show.title}
                        </h1>
                        {show.subtitle && (
                            <p className="text-balance text-base text-[var(--template-text-secondary)] sm:text-lg">
                                {show.subtitle}
                            </p>
                        )}
                        {show.description && (
                            <p className="max-w-2xl text-sm leading-relaxed text-[var(--template-text-secondary)]">
                                {show.description}
                            </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                            <a
                                href={feedHref}
                                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] px-3 py-1.5 text-xs font-semibold text-[var(--template-text-primary)] transition hover:border-[var(--template-accent)]/40"
                            >
                                <Rss className="h-3 w-3" />
                                RSS
                            </a>
                        </div>
                    </div>
                </header>

                {/* Episodes list */}
                <div>
                    <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                        {locale === "en"
                            ? `${episodes.length} ${episodes.length === 1 ? "episode" : "episodes"}`
                            : locale === "nl"
                                ? `${episodes.length} ${episodes.length === 1 ? "aflevering" : "afleveringen"}`
                                : `${episodes.length} حلقات`}
                    </h2>
                    {episodes.length === 0 ? (
                        <EmptyState locale={locale} />
                    ) : (
                        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {episodes.map((ep) => (
                                <li key={ep.id}>
                                    <EpisodeCard show={show} episode={ep} locale={locale} />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function EpisodeCard({ show, episode, locale }: { show: any; episode: any; locale: Locale }) {
    const cover = episode.cover_art_url || show.cover_art_url || null;
    return (
        <Link
            href={localizeHref(locale, `/podcast/${show.slug}/${episode.slug}`)}
            className="group flex flex-col rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] overflow-hidden backdrop-blur-[12px] transition-all duration-300 hover:border-[var(--template-accent)]/40 hover:shadow-[var(--template-depth-md)]"
        >
            <div className="aspect-[16/9] overflow-hidden bg-slate-100/80">
                {cover ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={cover}
                        alt={episode.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100/80">
                        <Headphones className="h-10 w-10 text-[var(--template-text-subtle)]" />
                    </div>
                )}
            </div>
            <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--template-text-subtle)]">
                    <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(episode.published_at, locale)}
                    </span>
                    {episode.audio_duration_seconds && (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(episode.audio_duration_seconds)}
                        </span>
                    )}
                </div>
                <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-[var(--template-text-primary)] transition-colors duration-200 group-hover:text-[var(--template-text-accent-strong)]">
                    {episode.title}
                </h3>
                {(episode.summary || episode.description) && (
                    <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--template-text-secondary)]">
                        {episode.summary || episode.description}
                    </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--template-text-accent-strong)] transition-all group-hover:gap-2">
                    {locale === "en" ? "Listen now" : locale === "nl" ? "Luister nu" : "استمع الآن"}
                    <ArrowRight className="h-3 w-3" />
                </span>
            </div>
        </Link>
    );
}

function EmptyState({ locale }: { locale: Locale }) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-[var(--template-border-soft)] bg-white/70 py-16 text-center">
            <Headphones className="mx-auto mb-4 h-8 w-8 text-[var(--template-text-subtle)]" />
            <p className="text-sm text-[var(--template-text-secondary)]">
                {locale === "en"
                    ? "No episodes published yet."
                    : locale === "nl"
                        ? "Nog geen afleveringen gepubliceerd."
                        : "لم يتم نشر أي حلقات بعد."}
            </p>
        </div>
    );
}

function CoverArtBlock({
    src,
    alt,
    size,
}: {
    src: string | null;
    alt: string;
    size: "sm" | "md" | "lg";
}) {
    const dimensions = size === "lg"
        ? "h-56 w-56 sm:h-64 sm:w-64"
        : size === "sm"
            ? "h-16 w-16"
            : "h-40 w-40";
    if (!src) {
        return (
            <div className={`${dimensions} flex items-center justify-center rounded-xl bg-gradient-to-br from-[var(--template-accent)]/15 via-[var(--template-accent)]/5 to-transparent ring-1 ring-[var(--template-border-soft)]`}>
                <Headphones className="h-8 w-8 text-[var(--template-text-accent-strong)]/60" />
            </div>
        );
    }
    return (
        <div className={`relative shrink-0 overflow-hidden rounded-xl ${dimensions}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
        </div>
    );
}
