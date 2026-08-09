import { NextRequest, NextResponse } from "next/server";
import { getPublishedPosts } from "@/features/blog/actions";
import { isSupportedLocale } from "@/shared/lib/i18n/routing";

// Public, anonymous endpoint that backs the InsightsGridBlock in the page
// builder. Returns the latest published blog posts in the current locale,
// already shaped for direct rendering (no client-side post-processing of
// PostgREST joins or metadata fields). Cached at the edge for a minute so
// the builder canvas stays snappy across edits, but short enough that
// freshly published posts surface promptly on public pages.
export async function GET(req: NextRequest) {
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "6");
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 12)) : 6;
    const localeParam = req.nextUrl.searchParams.get("locale");
    const localeOverride = isSupportedLocale(localeParam) ? localeParam : undefined;

    const { data, error } = await getPublishedPosts(limit, localeOverride);
    if (error || !data) {
        return NextResponse.json({ posts: [] }, { status: 200 });
    }

    const posts = data.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        excerpt: row.excerpt ?? null,
        featuredImageUrl: row.featured_image_url ?? null,
        publishedAt: row.created_at,
        author: row.author
            ? {
                name: row.author.display_name,
                avatarUrl: row.author.avatar_url ?? null,
            }
            : null,
    }));

    return NextResponse.json(
        { posts },
        {
            headers: {
                "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
            },
        },
    );
}
