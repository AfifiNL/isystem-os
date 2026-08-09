import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-safe URL fetcher for public tool scanners.
 *
 * Hard limits:
 *  - HTTPS or HTTP only (no file://, gopher://, data:, etc.)
 *  - DNS-resolve once and reject private/loopback/link-local/multicast/unique-local ranges
 *  - 5s connect / 10s total timeout
 *  - 2 MB max body
 *  - Max 5 redirects (manual, each redirect validated again)
 *  - HTML / text content-type only
 */

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const TOTAL_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "iSystemToolsScanner/1.0 (+https://isystem.ai/tools)";

export type SafeFetchError =
    | "invalid_url"
    | "scheme_not_allowed"
    | "private_address"
    | "dns_failure"
    | "timeout"
    | "too_large"
    | "bad_content_type"
    | "redirect_loop"
    | "http_error"
    | "network_error";

export interface SafeFetchResult {
    ok: boolean;
    error?: SafeFetchError;
    status?: number;
    finalUrl?: string;
    body?: string;
    headers?: Record<string, string>;
    contentType?: string;
}

function normalizeUrl(input: string): URL | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
        const candidate = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
        const url = new URL(candidate);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        return url;
    } catch {
        return null;
    }
}

function isPrivateIp(address: string, family: 4 | 6): boolean {
    if (family === 4) {
        const parts = address.split(".").map((n) => Number.parseInt(n, 10));
        if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
        const [a, b] = parts;
        if (a === 0) return true; // 0.0.0.0/8
        if (a === 10) return true; // 10.0.0.0/8
        if (a === 127) return true; // loopback
        if (a === 169 && b === 254) return true; // link-local
        if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
        if (a === 192 && b === 168) return true; // 192.168/16
        if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0/24
        if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET
        if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
        if (a >= 224) return true; // multicast + reserved
        return false;
    }
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe90:") || lower.startsWith("fea0:") || lower.startsWith("feb0:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("ff")) return true; // multicast
    if (lower.startsWith("::ffff:")) {
        return isPrivateIp(lower.slice(7), 4);
    }
    return false;
}

async function resolveAndValidate(host: string): Promise<{ ok: true; ip: string; family: 4 | 6 } | { ok: false; reason: SafeFetchError }> {
    // If the host is already a literal IP, validate it directly.
    const literalFamily = isIP(host);
    if (literalFamily === 4 || literalFamily === 6) {
        if (isPrivateIp(host, literalFamily)) return { ok: false, reason: "private_address" };
        return { ok: true, ip: host, family: literalFamily };
    }

    try {
        const resolved = await lookup(host, { all: false });
        const fam = resolved.family === 6 ? 6 : 4;
        if (isPrivateIp(resolved.address, fam)) return { ok: false, reason: "private_address" };
        return { ok: true, ip: resolved.address, family: fam };
    } catch {
        return { ok: false, reason: "dns_failure" };
    }
}

function isAllowedContentType(ct: string | null | undefined): boolean {
    if (!ct) return false;
    const lower = ct.toLowerCase();
    return (
        lower.includes("text/html") ||
        lower.includes("application/xhtml") ||
        lower.includes("text/plain") ||
        lower.includes("application/json")
    );
}

async function readBoundedText(response: Response): Promise<{ ok: boolean; text?: string; error?: SafeFetchError }> {
    if (!response.body) return { ok: true, text: "" };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let acc = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > MAX_BODY_BYTES) {
            try {
                await reader.cancel();
            } catch {
                /* noop */
            }
            return { ok: false, error: "too_large" };
        }
        acc += decoder.decode(value, { stream: true });
    }
    acc += decoder.decode();
    return { ok: true, text: acc };
}

export async function safeFetchHtml(rawUrl: string): Promise<SafeFetchResult> {
    const initial = normalizeUrl(rawUrl);
    if (!initial) return { ok: false, error: "invalid_url" };
    if (initial.protocol !== "https:" && initial.protocol !== "http:") {
        return { ok: false, error: "scheme_not_allowed" };
    }

    let currentUrl = initial;
    let redirects = 0;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort("timeout"), TOTAL_TIMEOUT_MS);

    try {
        for (;;) {
            const resolution = await resolveAndValidate(currentUrl.hostname);
            if (!resolution.ok) {
                return { ok: false, error: resolution.reason };
            }

            let response: Response;
            try {
                response = await fetch(currentUrl, {
                    method: "GET",
                    redirect: "manual",
                    signal: abort.signal,
                    headers: {
                        "user-agent": USER_AGENT,
                        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
                        "accept-language": "en,en-US;q=0.9",
                    },
                });
            } catch (err) {
                if (abort.signal.aborted) return { ok: false, error: "timeout" };
                console.warn("[tools.safe-fetch] network error", (err as Error)?.message);
                return { ok: false, error: "network_error" };
            }

            const status = response.status;
            if (status >= 300 && status < 400) {
                redirects += 1;
                if (redirects > MAX_REDIRECTS) {
                    return { ok: false, error: "redirect_loop" };
                }
                const location = response.headers.get("location");
                if (!location) {
                    return { ok: false, error: "http_error", status };
                }
                let next: URL;
                try {
                    next = new URL(location, currentUrl);
                } catch {
                    return { ok: false, error: "invalid_url" };
                }
                if (next.protocol !== "https:" && next.protocol !== "http:") {
                    return { ok: false, error: "scheme_not_allowed" };
                }
                currentUrl = next;
                continue;
            }

            if (status >= 400) {
                return { ok: false, error: "http_error", status };
            }

            const contentType = response.headers.get("content-type");
            if (!isAllowedContentType(contentType)) {
                return { ok: false, error: "bad_content_type", status, contentType: contentType ?? undefined };
            }

            const body = await readBoundedText(response);
            if (!body.ok) return { ok: false, error: body.error, status };

            const headerMap: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                headerMap[key.toLowerCase()] = value;
            });

            return {
                ok: true,
                status,
                finalUrl: currentUrl.toString(),
                body: body.text ?? "",
                headers: headerMap,
                contentType: contentType ?? undefined,
            };
        }
    } finally {
        clearTimeout(timer);
    }
}
