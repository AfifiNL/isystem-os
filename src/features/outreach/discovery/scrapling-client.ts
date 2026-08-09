export interface ScraplingExtractRequest {
    url: string;
    mode?: "basic" | "contact" | "company";
    timeoutMs?: number;
}

export interface ScraplingExtractResult {
    url: string;
    title: string | null;
    text: string;
    links: string[];
    emails: string[];
    phones: string[];
    metadata: Record<string, unknown>;
}

function getScraplingConfig() {
    const baseUrl = process.env.SCRAPLING_BASE_URL?.trim();
    const apiKey = process.env.SCRAPLING_API_KEY?.trim();
    if (!baseUrl) throw new Error("SCRAPLING_BASE_URL is not configured.");
    return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 200) : [];
}

export async function extractWithScrapling(input: ScraplingExtractRequest): Promise<ScraplingExtractResult> {
    const { baseUrl, apiKey } = getScraplingConfig();
    const timeoutMs = input.timeoutMs ?? 20_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${baseUrl}/extract`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "PublicWorkspace-OutreachDiscovery/1.0",
                ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                url: input.url,
                mode: input.mode ?? "company",
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Scrapling extraction failed (${response.status}): ${body}`);
        }

        const payload = await response.json() as Record<string, unknown>;
        return {
            url: typeof payload.url === "string" ? payload.url : input.url,
            title: typeof payload.title === "string" ? payload.title : null,
            text: typeof payload.text === "string" ? payload.text.slice(0, 80_000) : "",
            links: stringArray(payload.links),
            emails: stringArray(payload.emails).map((email) => email.toLowerCase()),
            phones: stringArray(payload.phones),
            metadata: payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
                ? payload.metadata as Record<string, unknown>
                : {},
        };
    } finally {
        clearTimeout(timeout);
    }
}
