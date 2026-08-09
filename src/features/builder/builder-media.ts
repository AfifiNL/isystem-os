export function resolveBuilderVideoSource(value: string | null | undefined): string | null {
    const candidate = value?.trim();
    if (!candidate) return null;
    if (candidate.startsWith("/media/")) return candidate;

    try {
        const url = new URL(candidate);
        return url.protocol === "https:" ? url.toString() : null;
    } catch {
        return null;
    }
}
