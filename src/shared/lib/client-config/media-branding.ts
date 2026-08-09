import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { extractPublicRuntimeConfig } from "./runtime";

const MIME_TYPES: Record<string, string> = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
};
const MAX_LOGO_BYTES = 1_000_000;

export async function resolveWorkspaceBrandLogoDataUri(metadata: unknown): Promise<string | null> {
    const logoUrl = extractPublicRuntimeConfig(metadata).brand?.logo.lightUrl;
    if (!logoUrl || !logoUrl.startsWith("/") || logoUrl.includes("\0")) return null;

    const publicRoot = resolve(process.cwd(), "public");
    const filePath = resolve(publicRoot, `.${logoUrl}`);
    if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${sep}`)) return null;

    const mimeType = MIME_TYPES[extname(filePath).toLowerCase()];
    if (!mimeType) return null;

    try {
        const bytes = await readFile(filePath);
        if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
        return `data:${mimeType};base64,${bytes.toString("base64")}`;
    } catch {
        return null;
    }
}
