export type BlogVideoShortcode =
    | {
          kind: "youtube";
          raw: string;
          id: string;
          title: string;
      }
    | {
          kind: "url";
          raw: string;
          src: string;
          title: string;
          poster?: string;
      };

export type BlogVideoShortcodeChunk =
    | { type: "markdown"; content: string }
    | { type: "video"; video: BlogVideoShortcode };

const VIDEO_SHORTCODE_PATTERN = /\{\{video:(youtube|url)\s+([^}]*)\}\}/g;

function parseAttributes(input: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const pattern = /(\w+)=((?:"[^"]*"|'[^']*')|[\s\S]+?)(?=\s+\w+=|$)/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(input.trim())) !== null) {
        attributes[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }

    return attributes;
}

export function extractYouTubeVideoId(input: string): string | null {
    const value = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "").toLowerCase();
        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0];
            return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
        }
        if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
            const embedMatch = url.pathname.match(/\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/);
            if (embedMatch?.[2]) return embedMatch[2];
            const id = url.searchParams.get("v");
            return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
        }
    } catch {
        return null;
    }

    return null;
}

function sanitizeTitle(value: string | undefined, fallback: string): string {
    return (value || fallback).replace(/[\n\r{}=]/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeHttpUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

export function createYouTubeVideoShortcode(input: { id: string; title: string }): string {
    return `{{video:youtube id=${input.id} title=${sanitizeTitle(input.title, "Embedded YouTube video")}}}`;
}

export function createUrlVideoShortcode(input: { src: string; title: string; poster?: string }): string {
    const title = sanitizeTitle(input.title, "Uploaded video");
    const poster = sanitizeHttpUrl(input.poster);
    return `{{video:url src=${input.src} title=${title}${poster ? ` poster=${poster}` : ""}}}`;
}

export function getYouTubeNoCookieEmbedUrl(id: string): string {
    return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function parseVideoShortcode(raw: string): BlogVideoShortcode | null {
    const match = raw.match(/^\{\{video:(youtube|url)\s+([^}]*)\}\}$/);
    if (!match) return null;

    const attributes = parseAttributes(match[2]);
    if (match[1] === "youtube") {
        const id = attributes.id ? extractYouTubeVideoId(attributes.id) : null;
        if (!id) return null;
        return {
            kind: "youtube",
            raw,
            id,
            title: sanitizeTitle(attributes.title, "Embedded YouTube video"),
        };
    }

    const src = sanitizeHttpUrl(attributes.src);
    if (!src) return null;
    return {
        kind: "url",
        raw,
        src,
        title: sanitizeTitle(attributes.title, "Uploaded video"),
        poster: sanitizeHttpUrl(attributes.poster),
    };
}

export function splitMarkdownByVideoShortcodes(markdown: string): BlogVideoShortcodeChunk[] {
    const chunks: BlogVideoShortcodeChunk[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const pattern = new RegExp(VIDEO_SHORTCODE_PATTERN);

    while ((match = pattern.exec(markdown)) !== null) {
        if (match.index > lastIndex) {
            chunks.push({ type: "markdown", content: markdown.slice(lastIndex, match.index) });
        }
        const video = parseVideoShortcode(match[0]);
        if (video) {
            chunks.push({ type: "video", video });
        } else {
            chunks.push({ type: "markdown", content: match[0] });
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < markdown.length) {
        chunks.push({ type: "markdown", content: markdown.slice(lastIndex) });
    }

    return chunks.filter((chunk) => chunk.type === "video" || chunk.content.trim().length > 0);
}
