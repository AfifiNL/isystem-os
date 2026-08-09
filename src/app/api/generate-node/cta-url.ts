export function normalizeWorkspaceSiteUrl(siteDomain: string): string {
    const base = new URL(
        /^https?:\/\//i.test(siteDomain) ? siteDomain : `https://${siteDomain}`,
    );
    if (
        (base.protocol !== "https:" && base.protocol !== "http:")
        || !base.hostname
        || base.username
        || base.password
    ) {
        throw new Error("Invalid workspace site domain configuration.");
    }
    base.pathname = "/";
    base.search = "";
    base.hash = "";
    return base.toString();
}

export function sanitizeWorkspaceCtaUrl(value: string, siteDomain: string): string {
    const base = new URL(normalizeWorkspaceSiteUrl(siteDomain));
    const trimmed = value.trim();
    if (!trimmed || trimmed === "#") return base.toString();
    if (!trimmed.startsWith("/") && !/^https?:\/\//i.test(trimmed)) {
        return base.toString();
    }

    try {
        const candidate = new URL(trimmed, base);
        if (
            (candidate.protocol === "https:" || candidate.protocol === "http:")
            && candidate.hostname === base.hostname
            && candidate.port === base.port
            && !candidate.username
            && !candidate.password
        ) {
            candidate.protocol = base.protocol;
            return candidate.toString();
        }
    } catch {
        // Fall through to the workspace home.
    }

    // Bare words, malformed URLs, and unrelated hosts fail closed to the
    // authorized workspace home so generated copy cannot create an off-site CTA.
    return base.toString();
}
