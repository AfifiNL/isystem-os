// SSRF-hardened URL validation for external link proposals.
// The model can return arbitrary URLs (including attacker-shaped internal
// network probes). This module is the only acceptable path for fetching those
// URLs — every policy check must pass before any network syscall.

import { lookup } from "node:dns/promises";

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 3_000;

// IPv4 CIDR ranges disallowed (private, loopback, link-local, multicast, reserved)
const PRIVATE_IPV4_CIDRS: Array<readonly [string, number]> = [
    ["10.0.0.0", 8],
    ["172.16.0.0", 12],
    ["192.168.0.0", 16],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["0.0.0.0", 8],
    ["100.64.0.0", 10],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["198.18.0.0", 15],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
];

function ipv4ToInt(address: string): number | null {
    const parts = address.split(".");
    if (parts.length !== 4) return null;
    let acc = 0;
    for (const part of parts) {
        const octet = Number.parseInt(part, 10);
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
        acc = (acc << 8) | octet;
    }
    return acc >>> 0;
}

function ipv4InCidr(address: string, cidr: readonly [string, number]): boolean {
    const ip = ipv4ToInt(address);
    const net = ipv4ToInt(cidr[0]);
    if (ip === null || net === null) return false;
    const mask = cidr[1] === 0 ? 0 : (~0 << (32 - cidr[1])) >>> 0;
    return (ip & mask) === (net & mask);
}

function isPrivateIpv4(address: string): boolean {
    return PRIVATE_IPV4_CIDRS.some((cidr) => ipv4InCidr(address, cidr));
}

function isPrivateIpv6(address: string): boolean {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9")
        || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 unique-local
    if (normalized.startsWith("ff")) return true; // multicast
    // IPv4-mapped IPv6 — strip prefix and re-check
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return false;
}

export type UrlValidationResult =
    | { ok: true; url: string }
    | { ok: false; reason: string };

async function assertPublicHost(hostname: string): Promise<string | null> {
    try {
        const addresses = await lookup(hostname, { all: true });
        if (addresses.length === 0) return "DNS returned no records";
        for (const addr of addresses) {
            if (addr.family === 4 && isPrivateIpv4(addr.address)) {
                return `resolves to private IPv4 ${addr.address}`;
            }
            if (addr.family === 6 && isPrivateIpv6(addr.address)) {
                return `resolves to private IPv6 ${addr.address}`;
            }
        }
        return null;
    } catch (err) {
        return `DNS lookup failed: ${err instanceof Error ? err.message : "unknown"}`;
    }
}

function sniffUrl(raw: string): URL | null {
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== "https:") return null;
        if (!parsed.hostname) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Validates a model-proposed external URL before trusting it for link
 * injection. Performs protocol + DNS + reachability checks with SSRF guards.
 *
 * Uses manual redirect following so we can re-validate the host at each hop —
 * fetch's automatic redirects would happily follow http://attacker.com into a
 * 302 to http://169.254.169.254/...
 */
export async function validateExternalUrl(raw: string): Promise<UrlValidationResult> {
    let current = sniffUrl(raw);
    if (!current) return { ok: false, reason: "URL must be HTTPS with a valid hostname" };

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        const hostErr = await assertPublicHost(current.hostname);
        if (hostErr) return { ok: false, reason: `SSRF guard: ${current.hostname} ${hostErr}` };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let response: Response;
        try {
            response = await fetch(current.toString(), {
                method: "HEAD",
                redirect: "manual",
                signal: controller.signal,
                headers: { "User-Agent": "PublicWorkspace-SEOValidator/1.0" },
            });
        } catch (err) {
            clearTimeout(timer);
            return {
                ok: false,
                reason: `HEAD request failed: ${err instanceof Error ? err.message : "unknown"}`,
            };
        }
        clearTimeout(timer);

        if (response.status >= 200 && response.status < 300) {
            return { ok: true, url: current.toString() };
        }

        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location");
            if (!location) return { ok: false, reason: `${response.status} with no Location header` };
            const next = sniffUrl(new URL(location, current).toString());
            if (!next) return { ok: false, reason: `redirect target is not HTTPS: ${location}` };
            current = next;
            continue;
        }

        return { ok: false, reason: `HEAD returned ${response.status}` };
    }

    return { ok: false, reason: `exceeded ${MAX_REDIRECTS} redirects` };
}
