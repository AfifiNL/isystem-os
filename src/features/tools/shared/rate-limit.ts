import { createHash, randomBytes } from "node:crypto";
import type { ToolSlug } from "./types";
import { getToolsServiceClient } from "./service-client";

/**
 * Per-IP+tool sliding-window quota using `tool_rate_limits`. Buckets are keyed
 * by sha256(ip|tool|UTC-day) and the underlying RPC handles atomic increment
 * inside Postgres so two near-simultaneous requests can't race past the cap.
 */

export interface RateLimitConfig {
    /** Max requests per IP per 24h window. */
    daily: number;
    /** Max requests per IP per 10-minute burst window. */
    burst: number;
}

// Hard rule: 1 use per tool per IP-fingerprint per UTC day. Bots that hammer
// the surface are blocked immediately; honest users who genuinely need a
// re-run can come back tomorrow or email Hossam. Burst window stays at 1 so
// the same fingerprint can't squeeze multiple submissions inside one 10-min
// window even if the daily counter were to reset (it doesn't, but defence in
// depth).
const DAILY_FREE_TIER = { daily: 1, burst: 1 } as const;

const DEFAULT_LIMITS: Record<ToolSlug, RateLimitConfig> = {
    "automation-scanner": DAILY_FREE_TIER,
    "automation-roi-calculator": DAILY_FREE_TIER,
    "ai-stack-recommender": DAILY_FREE_TIER,
    "ai-visibility-checker": DAILY_FREE_TIER,
    "support-automation-readiness": DAILY_FREE_TIER,
    "review-response-generator": DAILY_FREE_TIER,
    "gdpr-cookie-scanner": DAILY_FREE_TIER,
    "conversion-audit": DAILY_FREE_TIER,
    "nl-zzp-agreement-generator": { daily: 25, burst: 5 },
};

function hashValue(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function ipFingerprint(ip: string | null, ua: string | null): string {
    // sha256(ip + daily-rotating salt). Anonymous bots usually fall on either
    // missing IP (CF strips for some workers) or shared NAT. We add a tiny UA
    // hash suffix so single-IP shared networks don't all share a bucket.
    const safeIp = ip ?? "unknown";
    const day = new Date().toISOString().slice(0, 10);
    const uaSuffix = ua ? hashValue(ua).slice(0, 8) : "noua";
    return hashValue(`${safeIp}|${uaSuffix}|${day}`);
}

export function getIpHash(ip: string | null, ua: string | null): string {
    return ipFingerprint(ip, ua);
}

export interface RateLimitRequestContext {
    ipHash: string | null;
    /** Tool slug. */
    tool: ToolSlug;
}

export interface RateLimitDecision {
    allow: boolean;
    /** Count for the limited bucket *after* this request would be counted. */
    count: number;
    /** Bucket window that triggered the rejection (if any). */
    window?: "daily" | "burst";
    /** Retry-after seconds if denied. */
    retryAfterSeconds?: number;
}

function bucketKey(ipHash: string | null, tool: ToolSlug, window: "daily" | "burst", windowStartIso: string): string {
    return `${window}:${tool}:${ipHash ?? "anon"}:${windowStartIso}`;
}

function dailyWindowStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function burstWindowStart(): Date {
    const now = Date.now();
    const ten = 10 * 60 * 1000;
    return new Date(Math.floor(now / ten) * ten);
}

/**
 * Atomic increment + check. Calls `tool_rate_limit_increment` RPC defined in
 * the isystem-public-tools migration. Fails OPEN if the service client isn't
 * configured — we'd rather serve users than block them on a config error,
 * but the route logs loudly so this surfaces in monitoring.
 */
export async function checkToolRateLimit(ctx: RateLimitRequestContext): Promise<RateLimitDecision> {
    const limits = DEFAULT_LIMITS[ctx.tool];
    const supabase = getToolsServiceClient();
    if (!supabase) {
        return { allow: true, count: 0 };
    }

    const dailyStart = dailyWindowStart();
    const burstStart = burstWindowStart();

    const dailyBucket = bucketKey(ctx.ipHash, ctx.tool, "daily", dailyStart.toISOString());
    const burstBucket = bucketKey(ctx.ipHash, ctx.tool, "burst", burstStart.toISOString());

    const [dailyRes, burstRes] = await Promise.all([
        supabase.rpc("tool_rate_limit_increment", { p_bucket: dailyBucket, p_window_start: dailyStart.toISOString() }),
        supabase.rpc("tool_rate_limit_increment", { p_bucket: burstBucket, p_window_start: burstStart.toISOString() }),
    ]);

    if (dailyRes.error || burstRes.error) {
        console.error("[tools.rate-limit] rpc error", dailyRes.error?.message ?? burstRes.error?.message);
        return { allow: true, count: 0 };
    }

    const dailyCount = dailyRes.data ?? 0;
    const burstCount = burstRes.data ?? 0;

    if (burstCount > limits.burst) {
        return {
            allow: false,
            count: burstCount,
            window: "burst",
            retryAfterSeconds: Math.max(60, Math.floor((burstStart.getTime() + 10 * 60 * 1000 - Date.now()) / 1000)),
        };
    }

    if (dailyCount > limits.daily) {
        return {
            allow: false,
            count: dailyCount,
            window: "daily",
            retryAfterSeconds: Math.max(
                60,
                Math.floor((dailyStart.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / 1000),
            ),
        };
    }

    return { allow: true, count: dailyCount };
}

export function generateShareToken(): string {
    return randomBytes(12).toString("base64url");
}

/**
 * Builds the human-facing rate-limit message. Calls out the daily cap
 * explicitly so users understand it isn't a transient hiccup — the design is
 * "one use per tool per day", honest and intentional.
 */
export function formatRateLimitError(decision: RateLimitDecision, tool: ToolSlug): string {
    if (decision.allow) return "";
    const retrySeconds = decision.retryAfterSeconds ?? 3600;
    const hours = Math.max(1, Math.round(retrySeconds / 3600));
    const limits = DEFAULT_LIMITS[tool];
    if (limits.daily === 1) {
        return hours <= 1
            ? "This tool is one use per day. Please come back in about an hour."
            : `This tool is one use per day. Please come back in about ${hours} hours.`;
    }
    return `Rate limit reached. Please try again in ${hours <= 1 ? "about an hour" : `about ${hours} hours`}.`;
}
