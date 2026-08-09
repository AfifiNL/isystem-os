import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { ToolLocale, ToolRequestContext } from "./types";
import { getIpHash } from "./rate-limit";

function pickLocale(headerValue: string | null | undefined): ToolLocale {
    if (!headerValue) return "en";
    const first = headerValue.split(",")[0]?.trim().toLowerCase() ?? "en";
    if (first.startsWith("nl")) return "nl";
    if (first.startsWith("ar")) return "ar";
    return "en";
}

function parseUtm(referrer: string | null): Record<string, string> {
    if (!referrer) return {};
    try {
        const url = new URL(referrer);
        const utm: Record<string, string> = {};
        for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
            const value = url.searchParams.get(key);
            if (value) utm[key] = value.slice(0, 80);
        }
        return utm;
    } catch {
        return {};
    }
}

export async function getToolRequestContext(): Promise<ToolRequestContext> {
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip =
        forwardedFor ||
        h.get("x-real-ip")?.trim() ||
        h.get("cf-connecting-ip")?.trim() ||
        null;
    const userAgent = h.get("user-agent")?.trim() ?? null;
    const referrer = h.get("referer")?.trim() ?? null;
    const acceptLang = h.get("accept-language");

    return {
        ipHash: getIpHash(ip, userAgent),
        userAgentHash: userAgent ? createHash("sha256").update(userAgent).digest("hex").slice(0, 32) : null,
        userAgent,
        locale: pickLocale(acceptLang),
        referrer,
        utm: parseUtm(referrer),
    };
}
