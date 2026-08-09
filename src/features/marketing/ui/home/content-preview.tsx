import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/shared/lib/supabase/server";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { getActiveTemplate } from "@/features/templates/actions";
import type { Locale } from "@/features/templates/types";
import { pickLocaleText } from "@/shared/lib/i18n/resolve";
import { canonicalBlogHref } from "@/features/blog/urls";

interface ContentPreviewProps {
    title?: Record<Locale, string>;
    description?: Record<Locale, string>;
    cta?: Record<Locale, string>;
}

export async function ContentPreview({ title, description, cta }: ContentPreviewProps) {
    const supabase = await createClient();
    const { config, locale } = await getActiveTemplate();
    const { blog } = config.pages;

    const { data: posts } = await supabase
        .from("content_items")
        .select("id, title, slug, created_at, metadata, content_markdown")
        .eq("status", "published")
        .eq("locale", locale)
        .order("created_at", { ascending: false })
        .limit(3);

    if (!posts || posts.length === 0) {
        return null;
    }

    return (
        <section className="py-24 md:py-32">
            <div className="container mx-auto max-w-6xl px-4 md:px-6">
                <div className="flex items-end justify-between mb-12">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-[var(--template-primary)] mb-3">
                            {pickLocaleText(blog.subtitle, locale)}
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                            {pickLocaleText(title, locale) ?? pickLocaleText(blog.title, locale)}
                        </h2>
                        {description && (
                            <p className="text-lg text-muted-foreground max-w-2xl">
                                {pickLocaleText(description, locale)}
                            </p>
                        )}
                    </div>
                    <Button asChild variant="ghost" className="hidden sm:inline-flex text-[var(--template-primary)] hover:text-[var(--template-primary)] hover:brightness-110 hover:bg-black/5 dark:hover:bg-white/5">
                        <Link href={canonicalBlogHref(locale, "/blog")}>
                            {pickLocaleText(cta, locale, "View all posts")}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {posts.map((post: any) => {
                        const excerpt = post.metadata?.excerpt || post.content_markdown?.substring(0, 120).replace(/[#*_\[\]]/g, "") + "...";
                        const featuredImage = post.metadata?.featured_image_url;
                        const slug = post.slug || post.id;

                        return (
                            <Link
                                key={post.id}
                                href={canonicalBlogHref(locale, `/blog/${slug}`)}
                                className="group flex flex-col rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-[var(--template-primary)] hover:shadow-xl transition-all duration-300"
                            >
                                {/* Image */}
                                <div className="aspect-[16/9] bg-muted/50 overflow-hidden relative">
                                    {featuredImage ? (
                                        <Image
                                            src={featuredImage}
                                            alt={post.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <>
                                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `linear-gradient(to bottom right, var(--template-gradient-from), var(--template-gradient-to))` }} />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-4xl opacity-30">📝</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1 p-5">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(post.created_at).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </div>
                                    <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-[var(--template-primary)] transition-colors">
                                        {post.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                                        {excerpt}
                                    </p>
                                    <span className="mt-4 text-xs font-medium text-[var(--template-primary)] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                        Read more <ArrowRight className="h-3 w-3" />
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-8 text-center sm:hidden">
                    <Button asChild variant="outline">
                        <Link href={canonicalBlogHref(locale, "/blog")}>
                            View all posts
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
