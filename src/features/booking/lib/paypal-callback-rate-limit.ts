import type { NextRequest } from "next/server";

import { createAdminClient } from "@/shared/lib/supabase/admin";
import { extractAntiAbuseRequestContext } from "@/shared/lib/anti-abuse/server";

const LOCAL_WINDOW_MS = 60_000;
const LOCAL_LIMIT = 60;
const GLOBAL_LIMIT = 300;
const localBuckets = new Map<string, { windowStartedAt: number; count: number }>();

type AdminClient = ReturnType<typeof createAdminClient>;

function requestFingerprint(req: NextRequest): string {
    // NextRequest.ip is populated by the trusted edge/runtime adapter. Never
    // derive a callback bucket from client-controlled forwarding headers.
    const trustedIp = (req as NextRequest & { ip?: string }).ip?.trim();
    if (trustedIp && trustedIp.length <= 128) return trustedIp;
    return extractAntiAbuseRequestContext(req.headers).ipAddress ?? "unknown";
}

function allowLocalCallbackRequest(key: string, limit: number): boolean {
    const now = Date.now();
    const current = localBuckets.get(key);
    if (!current || now - current.windowStartedAt >= LOCAL_WINDOW_MS) {
        localBuckets.set(key, { windowStartedAt: now, count: 1 });
        for (const [bucketKey, bucket] of localBuckets) {
            if (now - bucket.windowStartedAt >= LOCAL_WINDOW_MS) localBuckets.delete(bucketKey);
        }
        return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
}

/**
 * Rate-limit unauthenticated PayPal return/cancel callbacks before any
 * service-role payment lookup. The migration-backed bucket is shared across
 * application instances; the local bucket remains a safe fallback during a
 * rolling deploy before the iSystem migration has reached every database.
 */
export async function allowPayPalCallbackRequest(params: {
    req: NextRequest;
    supabase: AdminClient;
    kind: "return" | "cancel";
}): Promise<boolean> {
    const fingerprint = requestFingerprint(params.req);
    const hasTrustedFingerprint = fingerprint !== "unknown";
    if (!allowLocalCallbackRequest(`paypal:${params.kind}:${fingerprint}`, hasTrustedFingerprint ? LOCAL_LIMIT : GLOBAL_LIMIT)) return false;

    const globalResult = await params.supabase.rpc("allow_payment_webhook_request" as never, {
        p_bucket_key: `paypal:${params.kind}:global`,
        p_limit: GLOBAL_LIMIT,
        p_window_seconds: LOCAL_WINDOW_MS / 1000,
    } as never);

    if (globalResult.error) {
        console.warn(
            `[paypal] ${params.kind} callback global rate limiter unavailable; using local guard`,
            globalResult.error.message,
        );
        return true;
    }
    if (!hasTrustedFingerprint || globalResult.data !== true) return globalResult.data === true;

    const clientResult = await params.supabase.rpc("allow_payment_webhook_request" as never, {
        p_bucket_key: `paypal:${params.kind}:${fingerprint}`,
        p_limit: LOCAL_LIMIT,
        p_window_seconds: LOCAL_WINDOW_MS / 1000,
    } as never);
    if (clientResult.error) {
        console.warn(`[paypal] ${params.kind} callback client rate limiter unavailable; using global guard`, clientResult.error.message);
        return true;
    }
    return clientResult.data === true;
}
