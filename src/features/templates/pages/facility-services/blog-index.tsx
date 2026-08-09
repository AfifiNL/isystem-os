import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { TemplateConfig, Locale, BlogPaginationMetadata } from "@/features/templates/types";
import { AuthorByline } from "@/features/blog/ui/author-byline";
import type { BlogAuthor } from "@/features/blog/types";
import { getBlogReadingTimeMinutes } from "@/features/blog/reading-time";
import { canonicalBlogHref } from "@/features/blog/urls";

interface FacilityServicesBlogIndexProps {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    posts: any[];
    config: TemplateConfig;
    locale: Locale;
    pagination?: BlogPaginationMetadata;
}

export function FacilityServicesBlogIndex({ posts, config, locale }: FacilityServicesBlogIndexProps) {
    const { blog } = config.pages;

    return (
        <section className="py-16 md:py-24 bg-muted/30 min-h-screen">
            <div className="container mx-auto max-w-7xl px-4 md:px-8">
                {/* Header Block - Clean & Professional */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 border-b border-border/60 pb-8">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-3 mb-4 text-[var(--template-primary)] font-semibold">
                            <BookOpen className="h-5 w-5" />
                            <span className="uppercase tracking-widest text-sm">{blog.subtitle[locale]}</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-4">
                            {blog.title[locale]}
                        </h1>
                        <p className="text-xl text-muted-foreground leading-relaxed">
                            {blog.description[locale]}
                        </p>
                    </div>
                </div>

                {/* Posts Grid - Dense, functional layout */}
                {posts && posts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {posts.map((post: any) => {
                            const excerpt = post.excerpt || post.metadata?.excerpt || (post.content_markdown ? post.content_markdown.substring(0, 160).replace(/[#*\\[\\]]/g, "") + "..." : "Read article for more insights.");
                            const slug = post.slug || post.id;
                            const readTime = getBlogReadingTimeMinutes({
                                content_markdown: post.content_markdown,
                                metadata: post.metadata,
                            });

                            return (
                                <Link
                                    key={post.id}
                                    href={canonicalBlogHref(locale, `/blog/${slug}`)}
                                    className="group flex flex-col bg-background p-8 border border-border/80 shadow-sm hover:shadow-[var(--template-shadow-tint)] hover:border-[var(--template-primary)] transition-all duration-300 relative overflow-hidden"
                                >
                                    {/* Accent corner tag */}
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--template-primary)] opacity-0 group-hover:opacity-10 transition-opacity rounded-bl-[100px]" />

                                    <div className="mb-4 text-sm font-medium text-muted-foreground flex justify-between items-center">
                                        <span>
                                            {new Date(post.created_at).toLocaleDateString(locale === "en" ? "en-US" : "nl-NL", {
                                                month: "long",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                        <span className="bg-muted px-2 py-0.5 rounded text-xs">
                                            {readTime} {locale === "en" ? "min" : "min"}
                                        </span>
                                    </div>

                                    <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight group-hover:text-[var(--template-primary)] transition-colors">
                                        {post.title}
                                    </h2>

                                    <p className="text-muted-foreground line-clamp-4 leading-relaxed flex-1 mb-8">
                                        {excerpt}
                                    </p>

                                    {post.author ? (
                                        <div className="mb-5 border-t border-border pt-4">
                                            <AuthorByline
                                                author={post.author as BlogAuthor}
                                                surface="default"
                                                size="compact"
                                                locale={locale === "ar" ? "ar" : locale === "nl" ? "nl" : "en"}
                                            />
                                        </div>
                                    ) : null}

                                    <div className="mt-auto flex items-center gap-2 font-semibold text-[var(--template-primary)]">
                                        {locale === "en" ? "Read full article" : locale === "ar" ? "اقرأ المقال كاملًا" : "Lees volledig artikel"}
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-24 text-center border-t border-border">
                        <p className="text-xl text-muted-foreground">
                            {locale === "en" ? "No insights available at this time." : "Momenteel geen inzichten beschikbaar."}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
