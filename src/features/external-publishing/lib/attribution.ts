import type { ExternalPublicationPlatform } from "../types";

export interface ExternalPublishingAttributionInput {
    platform: ExternalPublicationPlatform;
    campaign: string;
    content: string;
    medium?: string;
}

export function slugifyAttributionPart(value: string, fallback = "external-publishing"): string {
    const slug = value
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
    return slug || fallback;
}

export function buildExternalPublishingAttribution(input: ExternalPublishingAttributionInput) {
    return {
        utm_source: slugifyAttributionPart(input.platform, "external"),
        utm_medium: slugifyAttributionPart(input.medium ?? "external_publishing", "external_publishing").replace(/-/g, "_"),
        utm_campaign: slugifyAttributionPart(input.campaign, "campaign"),
        utm_content: slugifyAttributionPart(input.content, "package"),
    };
}

export function appendExternalPublishingUtm(url: string, input: ExternalPublishingAttributionInput): string {
    const parsed = new URL(url);
    const attribution = buildExternalPublishingAttribution(input);
    for (const [key, value] of Object.entries(attribution)) {
        parsed.searchParams.set(key, value);
    }
    return parsed.toString();
}

export function buildExternalPublishingAttributionKey(input: ExternalPublishingAttributionInput): string {
    const attribution = buildExternalPublishingAttribution(input);
    return `${attribution.utm_source}:${attribution.utm_medium}:${attribution.utm_campaign}:${attribution.utm_content}`;
}
