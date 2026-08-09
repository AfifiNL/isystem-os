const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;

    try {
        const url = new URL(withProtocol);
        return url.toString().replace(/\/$/, "");
    } catch {
        return null;
    }
}

export function getSiteUrl() {
    return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "")
        ?? LOCAL_SITE_URL;
}

export function getSiteHost() {
    return new URL(getSiteUrl()).hostname;
}

export function buildSiteUrl(pathname: string) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${getSiteUrl()}${normalizedPath}`;
}
