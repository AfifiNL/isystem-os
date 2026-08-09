import { NextResponse } from "next/server";
import { getPublishedEpisode } from "@/features/podcast/public-actions";

interface RouteContext {
    params: Promise<{ showSlug: string; episodeSlug: string }>;
}

// Podcast Index "JSON Chapters" spec:
// https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md
//
// Consumed by Podverse, Fountain, AntennaPod, etc. Apple Podcasts also picks
// up chapters via the `psc:chapters` block embedded directly in the RSS item.
export async function GET(_request: Request, { params }: RouteContext) {
    const { showSlug, episodeSlug } = await params;
    const { episode } = await getPublishedEpisode(showSlug, episodeSlug);
    if (!episode) {
        return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    }

    const chapters = (Array.isArray(episode.chapters) ? episode.chapters : [])
        .map((c) => ({
            startTime: Math.max(0, Math.floor(c.start_ms)) / 1000,
            title: c.title,
        }))
        .sort((a, b) => a.startTime - b.startTime);

    return NextResponse.json(
        {
            version: "1.2.0",
            title: episode.title,
            podcastName: episode.title,
            chapters,
        },
        {
            headers: {
                "Content-Type": "application/json+chapters; charset=utf-8",
                "Cache-Control": "public, max-age=300, s-maxage=600",
            },
        },
    );
}
