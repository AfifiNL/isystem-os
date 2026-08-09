import { NextResponse } from "next/server";

import { publicMediaCacheControl } from "./cache-policy";

interface PublicMediaRouteContext {
    params: Promise<{ path: string[] }>;
}

const PASSTHROUGH_HEADERS = [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
] as const;

const INDEXABLE_IMAGE_TYPES = new Set([
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
]);

function isSafePublicObjectPath(path: string[]): boolean {
    return path.length >= 2 && path.every((segment) => (
        segment.length > 0
        && segment !== "."
        && segment !== ".."
        && !segment.includes("/")
        && !segment.includes("\\")
        && !segment.includes("\0")
    ));
}

function isIndexableMediaType(value: string | null): boolean {
    const contentType = value?.split(";", 1)[0]?.trim().toLowerCase();
    return Boolean(
        contentType
        && (contentType.startsWith("video/") || INDEXABLE_IMAGE_TYPES.has(contentType)),
    );
}

async function proxyPublicMedia(
    request: Request,
    context: PublicMediaRouteContext,
): Promise<Response> {
    const { path } = await context.params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl || !isSafePublicObjectPath(path)) {
        return NextResponse.json({ error: "Public media not found" }, { status: 404 });
    }

    let upstreamUrl: URL;
    try {
        const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
        upstreamUrl = new URL(`/storage/v1/object/public/${encodedPath}`, supabaseUrl);
        const requestedUrl = new URL(request.url);
        const version = requestedUrl.searchParams.get("v") ?? requestedUrl.searchParams.get("version");
        if (version && /^[0-9a-f]{12,}$/i.test(version)) upstreamUrl.searchParams.set("v", version);
    } catch {
        return NextResponse.json({ error: "Public media not found" }, { status: 404 });
    }

    const upstreamHeaders = new Headers();
    const range = request.headers.get("range");
    if (range) upstreamHeaders.set("range", range);

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, {
            method: request.method,
            headers: upstreamHeaders,
            cache: "no-store",
            redirect: "follow",
            signal: request.signal,
        });
    } catch {
        return NextResponse.json(
            { error: "Public media is temporarily unavailable" },
            {
                status: 502,
                headers: { "X-Robots-Tag": "noindex" },
            },
        );
    }

    if (upstream.ok && !isIndexableMediaType(upstream.headers.get("content-type"))) {
        await upstream.body?.cancel();
        return NextResponse.json(
            { error: "Unsupported public media type" },
            {
                status: 415,
                headers: { "X-Robots-Tag": "noindex" },
            },
        );
    }

    const headers = new Headers();
    PASSTHROUGH_HEADERS.forEach((name) => {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    });
    const requestedUrl = new URL(request.url);
    const version = requestedUrl.searchParams.get("v") ?? requestedUrl.searchParams.get("version");
    headers.set("Cache-Control", publicMediaCacheControl({ status: upstream.status, path, version }));
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Robots-Tag", upstream.ok ? "index, follow" : "noindex");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
    });
}

export async function GET(request: Request, context: PublicMediaRouteContext) {
    return proxyPublicMedia(request, context);
}

export async function HEAD(request: Request, context: PublicMediaRouteContext) {
    return proxyPublicMedia(request, context);
}
