import Link from "next/link";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { ArrowLeft, ArrowRight, Calendar, Clock, Headphones, Rss } from "lucide-react";
import { PodcastPlayer } from "@/features/podcast/ui/podcast-player";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import type { PublicEvidenceSource } from "@/features/source-intelligence/public";

interface PersonalBrandPodcastEpisodeProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    show: any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    episode: any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    previousEpisode: any | null;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    nextEpisode: any | null;
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

function sourceDate(value: string | null, locale: Locale) {
    if (!value) return null;
    try {
        return new Date(value).toLocaleDateString(
            locale === "en" ? "en-US" : locale === "nl" ? "nl-NL" : "ar-EG",
            { year: "numeric", month: "short", day: "numeric" },
        );
    } catch {
        return null;
    }
}

export function PersonalBrandPodcastEpisode({
    show,
    episode,
    previousEpisode,
    nextEpisode,
    locale,
}: PersonalBrandPodcastEpisodeProps) {
    const heroCover = episode.cover_art_url || show.cover_art_url || null;
    const feedHref = `/api/podcast/${show.slug}/feed.xml`;
    const publicSources = Array.isArray(episode.publicEvidenceSources)
        ? episode.publicEvidenceSources as PublicEvidenceSource[]
        : [];

    return (
        <section className="py-12 text-[var(--template-text-primary)] md:py-16">
            <div className="container mx-auto max-w-4xl px-4 md:px-6">
                <Link
                    href={localizeHref(locale, `/podcast/${show.slug}`)}
                    className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--template-text-secondary)] transition hover:gap-2 hover:text-[var(--template-text-primary)]"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {show.title}
                </Link>

                <header className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-[auto_1fr] sm:items-end">
                    <CoverArtBlock src={heroCover} alt={episode.title} />
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                            <Headphones className="h-3.5 w-3.5" />
                            <span>{show.title}</span>
                            {episode.episode_number ? (
                                <>
                                    <span aria-hidden>•</span>
                                    <span>
                                        {locale === "en" ? `Episode ${episode.episode_number}` : locale === "nl" ? `Aflevering ${episode.episode_number}` : `الحلقة ${episode.episode_number}`}
                                    </span>
                                </>
                            ) : null}
                            {episode.season_number ? (
                                <>
                                    <span aria-hidden>•</span>
                                    <span>
                                        {locale === "en" ? `Season ${episode.season_number}` : locale === "nl" ? `Seizoen ${episode.season_number}` : `الموسم ${episode.season_number}`}
                                    </span>
                                </>
                            ) : null}
                        </div>
                        <h1 className="text-balance font-bold leading-[1.05] tracking-tight text-[var(--template-text-primary)]"
                            style={{ fontSize: "clamp(2rem, 1rem + 3vw, 3.5rem)" }}>
                            {episode.title}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--template-text-secondary)]">
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <time dateTime={episode.published_at ?? undefined}>
                                    {formatDate(episode.published_at, locale)}
                                </time>
                            </span>
                            {episode.audio_duration_seconds ? (
                                <>
                                    <span aria-hidden>•</span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {formatDuration(episode.audio_duration_seconds)}
                                    </span>
                                </>
                            ) : null}
                        </div>
                        {episode.summary && (
                            <p className="max-w-xl text-balance text-base leading-relaxed text-[var(--template-text-secondary)] sm:text-lg">
                                {episode.summary}
                            </p>
                        )}
                    </div>
                </header>

                {episode.audio_url && (
                    <div className="mb-12">
                        <PodcastPlayer
                            episodeId={episode.id}
                            showSlug={show.slug}
                            episodeSlug={episode.slug}
                            audioUrl={episode.audio_url}
                            coverUrl={heroCover}
                            title={episode.title}
                            chapters={episode.chapters}
                            transcriptVttUrl={episode.transcript_vtt_url}
                            workspaceId={episode.workspace_id}
                        />
                    </div>
                )}

                {episode.description && (
                    <section className="prose mb-12 max-w-none prose-headings:tracking-tight prose-headings:text-[var(--template-text-primary)] prose-p:text-[var(--template-text-secondary)] prose-a:text-[var(--template-text-accent-strong)] prose-a:no-underline hover:prose-a:underline">
                        {episode.description.split("\n\n").filter(Boolean).map((para: string, i: number) => (
                            <p key={i}>{para}</p>
                        ))}
                    </section>
                )}

                {publicSources.length > 0 ? (
                    <section className="mb-12 rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-5 backdrop-blur-[12px]">
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--template-text-subtle)]">
                            {locale === "en" ? "Sources behind this episode" : locale === "nl" ? "Bronnen achter deze aflevering" : "المصادر خلف هذه الحلقة"}
                        </h2>
                        <div className="mt-4 grid gap-3">
                            {publicSources.map((source) => {
                                const date = sourceDate(source.publishedAt ?? source.retrievedAt, locale);
                                return (
                                    <a key={source.id} href={source.citationUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--template-border-soft)] bg-background/50 p-4 transition hover:border-[var(--template-accent)]/40">
                                        <p className="text-sm font-semibold text-[var(--template-text-primary)]">{source.title}</p>
                                        <p className="mt-1 text-xs text-[var(--template-text-secondary)]">{source.publisher ?? "Source"}{date ? ` · ${date}` : ""}</p>
                                    </a>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {/* Episode-by-episode nav */}
                {(previousEpisode || nextEpisode) && (
                    <nav className="mt-16 grid grid-cols-1 gap-4 border-t border-[var(--template-border-soft)] pt-10 sm:grid-cols-2">
                        {previousEpisode ? (
                            <Link
                                href={localizeHref(locale, `/podcast/${show.slug}/${previousEpisode.slug}`)}
                                className="group flex flex-col gap-1 rounded-xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-4 backdrop-blur-[12px] transition hover:border-[var(--template-accent)]/40"
                            >
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                                    <ArrowLeft className="h-3 w-3" /> {locale === "en" ? "Previous" : locale === "nl" ? "Vorige" : "السابق"}
                                </span>
                                <span className="line-clamp-2 text-sm font-semibold text-[var(--template-text-primary)] transition group-hover:text-[var(--template-text-accent-strong)]">
                                    {previousEpisode.title}
                                </span>
                            </Link>
                        ) : <span />}
                        {nextEpisode ? (
                            <Link
                                href={localizeHref(locale, `/podcast/${show.slug}/${nextEpisode.slug}`)}
                                className="group flex flex-col gap-1 rounded-xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-4 text-right backdrop-blur-[12px] transition hover:border-[var(--template-accent)]/40 sm:items-end"
                            >
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                                    {locale === "en" ? "Next" : locale === "nl" ? "Volgende" : "التالي"} <ArrowRight className="h-3 w-3" />
                                </span>
                                <span className="line-clamp-2 text-sm font-semibold text-[var(--template-text-primary)] transition group-hover:text-[var(--template-text-accent-strong)]">
                                    {nextEpisode.title}
                                </span>
                            </Link>
                        ) : <span />}
                    </nav>
                )}

                <div className="mt-12 flex flex-wrap items-center gap-3 text-xs text-[var(--template-text-subtle)]">
                    <a
                        href={feedHref}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] px-3 py-1.5 font-semibold text-[var(--template-text-primary)] transition hover:border-[var(--template-accent)]/40"
                    >
                        <Rss className="h-3 w-3" />
                        {locale === "en" ? "Subscribe via RSS" : locale === "nl" ? "Abonneren via RSS" : "اشترك عبر RSS"}
                    </a>
                </div>
            </div>
        </section>
    );
}

function CoverArtBlock({ src, alt }: { src: string | null; alt: string }) {
    if (!src) {
        return (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--template-accent)]/15 via-[var(--template-accent)]/5 to-transparent ring-1 ring-[var(--template-border-soft)] sm:h-64 sm:w-64">
                <Headphones className="h-10 w-10 text-[var(--template-text-accent-strong)]/60" />
            </div>
        );
    }
    return (
        <div className="relative h-56 w-56 shrink-0 overflow-hidden rounded-xl shadow-2xl shadow-[var(--template-accent)]/25 sm:h-64 sm:w-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="h-full w-full object-cover" loading="eager" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
        </div>
    );
}
