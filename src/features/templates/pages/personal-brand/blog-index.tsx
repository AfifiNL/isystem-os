import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import type { TemplateConfig, Locale, BlogPaginationMetadata } from "@/features/templates/types";
import { AuthorByline } from "@/features/blog/ui/author-byline";
import type { BlogAuthor } from "@/features/blog/types";
import { getBlogReadingTimeMinutes } from "@/features/blog/reading-time";
import { canonicalBlogHref } from "@/features/blog/urls";
import { PublicEvidenceBadges } from "@/features/blog/ui/public-evidence";

const BLOG_INDEX_STRINGS: Record<Locale, {
    excerptFallback: string;
    readArticle: string;
    noArticles: string;
    noArticlesDescription: string;
    minutesAbbrev: string;
    paginationLabel: string;
    previousPage: string;
    nextPage: string;
    pageLabel: (page: number) => string;
    pageStatus: (currentPage: number, totalPages: number, totalItems: number) => string;
}> = {
    en: {
        excerptFallback: "Read article for more insights.",
        readArticle: "Read article",
        noArticles: "No published articles yet",
        noArticlesDescription: "Check back soon for new content.",
        minutesAbbrev: "min",
        paginationLabel: "Blog pagination",
        previousPage: "Previous page",
        nextPage: "Next page",
        pageLabel: (page) => `Go to page ${page}`,
        pageStatus: (currentPage, totalPages, totalItems) => `Page ${currentPage} of ${totalPages} · ${totalItems} articles`,
    },
    nl: {
        excerptFallback: "Lees het artikel voor meer inzicht.",
        readArticle: "Lees artikel",
        noArticles: "Nog geen gepubliceerde artikelen",
        noArticlesDescription: "Kom snel terug voor nieuwe inhoud.",
        minutesAbbrev: "min",
        paginationLabel: "Blogpaginering",
        previousPage: "Vorige pagina",
        nextPage: "Volgende pagina",
        pageLabel: (page) => `Ga naar pagina ${page}`,
        pageStatus: (currentPage, totalPages, totalItems) => `Pagina ${currentPage} van ${totalPages} · ${totalItems} artikelen`,
    },
    ar: {
        excerptFallback: "اقرأ المقال لمزيد من الرؤى.",
        readArticle: "اقرأ المقال",
        noArticles: "لا توجد مقالات منشورة بعد",
        noArticlesDescription: "تحقق مرة أخرى قريبًا للاطلاع على محتوى جديد.",
        minutesAbbrev: "د",
        paginationLabel: "ترقيم صفحات المدوّنة",
        previousPage: "الصفحة السابقة",
        nextPage: "الصفحة التالية",
        pageLabel: (page) => `انتقل إلى الصفحة ${page}`,
        pageStatus: (currentPage, totalPages, totalItems) => `الصفحة ${currentPage} من ${totalPages} · ${totalItems} مقالات`,
    },
};

interface PersonalBrandBlogIndexProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    posts: any[];
    config: TemplateConfig;
    locale: Locale;
    pagination?: BlogPaginationMetadata;
}

function buildBlogPageHref(locale: Locale, page: number) {
    const baseHref = canonicalBlogHref(locale, "/blog");

    if (page <= 1) {
        return baseHref;
    }

    return `${baseHref}?page=${page}`;
}

function getVisiblePages(currentPage: number, totalPages: number) {
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function PaginationControls({ locale, pagination, strings }: {
    locale: Locale;
    pagination: BlogPaginationMetadata;
    strings: (typeof BLOG_INDEX_STRINGS)[Locale];
}) {
    if (pagination.totalPages <= 1) {
        return null;
    }

    const visiblePages = getVisiblePages(pagination.currentPage, pagination.totalPages);
    const previousPage = Math.max(1, pagination.currentPage - 1);
    const nextPage = Math.min(pagination.totalPages, pagination.currentPage + 1);

    const baseButtonClass = "inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-[var(--template-border-inverse)] px-4 text-sm font-semibold transition-all duration-200";
    const enabledClass = "text-[var(--template-text-inverse)] hover:border-[var(--template-border-accent-soft)] hover:bg-[var(--template-surface-soft)] hover:text-[var(--template-text-accent-strong)]";
    const disabledClass = "pointer-events-none opacity-40 text-[var(--template-text-inverse-subtle)]";

    return (
        <nav
            aria-label={strings.paginationLabel}
            className="mt-12 flex flex-col items-center justify-between gap-5 rounded-2xl border border-[var(--template-border-inverse)] [background:var(--template-surface-inverse-raised)] p-4 backdrop-blur-[12px] sm:flex-row"
        >
            <p className="text-sm text-[var(--template-text-inverse-muted)]">
                {strings.pageStatus(pagination.currentPage, pagination.totalPages, pagination.totalItems)}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
                <Link
                    href={buildBlogPageHref(locale, previousPage)}
                    aria-label={strings.previousPage}
                    aria-disabled={!pagination.hasPreviousPage}
                    tabIndex={pagination.hasPreviousPage ? undefined : -1}
                    className={`${baseButtonClass} ${pagination.hasPreviousPage ? enabledClass : disabledClass}`}
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{strings.previousPage}</span>
                </Link>

                {visiblePages[0] > 1 ? (
                    <>
                        <Link
                            href={buildBlogPageHref(locale, 1)}
                            aria-label={strings.pageLabel(1)}
                            className={`${baseButtonClass} ${enabledClass}`}
                        >
                            1
                        </Link>
                        <span className="px-1 text-[var(--template-text-inverse-subtle)]" aria-hidden="true">…</span>
                    </>
                ) : null}

                {visiblePages.map((page) => {
                    const isCurrent = page === pagination.currentPage;
                    return (
                        <Link
                            key={page}
                            href={buildBlogPageHref(locale, page)}
                            aria-label={strings.pageLabel(page)}
                            aria-current={isCurrent ? "page" : undefined}
                            className={`${baseButtonClass} ${isCurrent
                                ? "border-[var(--template-primary)] bg-[var(--template-primary)] text-[var(--template-primary-fg)] shadow-[var(--template-depth-sm)]"
                                : enabledClass}`}
                        >
                            {page}
                        </Link>
                    );
                })}

                {visiblePages[visiblePages.length - 1] < pagination.totalPages ? (
                    <>
                        <span className="px-1 text-[var(--template-text-inverse-subtle)]" aria-hidden="true">…</span>
                        <Link
                            href={buildBlogPageHref(locale, pagination.totalPages)}
                            aria-label={strings.pageLabel(pagination.totalPages)}
                            className={`${baseButtonClass} ${enabledClass}`}
                        >
                            {pagination.totalPages}
                        </Link>
                    </>
                ) : null}

                <Link
                    href={buildBlogPageHref(locale, nextPage)}
                    aria-label={strings.nextPage}
                    aria-disabled={!pagination.hasNextPage}
                    tabIndex={pagination.hasNextPage ? undefined : -1}
                    className={`${baseButtonClass} ${pagination.hasNextPage ? enabledClass : disabledClass}`}
                >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{strings.nextPage}</span>
                </Link>
            </div>
        </nav>
    );
}

export function PersonalBrandBlogIndex({ posts, config, locale, pagination }: PersonalBrandBlogIndexProps) {
    const { blog } = config.pages;
    const strings = BLOG_INDEX_STRINGS[locale] ?? BLOG_INDEX_STRINGS.en;
    const evidenceSurface = config.id === "isystem-agency" ? "light" : "dark";

    return (
        <section className="-mt-16 pt-32 md:pt-40 pb-16 md:pb-24 [background:var(--template-surface-inverse)] text-[var(--template-text-inverse)]">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                {/* Header */}
                <div className="mb-16 max-w-2xl">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--template-text-accent-strong)] mb-4">
                        {blog.subtitle[locale]}
                    </p>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--template-text-inverse)] leading-tight mb-5">
                        {blog.title[locale]}
                    </h1>
                    <p className="text-lg text-[var(--template-text-inverse-muted)] leading-relaxed">
                        {blog.description[locale]}
                    </p>
                </div>

                {/* Posts Grid */}
                {posts && posts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {posts.map((post: any) => {
                            const excerpt = post.excerpt || post.metadata?.excerpt || (post.content_markdown
                                ? post.content_markdown.substring(0, 140).replace(/[#*\[\]]/g, "") + "..."
                                : strings.excerptFallback);
                            const featuredImage = post.featured_image_url || post.metadata?.featured_image_url;
                            const slug = post.slug || post.id;
                            const readTime = getBlogReadingTimeMinutes({
                                content_markdown: post.content_markdown,
                                metadata: post.metadata,
                            });

                            return (
                                <Link
                                    key={post.id}
                                    href={canonicalBlogHref(locale, `/blog/${slug}`)}
                                    className="group flex flex-col rounded-2xl border border-[var(--template-border-inverse)] [background:var(--template-surface-inverse-raised)] overflow-hidden backdrop-blur-[12px] hover:border-[var(--template-accent)]/40 hover:shadow-[var(--template-depth-md)] transition-all duration-300"
                                >
                                    {/* Image */}
                                    <div className="aspect-[16/9] overflow-hidden bg-[var(--template-surface-soft)]">
                                        {featuredImage ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={featuredImage}
                                                alt={post.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-[var(--template-surface-soft)]">
                                                <span className="text-4xl opacity-20">✍️</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex flex-col flex-1 p-5">
                                        <h2 className="font-semibold text-lg text-[var(--template-text-inverse)] mb-2 line-clamp-2 group-hover:text-[var(--template-text-accent-strong)] transition-colors duration-200">
                                            {post.title}
                                        </h2>

                                        <p className="text-sm text-[var(--template-text-inverse-muted)] line-clamp-3 leading-relaxed flex-1">
                                            {excerpt}
                                        </p>

                                        <div className="mt-4">
                                            <PublicEvidenceBadges
                                                summary={post.evidenceSummary ?? null}
                                                locale={locale === "nl" || locale === "ar" ? locale : "en"}
                                                compact
                                                surface={evidenceSurface}
                                            />
                                        </div>

                                        {/* Author + meta footer. Compact byline replaces the
                                            bare date/read-time row so every card carries a face. */}
                                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--template-border-inverse)] pt-4">
                                            {post.author ? (
                                                <AuthorByline
                                                    author={post.author as BlogAuthor}
                                                    surface="inverse"
                                                    size="compact"
                                                    publishedDate={post.created_at}
                                                    locale={locale === "ar" ? "ar" : locale === "nl" ? "nl" : "en"}
                                                    className="min-w-0 flex-1"
                                                />
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-[var(--template-text-inverse-subtle)]">
                                                    {new Date(post.created_at).toLocaleDateString(locale === "en" ? "en-US" : locale === "ar" ? "ar-AE" : "nl-NL", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })}
                                                </span>
                                            )}
                                            <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--template-text-inverse-subtle)]">
                                                <Clock className="h-3 w-3" />
                                                {readTime} {strings.minutesAbbrev}
                                            </span>
                                        </div>

                                        <span className="mt-3 text-xs font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all text-[var(--template-text-accent-strong)]">
                                            {strings.readArticle} <ArrowRight className="h-3 w-3" />
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-2xl border-2 border-dashed border-[var(--template-border-inverse)] bg-[var(--template-surface-inverse-raised)] py-20 text-center">
                        <span className="text-5xl mb-4 block">📝</span>
                        <h3 className="text-lg font-semibold text-[var(--template-text-inverse)] mb-2">
                            {strings.noArticles}
                        </h3>
                        <p className="text-[var(--template-text-inverse-muted)] text-sm">
                            {strings.noArticlesDescription}
                        </p>
                    </div>
                )}

                {pagination ? (
                    <PaginationControls locale={locale} pagination={pagination} strings={strings} />
                ) : null}
            </div>
        </section>
    );
}
