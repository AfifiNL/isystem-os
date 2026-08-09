import { createHash } from "node:crypto";

const RAW_EMAIL_METADATA_KEYS = new Set([
    "email",
    "emailAddress",
    "email_address",
    "customerEmail",
    "customer_email",
    "subjectEmail",
    "subject_email",
]);

const DIRECT_IDENTIFIER_METADATA_KEYS = new Set([
    "firstName",
    "first_name",
    "lastName",
    "last_name",
    "fullName",
    "full_name",
    "name",
    "contact",
    "customer",
    "lead",
]);

const SAFE_METADATA_KEYS = new Set([
    "emailHash",
    "email_hash",
    "subscriberId",
    "subscriber_id",
    "contactId",
    "contact_id",
    "audienceId",
    "audience_id",
    "auditId",
    "audit_id",
    "requestId",
    "request_id",
    "bookingId",
    "booking_id",
    "reservationId",
    "reservation_id",
    "serviceId",
    "service_id",
    "templateKey",
    "template_key",
    "templateKind",
    "template_kind",
    "campaign",
    "campaignId",
    "campaign_id",
    "campaignName",
    "campaign_name",
    "sourceChannel",
    "source_channel",
    "sourceCampaign",
    "source_campaign",
    "sourceMedium",
    "source_medium",
    "utmSource",
    "utm_source",
    "utmMedium",
    "utm_medium",
    "utmCampaign",
    "utm_campaign",
    "selectedSlot",
    "selected_slot",
    "slot",
    "page",
    "path",
    "popupId",
    "popup_id",
    "showSlug",
    "show_slug",
    "episodeSlug",
    "episode_slug",
    "source",
    "locale",
    "consentState",
    "consent_state",
    "requiresConfirmation",
    "requires_confirmation",
    "antiAbuseDecision",
    "anti_abuse_decision",
    "antiAbuseRiskLevel",
    "anti_abuse_risk_level",
    "antiAbuseRiskScore",
    "anti_abuse_risk_score",
    "grantUnlockTool",
    "grant_unlock_tool",
    "requestType",
    "request_type",
    "combinedAnnualSavings",
    "combined_annual_savings",
    "tool",
    "placement",
    "label",
    "href",
    "episodeId",
    "episode_id",
    "milestone",
]);

function normalizeEmailForHash(email: string) {
    return email.trim().toLowerCase();
}

function isLikelyEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function sanitizePrimitive(value: unknown): string | number | boolean | null | undefined {
    if (value === null || value === undefined) return value;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string") {
        const normalized = value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
        return normalized ? normalized.slice(0, 500) : null;
    }
    return undefined;
}

export function hashEmailForAnalytics(email: string | null | undefined) {
    if (!email) return null;
    const normalized = normalizeEmailForHash(email);
    if (!isLikelyEmail(normalized)) return null;
    return createHash("sha256").update(normalized).digest("hex");
}

export function buildAntiAbuseAnalyticsSummary(antiAbuse: {
    decision?: unknown;
    riskLevel?: unknown;
    riskScore?: unknown;
}) {
    return {
        antiAbuseDecision: typeof antiAbuse.decision === "string" ? antiAbuse.decision : null,
        antiAbuseRiskLevel: typeof antiAbuse.riskLevel === "string" ? antiAbuse.riskLevel : null,
        antiAbuseRiskScore: typeof antiAbuse.riskScore === "number" && Number.isFinite(antiAbuse.riskScore)
            ? antiAbuse.riskScore
            : null,
    };
}

export function sanitizeAnalyticsMetadataForExport(metadata: Record<string, unknown> | null | undefined) {
    if (!metadata) return {};

    const sanitized: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (RAW_EMAIL_METADATA_KEYS.has(key)) {
            if (typeof value === "string") {
                const emailHash = hashEmailForAnalytics(value);
                if (emailHash) sanitized.emailHash = emailHash;
            }
            continue;
        }

        if (DIRECT_IDENTIFIER_METADATA_KEYS.has(key)) {
            continue;
        }

        if (!SAFE_METADATA_KEYS.has(key)) {
            continue;
        }

        const primitive = sanitizePrimitive(value);
        if (primitive !== undefined) {
            sanitized[key] = primitive;
        }
    }

    return sanitized;
}

export function pickSanitizedAnalyticsMetadataValue(
    metadata: Record<string, unknown> | null | undefined,
    keys: readonly string[],
) {
    const sanitized = sanitizeAnalyticsMetadataForExport(metadata);
    for (const key of keys) {
        const value = sanitized[key];
        if (value !== undefined && value !== null && value !== "") {
            return String(value);
        }
    }
    return "";
}
