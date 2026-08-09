const TAVILY_BASE_URL = "https://api.tavily.com";

function getApiKey(): string {
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error("TAVILY_API_KEY is not set");
    return key;
}

export interface TavilySearchParams {
    query: string;
    search_depth?: "basic" | "advanced";
    topic?: "general" | "news" | "finance";
    time_range?: "day" | "week" | "month" | "year" | "d" | "w" | "m" | "y";
    include_domains?: string[];
    exclude_domains?: string[];
    max_results?: number;
    include_raw_content?: boolean;
    include_answer?: boolean;
    /**
     * Tavily country bias. Lowercase country name, e.g. "netherlands",
     * "united arab emirates". Boosts results from that country / language
     * region; pass undefined for global (English-skewed) results.
     * See `tavilyCountryForLocale()` for the locale → country mapping
     * we use across SEO and research flows.
     */
    country?: string;
}

export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    raw_content?: string;
    score: number;
    published_date?: string;
}

export interface TavilySearchResponse {
    query: string;
    answer?: string;
    results: TavilySearchResult[];
}

export interface TavilyExtractParams {
    urls: string[];
    /** "basic" (default) fetches the rendered text; "advanced" fetches JS-heavy pages */
    extract_depth?: "basic" | "advanced";
    /** Output format for extracted content */
    format?: "markdown" | "text";
    include_images?: boolean;
    /** Optional query to steer extraction focus */
    topic?: string;
}

export interface TavilyExtractItem {
    url: string;
    raw_content: string;
    images?: string[];
}

export interface TavilyExtractResponse {
    results: TavilyExtractItem[];
    failed_results: { url: string; error: string }[];
    response_time?: number;
}

export async function tavilySearch(params: TavilySearchParams): Promise<TavilySearchResponse> {
    const response = await fetch(`${TAVILY_BASE_URL}/search`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            query: params.query,
            search_depth: params.search_depth ?? "basic",
            topic: params.topic ?? "general",
            time_range: params.time_range,
            include_domains: params.include_domains,
            exclude_domains: params.exclude_domains,
            max_results: params.max_results ?? 5,
            include_raw_content: params.include_raw_content ?? false,
            include_answer: params.include_answer ?? false,
            ...(params.country ? { country: params.country } : {}),
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Tavily search failed (${response.status}): ${body}`);
    }

    return response.json() as Promise<TavilySearchResponse>;
}

/**
 * Map our app locales to Tavily's country bias parameter.
 *
 * Tavily's index is English-skewed. Without a country bias, an `nl` or `ar`
 * source-text query gets fewer / less authoritative results than the EN
 * equivalent. The country bias boosts in-region domains and surfaces sources
 * the search would otherwise miss.
 *
 * - `en` → undefined (global, no bias — English already dominates the index)
 * - `nl` → "netherlands" (boost .nl domains, Dutch-language sources)
 * - `ar` → undefined. Arabic spans many countries, so the reusable core does
 *   not guess a market from the language alone.
 *
 * If you need a different country for a different deployment, pass `country`
 * explicitly to `tavilySearch` instead of relying on this default.
 */
export function tavilyCountryForLocale(locale: string | null | undefined): string | undefined {
    if (locale === "nl") return "netherlands";
    return undefined;
}

export async function tavilyExtract(params: TavilyExtractParams): Promise<TavilyExtractResponse> {
    const response = await fetch(`${TAVILY_BASE_URL}/extract`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
            urls: params.urls,
            extract_depth: params.extract_depth ?? "basic",
            format: params.format ?? "markdown",
            include_images: params.include_images ?? false,
            ...(params.topic ? { topic: params.topic } : {}),
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Tavily extract failed (${response.status}): ${body}`);
    }

    return response.json() as Promise<TavilyExtractResponse>;
}
