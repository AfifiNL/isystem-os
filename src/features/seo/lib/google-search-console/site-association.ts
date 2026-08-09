export function resolveGscPropertyHost(value: string): string | null {
    const candidate = value.trim();
    if (!candidate) return null;

    if (candidate.toLowerCase().startsWith("sc-domain:")) {
        const domain = candidate.slice("sc-domain:".length).trim();
        if (!domain || /[/:?#@]/.test(domain)) return null;
        try {
            return new URL(`https://${domain}`).hostname.toLowerCase();
        } catch {
            return null;
        }
    }

    try {
        const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
        if (!/^https?:$/.test(url.protocol)) return null;
        return url.hostname.toLowerCase();
    } catch {
        return null;
    }
}

export function gscPropertyMatchesWorkspaceDomain(
    gscSiteUrl: string,
    workspaceSiteDomain: string,
): boolean {
    const gscHost = resolveGscPropertyHost(gscSiteUrl);
    const workspaceHost = resolveGscPropertyHost(workspaceSiteDomain);
    if (!gscHost || !workspaceHost) return false;

    return workspaceHost === gscHost;
}
