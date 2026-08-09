import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, Clock, ArrowRight } from "lucide-react";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import { normalizeMarkdownForRender } from "@/features/content-engine/lib/normalize-markdown";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import {
    ManualBlogRenderer,
    type ManualBlogSection,
    type ManualBlogTemplate,
} from "@/features/templates/pages/shared/manual-blog-renderer";
import { BlogMarkdownWithVisuals } from "@/features/content-engine/ui/blog-markdown-with-visuals";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";
import { AuthorByline } from "@/features/blog/ui/author-byline";
import { AuthorBioCard } from "@/features/blog/ui/author-bio-card";
import type { BlogAuthor } from "@/features/blog/types";
import { getBlogReadingTimeMinutes } from "@/features/blog/reading-time";
import { canonicalBlogHref } from "@/features/blog/urls";
import { PublicEvidenceBadges, PublicEvidenceDrawer } from "@/features/blog/ui/public-evidence";
import type { PublicEvidenceSource } from "@/features/source-intelligence/public";
import { FaqAccordion } from "@/features/blog/ui/faq-accordion";

const BLOG_POST_STRINGS: Record<Locale, {
    backToBlog: string;
    minRead: string;
    relatedArticles: string;
    read: string;
}> = {
    en: {
        backToBlog: "Back to Blog",
        minRead: "min read",
        relatedArticles: "Related Articles",
        read: "Read",
    },
    nl: {
        backToBlog: "Terug naar Blog",
        minRead: "min leestijd",
        relatedArticles: "Gerelateerde Artikelen",
        read: "Lees",
    },
    ar: {
        backToBlog: "العودة إلى المدونة",
        minRead: "دقائق قراءة",
        relatedArticles: "مقالات ذات صلة",
        read: "اقرأ",
    },
};

function dateLocale(locale: Locale) {
    if (locale === "ar") return "ar-AE";
    if (locale === "nl") return "nl-NL";
    return "en-US";
}

function normalizeBlogContent(content: string) {
    if (!content) {
        return "";
    }

    const trimmed = content.trim();

    const stripped = trimmed.startsWith("<")
        ? trimmed
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>\s*<p>/gi, "\n\n")
            .replace(/<\/blockquote>\s*<p>/gi, "\n\n")
            .replace(/<blockquote>\s*<p>/gi, "> ")
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n\n# $1\n\n")
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n\n## $1\n\n")
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n\n### $1\n\n")
            .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n\n#### $1\n\n")
            .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
            .replace(/<em>(.*?)<\/em>/gi, "*$1*")
            .replace(/<[^>]+>/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        : trimmed;

    return normalizeMarkdownForRender(stripped);
}

function isRichHtmlContent(content: string) {
    return content.trim().startsWith("<");
}

interface PersonalBrandBlogPostProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    post: any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    relatedPosts: any[];
    config: TemplateConfig;
    locale: Locale;
}

export function PersonalBrandBlogPost({ post, relatedPosts, config, locale }: PersonalBrandBlogPostProps) {
    const content = normalizeBlogContent(post.content_markdown || post.metadata?.generated_formats?.blog_post || "");
    const strings = BLOG_POST_STRINGS[locale] ?? BLOG_POST_STRINGS.en;
    const readTime = getBlogReadingTimeMinutes({
        content_markdown: content,
        metadata: post.metadata,
    });
    const manualBuilder = post.metadata?.manual_builder as { template?: ManualBlogTemplate; sections?: ManualBlogSection[] } | undefined;
    const visualBlocks = getVisualEnrichment(post.metadata).visual_blocks;
    const evidenceSurface = config.id === "isystem-agency" ? "light" : "dark";

    return (
        <article className="-mt-16 pt-32 md:pt-40 pb-12 md:pb-20 [background:var(--template-surface-inverse)] text-[var(--template-text-inverse)]">
            <div className="container mx-auto max-w-4xl px-4 md:px-6">
                {/* Back Button */}
                <Link
                    href={canonicalBlogHref(locale, "/blog")}
                    className="inline-flex items-center gap-2 text-sm text-[var(--template-text-inverse-muted)] hover:text-[var(--template-text-inverse)] transition-colors mb-8 group"
                >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                    {strings.backToBlog}
                </Link>

                {/* Header */}
                <header className="mb-10">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight text-[var(--template-text-inverse)] mb-6">
                        {post.title}
                    </h1>
                    {/* Author byline + meta. Byline owns the author/role/date
                        triple; the meta row stays for read-time which isn't
                        author-specific. Falls back gracefully when no author
                        profile is attached (skips the byline). */}
                    <div className="flex flex-wrap items-center gap-4">
                        {post.author ? (
                            <AuthorByline
                                author={post.author as BlogAuthor}
                                surface="inverse"
                                size="standard"
                                publishedDate={post.created_at}
                                locale={locale === "ar" ? "ar" : locale === "nl" ? "nl" : "en"}
                            />
                        ) : (
                            <span className="flex items-center gap-1.5 text-sm text-[var(--template-text-inverse-subtle)]">
                                <Calendar className="h-4 w-4" />
                                {new Date(post.created_at).toLocaleDateString(locale === "en" ? "en-US" : locale === "ar" ? "ar-AE" : "nl-NL", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 text-sm text-[var(--template-text-inverse-subtle)]">
                            <Clock className="h-4 w-4" />
                            {readTime} {strings.minRead}
                        </span>
                    </div>
                    <div className="mt-5">
                        <PublicEvidenceBadges
                            summary={post.evidenceSummary ?? null}
                            locale={locale === "nl" || locale === "ar" ? locale : "en"}
                            surface={evidenceSurface}
                        />
                    </div>
                </header>

                {/* Featured Image */}
                {post.metadata?.featured_image_url && (
                    <div className="relative mb-10 aspect-[2/1] overflow-hidden rounded-2xl border border-[var(--template-border-inverse)] bg-[var(--template-surface-soft)]">
                        <Image
                            src={post.metadata.featured_image_url}
                            alt={post.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 768px"
                            className="object-cover"
                            priority
                        />
                    </div>
                )}

                {/* Article Body */}
                {post.metadata?.source === "manual" && manualBuilder?.sections?.length ? (
                    <ManualBlogRenderer builder={manualBuilder} />
                ) : isRichHtmlContent(content) ? (
                    <RichTextRenderer content={content} className="prose-lg prose-invert text-[var(--template-text-inverse-muted)]" />
                ) : (
                    <BlogMarkdownWithVisuals
                        content={content}
                        visualBlocks={visualBlocks}
                        locale={locale}
                        imageAltFallback="Blog image"
                        imageClassName="rounded-2xl border border-[var(--template-border-inverse)] w-full shadow-sm my-8"
                        publicView={true}
                        className="prose prose-lg prose-invert max-w-none
                        prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-[var(--template-text-inverse)]
                        prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-[var(--template-border-inverse)] prose-h2:pb-2
                        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                        prose-p:leading-relaxed prose-p:text-[var(--template-text-inverse-muted)]
                        prose-a:text-[var(--template-text-accent-strong)] prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-[var(--template-text-inverse)] prose-strong:font-semibold
                        prose-em:text-[var(--template-text-inverse-muted)]
                        prose-code:bg-[var(--template-surface-inverse-raised)] prose-code:text-[var(--template-text-inverse)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
                        prose-pre:bg-[var(--template-surface-inverse-raised)] prose-pre:border prose-pre:border-[var(--template-border-inverse)] prose-pre:rounded-xl
                        prose-blockquote:border-s-[var(--template-accent)] prose-blockquote:bg-[var(--template-surface-inverse-raised)] prose-blockquote:rounded-e-xl prose-blockquote:py-1 prose-blockquote:not-italic
                        prose-blockquote:text-[var(--template-text-inverse-muted)]
                        prose-img:rounded-xl prose-img:border prose-img:border-[var(--template-border-inverse)]
                        prose-li:text-[var(--template-text-inverse-muted)]
                        prose-hr:border-[var(--template-border-inverse)]
                        prose-table:text-[var(--template-text-inverse-muted)]
                        prose-th:text-[var(--template-text-inverse)]
                    " />
                )}

                {post.metadata?.faqs && Array.isArray(post.metadata.faqs) && post.metadata.faqs.length > 0 && (
                    <FaqAccordion faqs={post.metadata.faqs as { question: string; answer: string }[]} surface="inverse" />
                )}

                <PublicEvidenceDrawer
                    sources={(post.publicEvidenceSources ?? []) as PublicEvidenceSource[]}
                    locale={locale === "nl" || locale === "ar" ? locale : "en"}
                    surface={evidenceSurface}
                />

                {/* Author bio card — surfaces the full profile after the
                    article body. Self-suppresses when the author has no bio
                    or social context, so historical posts don't render an
                    empty card. */}
                {post.author ? (
                    <AuthorBioCard
                        author={post.author as BlogAuthor}
                        surface="inverse"
                        heading={locale === "ar" ? "نبذة عن الكاتب" : locale === "nl" ? "Over de auteur" : "About the author"}
                    />
                ) : null}

                {/* Tags */}
                {post.metadata?.seo?.keywords && post.metadata.seo.keywords.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-[var(--template-border-inverse)]">
                        <div className="flex flex-wrap gap-2">
                            {post.metadata.seo.keywords.map((tag: string) => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 text-xs font-medium rounded-full border"
                                    style={{
                                        background: "color-mix(in oklch, var(--template-accent) 10%, transparent)",
                                        color: "var(--template-text-accent-strong)",
                                        borderColor: "color-mix(in oklch, var(--template-accent) 25%, transparent)",
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Related Posts */}
                {relatedPosts && relatedPosts.length > 0 && (
                    <div className="mt-16 pt-10 border-t border-[var(--template-border-inverse)]">
                        <h3 className="text-xl font-bold text-[var(--template-text-inverse)] mb-6">
                            {strings.relatedArticles}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {relatedPosts.map((related: any) => (
                                <Link
                                    key={related.id}
                                    href={canonicalBlogHref(locale, `/blog/${related.slug || related.id}`)}
                                    className="group p-4 rounded-xl border border-[var(--template-border-inverse)] [background:var(--template-surface-inverse-raised)] hover:border-[var(--template-accent)]/40 transition-all backdrop-blur-[8px]"
                                >
                                    <p className="text-xs text-[var(--template-text-inverse-subtle)] mb-2">
                                        {new Date(related.created_at).toLocaleDateString(dateLocale(locale), {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </p>
                                    <h4 className="font-semibold text-sm line-clamp-2 text-[var(--template-text-inverse)] group-hover:text-[var(--template-text-accent-strong)] transition-colors">
                                        {related.title}
                                    </h4>
                                    <span className="mt-2 text-xs text-[var(--template-text-accent-strong)] inline-flex items-center gap-1">
                                        {strings.read} <ArrowRight className="h-3 w-3" />
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}
