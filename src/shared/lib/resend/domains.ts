interface ResendDomain {
    id: string;
    name: string;
    status: string;
    region?: string;
    created_at?: string;
}

interface ListDomainsResponse {
    data?: ResendDomain[];
}

/**
 * Resolves the verification status of `domain` from the Resend Domains API.
 * Returns `null` when:
 *   - RESEND_API_KEY is missing (operator hasn't wired Resend yet)
 *   - the API call fails (network or 5xx)
 *   - the domain isn't registered at Resend at all
 * Callers should treat `null` as "unknown" and show a neutral UI state rather
 * than a red banner — Resend may be down and we don't want to false-positive.
 */
export async function getResendDomainStatus(domain: string): Promise<ResendDomain | null> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey || !domain) return null;
    try {
        const res = await fetch("https://api.resend.com/domains", {
            method: "GET",
            headers: { Authorization: `Bearer ${apiKey}` },
            // Resend domain list rarely changes; cache aggressively per
            // workspace render rather than calling on every dashboard load.
            next: { revalidate: 300 },
        });
        if (!res.ok) return null;
        const payload = (await res.json()) as ListDomainsResponse;
        const match = (payload.data ?? []).find((d) => d.name?.toLowerCase() === domain.toLowerCase());
        return match ?? null;
    } catch {
        return null;
    }
}
