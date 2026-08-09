import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/shared/lib/supabase/database.types";

export type AntiAbuseSurface = "booking_submission" | "contact_inquiry" | "newsletter_subscribe";
export type AntiAbuseDecision = "allow" | "review" | "block" | "throttle";
export type AntiAbuseRiskLevel = "low" | "medium" | "high" | "critical";

interface SurfaceConfig {
    minDwellMs: number;
    reviewThreshold: number;
    blockThreshold: number;
    throttleWindowMinutes: number;
    throttleMaxAttemptsPerIp: number;
    throttleMaxAttemptsPerEmail: number;
    cooldownMinutes: number;
    allowReviewDecision: boolean;
}

const SURFACE_CONFIG: Record<AntiAbuseSurface, SurfaceConfig> = {
    booking_submission: {
        minDwellMs: 8000,
        reviewThreshold: 45,
        blockThreshold: 90,
        throttleWindowMinutes: 20,
        throttleMaxAttemptsPerIp: 5,
        throttleMaxAttemptsPerEmail: 3,
        cooldownMinutes: 60,
        allowReviewDecision: true,
    },
    contact_inquiry: {
        minDwellMs: 4000,
        reviewThreshold: 55,
        blockThreshold: 75,
        throttleWindowMinutes: 15,
        throttleMaxAttemptsPerIp: 4,
        throttleMaxAttemptsPerEmail: 3,
        cooldownMinutes: 45,
        allowReviewDecision: false,
    },
    newsletter_subscribe: {
        minDwellMs: 2500,
        reviewThreshold: 60,
        blockThreshold: 80,
        throttleWindowMinutes: 15,
        throttleMaxAttemptsPerIp: 6,
        throttleMaxAttemptsPerEmail: 3,
        cooldownMinutes: 30,
        allowReviewDecision: false,
    },
};

export interface AntiAbuseRequestContext {
    ipAddress: string | null;
    userAgent: string | null;
}

export interface AntiAbuseAssessmentInput {
    surface: AntiAbuseSurface;
    sourcePath: string;
    workspaceId?: string | null;
    email?: string | null;
    honeypotValue?: string | null;
    formStartedAt?: string | null;
    contentSummary?: string | null;
    metadata?: Record<string, unknown>;
    context: AntiAbuseRequestContext;
}

export interface AntiAbuseAssessmentResult {
    decision: AntiAbuseDecision;
    riskLevel: AntiAbuseRiskLevel;
    riskScore: number;
    reasons: string[];
    dwellTimeMs: number | null;
    requestFingerprint: string | null;
    ipHash: string | null;
    emailHash: string | null;
    triggerCooldown: boolean;
}

type SupabaseAdminClient = SupabaseClient<Database>;

function hashValue(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() || null;
}

function inferRiskLevel(score: number): AntiAbuseRiskLevel {
    if (score >= 80) return "critical";
    if (score >= 55) return "high";
    if (score >= 30) return "medium";
    return "low";
}

function getDwellTimeMs(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const startedAt = new Date(value);
    if (Number.isNaN(startedAt.getTime())) {
        return null;
    }

    return Date.now() - startedAt.getTime();
}

function countUrls(contentSummary: string | null | undefined) {
    if (!contentSummary) {
        return 0;
    }

    const matches = contentSummary.match(/https?:\/\//gi);
    return matches?.length ?? 0;
}

function buildRequestFingerprint(params: {
    surface: AntiAbuseSurface;
    ipHash: string | null;
    emailHash: string | null;
    userAgent: string | null;
}) {
    const fingerprintSource = [params.surface, params.ipHash, params.emailHash, params.userAgent?.slice(0, 120) ?? null].filter(Boolean).join("|");
    return fingerprintSource ? hashValue(fingerprintSource) : null;
}

function extractSuspiciousReasons(input: AntiAbuseAssessmentInput) {
    const config = SURFACE_CONFIG[input.surface];
    const reasons: string[] = [];
    let score = 0;
    const dwellTimeMs = getDwellTimeMs(input.formStartedAt);
    const normalizedEmail = normalizeEmail(input.email);

    if (input.honeypotValue && input.honeypotValue.trim().length > 0) {
        reasons.push("honeypot_triggered");
        score = 100;
    }

    if (dwellTimeMs !== null && dwellTimeMs < config.minDwellMs) {
        reasons.push("dwell_time_too_short");
        score += 35;
    }

    if (!input.context.userAgent) {
        reasons.push("missing_user_agent");
        score += 10;
    }

    if (normalizedEmail && /(?:test|fake|spam|temp|bot)[^@]*@/i.test(normalizedEmail)) {
        reasons.push("suspicious_email_pattern");
        score += 25;
    }

    if (countUrls(input.contentSummary) > 1) {
        reasons.push("multiple_links_detected");
        score += 20;
    }

    if (input.contentSummary && /<script|<iframe|viagra|casino|crypto/gi.test(input.contentSummary)) {
        reasons.push("spam_keyword_pattern");
        score += 30;
    }

    return { reasons, score, dwellTimeMs, normalizedEmail };
}

async function lookupActiveRule(params: {
    supabaseAdmin: SupabaseAdminClient;
    workspaceId?: string | null;
    surface: AntiAbuseSurface;
    subjectType: "ip" | "email" | "fingerprint";
    subjectValueHash: string | null;
}) {
    if (!params.subjectValueHash) {
        return null;
    }

    let query = params.supabaseAdmin
        .from("anti_abuse_rules")
        .select("id, action, expires_at, metadata")
        .eq("surface", params.surface)
        .eq("subject_type", params.subjectType)
        .eq("subject_value_hash", params.subjectValueHash)
        .order("created_at", { ascending: false })
        .limit(1);
    query = params.workspaceId
        ? query.eq("workspace_id", params.workspaceId)
        : query.is("workspace_id", null);

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
        return null;
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
        return null;
    }

    return data;
}

async function countRecentEvents(params: {
    supabaseAdmin: SupabaseAdminClient;
    workspaceId?: string | null;
    surface: AntiAbuseSurface;
    column: "ip_hash" | "email_hash" | "request_fingerprint";
    value: string | null;
    since: string;
    globalAcrossWorkspaces?: boolean;
}) {
    if (!params.value) {
        return 0;
    }

    let query = params.supabaseAdmin
        .from("anti_abuse_events")
        .select("id", { count: "exact", head: true })
        .eq("surface", params.surface)
        .eq(params.column, params.value)
        .gte("created_at", params.since);
    if (!params.globalAcrossWorkspaces) {
        query = params.workspaceId
            ? query.eq("workspace_id", params.workspaceId)
            : query.is("workspace_id", null);
    }

    const { count } = await query;

    return count ?? 0;
}

export function extractAntiAbuseRequestContext(headers: Headers, trustedIpAddress?: string | null): AntiAbuseRequestContext {
    // In production, proxy-derived headers are trusted only when the deployer
    // explicitly names the header that the edge proxy overwrites. Falling
    // back to arbitrary client-supplied X-Forwarded-For values lets an
    // attacker rotate spoofed addresses and evade throttles.
    const configuredHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
    const configuredValue = configuredHeader ? headers.get(configuredHeader)?.trim() : null;
    const legacyDevValue = process.env.NODE_ENV === "production"
        ? null
        : headers.get("x-real-ip")?.trim()
            || headers.get("cf-connecting-ip")?.trim()
            || headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
            || headers.get("fly-client-ip")?.trim()
            || null;
    const ipAddress = trustedIpAddress?.trim() || configuredValue || legacyDevValue || null;

    return {
        ipAddress,
        userAgent: headers.get("user-agent")?.trim() || null,
    };
}

export async function assessAntiAbuseSubmission(params: {
    supabaseAdmin: SupabaseAdminClient;
    input: AntiAbuseAssessmentInput;
}) : Promise<AntiAbuseAssessmentResult> {
    const config = SURFACE_CONFIG[params.input.surface];
    const initial = extractSuspiciousReasons(params.input);
    const ipHash = hashValue(params.input.context.ipAddress);
    const emailHash = hashValue(initial.normalizedEmail);
    const requestFingerprint = buildRequestFingerprint({
        surface: params.input.surface,
        ipHash,
        emailHash,
        userAgent: params.input.context.userAgent,
    });
    const since = new Date(Date.now() - config.throttleWindowMinutes * 60_000).toISOString();

    const [ipRule, emailRule, fingerprintRule, recentIpAttempts, recentGlobalIpAttempts, recentEmailAttempts, recentFingerprintAttempts] = await Promise.all([
        lookupActiveRule({ supabaseAdmin: params.supabaseAdmin, workspaceId: params.input.workspaceId, surface: params.input.surface, subjectType: "ip", subjectValueHash: ipHash }),
        lookupActiveRule({ supabaseAdmin: params.supabaseAdmin, workspaceId: params.input.workspaceId, surface: params.input.surface, subjectType: "email", subjectValueHash: emailHash }),
        lookupActiveRule({ supabaseAdmin: params.supabaseAdmin, workspaceId: params.input.workspaceId, surface: params.input.surface, subjectType: "fingerprint", subjectValueHash: requestFingerprint }),
        countRecentEvents({ supabaseAdmin: params.supabaseAdmin, workspaceId: params.input.workspaceId, surface: params.input.surface, column: "ip_hash", value: ipHash, since }),
        countRecentEvents({ supabaseAdmin: params.supabaseAdmin, surface: params.input.surface, column: "ip_hash", value: ipHash, since, globalAcrossWorkspaces: true }),
        countRecentEvents({ supabaseAdmin: params.supabaseAdmin, workspaceId: params.input.workspaceId, surface: params.input.surface, column: "email_hash", value: emailHash, since }),
        countRecentEvents({ supabaseAdmin: params.supabaseAdmin, workspaceId: params.input.workspaceId, surface: params.input.surface, column: "request_fingerprint", value: requestFingerprint, since }),
    ]);

    let decision: AntiAbuseDecision = "allow";
    let riskScore = initial.score;
    const reasons = [...initial.reasons];

    if (recentIpAttempts >= config.throttleMaxAttemptsPerIp
        || recentGlobalIpAttempts >= config.throttleMaxAttemptsPerIp * 2
        || recentEmailAttempts >= config.throttleMaxAttemptsPerEmail) {
        reasons.push("rate_limit_threshold_reached");
        riskScore += 40;
        decision = "throttle";
    }

    if (recentFingerprintAttempts >= config.throttleMaxAttemptsPerIp) {
        reasons.push("fingerprint_repeat_pattern");
        riskScore += 25;
    }

    for (const rule of [ipRule, emailRule, fingerprintRule]) {
        if (!rule) continue;
        reasons.push(`active_${rule.action}_rule`);
        if (rule.action === "blacklist") {
            riskScore = 100;
            decision = "block";
        } else if (rule.action === "cooldown" && decision !== "block") {
            riskScore = Math.max(riskScore, 85);
            decision = "throttle";
        } else if (rule.action === "review" && config.allowReviewDecision && decision === "allow") {
            riskScore = Math.max(riskScore, config.reviewThreshold);
            decision = "review";
        }
    }

    if (reasons.includes("honeypot_triggered")) {
        decision = config.allowReviewDecision ? "block" : "block";
    } else if (decision === "allow") {
        if (config.allowReviewDecision && riskScore >= config.reviewThreshold) {
            decision = "review";
        }

        if (riskScore >= config.blockThreshold) {
            decision = config.allowReviewDecision ? "review" : "block";
        }
    }

    const riskLevel = inferRiskLevel(riskScore);
    const triggerCooldown = decision === "throttle" || reasons.includes("honeypot_triggered") || (decision === "review" && riskScore >= 80);

    return {
        decision,
        riskLevel,
        riskScore: Math.min(100, riskScore),
        reasons,
        dwellTimeMs: initial.dwellTimeMs,
        requestFingerprint,
        ipHash,
        emailHash,
        triggerCooldown,
    };
}

export async function persistAntiAbuseEvent(params: {
    supabaseAdmin: SupabaseAdminClient;
    assessment: AntiAbuseAssessmentResult;
    input: AntiAbuseAssessmentInput;
    bookingReservationId?: string | null;
    portalClientId?: string | null;
}) {
    const payload: TablesInsert<"anti_abuse_events"> = {
        workspace_id: params.input.workspaceId ?? null,
        surface: params.input.surface,
        source_path: params.input.sourcePath,
        decision: params.assessment.decision,
        risk_level: params.assessment.riskLevel,
        risk_score: params.assessment.riskScore,
        reason_codes: params.assessment.reasons as unknown as Database["public"]["Tables"]["anti_abuse_events"]["Insert"]["reason_codes"],
        request_fingerprint: params.assessment.requestFingerprint,
        ip_hash: params.assessment.ipHash,
        email_hash: params.assessment.emailHash,
        user_agent: params.input.context.userAgent,
        booking_reservation_id: params.bookingReservationId ?? null,
        portal_client_id: params.portalClientId ?? null,
        metadata: {
            dwellTimeMs: params.assessment.dwellTimeMs,
            ...params.input.metadata,
        },
    };

    const { error } = await params.supabaseAdmin.from("anti_abuse_events").insert(payload).select("id").single();

    console.info("[anti-abuse]", JSON.stringify({
        surface: params.input.surface,
        sourcePath: params.input.sourcePath,
        workspaceId: params.input.workspaceId ?? null,
        decision: params.assessment.decision,
        riskLevel: params.assessment.riskLevel,
        riskScore: params.assessment.riskScore,
        reasons: params.assessment.reasons,
        bookingReservationId: params.bookingReservationId ?? null,
        portalClientId: params.portalClientId ?? null,
    }));

    if (error) {
        console.error("[anti-abuse] Failed to persist anti-abuse event:", error.message);
    }
}

export async function applyAutomaticCooldownRule(params: {
    supabaseAdmin: SupabaseAdminClient;
    assessment: AntiAbuseAssessmentResult;
    input: AntiAbuseAssessmentInput;
}) {
    if (!params.assessment.triggerCooldown) {
        return;
    }

    const config = SURFACE_CONFIG[params.input.surface];
    const expiresAt = new Date(Date.now() + config.cooldownMinutes * 60_000).toISOString();
    const rulePayloads: Array<TablesInsert<"anti_abuse_rules">> = [];

    if (params.assessment.ipHash) {
        rulePayloads.push({
            workspace_id: params.input.workspaceId ?? null,
            surface: params.input.surface,
            subject_type: "ip",
            subject_value_hash: params.assessment.ipHash,
            action: "cooldown",
            reason: `Automatic cooldown after ${params.assessment.decision} decision.`,
            expires_at: expiresAt,
            metadata: { riskScore: params.assessment.riskScore, reasons: params.assessment.reasons },
        });
    }

    if (params.assessment.emailHash) {
        rulePayloads.push({
            workspace_id: params.input.workspaceId ?? null,
            surface: params.input.surface,
            subject_type: "email",
            subject_value_hash: params.assessment.emailHash,
            action: "cooldown",
            reason: `Automatic cooldown after ${params.assessment.decision} decision.`,
            expires_at: expiresAt,
            metadata: { riskScore: params.assessment.riskScore, reasons: params.assessment.reasons },
        });
    }

    if (params.assessment.requestFingerprint) {
        rulePayloads.push({
            workspace_id: params.input.workspaceId ?? null,
            surface: params.input.surface,
            subject_type: "fingerprint",
            subject_value_hash: params.assessment.requestFingerprint,
            action: params.assessment.riskScore >= 95 ? "blacklist" : "cooldown",
            reason: `Automatic enforcement after ${params.assessment.decision} decision.`,
            expires_at: params.assessment.riskScore >= 95 ? null : expiresAt,
            metadata: { riskScore: params.assessment.riskScore, reasons: params.assessment.reasons },
        });
    }

    if (rulePayloads.length === 0) {
        return;
    }

    const { error } = await params.supabaseAdmin.from("anti_abuse_rules").insert(rulePayloads);
    if (error) {
        console.error("[anti-abuse] Failed to persist automatic cooldown rule:", error.message);
    }
}

export function buildAntiAbuseGenericSuccessMessage(surface: AntiAbuseSurface) {
    if (surface === "newsletter_subscribe") {
        return "You're in! Welcome to the Systems Brief.";
    }

    return "Your request has been received.";
}
