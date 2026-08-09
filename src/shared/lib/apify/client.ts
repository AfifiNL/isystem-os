const APIFY_BASE_URL = "https://api.apify.com/v2";

export type ApifyRunStatus = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED-OUT" | "ABORTED" | string;

export type ApifyRun = {
    id: string;
    actId?: string;
    actorId?: string;
    status: ApifyRunStatus;
    defaultDatasetId?: string | null;
    defaultKeyValueStoreId?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
    statusMessage?: string | null;
};

export type ApifyDatasetItemsResponse<TItem = Record<string, unknown>> = {
    items: TItem[];
    total?: number;
    offset?: number;
    count?: number;
    limit?: number;
};

export type ApifyActorKind = "google_maps" | "website_crawler" | "reddit_scraper";

export type ApifyRunOptions = {
    actorId: string;
    input: Record<string, unknown>;
    maxItems?: number;
    maxTotalChargeUsd?: number;
    memoryMb?: number;
    webhookJobId?: string;
    waitForFinishSeconds?: number;
};

export type ApifyConfig = {
    enabled: boolean;
    token: string | null;
    googleMapsActorId: string;
    websiteCrawlerActorId: string;
    redditActorId: string;
    maxItemsPerRun: number | null;
    maxTotalChargeUsd: number | null;
    googleMapsMemoryMb: number | null;
    websiteCrawlerMemoryMb: number | null;
    redditMemoryMb: number | null;
    maxWebsiteCrawlsPerImport: number;
    webhookSecret: string | null;
    siteUrl: string | null;
};

function trimEnv(name: string) {
    return process.env[name]?.trim() || null;
}

function numberEnv(name: string) {
    const value = trimEnv(name);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getApifyConfig(): ApifyConfig {
    return {
        enabled: trimEnv("APIFY_ENABLED") === "1",
        token: trimEnv("APIFY_API_TOKEN"),
        googleMapsActorId: trimEnv("APIFY_GOOGLE_MAPS_ACTOR_ID") ?? "compass/crawler-google-places",
        websiteCrawlerActorId: trimEnv("APIFY_WEBSITE_CRAWLER_ACTOR_ID") ?? "apify/website-content-crawler",
        redditActorId: trimEnv("APIFY_REDDIT_ACTOR_ID") ?? "trudax/reddit-scraper-lite",
        maxItemsPerRun: numberEnv("APIFY_MAX_ITEMS_PER_RUN"),
        maxTotalChargeUsd: numberEnv("APIFY_MAX_TOTAL_CHARGE_USD"),
        googleMapsMemoryMb: numberEnv("APIFY_GOOGLE_MAPS_MEMORY_MB"),
        websiteCrawlerMemoryMb: numberEnv("APIFY_WEBSITE_CRAWLER_MEMORY_MB"),
        redditMemoryMb: numberEnv("APIFY_REDDIT_MEMORY_MB"),
        maxWebsiteCrawlsPerImport: numberEnv("APIFY_MAX_WEBSITE_CRAWLS_PER_IMPORT") ?? 5,
        webhookSecret: trimEnv("APIFY_WEBHOOK_SECRET"),
        siteUrl: trimEnv("NEXT_PUBLIC_SITE_URL")?.replace(/\/$/, "") ?? null,
    };
}

export function assertApifyConfigured(): ApifyConfig & { token: string } {
    const config = getApifyConfig();
    if (!config.enabled) throw new Error("Apify discovery is disabled. Set APIFY_ENABLED=1 to enable it.");
    if (!config.token) throw new Error("APIFY_API_TOKEN is not configured.");
    return { ...config, token: config.token };
}

function actorPath(actorId: string) {
    return encodeURIComponent(actorId.replace("/", "~"));
}

function withRunOptions(url: URL, options: Pick<ApifyRunOptions, "maxItems" | "maxTotalChargeUsd" | "memoryMb" | "webhookJobId">, config: ApifyConfig) {
    const maxItems = options.maxItems ?? config.maxItemsPerRun;
    const maxTotalChargeUsd = options.maxTotalChargeUsd ?? config.maxTotalChargeUsd;
    if (maxItems) url.searchParams.set("maxItems", String(Math.trunc(maxItems)));
    if (maxTotalChargeUsd) url.searchParams.set("maxTotalChargeUsd", String(maxTotalChargeUsd));
    if (options.memoryMb) url.searchParams.set("memory", String(Math.trunc(options.memoryMb)));

    if (options.webhookJobId && config.siteUrl && config.webhookSecret) {
        const webhooks = [{
            eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED", "ACTOR.RUN.TIMED_OUT", "ACTOR.RUN.ABORTED"],
            requestUrl: `${config.siteUrl}/api/outreach/apify/webhook?jobId=${encodeURIComponent(options.webhookJobId)}`,
            headersTemplate: JSON.stringify({ Authorization: `Bearer ${config.webhookSecret}` }),
            isAdHoc: true,
        }];
        url.searchParams.set("webhooks", Buffer.from(JSON.stringify(webhooks)).toString("base64"));
    }
}

async function apifyFetch<T>(path: string, init: RequestInit, token: string): Promise<T> {
    const response = await fetch(`${APIFY_BASE_URL}${path}`, {
        ...init,
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
            ...(init.headers ?? {}),
        },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Apify request failed (${response.status}): ${body}`);
    }

    return response.json() as Promise<T>;
}

export async function runApifyActor(options: ApifyRunOptions): Promise<ApifyRun> {
    const config = assertApifyConfigured();
    const path = `/actors/${actorPath(options.actorId)}/runs`;
    const url = new URL(`${APIFY_BASE_URL}${path}`);
    withRunOptions(url, options, config);
    if (options.waitForFinishSeconds) url.searchParams.set("waitForFinish", String(Math.min(60, Math.max(1, Math.trunc(options.waitForFinishSeconds)))));
    const payload = await apifyFetch<{ data: ApifyRun }>(
        `${path}${url.search}`,
        { method: "POST", body: JSON.stringify(options.input) },
        config.token,
    );
    return payload.data;
}

export async function getApifyRun(runId: string): Promise<ApifyRun> {
    const config = assertApifyConfigured();
    const payload = await apifyFetch<{ data: ApifyRun }>(`/actor-runs/${encodeURIComponent(runId)}`, { method: "GET" }, config.token);
    return payload.data;
}

export async function listApifyDatasetItems<TItem = Record<string, unknown>>(input: {
    datasetId: string;
    offset?: number;
    limit?: number;
}): Promise<ApifyDatasetItemsResponse<TItem>> {
    const config = assertApifyConfigured();
    const url = new URL(`${APIFY_BASE_URL}/datasets/${encodeURIComponent(input.datasetId)}/items`);
    url.searchParams.set("format", "json");
    url.searchParams.set("clean", "1");
    if (typeof input.offset === "number") url.searchParams.set("offset", String(input.offset));
    if (typeof input.limit === "number") url.searchParams.set("limit", String(input.limit));

    const response = await fetch(url, {
        headers: { authorization: `Bearer ${config.token}` },
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Apify dataset fetch failed (${response.status}): ${body}`);
    }

    const items = await response.json() as TItem[];
    const totalHeader = response.headers.get("x-apify-pagination-total");
    const offsetHeader = response.headers.get("x-apify-pagination-offset");
    const countHeader = response.headers.get("x-apify-pagination-count");
    const limitHeader = response.headers.get("x-apify-pagination-limit");
    return {
        items,
        total: totalHeader ? Number(totalHeader) : undefined,
        offset: offsetHeader ? Number(offsetHeader) : undefined,
        count: countHeader ? Number(countHeader) : items.length,
        limit: limitHeader ? Number(limitHeader) : input.limit,
    };
}
