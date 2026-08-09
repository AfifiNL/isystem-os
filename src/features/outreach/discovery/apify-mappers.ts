import { createHash } from "node:crypto";
import { normalizeOutreachEmail, outreachEmailHash } from "@/features/outreach/compliance";

export type ApifyMappedContact = {
    email: string;
    email_hash: string;
    contact_type: "role_mailbox" | "generic_business" | "named_business" | "personal" | "unknown";
    full_name: string | null;
    role_title: string | null;
    source_url: string | null;
    metadata: Record<string, unknown>;
};

export type ApifyMappedAccount = {
    name: string;
    domain: string | null;
    website_url: string | null;
    country: string | null;
    sector: string | null;
    fit_score: number;
    fit_summary: string | null;
    metadata: Record<string, unknown>;
    contacts: ApifyMappedContact[];
};

export type ApifyMappedDocument = {
    canonical_url: string;
    title: string;
    excerpt: string;
    content_hash: string;
    trust_tier?: number;
    metadata: Record<string, unknown>;
    claim_text: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstString(item: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = stringValue(item[key]);
        if (value) return value;
    }
    return null;
}

function compactText(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

export function domainFromUrl(url: string | null | undefined) {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return null;
    }
}

function companyWebsiteFromItem(item: Record<string, unknown>) {
    const websiteUrl = firstString(item, ["website", "websiteUrl", "companyWebsite", "companyUrl", "businessWebsite"]);
    if (!websiteUrl) return null;
    const domain = domainFromUrl(websiteUrl);
    if (!domain || domain === "google.com" || domain.endsWith(".google.com")) return null;
    return websiteUrl;
}

function contentHash(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

function collectStrings(value: unknown, output: string[] = []): string[] {
    if (typeof value === "string") {
        output.push(value);
        return output;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectStrings(item, output);
        return output;
    }
    if (value && typeof value === "object") {
        for (const item of Object.values(value)) collectStrings(item, output);
    }
    return output;
}

function uniqueEmails(item: Record<string, unknown>) {
    const emailishKeys = [
        "email",
        "emails",
        "companyEmail",
        "companyEmails",
        "contactEmail",
        "contactEmails",
        "websiteEmail",
        "websiteEmails",
        "businessEmail",
        "businessEmails",
        "workEmail",
        "workEmails",
        "leadsEnrichment",
        "contactDetails",
        "websiteContactDetails",
    ];
    const candidates = emailishKeys.flatMap((key) => collectStrings(item[key]));
    const embedded = collectStrings(item).flatMap((value) => value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
    return Array.from(new Set([...candidates, ...embedded].map(normalizeOutreachEmail).filter((email): email is string => Boolean(email))));
}

function contactTypeForEmail(email: string): ApifyMappedContact["contact_type"] {
    const local = email.split("@")[0] ?? "";
    if (["info", "hello", "contact", "sales", "admin", "support", "office"].includes(local)) return "generic_business";
    if (local.includes(".") || local.includes("_")) return "named_business";
    return "unknown";
}

export function mapApifyGoogleMapsItem(rawItem: unknown, source: { actorId: string; runId?: string | null; datasetId?: string | null }): ApifyMappedAccount | null {
    const item = asRecord(rawItem);
    const name = firstString(item, ["title", "name", "placeName", "businessName"]);
    if (!name) return null;

    const websiteUrl = companyWebsiteFromItem(item);
    const domain = domainFromUrl(websiteUrl);
    const phone = firstString(item, ["phone", "phoneNumber", "contactPhone", "companyPhone"]);
    const address = firstString(item, ["address", "street", "formattedAddress"]);
    const category = firstString(item, ["categoryName", "category", "mainCategory", "type"]);
    const country = firstString(item, ["countryCode", "country"]);
    const rating = numberValue(item.totalScore) ?? numberValue(item.rating);
    const reviewsCount = numberValue(item.reviewsCount) ?? numberValue(item.reviewCount);
    const summaryParts = [
        category,
        address,
        rating ? `Rating ${rating}` : null,
        reviewsCount ? `${reviewsCount} reviews` : null,
        phone ? `Phone ${phone}` : null,
    ].filter(Boolean);
    const emails = uniqueEmails(item);
    const sourceUrl = firstString(item, ["url", "placeUrl", "searchPageUrl"]) ?? websiteUrl;

    return {
        name: name.slice(0, 180),
        domain,
        website_url: websiteUrl,
        country,
        sector: category,
        fit_score: Math.max(0, Math.min(100, rating ? rating * 20 : 55)),
        fit_summary: summaryParts.join(" | ").slice(0, 1000) || null,
        metadata: {
            provider: "apify",
            apify_actor_id: source.actorId,
            apify_run_id: source.runId ?? null,
            apify_dataset_id: source.datasetId ?? null,
            google_maps_place_id: firstString(item, ["placeId", "cid", "fid"]),
            google_maps_url: sourceUrl,
            phone,
            rating,
            reviews_count: reviewsCount,
            raw_category: category,
            email_validation_status: emails.length > 0 ? "valid_email_found" : "no_valid_email",
        },
        contacts: emails.slice(0, 10).map((email) => ({
            email,
            email_hash: outreachEmailHash(email) ?? "",
            contact_type: contactTypeForEmail(email),
            full_name: null,
            role_title: null,
            source_url: sourceUrl,
            metadata: {
                provider: "apify",
                apify_actor_id: source.actorId,
                apify_run_id: source.runId ?? null,
                apify_dataset_id: source.datasetId ?? null,
                source_kind: "google_maps",
            },
        })),
    };
}

export function mapApifyWebsiteCrawlerItem(rawItem: unknown, fallbackUrl: string): ApifyMappedDocument | null {
    const item = asRecord(rawItem);
    const url = firstString(item, ["url", "loadedUrl", "canonicalUrl"]) ?? fallbackUrl;
    const metadata = asRecord(item.metadata);
    const title = firstString(item, ["title"]) ?? stringValue(metadata.title) ?? domainFromUrl(url) ?? url;
    const text = firstString(item, ["markdown", "text", "content", "rawContent", "html"]) ?? "";
    const excerpt = compactText(text).slice(0, 2000);
    if (!url || !excerpt) return null;

    return {
        canonical_url: url,
        title: title.slice(0, 240),
        excerpt,
        content_hash: contentHash(text || url),
        metadata: {
            provider: "apify",
            source_kind: "website_crawler",
            crawl_depth: item.depth ?? null,
        },
        claim_text: compactText(title || excerpt).slice(0, 280) || null,
    };
}

export function mapApifyRedditItem(rawItem: unknown, fallbackUrl: string): ApifyMappedDocument | null {
    const item = asRecord(rawItem);
    const url = firstString(item, ["url", "permalink"]) ?? fallbackUrl;
    const title = firstString(item, ["title"]);
    const text = firstString(item, ["selftext", "body", "text", "content"]) ?? "";
    const excerpt = compactText(text).slice(0, 2000);
    const upvotes = numberValue(item.upvotes) ?? numberValue(item.score) ?? 0;
    const subreddit = firstString(item, ["subreddit", "subredditName"]);

    if (!url || (!title && !excerpt)) return null;
    const finalTitle = title ?? (subreddit ? `Reddit question in r/${subreddit}` : "Reddit question");

    // Boost trust_tier for highly upvoted questions
    const trustTier = upvotes >= 50 ? 5 : upvotes >= 10 ? 4 : 3;

    return {
        canonical_url: url,
        title: finalTitle.slice(0, 240),
        excerpt,
        content_hash: contentHash(text || url),
        trust_tier: trustTier,
        metadata: {
            provider: "apify",
            source_kind: "reddit_question",
            subreddit,
            upvotes,
        },
        claim_text: compactText(finalTitle).slice(0, 280) || null,
    };
}
