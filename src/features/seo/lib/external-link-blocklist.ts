// Seeded blocklist of hostnames that should not be proposed as external
// reference links. Reasons vary: low-signal content farms, SEO spam networks,
// paywalled sources users can't verify, platforms whose content drifts quickly.
//
// This is a deny-list, not an allow-list — the AI is free to propose anything
// not listed here. New entries should cite a reason in the inline comment.

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
    // Content-farm / low-signal SEO aggregators
    "ehow.com",
    "wikihow.com",
    "answers.com",

    // User-generated with no editorial oversight
    "quora.com",
    "yahoo.com",
    "reddit.com",              // sometimes useful but unsafe as an "authoritative" reference
    "medium.com",              // mixed quality; content drifts behind paywall

    // Spam-adjacent
    "pinterest.com",
    "tumblr.com",

    // Known paywall-locked without stable archival
    "wsj.com",
    "ft.com",
    "nytimes.com",
    "bloomberg.com",

    // Link shorteners / redirect services (never reference-grade)
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "buff.ly",
    "lnkd.in",

    // Forum boards that frequently rot
    "stackexchange.com",

    // Aggregators whose stability depends on user votes
    "producthunt.com",
    "hackernews.com",
]);

// Suffix-matched — blocks any subdomain of the listed base domain
const BLOCKED_DOMAIN_SUFFIXES: readonly string[] = [
    ".ehow.com",
    ".wikihow.com",
    ".quora.com",
    ".yahoo.com",
    ".reddit.com",
    ".medium.com",
    ".pinterest.com",
    ".tumblr.com",
    ".wsj.com",
    ".ft.com",
    ".nytimes.com",
    ".bloomberg.com",
    ".stackexchange.com",
];

export function isBlockedExternalHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(host)) return true;
    return BLOCKED_DOMAIN_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Returns true if the URL's hostname is on the blocklist. Invalid URLs
 * fail-closed (treated as blocked) so a malformed proposal doesn't slip past.
 */
export function isBlockedExternalUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        return isBlockedExternalHost(parsed.hostname);
    } catch {
        return true;
    }
}
