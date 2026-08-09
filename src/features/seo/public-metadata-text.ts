const SITE_SUFFIX_SEPARATORS = ["|", "—", "-", "·"] as const;

function stripMarkup(value: string): string {
    return value
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/[`*_>#~]/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeRepeatedSiteSuffix(value: string, siteName?: string): string {
    if (!siteName?.trim()) return value;

    const escapedSeparators = SITE_SUFFIX_SEPARATORS.map(escapeRegExp).join("|");
    const suffix = new RegExp(
        `\\s*(?:${escapedSeparators})\\s*${escapeRegExp(siteName.trim())}\\s*$`,
        "i",
    );
    let result = value;

    while (suffix.test(result)) {
        result = result.replace(suffix, "").trim();
    }

    return result || value;
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;

    const candidate = value.slice(0, Math.max(1, maxLength - 1));
    const lastWhitespace = candidate.lastIndexOf(" ");
    const cutAt = lastWhitespace >= Math.floor(maxLength * 0.65)
        ? lastWhitespace
        : candidate.length;
    const truncated = candidate
        .slice(0, cutAt)
        .replace(/[\s,;:–—-]+$/u, "")
        .trim();

    return truncated ? `${truncated}…` : value.slice(0, maxLength);
}

export function normalizeSeoTitle(input: {
    value?: string | null;
    fallback?: string | null;
    siteName?: string;
    maxLength?: number;
}): string {
    const source = stripMarkup(input.value || "") || stripMarkup(input.fallback || "");
    const withoutSuffix = removeRepeatedSiteSuffix(source, input.siteName);
    return truncateAtWordBoundary(withoutSuffix, input.maxLength ?? 60);
}

export function normalizeSeoDescription(input: {
    value?: string | null;
    fallback?: string | null;
    maxLength?: number;
}): string {
    const source = stripMarkup(input.value || "") || stripMarkup(input.fallback || "");
    return truncateAtWordBoundary(source, input.maxLength ?? 160);
}

export function publicTextExcerpt(value: string | null | undefined, maxLength = 160): string {
    return normalizeSeoDescription({ value, maxLength });
}
