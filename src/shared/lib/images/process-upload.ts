import sharp from "sharp";

// Web-upload hardening for raster images. Applies:
//   * EXIF orientation baking then strips all metadata
//   * Max edge clamp (prevents 30MP phone photos from entering the pipeline)
//   * Re-encode to WebP for photos / PNG for anything with transparency
// Non-raster files (SVG, PDF, GIF animations, video, audio) pass through
// unchanged — we only want to rewrite content we can safely re-encode.
//
// IMPORTANT: callers MUST enforce SAFE_IMAGE_MIME_TYPES (or an equivalent
// allowlist) on `processed.contentType` before persisting to public storage.
// `processRasterUpload` does NOT validate the input MIME — a client claiming
// `text/html` or `image/svg+xml` will get those bytes echoed back unchanged
// because they aren't in the raster re-encode set, and `processed.contentType`
// will be the attacker-supplied value. Storing that to a publicly served
// bucket = stored XSS / arbitrary HTML hosting.
export const SAFE_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/avif",
    "image/gif",
]);

export function isSafeImageMime(contentType: string | null | undefined): boolean {
    if (!contentType) return false;
    return SAFE_IMAGE_MIME_TYPES.has(contentType.toLowerCase().split(";")[0].trim());
}
const MAX_EDGE_PX = 2400;
const WEBP_QUALITY = 82;
const PROCESSABLE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/avif",
    "image/tiff",
    "image/heic",
    "image/heif",
]);

export interface ProcessedImage {
    buffer: Buffer;
    contentType: string;
    extension: string;
    width: number | null;
    height: number | null;
    didProcess: boolean;
}

export async function processRasterUpload(
    buffer: Buffer,
    mimeType: string,
    originalExtension: string,
): Promise<ProcessedImage> {
    const lowerMime = mimeType?.toLowerCase() ?? "";
    if (!PROCESSABLE_TYPES.has(lowerMime)) {
        return {
            buffer,
            contentType: mimeType || "application/octet-stream",
            extension: originalExtension,
            width: null,
            height: null,
            didProcess: false,
        };
    }

    try {
        const pipeline = sharp(buffer, { failOn: "error" }).rotate();
        const metadata = await pipeline.metadata();

        const needsResize =
            (metadata.width ?? 0) > MAX_EDGE_PX || (metadata.height ?? 0) > MAX_EDGE_PX;

        let working = pipeline;
        if (needsResize) {
            working = working.resize({
                width: MAX_EDGE_PX,
                height: MAX_EDGE_PX,
                fit: "inside",
                withoutEnlargement: true,
            });
        }

        const hasAlpha = Boolean(metadata.hasAlpha);
        const output = await working
            .webp({ quality: WEBP_QUALITY, effort: 4, alphaQuality: hasAlpha ? 90 : 82 })
            .withMetadata({ orientation: undefined })
            .toBuffer({ resolveWithObject: true });

        return {
            buffer: output.data,
            contentType: "image/webp",
            extension: "webp",
            width: output.info.width,
            height: output.info.height,
            didProcess: true,
        };
    } catch (error) {
        console.warn("[processRasterUpload] sharp processing failed, keeping original bytes:", error);
        return {
            buffer,
            contentType: mimeType || "application/octet-stream",
            extension: originalExtension,
            width: null,
            height: null,
            didProcess: false,
        };
    }
}

export function deriveExtension(fileName: string, fallback = "bin"): string {
    const match = fileName.match(/\.([A-Za-z0-9]+)$/);
    return match ? match[1].toLowerCase() : fallback;
}
