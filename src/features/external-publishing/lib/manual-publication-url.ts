const MANUAL_PUBLICATION_URL_PROTOCOLS = new Set(["http:", "https:"]);

export function parseExternalPublishingManualPublicationUrl(url: string) {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error("Manual publication URL must be a valid absolute HTTP(S) URL.");
    }

    if (!MANUAL_PUBLICATION_URL_PROTOCOLS.has(parsedUrl.protocol)) {
        throw new Error("Manual publication URL must use http or https.");
    }

    return parsedUrl.toString();
}
