const IMMUTABLE_PUBLIC_MEDIA_CACHE = "public, max-age=31536000, immutable";
const REVALIDATING_PUBLIC_MEDIA_CACHE = "public, max-age=300, stale-while-revalidate=86400";
const CONTENT_HASH = /(?:^|[._-])[0-9a-f]{12,}(?:[._-]|$)/i;

export function publicMediaCacheControl(input: { status: number; path: readonly string[]; version?: string | null }): string {
    if (input.status < 200 || input.status >= 300) return "no-store";
    const hasStableVersion = typeof input.version === "string" && /^[0-9a-f]{12,}$/i.test(input.version);
    if (input.status === 200 && (input.path.some((segment) => CONTENT_HASH.test(segment)) || hasStableVersion)) {
        return IMMUTABLE_PUBLIC_MEDIA_CACHE;
    }
    return REVALIDATING_PUBLIC_MEDIA_CACHE;
}
