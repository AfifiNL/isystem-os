export type BoundedJsonResult =
    | { ok: true; value: unknown }
    | { ok: false; status: 400 | 413; error: string };

export function declaredBodyExceeds(headers: Headers, maxBytes: number): boolean {
    const rawLength = headers.get("content-length");
    if (!rawLength) return false;
    const length = Number(rawLength);
    return Number.isFinite(length) && length > maxBytes;
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<BoundedJsonResult> {
    if (declaredBodyExceeds(request.headers, maxBytes)) {
        return { ok: false, status: 413, error: "Payload too large" };
    }
    let rawBody: string;
    try {
        rawBody = await request.text();
    } catch {
        return { ok: false, status: 400, error: "Invalid payload" };
    }
    if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
        return { ok: false, status: 413, error: "Payload too large" };
    }
    try {
        return { ok: true, value: JSON.parse(rawBody) };
    } catch {
        return { ok: false, status: 400, error: "Invalid payload" };
    }
}

export function inspectBoundedMetadata(
    value: unknown,
    limits: { maxDepth?: number; maxEntries?: number; maxBytes?: number } = {},
): { ok: true } | { ok: false; reason: "depth" | "entries" | "bytes" | "type" } {
    const maxDepth = limits.maxDepth ?? 4;
    const maxEntries = limits.maxEntries ?? 40;
    const maxBytes = limits.maxBytes ?? 4096;
    let entries = 0;
    let invalidType = false;

    const visit = (candidate: unknown, depth: number): boolean => {
        if (depth > maxDepth) return false;
        if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") return true;
        if (typeof candidate === "number") return Number.isFinite(candidate);
        if (Array.isArray(candidate)) {
            entries += candidate.length;
            return entries <= maxEntries && candidate.every((item) => visit(item, depth + 1));
        }
        if (typeof candidate === "object") {
            const values = Object.values(candidate as Record<string, unknown>);
            entries += values.length;
            return entries <= maxEntries && values.every((item) => visit(item, depth + 1));
        }
        invalidType = true;
        return false;
    };

    if (!visit(value, 1)) {
        return { ok: false, reason: invalidType ? "type" : entries > maxEntries ? "entries" : "depth" };
    }
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > maxBytes) {
        return { ok: false, reason: "bytes" };
    }
    return { ok: true };
}
