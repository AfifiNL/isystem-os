const RETIRED_PUBLIC_SLUGS = new Set([
    "basic-vs-pro",
]);

function normalizePathSegment(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!normalized || normalized.includes("/")) return null;
    return normalized;
}

export function isRetiredPublicSlug(slug: string): boolean {
    return RETIRED_PUBLIC_SLUGS.has(slug.trim().replace(/^\/+/, "").replace(/\/+$/, ""));
}

export function isPublicPageLayoutNoIndex(value: unknown): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const root = "root" in value ? value.root : null;
    if (!root || typeof root !== "object" || Array.isArray(root)) return false;
    const props = "props" in root ? root.props : null;
    if (!props || typeof props !== "object" || Array.isArray(props)) return false;
    const metadata = "metadata" in props ? props.metadata : null;

    return Boolean(
        metadata
        && typeof metadata === "object"
        && !Array.isArray(metadata)
        && "noindex" in metadata
        && metadata.noindex === true,
    );
}

export function createPodcastEpisodePath(showSlug: unknown, episodeSlug: unknown): string | null {
    const show = normalizePathSegment(showSlug);
    const episode = normalizePathSegment(episodeSlug);
    if (!show || !episode) return null;
    return `/podcast/${show}/${episode}`;
}
