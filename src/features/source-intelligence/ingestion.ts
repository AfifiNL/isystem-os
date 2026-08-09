import crypto from "node:crypto";
import { canonicalizeUrl } from "@/features/market-monitor/lib/monitor";
import { extractConservativeClaims } from "@/features/source-intelligence/claims";
import type { SourceDocumentRow, SourceIngestionJobRow, SourceIngestionRunReason, SourceRegistryRow } from "@/features/source-intelligence/types";
import type { Json } from "@/shared/lib/supabase/database.types";

export type SupabaseLike = ReturnType<typeof import("@/shared/lib/supabase/admin").createAdminClient>;

type ExtractedDocument = {
    canonicalUrl: string;
    title: string;
    description: string | null;
    author: string | null;
    publisher: string | null;
    publishedAt: string | null;
    bodyText: string;
    headings: string[];
    metadata: Record<string, unknown>;
};

const DEFAULT_USER_AGENT = "PublicWorkspace-SourceIntelligence/1.0";
const BLOCKED_EXTENSIONS = /\.(?:jpg|jpeg|png|gif|webp|svg|mp4|mov|avi|zip|tar|gz|css|js|woff2?|ttf|ico)(?:$|[?#])/i;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_FETCH_MAX_ATTEMPTS = 3;
const MAX_FETCH_TIMEOUT_MS = 45_000;
const MAX_RETRY_DELAY_MS = 30_000;
const HOST_TIMEOUT_OVERRIDES: Record<string, number> = {
    "mckinsey.com": 30_000,
    "www.mckinsey.com": 30_000,
};

export type SourceFetchFailureClassification = "missing" | "blocked" | "unauthorized" | "rate_limited" | "network" | "non_text" | "timeout" | "unknown";
export type SourceHealthStatus = "healthy" | "missing" | "blocked" | "unauthorized" | "rate_limited" | "degraded" | "unknown";

export type SourceFetchFailureDetails = {
    classification: SourceFetchFailureClassification;
    url: string;
    final_url: string | null;
    http_status: number | null;
    status_text: string | null;
    content_type: string | null;
    attempt: number;
    max_attempts: number;
    retriable: boolean;
    retry_after_ms: number | null;
    message: string;
};

export class SourceFetchError extends Error {
    readonly details: SourceFetchFailureDetails;

    constructor(details: SourceFetchFailureDetails) {
        super(details.message);
        this.name = "SourceFetchError";
        this.details = details;
    }
}

type IngestionFailureSummary = SourceFetchFailureDetails & {
    failed_at: string;
};

type SourceFailureHealthStatus = Exclude<SourceHealthStatus, "healthy">;

type SourceHealthUpdateInput =
    | { status: "healthy"; checkedAt: string; finalUrl?: string | null; httpStatus?: number | null; contentType?: string | null }
    | { status: SourceFailureHealthStatus; failure: IngestionFailureSummary };

export function hashContent(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonObject(value: Json | Record<string, unknown> | null | undefined): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function pathAllowed(url: string, registry: SourceRegistryRow): { ok: boolean; reason?: string } {
    if (BLOCKED_EXTENSIONS.test(url)) return { ok: false, reason: "blocked_file_extension" };
    const meta = asRecord(registry.metadata);
    const robots = asRecord(meta.robots);
    if (robots.disallow_all === true || meta.robots_disallowed === true) return { ok: false, reason: "robots_disallowed" };
    let parsed: URL;
    try { parsed = new URL(url); } catch { return { ok: false, reason: "invalid_url" }; }
    const allowlist = stringArray(meta.allowlist_paths ?? meta.allowed_paths);
    const blocked = stringArray(meta.blocked_paths ?? meta.disallow_paths);
    if (allowlist.length > 0 && !allowlist.some((path) => parsed.pathname.startsWith(path))) return { ok: false, reason: "path_not_allowlisted" };
    if (blocked.some((path) => parsed.pathname.startsWith(path))) return { ok: false, reason: "path_blocked" };
    return { ok: true };
}

async function respectCrawlDelay(registry: SourceRegistryRow) {
    const meta = asRecord(registry.metadata);
    const delaySeconds = Number(meta.crawl_delay_seconds ?? asRecord(meta.robots).crawl_delay_seconds ?? 0);
    if (Number.isFinite(delaySeconds) && delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 10) * 1000));
    }
}

function fetchTimeoutMs(registry: SourceRegistryRow): number {
    const meta = asRecord(registry.metadata);
    const configured = Number(meta.fetch_timeout_ms ?? meta.source_fetch_timeout_ms ?? DEFAULT_FETCH_TIMEOUT_MS);
    if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_FETCH_TIMEOUT_MS;
    return Math.min(Math.max(1_000, configured), MAX_FETCH_TIMEOUT_MS);
}

function hostAwareFetchTimeoutMs(registry: SourceRegistryRow, url: string): number {
    const configured = fetchTimeoutMs(registry);
    let host: string | null = null;
    try {
        host = new URL(url).host.toLowerCase();
    } catch {
        return configured;
    }

    return Math.min(Math.max(configured, HOST_TIMEOUT_OVERRIDES[host] ?? configured), MAX_FETCH_TIMEOUT_MS);
}

function fetchMaxAttempts(registry: SourceRegistryRow): number {
    const meta = asRecord(registry.metadata);
    const configured = Number(meta.fetch_max_attempts ?? meta.source_fetch_max_attempts ?? DEFAULT_FETCH_MAX_ATTEMPTS);
    if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_FETCH_MAX_ATTEMPTS;
    return Math.min(Math.max(1, Math.floor(configured)), 5);
}

export function classifySourceFetchFailure(input: { status?: number | null; contentType?: string | null; errorName?: string | null; message?: string | null }): SourceFetchFailureClassification {
    const status = input.status ?? null;
    if (status === 401 || status === 407) return "unauthorized";
    if (status === 403 || status === 451) return "blocked";
    if (status === 404 || status === 410) return "missing";
    if (status === 429) return "rate_limited";
    if (input.errorName === "AbortError" || /timeout|aborted/i.test(input.message ?? "")) return "timeout";
    if (/fetch failed|network|econnreset|enotfound|etimedout|eai_again|socket|tls|dns/i.test(input.message ?? "")) return "network";
    if (input.contentType && !isTextualContentType(input.contentType)) return "non_text";
    return "unknown";
}

function isTransientHttpStatus(status: number | null): boolean {
    return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetriableFailure(details: Pick<SourceFetchFailureDetails, "classification" | "http_status">): boolean {
    if (details.classification === "network" || details.classification === "timeout" || details.classification === "rate_limited") return true;
    return isTransientHttpStatus(details.http_status);
}

function retryAfterMs(response: Response | null, attempt: number): number {
    const raw = response?.headers.get("retry-after")?.trim();
    if (raw) {
        const asSeconds = Number(raw);
        if (Number.isFinite(asSeconds) && asSeconds >= 0) return Math.min(asSeconds * 1000, MAX_RETRY_DELAY_MS);
        const asDate = Date.parse(raw);
        if (Number.isFinite(asDate)) return Math.min(Math.max(0, asDate - Date.now()), MAX_RETRY_DELAY_MS);
    }
    return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), MAX_RETRY_DELAY_MS);
}

function isTextualContentType(contentType: string | null): boolean {
    if (!contentType) return true;
    if (/^(text\/|application\/(?:json|ld\+json|xml|rss\+xml|atom\+xml|xhtml\+xml)|.+\+xml\b)/i.test(contentType)) return true;
    return /\b(html|xml|rss|atom|json)\b/i.test(contentType);
}

function sourceFetchDetails(input: {
    url: string;
    finalUrl?: string | null;
    status?: number | null;
    statusText?: string | null;
    contentType?: string | null;
    attempt: number;
    maxAttempts: number;
    retryAfter?: number | null;
    message?: string | null;
    errorName?: string | null;
}): SourceFetchFailureDetails {
    const classification = classifySourceFetchFailure({ status: input.status ?? null, contentType: input.contentType ?? null, errorName: input.errorName ?? null, message: input.message ?? null });
    const partial = { classification, http_status: input.status ?? null };
    const retryAfter = input.retryAfter ?? null;
    const retriable = isRetriableFailure(partial) && input.attempt < input.maxAttempts;
    const statusLabel = input.status ? `HTTP ${input.status}${input.statusText ? ` ${input.statusText}` : ""}` : classification;
    return {
        classification,
        url: input.url,
        final_url: input.finalUrl ?? null,
        http_status: input.status ?? null,
        status_text: input.statusText ?? null,
        content_type: input.contentType ?? null,
        attempt: input.attempt,
        max_attempts: input.maxAttempts,
        retriable,
        retry_after_ms: retriable ? retryAfter : null,
        message: input.message ?? `Source fetch failed (${statusLabel}, ${classification})`,
    };
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function serializeSourceFetchFailure(error: unknown): SourceFetchFailureDetails | null {
    if (error instanceof SourceFetchError) return error.details;
    return null;
}

function sourceHealthStatusForFailure(classification: SourceFetchFailureClassification): SourceFailureHealthStatus {
    if (classification === "missing") return "missing";
    if (classification === "blocked" || classification === "unauthorized" || classification === "non_text") return "blocked";
    if (classification === "rate_limited") return "rate_limited";
    if (classification === "network" || classification === "timeout") return "degraded";
    return "unknown";
}

function nextRetryAfterFailure(classification: SourceFetchFailureClassification): string {
    const hours = classification === "rate_limited" ? 24
        : classification === "network" || classification === "timeout" ? 6
            : classification === "unknown" ? 12
                : 72;
    return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function mergeSourceHealthMetadata(registry: SourceRegistryRow, input: SourceHealthUpdateInput) {
    const metadata = jsonObject(registry.metadata);
    const existingHealth = asRecord(metadata.source_health);
    if (input.status === "healthy") {
        const nextHealth = {
            ...existingHealth,
            status: "healthy",
            last_checked_at: input.checkedAt,
            last_success_at: input.checkedAt,
            last_http_status: input.httpStatus ?? null,
            last_content_type: input.contentType ?? null,
            final_url: input.finalUrl ?? null,
            failure_count: 0,
            last_error_classification: null,
            disabled_reason: null,
            next_retry_after: null,
        };
        return { ...metadata, source_health: nextHealth };
    }

    const previousFailureCount = Number(existingHealth.failure_count ?? 0);
    const failureCount = Number.isFinite(previousFailureCount) ? previousFailureCount + 1 : 1;
    const nextHealth = {
        ...existingHealth,
        status: input.status,
        last_checked_at: input.failure.failed_at,
        last_failure_at: input.failure.failed_at,
        last_http_status: input.failure.http_status,
        last_content_type: input.failure.content_type,
        final_url: input.failure.final_url,
        last_error_classification: input.failure.classification,
        last_error_message: input.failure.message,
        failure_count: failureCount,
        disabled_reason: input.failure.classification === "missing" || input.failure.classification === "blocked" || input.failure.classification === "unauthorized" || input.failure.classification === "non_text" ? input.failure.classification : null,
        next_retry_after: nextRetryAfterFailure(input.failure.classification),
    };
    return { ...metadata, source_health: nextHealth };
}

function sourceHealthColumnPatch(input: SourceHealthUpdateInput) {
    if (input.status === "healthy") {
        return {
            source_health_status: "healthy",
            last_fetch_status: input.httpStatus ?? null,
            last_fetch_error_classification: null,
            last_fetch_checked_at: input.checkedAt,
            disabled_reason: null,
        };
    }
    return {
        source_health_status: input.status,
        last_fetch_status: input.failure.http_status,
        last_fetch_error_classification: input.failure.classification,
        last_fetch_checked_at: input.failure.failed_at,
        disabled_reason: input.failure.classification === "missing" || input.failure.classification === "blocked" || input.failure.classification === "unauthorized" || input.failure.classification === "non_text" ? input.failure.classification : null,
    };
}

async function updateSourceHealth(supabase: SupabaseLike, registry: SourceRegistryRow, input: SourceHealthUpdateInput) {
    const update = { metadata: mergeSourceHealthMetadata(registry, input), ...sourceHealthColumnPatch(input) };
    const { error } = await supabase
        .from("source_registry" as never)
        .update(update as never)
        .eq("id" as never, registry.id as never);
    if (!error) return;

    if (/source_health_status|last_fetch_status|last_fetch_error_classification|last_fetch_checked_at|disabled_reason/i.test(error.message)) {
        await supabase
            .from("source_registry" as never)
            .update({ metadata: update.metadata } as never)
            .eq("id" as never, registry.id as never);
        return;
    }
    throw new Error(`Failed to update source health metadata: ${error.message}`);
}

export function sourceHealthBackoffActive(registry: SourceRegistryRow, now = new Date()): { active: boolean; reason?: string; nextRetryAfter?: string | null } {
    const health = asRecord(asRecord(registry.metadata).source_health);
    const status = typeof health.status === "string" ? health.status : null;
    const nextRetryAfter = typeof health.next_retry_after === "string" ? health.next_retry_after : null;
    if (!status || status === "healthy" || !nextRetryAfter) return { active: false };
    const nextRetryTime = Date.parse(nextRetryAfter);
    if (!Number.isFinite(nextRetryTime) || nextRetryTime <= now.getTime()) return { active: false };
    return { active: true, reason: status, nextRetryAfter };
}

export function shouldSkipSourceHealthBackoff(registry: SourceRegistryRow, reason: SourceIngestionRunReason): boolean {
    if (reason === "manual" || reason === "retry" || reason === "backfill") return true;
    const metadata = asRecord(registry.metadata);
    return metadata.disable_source_health_backoff === true;
}

function decodeEntities(value: string): string {
    return value
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function tagContent(html: string, selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    return match?.[1] ? decodeEntities(stripHtml(match[1])).trim() : null;
}

function metaContent(html: string, name: string): string | null {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
    return decodeEntities(html.match(re)?.[1] ?? "").trim() || null;
}

function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n");
}

function extractJsonLd(html: string): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim()) as unknown;
            if (Array.isArray(parsed)) out.push(...parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))));
            else if (parsed && typeof parsed === "object") out.push(parsed as Record<string, unknown>);
        } catch { /* ignore invalid publisher json */ }
    }
    return out.slice(0, 5);
}

function parseHtmlDocument(html: string, url: string, registry: SourceRegistryRow): ExtractedDocument {
    const jsonLd = extractJsonLd(html);
    const firstLd = jsonLd[0] ?? {};
    const title = metaContent(html, "og:title") ?? tagContent(html, "title") ?? registry.name;
    const description = metaContent(html, "description") ?? metaContent(html, "og:description");
    const authorValue = firstLd.author;
    const publisherValue = firstLd.publisher;
    const headings = Array.from(html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)).map((m) => decodeEntities(stripHtml(m[1])).trim()).filter(Boolean).slice(0, 30);
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const bodyText = decodeEntities(stripHtml(articleMatch?.[1] ?? html)).replace(/\n{3,}/g, "\n\n").trim();
    return {
        canonicalUrl: canonicalizeUrl(metaContent(html, "og:url") ?? url),
        title: title.slice(0, 240),
        description,
        author: typeof authorValue === "string" ? authorValue : asRecord(authorValue).name as string | null ?? metaContent(html, "author"),
        publisher: typeof publisherValue === "string" ? publisherValue : asRecord(publisherValue).name as string | null ?? registry.name,
        publishedAt: metaContent(html, "article:published_time") ?? (typeof firstLd.datePublished === "string" ? firstLd.datePublished : null),
        bodyText,
        headings,
        metadata: { og: { image: metaContent(html, "og:image"), type: metaContent(html, "og:type") }, json_ld: jsonLd },
    };
}

function parseRssItems(xml: string, baseUrl: string): string[] {
    const itemRe = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
    const urls: string[] = [];
    for (const item of xml.match(itemRe) ?? []) {
        const link = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim()
            ?? item.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1]?.trim();
        if (!link) continue;
        try { urls.push(canonicalizeUrl(new URL(decodeEntities(link), baseUrl).toString())); } catch { /* noop */ }
    }
    return Array.from(new Set(urls)).slice(0, 20);
}

export async function fetchText(url: string, registry: SourceRegistryRow): Promise<{ text: string; contentType: string | null; finalUrl: string }> {
    await respectCrawlDelay(registry);
    const maxAttempts = fetchMaxAttempts(registry);
    const timeoutMs = hostAwareFetchTimeoutMs(registry, url);
    let latestFailure: SourceFetchFailureDetails | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response | null = null;

        try {
            response = await fetch(url, {
                headers: { "user-agent": DEFAULT_USER_AGENT, accept: "text/html,application/rss+xml,application/atom+xml,application/xml,text/plain;q=0.9,*/*;q=0.5" },
                redirect: "follow",
                signal: controller.signal,
            });

            const contentType = response.headers.get("content-type");
            if (!response.ok) {
                latestFailure = sourceFetchDetails({
                    url,
                    finalUrl: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    contentType,
                    attempt,
                    maxAttempts,
                    retryAfter: retryAfterMs(response, attempt),
                    message: `Source fetch failed: HTTP ${response.status} ${response.statusText}`,
                });
            } else if (!isTextualContentType(contentType)) {
                latestFailure = sourceFetchDetails({
                    url,
                    finalUrl: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    contentType,
                    attempt,
                    maxAttempts,
                    message: `Source fetch returned non-text content type: ${contentType}`,
                });
            } else {
                return { text: await response.text(), contentType, finalUrl: response.url };
            }
        } catch (error) {
            const err = error as { name?: string; message?: string };
            latestFailure = sourceFetchDetails({
                url,
                finalUrl: response?.url ?? null,
                status: response?.status ?? null,
                statusText: response?.statusText ?? null,
                contentType: response?.headers.get("content-type") ?? null,
                attempt,
                maxAttempts,
                retryAfter: retryAfterMs(response, attempt),
                message: err.message ?? "Source fetch network failure",
                errorName: err.name ?? null,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!latestFailure.retriable) break;
        await sleep(latestFailure.retry_after_ms ?? retryAfterMs(response, attempt));
    }

    throw new SourceFetchError(latestFailure ?? sourceFetchDetails({ url, attempt: maxAttempts, maxAttempts, message: "Source fetch failed for an unknown reason" }));
}

function chunkText(text: string, headings: string[]): Array<{ heading: string | null; body: string; token_count: number; metadata: Record<string, unknown> }> {
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 80);
    const chunks: Array<{ heading: string | null; body: string; token_count: number; metadata: Record<string, unknown> }> = [];
    let current: string[] = [];
    let currentWords = 0;
    const flush = () => {
        if (!current.length) return;
        const body = current.join("\n\n").trim();
        chunks.push({ heading: headings[chunks.length] ?? null, body, token_count: body.split(/\s+/).length, metadata: { chunk_hash: hashContent(body) } });
        current = [];
        currentWords = 0;
    };
    for (const paragraph of paragraphs) {
        const words = paragraph.split(/\s+/).length;
        if (currentWords + words > 550) flush();
        current.push(paragraph);
        currentWords += words;
    }
    flush();
    return chunks.slice(0, 80);
}

async function discoverRegistryUrls(job: SourceIngestionJobRow, registry: SourceRegistryRow): Promise<string[]> {
    const requested = canonicalizeUrl(job.source_url || registry.canonical_url);
    const guard = pathAllowed(requested, registry);
    if (!guard.ok) throw new Error(`Source URL blocked by registry policy: ${guard.reason}`);
    if (registry.source_type !== "rss") return [requested];
    const fetched = await fetchText(requested, registry);
    return parseRssItems(fetched.text, fetched.finalUrl).filter((url) => pathAllowed(url, registry).ok);
}

export async function ingestSourceJob(supabase: SupabaseLike, job: SourceIngestionJobRow): Promise<{ documentId: string | null; summary: Json }> {
    const { data: registry, error: registryError } = await supabase.from("source_registry" as never).select("*" as never).eq("id" as never, job.registry_id as never).single();
    if (registryError || !registry) throw new Error(`Registry source not found: ${registryError?.message ?? job.registry_id}`);
    const source = registry as SourceRegistryRow;
    if (!source.is_active) throw new Error("Registry source is inactive");
    const backoff = shouldSkipSourceHealthBackoff(source, job.run_reason ?? "scheduled")
        ? { active: false }
        : sourceHealthBackoffActive(source);
    if (backoff.active) {
        const message = `Registry source fetch backoff active: ${backoff.reason} until ${backoff.nextRetryAfter}`;
        throw new SourceFetchError({
            classification: backoff.reason === "rate_limited" ? "rate_limited" : backoff.reason === "missing" ? "missing" : backoff.reason === "blocked" ? "blocked" : "unknown",
            url: job.source_url || source.canonical_url,
            final_url: null,
            http_status: null,
            status_text: null,
            content_type: null,
            attempt: 0,
            max_attempts: 0,
            retriable: false,
            retry_after_ms: null,
            message,
        });
    }

    let urls: string[];
    try {
        urls = await discoverRegistryUrls(job, source);
    } catch (error) {
        const fetchFailure = serializeSourceFetchFailure(error);
        if (fetchFailure) {
            const failure = { ...fetchFailure, failed_at: new Date().toISOString() };
            await updateSourceHealth(supabase, source, { status: sourceHealthStatusForFailure(fetchFailure.classification), failure });
        }
        throw error;
    }
    const processed: Array<Record<string, unknown>> = [];
    let primaryDocumentId: string | null = null;
    let latestSuccessfulFetch: { checkedAt: string; finalUrl: string | null; contentType: string | null; httpStatus: number | null } | null = null;

    for (const url of urls) {
        let fetched: { text: string; contentType: string | null; finalUrl: string };
        try {
            fetched = await fetchText(url, source);
            latestSuccessfulFetch = { checkedAt: new Date().toISOString(), finalUrl: fetched.finalUrl, contentType: fetched.contentType, httpStatus: 200 };
        } catch (error) {
            const fetchFailure = serializeSourceFetchFailure(error);
            if (fetchFailure) {
                const failure = { ...fetchFailure, failed_at: new Date().toISOString() };
                await updateSourceHealth(supabase, source, { status: sourceHealthStatusForFailure(fetchFailure.classification), failure });
                processed.push({ url, skipped: true, fetch_failure: failure });
            }
            throw error;
        }
        const isXml = /xml|rss|atom/i.test(fetched.contentType ?? "") || /^\s*</.test(fetched.text) && /<rss|<feed/i.test(fetched.text.slice(0, 500));
        if (isXml && source.source_type === "rss") continue;
        const extracted = /html/i.test(fetched.contentType ?? "") || /<html|<article|<body/i.test(fetched.text.slice(0, 1000))
            ? parseHtmlDocument(fetched.text, fetched.finalUrl, source)
            : { canonicalUrl: canonicalizeUrl(fetched.finalUrl), title: source.name, description: null, author: null, publisher: source.name, publishedAt: null, bodyText: fetched.text.replace(/\s+/g, " ").trim(), headings: [], metadata: {} };
        if (extracted.bodyText.length < 300) {
            processed.push({ url, skipped: true, reason: "body_too_short" });
            continue;
        }
        const contentHash = hashContent(extracted.bodyText);
        const { data: existing } = await supabase.from("source_documents" as never).select("id,content_hash" as never).eq("registry_id" as never, source.id as never).eq("canonical_url" as never, extracted.canonicalUrl as never).maybeSingle();
        const existingDocument = existing as { id: string; content_hash?: string } | null;
        if (existingDocument?.content_hash === contentHash) {
            const documentId = existingDocument.id;
            primaryDocumentId ||= documentId;
            processed.push({ url: extracted.canonicalUrl, document_id: documentId, unchanged: true });
            continue;
        }
        const row = {
            workspace_id: source.workspace_id,
            registry_id: source.id,
            canonical_url: extracted.canonicalUrl,
            title: extracted.title || source.name,
            description: extracted.description,
            author: extracted.author,
            publisher: extracted.publisher,
            locale: source.locale,
            quality: source.quality,
            trust_tier: source.trust_tier,
            topic_tags: source.topic_tags,
            published_at: extracted.publishedAt,
            retrieved_at: new Date().toISOString(),
            content_hash: contentHash,
            raw_text: extracted.bodyText,
            summary: extracted.bodyText.slice(0, 700),
            is_public_safe: source.is_public_safe,
            metadata: { ...extracted.metadata, ingestion: { source_url: url, content_type: fetched.contentType, headings: extracted.headings } },
        };
        const write = existingDocument?.id
            ? await supabase.from("source_documents" as never).update(row as never).eq("id" as never, existingDocument.id as never).select("*" as never).single()
            : await supabase.from("source_documents" as never).insert(row as never).select("*" as never).single();
        const { data: document, error: writeError } = write;
        if (writeError || !document) throw new Error(`Document ${existingDocument?.id ? "update" : "insert"} failed: ${writeError?.message}`);
        const doc = document as SourceDocumentRow;
        primaryDocumentId ||= doc.id;
        await supabase.from("source_chunks" as never).delete().eq("document_id" as never, doc.id as never);
        await supabase.from("source_claims" as never).delete().eq("document_id" as never, doc.id as never);
        const chunks = chunkText(extracted.bodyText, extracted.headings);
        const { data: insertedChunks, error: chunkError } = await supabase.from("source_chunks" as never).insert(chunks.map((chunk, index) => ({ workspace_id: source.workspace_id, document_id: doc.id, registry_id: source.id, chunk_index: index, ...chunk })) as never).select("id,chunk_index" as never);
        if (chunkError) throw new Error(`Chunk insert failed: ${chunkError.message}`);
        const chunkByIndex = new Map((insertedChunks as Array<{ id: string; chunk_index: number }> | null ?? []).map((chunk) => [chunk.chunk_index, chunk.id]));
        const claims = extractConservativeClaims({ document: doc, registry: source }).map((claim, index) => ({
            workspace_id: source.workspace_id,
            document_id: doc.id,
            chunk_id: chunkByIndex.get(Math.min(index, Math.max(0, chunks.length - 1))) ?? null,
            registry_id: source.id,
            claim_text: claim.claim_text,
            normalized_claim: claim.normalized_claim,
            evidence_type: claim.evidence_type,
            confidence: claim.confidence,
            quality: source.quality,
            topic_tags: source.topic_tags,
            locale: source.locale,
            published_at: doc.published_at,
            metadata: { ...claim.metadata, source_quality: source.quality, trust_tier: source.trust_tier },
        }));
        if (claims.length > 0) {
            const { error: claimError } = await supabase.from("source_claims" as never).insert(claims as never);
            if (claimError) throw new Error(`Claim insert failed: ${claimError.message}`);
        }
        processed.push({ url: extracted.canonicalUrl, document_id: doc.id, chunks: chunks.length, claims: claims.length, content_hash: contentHash });
    }

    const completedAt = new Date().toISOString();
    const registryMetadata = latestSuccessfulFetch
        ? mergeSourceHealthMetadata(source, { status: "healthy", checkedAt: latestSuccessfulFetch.checkedAt, finalUrl: latestSuccessfulFetch.finalUrl, httpStatus: latestSuccessfulFetch.httpStatus, contentType: latestSuccessfulFetch.contentType })
        : source.metadata;
    const registryUpdate = latestSuccessfulFetch
        ? {
            last_ingested_at: completedAt,
            metadata: registryMetadata,
            source_health_status: "healthy",
            last_fetch_status: latestSuccessfulFetch.httpStatus,
            last_fetch_error_classification: null,
            last_fetch_checked_at: latestSuccessfulFetch.checkedAt,
            disabled_reason: null,
        }
        : { last_ingested_at: completedAt, metadata: registryMetadata };
    const { error: registryUpdateError } = await supabase.from("source_registry" as never).update(registryUpdate as never).eq("id" as never, source.id as never);
    if (registryUpdateError && latestSuccessfulFetch && /source_health_status|last_fetch_status|last_fetch_error_classification|last_fetch_checked_at|disabled_reason/i.test(registryUpdateError.message)) {
        await supabase.from("source_registry" as never).update({ last_ingested_at: completedAt, metadata: registryMetadata } as never).eq("id" as never, source.id as never);
    } else if (registryUpdateError) {
        throw new Error(`Failed to update source registry ingestion status: ${registryUpdateError.message}`);
    }
    return { documentId: primaryDocumentId, summary: { processed, discovered: urls.length } as Json };
}
