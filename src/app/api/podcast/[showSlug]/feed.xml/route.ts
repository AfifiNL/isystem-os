import { NextRequest, NextResponse } from "next/server";
import { getPublishedShowBySlug } from "@/features/podcast/public-actions";
import { getSiteSettings } from "@/features/templates/actions";
import { resolveMetadataBase } from "@/features/templates/metadata";

interface RouteContext {
    params: Promise<{ showSlug: string }>;
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function cdata(value: string | null | undefined): string {
    if (!value) return "";
    return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function rfc2822(date: string | null): string {
    if (!date) return new Date().toUTCString();
    try {
        return new Date(date).toUTCString();
    } catch {
        return new Date().toUTCString();
    }
}

// Podlove Simple Chapters use NPT timecodes: "h:mm:ss.SSS" or "mm:ss.SSS".
function formatPscTimecode(ms: number): string {
    const totalSeconds = Math.max(0, ms) / 1000;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const sStr = s.toFixed(3).padStart(6, "0");
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sStr}`;
    return `${m.toString().padStart(2, "0")}:${sStr}`;
}

function formatItunesDuration(seconds: number | null): string {
    if (!seconds) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
    const { showSlug } = await params;
    const { show, episodes } = await getPublishedShowBySlug(showSlug);
    if (!show) {
        return new NextResponse("Show not found", { status: 404 });
    }

    const settings = await getSiteSettings();
    const base = resolveMetadataBase(settings.siteDomain);
    const origin = base ? base.toString().replace(/\/$/, "") : `https://${settings.siteDomain}`;
    const showUrl = `${origin}/podcast/${show.slug}`;
    const feedUrl = `${origin}/api/podcast/${show.slug}/feed.xml`;

    const items = episodes.filter((ep) => ep.audio_url).map((ep) => {
        const epUrl = `${origin}/podcast/${show.slug}/${ep.slug}`;
        const audioBytes = ep.audio_byte_size ?? 0;
        const description = ep.description || ep.summary || "";
        // Chapter emission uses the Podcast Namespace 1.0 spec
        // (https://podcastindex.org/namespace/1.0#chapters). We expose chapters
        // both inline via psc:chapters (Podlove Simple Chapters, widely
        // supported by Apple Podcasts) and via a podcast:chapters URL pointing
        // at our chapters JSON endpoint (consumed by Podverse, Fountain, etc.).
        const chapters = Array.isArray(ep.chapters) ? ep.chapters : [];
        const chaptersJsonUrl = chapters.length > 0
            ? `${origin}/api/podcast/${show.slug}/${ep.slug}/chapters.json`
            : null;
        const pscChapters = chapters.length > 0
            ? `<psc:chapters version="1.2" xmlns:psc="http://podlove.org/simple-chapters">
        ${chapters.map((c) => `<psc:chapter start="${escapeXml(formatPscTimecode(c.start_ms))}" title="${escapeXml(c.title)}" />`).join("\n        ")}
      </psc:chapters>`
            : "";
        const podcastChapters = chaptersJsonUrl
            ? `<podcast:chapters url="${escapeXml(chaptersJsonUrl)}" type="application/json+chapters" />`
            : "";
        return `
    <item>
      <title>${escapeXml(ep.title)}</title>
      <link>${escapeXml(epUrl)}</link>
      <guid isPermaLink="true">${escapeXml(epUrl)}</guid>
      <pubDate>${rfc2822(ep.published_at)}</pubDate>
      <description>${cdata(description)}</description>
      <itunes:title>${escapeXml(ep.title)}</itunes:title>
      <itunes:summary>${cdata(ep.summary || description)}</itunes:summary>
      <itunes:duration>${formatItunesDuration(ep.audio_duration_seconds)}</itunes:duration>
      <itunes:episodeType>${escapeXml(ep.episode_type)}</itunes:episodeType>
      ${ep.season_number ? `<itunes:season>${ep.season_number}</itunes:season>` : ""}
      ${ep.episode_number ? `<itunes:episode>${ep.episode_number}</itunes:episode>` : ""}
      ${ep.cover_art_url ? `<itunes:image href="${escapeXml(ep.cover_art_url)}" />` : ""}
      ${podcastChapters}
      ${pscChapters}
      <enclosure url="${escapeXml(ep.audio_url!)}" length="${audioBytes}" type="${escapeXml(ep.audio_mime_type)}" />
    </item>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:psc="http://podlove.org/simple-chapters">
  <channel>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <title>${escapeXml(show.title)}</title>
    <link>${escapeXml(showUrl)}</link>
    <language>${escapeXml(show.language)}</language>
    <description>${cdata(show.description || show.subtitle || show.title)}</description>
    <lastBuildDate>${rfc2822(show.updated_at)}</lastBuildDate>
    ${show.author ? `<itunes:author>${escapeXml(show.author)}</itunes:author>` : ""}
    ${show.subtitle ? `<itunes:subtitle>${escapeXml(show.subtitle)}</itunes:subtitle>` : ""}
    <itunes:summary>${cdata(show.description || show.subtitle || show.title)}</itunes:summary>
    <itunes:explicit>${show.explicit ? "true" : "false"}</itunes:explicit>
    ${show.category ? `<itunes:category text="${escapeXml(show.category)}" />` : ""}
    ${show.cover_art_url ? `<itunes:image href="${escapeXml(show.cover_art_url)}" />` : ""}
    ${show.owner_email
        ? `<itunes:owner><itunes:name>${escapeXml(show.author || show.title)}</itunes:name><itunes:email>${escapeXml(show.owner_email)}</itunes:email></itunes:owner>`
        : ""}
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
        status: 200,
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, s-maxage=600",
        },
    });
}
