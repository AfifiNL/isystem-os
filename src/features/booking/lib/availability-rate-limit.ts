import { createHash } from "node:crypto";

import { extractAntiAbuseRequestContext } from "@/shared/lib/anti-abuse/server";
import { createAdminClient } from "@/shared/lib/supabase/admin";

type AvailabilityAdminClient = ReturnType<typeof createAdminClient>;

const WINDOW_MS = 60_000;
const TRUSTED_LIMIT = 60;
const UNKNOWN_LIMIT = 120;
const localBuckets = new Map<string, { windowStartedAt: number; count: number }>();

function hashFingerprint(value: string): string {
    return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function requestFingerprint(requestHeaders: Headers): { key: string; trusted: boolean } {
    const context = extractAntiAbuseRequestContext(requestHeaders);
    if (context.ipAddress) {
        return {
            key: hashFingerprint(`${context.ipAddress}|${context.userAgent ?? ""}`),
            trusted: true,
        };
    }
    // Do not use user-agent alone as a trusted identity; it is easy to spoof.
    return { key: "unknown", trusted: false };
}

function allowLocal(key: string, limit: number): boolean {
    const now = Date.now();
    const current = localBuckets.get(key);
    if (!current || now - current.windowStartedAt >= WINDOW_MS) {
        localBuckets.set(key, { windowStartedAt: now, count: 1 });
        for (const [bucketKey, bucket] of localBuckets) {
            if (now - bucket.windowStartedAt >= WINDOW_MS) localBuckets.delete(bucketKey);
        }
        return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
}

/**
 * Gate public availability previews before the Google FreeBusy call. A
 * trusted proxy address gets a cross-instance database bucket; deployments
 * that do not expose a peer address use only a bounded per-worker fallback so
 * all unknown callers cannot exhaust a shared workspace bucket.
 */
export async function allowBookingAvailabilityRequest(params: {
    supabase: AvailabilityAdminClient;
    workspaceId: string;
    headers: Headers;
}): Promise<boolean> {
    const fingerprint = requestFingerprint(params.headers);
    const localKey = `booking-availability:${params.workspaceId}:${fingerprint.key}`;
    if (!allowLocal(localKey, fingerprint.trusted ? TRUSTED_LIMIT : UNKNOWN_LIMIT)) return false;
    if (!fingerprint.trusted) return true;

    const result = await params.supabase.rpc("allow_booking_availability_request" as never, {
        p_bucket_key: `${params.workspaceId}:${fingerprint.key}`,
        p_limit: TRUSTED_LIMIT,
        p_window_seconds: WINDOW_MS / 1000,
    } as never);
    if (result.error) {
        console.warn("[booking] availability rate limiter unavailable; using local guard", result.error.message);
        return true;
    }
    return result.data === true;
}
