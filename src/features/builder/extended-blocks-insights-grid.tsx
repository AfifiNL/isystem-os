"use client";

// Client-only sub-component for the InsightsGridBlock. The rest of the
// extended-blocks registry is server-renderable; only this card grid needs
// hooks (useState/useEffect to fetch /api/insights/recent on the client),
// so isolating it here lets extended-blocks.tsx stay a server module —
// otherwise spreading its registry into puckRenderConfig.components from a
// server context yields client-reference proxies and the blocks vanish.

import { useEffect, useState } from "react";
import { Calendar, Newspaper } from "lucide-react";
import { canonicalBlogHref } from "@/features/blog/urls";
import {
    getLocaleValue,
    type LocaleField,
    type RichLocaleField,
    type SectionStyleProps,
    type SupportedLocale,
} from "@/features/builder/facility-services-page-data";

interface InsightsApiPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    featuredImageUrl: string | null;
    publishedAt: string;
    author: { name: string; avatarUrl: string | null } | null;
}

const CARD = "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md";
const CARD_HOVER = "transition-colors hover:border-cyan-400/30 hover:bg-white/[0.07]";
const SUBTLE = "text-slate-400";

function pickLocale(locale: SupportedLocale, field: LocaleField | undefined): string {
    if (!field) return "";
    return getLocaleValue(locale, field);
}

function formatLocaleDate(iso: string, locale: SupportedLocale) {
    try {
        const intlLocale = locale === "ar" ? "ar-EG" : locale === "nl" ? "nl-NL" : "en-GB";
        return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
    } catch {
        return iso;
    }
}

interface InsightsGridClientProps {
    locale: SupportedLocale;
    eyebrow: LocaleField;
    title: LocaleField;
    description: RichLocaleField;
    readMoreLabel: LocaleField;
    limit: number;
    style: SectionStyleProps;
}

/* eslint-disable @next/next/no-img-element */
export function InsightsGridClient({ locale, readMoreLabel, limit }: InsightsGridClientProps) {
    const [posts, setPosts] = useState<InsightsApiPost[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        fetch(`/api/insights/recent?limit=${limit}&locale=${encodeURIComponent(locale)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as { posts: InsightsApiPost[] };
                if (!cancelled) setPosts(json.posts ?? []);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Failed to load insights");
                setPosts([]);
            });
        return () => {
            cancelled = true;
        };
    }, [limit, locale]);

    const ctaLabel = pickLocale(locale, readMoreLabel) || "Read";

    if (posts === null) {
        return (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: limit }).map((_, idx) => (
                    <div key={idx} className={`${CARD} h-72 animate-pulse`} />
                ))}
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className={`${CARD} flex h-48 items-center justify-center`}>
                <p className={SUBTLE}>{error ? "Insights are temporarily unavailable." : "No insights published yet."}</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.slice(0, limit).map((post, idx) => {
                const isFeature = idx === 0 && posts.length >= 4;
                return (
                    <a
                        key={post.id}
                        href={canonicalBlogHref(locale, `/blog/${post.slug}`)}
                        className={`group ${CARD} ${CARD_HOVER} flex flex-col overflow-hidden ${isFeature ? "lg:col-span-2 lg:row-span-2" : ""}`}
                    >
                        <div className={`relative aspect-[16/9] w-full overflow-hidden ${isFeature ? "lg:aspect-[21/9]" : ""} bg-slate-900`}>
                            {post.featuredImageUrl ? (
                                <img
                                    src={post.featuredImageUrl}
                                    alt={post.title}
                                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-cyan-300/40">
                                    <Newspaper className="h-10 w-10" aria-hidden="true" />
                                </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/80 to-transparent" />
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-5">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                                <Calendar className="h-3 w-3" aria-hidden="true" />
                                {formatLocaleDate(post.publishedAt, locale)}
                            </div>
                            <h3 className={`${isFeature ? "text-2xl md:text-3xl" : "text-lg"} font-semibold leading-snug text-white group-hover:text-cyan-200`}>
                                {post.title}
                            </h3>
                            {post.excerpt ? (
                                <p className={`${SUBTLE} text-sm leading-relaxed line-clamp-3`}>{post.excerpt}</p>
                            ) : null}
                            <div className="mt-auto flex items-center justify-between pt-2">
                                {post.author ? (
                                    <div className="flex items-center gap-2">
                                        {post.author.avatarUrl ? (
                                            <img
                                                src={post.author.avatarUrl}
                                                alt={post.author.name}
                                                className="h-6 w-6 rounded-full object-cover"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="h-6 w-6 rounded-full bg-cyan-500/20" />
                                        )}
                                        <span className="text-xs text-slate-400">{post.author.name}</span>
                                    </div>
                                ) : <span />}
                                <span className="text-xs font-semibold text-cyan-300 group-hover:text-cyan-200">
                                    {ctaLabel} →
                                </span>
                            </div>
                        </div>
                    </a>
                );
            })}
        </div>
    );
}
