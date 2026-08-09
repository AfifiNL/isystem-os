import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { RichTextRenderer } from "@/features/content-engine/ui/rich-text-renderer";
import { normalizeMarkdownForRender } from "@/features/content-engine/lib/normalize-markdown";
import type { TemplateConfig, Locale } from "@/features/templates/types";
import {
    ManualBlogRenderer,
    type ManualBlogSection,
    type ManualBlogTemplate,
} from "@/features/templates/pages/shared/manual-blog-renderer";
import { BlogPostActions } from "@/features/templates/pages/shared/blog-post-actions";
import { BlogMarkdownWithVisuals } from "@/features/content-engine/ui/blog-markdown-with-visuals";
import { getVisualEnrichment } from "@/features/content-engine/visual-enrichment";
import { AuthorByline } from "@/features/blog/ui/author-byline";
import { AuthorBioCard } from "@/features/blog/ui/author-bio-card";
import type { BlogAuthor } from "@/features/blog/types";
import { canonicalBlogHref } from "@/features/blog/urls";

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

interface FacilityServicesBlogPostProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    post: any;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    relatedPosts: any[];
    config: TemplateConfig;
    locale: Locale;
}

export function FacilityServicesBlogPost({ post, relatedPosts, locale }: FacilityServicesBlogPostProps) {
    const content = normalizeBlogContent(post.content_markdown || post.metadata?.generated_formats?.blog_post || "");
    const manualBuilder = post.metadata?.manual_builder as { template?: ManualBlogTemplate; sections?: ManualBlogSection[] } | undefined;
    const visualBlocks = getVisualEnrichment(post.metadata).visual_blocks;

    return (
        <article className="min-h-screen bg-background">
            {/* Top Navigation Bar - Functional & Clean */}
            <div className="border-b border-border bg-muted/20">
                <div className="container mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground font-medium">
                        <Link href={canonicalBlogHref(locale, "/blog")}>
                            <ArrowLeft className="me-2 h-4 w-4" />
                            {locale === "en" ? "Back to News & Insights" : "Terug naar Nieuws & Inzichten"}
                        </Link>
                    </Button>
                    <BlogPostActions title={post.title} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
                {/* Header */}
                <header className="mb-12 border-b border-border/60 pb-10">
                    <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-semibold text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString(locale === "en" ? "en-US" : locale === "ar" ? "ar-AE" : "nl-NL", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                        {post.title}
                    </h1>
                    {post.author ? (
                        <div className="mt-6">
                            <AuthorByline
                                author={post.author as BlogAuthor}
                                surface="default"
                                size="standard"
                                locale={locale === "ar" ? "ar" : locale === "nl" ? "nl" : "en"}
                            />
                        </div>
                    ) : null}
                </header>

                {/* Optional Featured Image */}
                {post.metadata?.featured_image_url && (
                    <figure className="mb-12 relative aspect-[16/9] w-full overflow-hidden border border-border shadow-sm">
                        <Image
                            src={post.metadata.featured_image_url}
                            alt={post.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 768px"
                            className="object-cover"
                            priority
                        />
                    </figure>
                )}

                {/* Article Prose - Styled for readability and professionalism */}
                {post.metadata?.source === "manual" && manualBuilder?.sections?.length ? (
                    <ManualBlogRenderer builder={manualBuilder} />
                ) : isRichHtmlContent(content) ? (
                    <RichTextRenderer content={content} className="prose-lg md:prose-xl" />
                ) : (
                    <BlogMarkdownWithVisuals
                        content={content}
                        visualBlocks={visualBlocks}
                        locale={locale}
                        imageAltFallback={post.title}
                        imageClassName="border border-border shadow-sm my-10"
                        publicView={true}
                        className="prose prose-lg md:prose-xl prose-slate max-w-none
                        prose-headings:font-bold prose-headings:text-[var(--template-primary)]
                        prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:border-b prose-h2:pb-4 prose-h2:border-border/50
                        prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
                        prose-p:text-muted-foreground prose-p:leading-relaxed
                        prose-a:text-[var(--template-text-accent-strong)] prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-foreground
                        prose-ul:list-square prose-ul:text-muted-foreground
                        prose-blockquote:border-s-4 prose-blockquote:border-[var(--template-primary)] prose-blockquote:bg-[var(--template-primary)]/5 prose-blockquote:px-6 prose-blockquote:py-4 prose-blockquote:font-medium prose-blockquote:not-italic prose-blockquote:text-foreground
                    " />
                )}

                {post.author ? (
                    <AuthorBioCard
                        author={post.author as BlogAuthor}
                        surface="default"
                        heading={locale === "ar" ? "نبذة عن الكاتب" : locale === "nl" ? "Over de auteur" : "About the author"}
                    />
                ) : null}
            </div>

            {/* Related Posts Footer */}
            {relatedPosts && relatedPosts.length > 0 && (
                <div className="bg-muted/30 border-t border-border mt-12 py-16">
                    <div className="container mx-auto max-w-5xl px-4">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-bold">
                                {locale === "en" ? "More from our experts" : "Meer van onze experts"}
                            </h3>
                            <Link href={canonicalBlogHref(locale, "/blog")} className="text-sm font-semibold text-[var(--template-primary)] hover:underline inline-flex items-center gap-1">
                                {locale === "en" ? "View all" : "Bekijk alles"} <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {relatedPosts.slice(0, 2).map((related: any) => (
                                <Link
                                    key={related.id}
                                    href={canonicalBlogHref(locale, `/blog/${related.slug || related.id}`)}
                                    className="block p-6 bg-background border border-border shadow-sm hover:border-[var(--template-primary)] transition-colors group"
                                >
                                    <div className="text-sm text-muted-foreground mb-3">
                                        {new Date(related.created_at).toLocaleDateString(locale === "en" ? "en-US" : "nl-NL", {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </div>
                                    <h4 className="text-xl font-bold group-hover:text-[var(--template-primary)] transition-colors leading-tight">
                                        {related.title}
                                    </h4>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}
