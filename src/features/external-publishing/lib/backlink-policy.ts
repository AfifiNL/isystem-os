import { getExternalPublishingPlatformAdapter } from "../platform-adapters";
import type { ExternalPublicationPlatform } from "../types";

export interface ExternalPublishingLinkCandidate {
    url: string;
    anchorText: string;
    rationale?: string | null;
    placement?: string | null;
}

export interface ExternalPublishingBacklinkPolicyInput {
    platform: ExternalPublicationPlatform;
    links: ExternalPublishingLinkCandidate[];
    siteUrl?: string | null;
    allowExternalTargetReason?: string | null;
}

export interface ExternalPublishingBacklinkPolicyResult {
    allowed: boolean;
    backlinkSafetyScore: number;
    linkCount: number;
    maxLinks: number;
    warnings: string[];
    hardFailures: string[];
}

const KEYWORD_STUFFING_PATTERN = /\b(ai automation|business automation|seo|backlinks?|best ai|automation platform)\b.*\b(ai automation|business automation|seo|backlinks?|best ai|automation platform)\b/i;
const GENERIC_ANCHOR_PATTERN = /^(click here|read more|learn more|visit website|this link|here)$/i;

function normalizeHost(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return null;
    }
}

export function isOwnedExternalPublishingUrl(url: string, siteUrl: string | null = process.env.NEXT_PUBLIC_SITE_URL ?? null): boolean {
    const linkHost = normalizeHost(url);
    const siteHost = normalizeHost(siteUrl);
    if (!linkHost || !siteHost) return false;
    return linkHost === siteHost || linkHost.endsWith(`.${siteHost}`);
}

export function validateExternalPublishingBacklinks(input: ExternalPublishingBacklinkPolicyInput): ExternalPublishingBacklinkPolicyResult {
    const adapter = getExternalPublishingPlatformAdapter(input.platform);
    const warnings: string[] = [];
    const hardFailures: string[] = [];
    const links = input.links.filter((link) => link.url.trim().length > 0);

    if (links.length > adapter.maxLinks) {
        hardFailures.push(`${adapter.label} allows at most ${adapter.maxLinks} backlink(s); received ${links.length}.`);
    }

    links.forEach((link, index) => {
        let parsed: URL;
        try {
            parsed = new URL(link.url);
        } catch {
            hardFailures.push(`Link ${index + 1} is not a valid URL.`);
            return;
        }
        if (!["http:", "https:"].includes(parsed.protocol)) {
            hardFailures.push(`Link ${index + 1} must use http or https.`);
        }
        if (!link.rationale?.trim()) {
            hardFailures.push(`Link ${index + 1} requires a usefulness rationale.`);
        }
        const anchor = link.anchorText.trim();
        if (anchor.length < 3) warnings.push(`Link ${index + 1} anchor text is too short to be useful.`);
        if (GENERIC_ANCHOR_PATTERN.test(anchor)) warnings.push(`Link ${index + 1} uses generic anchor text.`);
        if (KEYWORD_STUFFING_PATTERN.test(anchor)) hardFailures.push(`Link ${index + 1} anchor text appears keyword-stuffed.`);
        if (!isOwnedExternalPublishingUrl(link.url, input.siteUrl) && !input.allowExternalTargetReason?.trim()) {
            hardFailures.push(`Link ${index + 1} points outside the configured workspace host and needs an explicit reason.`);
        }
    });

    const score = Math.max(0, 100 - hardFailures.length * 25 - warnings.length * 5 - Math.max(0, links.length - 1) * 3);
    return {
        allowed: hardFailures.length === 0,
        backlinkSafetyScore: score,
        linkCount: links.length,
        maxLinks: adapter.maxLinks,
        warnings,
        hardFailures,
    };
}
