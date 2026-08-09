import Link from "next/link";
import { localizeHref } from "@/shared/lib/i18n/routing";
import { ArrowRight, Headphones, Mic } from "lucide-react";
import type { TemplateConfig, Locale } from "@/features/templates/types";

interface PersonalBrandPodcastIndexProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    shows: any[];
    config: TemplateConfig;
    locale: Locale;
}

export function PersonalBrandPodcastIndex({ shows, locale }: PersonalBrandPodcastIndexProps) {
    const featured = shows[0] ?? null;
    const rest = shows.slice(1);

    return (
        <section className="py-16 text-[var(--template-text-primary)] md:py-24">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                {/* Header */}
                <div className="mb-16 max-w-2xl">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                        {locale === "en" ? "Audio dispatches" : locale === "nl" ? "Audio dispatches" : "بثوث صوتية"}
                    </p>
                    <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-[var(--template-text-primary)] sm:text-5xl">
                        {locale === "en" ? "The Podcast" : locale === "nl" ? "De Podcast" : "البودكاست"}
                    </h1>
                    <p className="text-lg leading-relaxed text-[var(--template-text-secondary)]">
                        {locale === "en"
                            ? "Original conversations and audio essays — produced, mastered, and published from our studio."
                            : locale === "nl"
                                ? "Originele gesprekken en audio-essays — geproduceerd, gemasterd en uitgegeven vanuit onze studio."
                                : "محادثات ومقالات صوتية أصلية — يتم إنتاجها وضبطها ونشرها من استوديو الخاص بنا."}
                    </p>
                </div>

                {shows.length === 0 ? (
                    <EmptyState locale={locale} />
                ) : (
                    <div className="flex flex-col gap-12">
                        {featured && (
                            <FeaturedShow show={featured} locale={locale} />
                        )}
                        {rest.length > 0 && (
                            <div>
                                <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--template-text-subtle)]">
                                    {locale === "en" ? "More shows" : locale === "nl" ? "Meer shows" : "المزيد من العروض"}
                                </h2>
                                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                    {rest.map((show) => (
                                        <li key={show.id}>
                                            <ShowCard show={show} locale={locale} />
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

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function FeaturedShow({ show, locale }: { show: any; locale: Locale }) {
    return (
        <Link
            href={localizeHref(locale, `/podcast/${show.slug}`)}
            className="group relative grid grid-cols-1 gap-8 overflow-hidden rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-6 backdrop-blur-[12px] transition-all duration-300 hover:border-[var(--template-accent)]/40 hover:shadow-[var(--template-depth-md)] sm:p-10 lg:grid-cols-[auto_1fr]"
        >
            <div className="relative">
                <CoverArtBlock src={show.cover_art_url} alt={show.title} size="lg" />
            </div>
            <div className="flex flex-col justify-center gap-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--template-accent)]/30 [background:var(--template-accent)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--template-text-accent-strong)]" />
                    {locale === "en" ? "Featured show" : locale === "nl" ? "Uitgelicht" : "العرض المميز"}
                </span>
                <h2 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-[var(--template-text-primary)] sm:text-4xl">
                    {show.title}
                </h2>
                {show.subtitle && (
                    <p className="text-base text-[var(--template-text-secondary)] sm:text-lg">{show.subtitle}</p>
                )}
                {show.description && (
                    <p className="line-clamp-3 text-sm leading-relaxed text-[var(--template-text-secondary)]">
                        {show.description}
                    </p>
                )}
                <span className="mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--template-text-accent-strong)] transition group-hover:gap-2.5">
                    {locale === "en" ? "Open the show" : locale === "nl" ? "Open de show" : "افتح العرض"}
                    <ArrowRight className="h-4 w-4" />
                </span>
            </div>
        </Link>
    );
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function ShowCard({ show, locale }: { show: any; locale: Locale }) {
    return (
        <Link
            href={localizeHref(locale, `/podcast/${show.slug}`)}
            className="group flex h-full flex-col gap-4 rounded-2xl border border-[var(--template-border-soft)] [background:var(--template-surface-glass)] p-5 backdrop-blur-[12px] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--template-accent)]/40 hover:shadow-[var(--template-depth-md)]"
        >
            <CoverArtBlock src={show.cover_art_url} alt={show.title} size="md" className="aspect-square !h-auto w-full" />
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold leading-tight text-[var(--template-text-primary)]">{show.title}</h3>
                {show.subtitle && (
                    <p className="line-clamp-2 text-sm text-[var(--template-text-secondary)]">{show.subtitle}</p>
                )}
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--template-text-accent-strong)] transition group-hover:gap-2">
                {locale === "en" ? "Listen" : locale === "nl" ? "Luister" : "استمع"}
                <ArrowRight className="h-3 w-3" />
            </span>
        </Link>
    );
}

function EmptyState({ locale }: { locale: Locale }) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-[var(--template-border-soft)] bg-white/70 py-20 text-center">
            <Headphones className="mx-auto mb-4 h-10 w-10 text-[var(--template-text-subtle)]" />
            <h3 className="mb-2 text-lg font-semibold text-[var(--template-text-primary)]">
                {locale === "en" ? "No live shows yet" : locale === "nl" ? "Nog geen live shows" : "لا توجد عروض مباشرة بعد"}
            </h3>
            <p className="text-sm text-[var(--template-text-secondary)]">
                {locale === "en"
                    ? "The first episode will land here. Check back soon."
                    : locale === "nl"
                        ? "De eerste aflevering komt hier. Kom snel terug."
                        : "ستظهر الحلقة الأولى هنا. عُد قريبًا."}
            </p>
        </div>
    );
}

function CoverArtBlock({
    src,
    alt,
    size,
    className,
}: {
    src: string | null;
    alt: string;
    size: "sm" | "md" | "lg";
    className?: string;
}) {
    const dimensions = size === "lg"
        ? "h-64 w-64 sm:h-80 sm:w-80"
        : size === "sm"
            ? "h-16 w-16"
            : "h-40 w-40";
    const wrapperClass = `relative shrink-0 overflow-hidden rounded-xl ${dimensions} ${className ?? ""}`;
    if (!src) {
        return (
            <div className={`${wrapperClass} flex items-center justify-center bg-gradient-to-br from-[var(--template-accent)]/15 via-[var(--template-accent)]/5 to-transparent ring-1 ring-[var(--template-border-soft)]`}>
                <Mic className="h-8 w-8 text-[var(--template-text-accent-strong)]/60" />
            </div>
        );
    }
    return (
        <div className={wrapperClass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" loading="lazy" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
        </div>
    );
}
