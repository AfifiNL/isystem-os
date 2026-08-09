import { createClient as createServiceClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/lib/supabase/database.types";
import {
    computeImageCost,
    computeMusicCost,
    computeSpeechTranscriptionCost,
    computeTokenCost,
    computeTtsCost,
    computeVideoCost,
    CostBreakdown,
    MIN_BALANCE_FLOOR_MILLICENTS,
} from "@/shared/lib/ai/pricing";

// ─── Service-role client (bypasses RLS for metering writes) ─────────────────

let cachedClient: SupabaseClient<Database> | null = null;

function isProductionLikeEnvironment(): boolean {
    if (process.env.NODE_ENV === "production") return true;
    if (process.env.AI_METERING_FAIL_CLOSED === "true") return true;
    if (process.env.VERCEL_ENV === "production") return true;
    if (process.env.PAYPAL_ENV === "live") return true;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) return false;
    try {
        const { hostname } = new URL(siteUrl);
        return hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.endsWith(".local");
    } catch {
        return false;
    }
}

function getServiceClient(): SupabaseClient<Database> | null {
    if (cachedClient) return cachedClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error(
            "[ai-metering] CRITICAL: SUPABASE_SERVICE_ROLE_KEY missing. Balance gate is failing open (free AI). Fix env ASAP.",
        );
        return null;
    }

    cachedClient = createServiceClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return cachedClient;
}

// ─── Usage input (discriminated union per billable dimension) ────────────────

export type UsageInput =
    | { unitType: "tokens"; model: string; tokensIn: number; tokensOut: number }
    | { unitType: "image"; model: string; imageCount: number }
    | { unitType: "tts_char"; model: string; charCount: number }
    | { unitType: "music_seconds"; model: string; durationSeconds: number }
    | { unitType: "speech_seconds"; model: string; durationSeconds: number }
    | { unitType: "video_seconds"; model: string; durationSeconds: number };

export interface MeterParams {
    workspaceId: string;
    profileId: string | null;
    route: string;
    usage: UsageInput;
    status?: "succeeded" | "failed" | "partial";
    metadata?: Record<string, unknown>;
}

export interface MeterResult {
    chargedMillicents: number;
    baseCostMillicents: number;
    platformFeeMillicents: number;
}

export function computeUsageBreakdown(usage: UsageInput): CostBreakdown | null {
    switch (usage.unitType) {
        case "tokens":
            return computeTokenCost(usage.model, usage.tokensIn, usage.tokensOut);
        case "image":
            return computeImageCost(usage.model, usage.imageCount);
        case "tts_char":
            return computeTtsCost(usage.model, usage.charCount);
        case "music_seconds":
            return computeMusicCost(usage.model, usage.durationSeconds);
        case "speech_seconds":
            return computeSpeechTranscriptionCost(usage.model, usage.durationSeconds);
        case "video_seconds":
            return computeVideoCost(usage.model, usage.durationSeconds);
    }
}

function resolveCanonicalUsage(usage: UsageInput, metadata?: Record<string, unknown>): UsageInput {
    const aiMetadata = metadata?.ai;
    if (!aiMetadata || typeof aiMetadata !== "object" || Array.isArray(aiMetadata)) {
        return usage;
    }

    const modelId = (aiMetadata as { model_id?: unknown }).model_id;
    if (typeof modelId !== "string" || modelId.trim().length === 0) {
        return usage;
    }

    return { ...usage, model: modelId.trim() } as UsageInput;
}

/**
 * Records one AI call's cost + platform fee against the workspace balance.
 * Never throws; metering failures are logged but do not bubble to the user
 * (we've already paid Google, and the admin has a reconciliation path).
 */
export async function meterAndCharge(params: MeterParams): Promise<MeterResult | null> {
    const usage = resolveCanonicalUsage(params.usage, params.metadata);
    const breakdown = computeUsageBreakdown(usage);
    if (!breakdown) {
        console.warn(
            `[ai-metering] No pricing for model=${usage.model} unit=${usage.unitType} — call not metered.`,
        );
        return null;
    }

    const supabase = getServiceClient();
    if (!supabase) return null;

    const tokensIn = usage.unitType === "tokens" ? usage.tokensIn : null;
    const tokensOut = usage.unitType === "tokens" ? usage.tokensOut : null;
    const imageCount = usage.unitType === "image" ? usage.imageCount : null;
    const charCount = usage.unitType === "tts_char" ? usage.charCount : null;
    const durationSeconds = usage.unitType === "music_seconds" || usage.unitType === "speech_seconds" || usage.unitType === "video_seconds"
        ? usage.durationSeconds
        : null;

    // RPC names are created by migration 20260421120000_ai_credit_system.sql.
    // Cast until `supabase gen types` is re-run against the new schema.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("charge_ai_usage", {
        p_workspace_id: params.workspaceId,
        p_profile_id: params.profileId,
        p_route: params.route,
        p_model: usage.model,
        p_unit_type: usage.unitType,
        p_tokens_in: tokensIn,
        p_tokens_out: tokensOut,
        p_image_count: imageCount,
        p_char_count: charCount,
        p_duration_seconds: durationSeconds,
        p_base_cost_millicents: breakdown.baseCostMillicents,
        p_platform_fee_millicents: breakdown.platformFeeMillicents,
        p_status: params.status ?? "succeeded",
        p_metadata: params.metadata ?? {},
    });

    if (error) {
        console.error("[ai-metering] charge_ai_usage RPC failed:", error.message, {
            workspaceId: params.workspaceId,
            route: params.route,
            model: usage.model,
        });
        return null;
    }

    return {
        chargedMillicents: breakdown.chargedMillicents,
        baseCostMillicents: breakdown.baseCostMillicents,
        platformFeeMillicents: breakdown.platformFeeMillicents,
    };
}

// ─── Balance gate (pre-flight check before calling Google) ───────────────────

function formatBalanceEur(millicents: number): string {
    return `€${(millicents / 10_000).toFixed(2)}`;
}

export class InsufficientAiBalanceError extends Error {
    constructor(public balanceMillicents: number) {
        // Explicit disambiguation: the AI generation balance is a monetary
        // budget (€) for Gemini calls and is NOT the same as the integer
        // "compute credits" shown on the workspace (those are for the video
        // queue). Users kept hitting this thinking their compute credits
        // should cover AI draft generation.
        super(
            `AI generation balance exhausted (current: ${formatBalanceEur(balanceMillicents)}). ` +
            `This is a monetary budget for Gemini AI features and is separate from the workspace's ` +
            `video queue credits. Ask an admin to top up the AI balance to continue.`,
        );
        this.name = "InsufficientAiBalanceError";
    }
}

/**
 * Throws InsufficientAiBalanceError if the workspace balance is below the
 * configured floor. Called at the start of every AI route before Google is hit.
 */
export async function assertSufficientAiBalance(workspaceId: string): Promise<void> {
    const supabase = getServiceClient();
    if (!supabase) {
        if (isProductionLikeEnvironment()) {
            console.error("[ai-metering] Service role missing in production-like environment. Failing closed.");
            throw new InsufficientAiBalanceError(0);
        }
        // Fail open: if service role is missing, don't block the user —
        // the admin will see the metering-off warning in logs.
        return;
    }

    // ai_balance_millicents column added by migration 20260421120000.
    // Select string cast until types are regenerated.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("workspaces") as any)
        .select("ai_balance_millicents")
        .eq("id", workspaceId)
        .single() as { data: { ai_balance_millicents: number } | null; error: { message: string } | null };

    if (error || !data) {
        console.error("[ai-metering] Balance lookup failed:", error?.message);
        if (isProductionLikeEnvironment()) {
            throw new InsufficientAiBalanceError(0);
        }
        return; // fail open on read error
    }

    if ((data.ai_balance_millicents ?? 0) < MIN_BALANCE_FLOOR_MILLICENTS) {
        throw new InsufficientAiBalanceError(data.ai_balance_millicents ?? 0);
    }
}

// ─── DB-backed rate limiter (replaces module-level Map) ─────────────────────

export interface RateLimitConfig {
    maxPerWindow: number;
    windowSeconds?: number; // default 60
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

/**
 * Postgres-backed sliding window rate limiter. Works correctly across multiple
 * Node processes and across VPS nodes — no shared memory required.
 */
export async function checkAiRateLimitPg(
    workspaceId: string,
    route: string,
    config: RateLimitConfig,
): Promise<RateLimitResult> {
    const supabase = getServiceClient();
    if (!supabase) {
        if (isProductionLikeEnvironment()) {
            return { allowed: false, remaining: 0, retryAfterSeconds: config.windowSeconds ?? 60 };
        }
        // Fail open when service role is missing.
        return { allowed: true, remaining: config.maxPerWindow, retryAfterSeconds: 0 };
    }

    const windowSeconds = config.windowSeconds ?? 60;

    // Atomic check-and-record: the RPC takes a per-(workspace, route) advisory
    // lock, re-reads the count inside the lock, and only inserts a new log row
    // when still under the cap. Eliminates the race where two concurrent
    // callers could both pass the earlier check-then-insert pattern.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("check_and_record_ai_request", {
        p_workspace_id: workspaceId,
        p_route: route,
        p_max_per_window: config.maxPerWindow,
        p_window_secs: windowSeconds,
    }) as {
        data:
            | Array<{ allowed: boolean; used: number; remaining: number; retry_after_secs: number }>
            | null;
        error: { message: string } | null;
    };

    if (error) {
        // Fall back to the legacy non-atomic pattern so traffic isn't blocked
        // if the new RPC hasn't been applied yet.
        if (/function .* does not exist/i.test(error.message)) {
            return legacyCheckAiRateLimit(workspaceId, route, config, windowSeconds);
        }
        console.error("[ai-metering] Rate limit RPC failed:", error.message);
        if (isProductionLikeEnvironment()) {
            return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
        }
        return { allowed: true, remaining: config.maxPerWindow, retryAfterSeconds: 0 };
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
        if (isProductionLikeEnvironment()) {
            return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
        }
        return { allowed: true, remaining: config.maxPerWindow, retryAfterSeconds: 0 };
    }

    return {
        allowed: Boolean(row.allowed),
        remaining: Math.max(0, row.remaining ?? 0),
        retryAfterSeconds: row.retry_after_secs ?? (row.allowed ? 0 : windowSeconds),
    };
}

async function legacyCheckAiRateLimit(
    workspaceId: string,
    route: string,
    config: RateLimitConfig,
    windowSeconds: number,
): Promise<RateLimitResult> {
    const supabase = getServiceClient();
    if (!supabase) {
        if (isProductionLikeEnvironment()) {
            return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
        }
        return { allowed: true, remaining: config.maxPerWindow, retryAfterSeconds: 0 };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: count, error: countError } = await (supabase.rpc as any)("count_recent_ai_requests", {
        p_workspace_id: workspaceId,
        p_route: route,
        p_window_secs: windowSeconds,
    }) as { data: number | null; error: { message: string } | null };
    if (countError) {
        console.error("[ai-metering] Rate limit count failed:", countError.message);
        if (isProductionLikeEnvironment()) {
            return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
        }
        return { allowed: true, remaining: config.maxPerWindow, retryAfterSeconds: 0 };
    }
    const used = count ?? 0;
    if (used >= config.maxPerWindow) {
        return { allowed: false, remaining: 0, retryAfterSeconds: windowSeconds };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase.rpc as any)("record_ai_request", {
        p_workspace_id: workspaceId,
        p_route: route,
    });
    if (insertError) {
        console.error("[ai-metering] Rate limit record failed:", insertError.message);
    }
    return {
        allowed: true,
        remaining: config.maxPerWindow - used - 1,
        retryAfterSeconds: 0,
    };
}
